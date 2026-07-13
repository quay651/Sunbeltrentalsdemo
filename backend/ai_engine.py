"""
AI Diagnosis Engine
====================
Wraps the Anthropic API to provide:
1. Electrical diagnosis reasoning (relays, fuses, components, wiring faults)
2. Dynamic web search for Sunbelt Rentals equipment manuals / service docs
3. Vision analysis of uploaded photos (equipment, wiring, components, diagrams)

IMPORTANT CALIBRATION NOTE (read before deploying):
This module gives the AI web_search and prompts it to ground claims in what
it finds. It does NOT have a verified, indexed database of actual Sunbelt
service manuals -- those aren't publicly available in bulk. The system
prompt instructs Claude to be explicit about when it's inferring from
general electrical/mechanical principles vs. citing something it actually
found. Test this against real equipment before trusting it in the field,
and always cross-check AI suggestions against lockout/tagout procedures
and qualified electrician judgment for anything involving live voltage.
"""
import os
import json
from datetime import datetime

import anthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-8")
CLAUDE_VISION_MODEL = os.environ.get("CLAUDE_VISION_MODEL", "claude-opus-4-8")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

DIAGNOSIS_SYSTEM_PROMPT = """You are an electrical diagnostic assistant built for Sunbelt Rentals \
field technicians. Your job is to help technicians troubleshoot electrical issues on rental \
equipment: blown fuses, failed relays, dead components, wiring faults, control circuit issues, \
and related electrical problems.

HOW TO RESPOND:
1. Ask only for the specific missing detail you need to narrow the diagnosis (equipment make/model, \
symptom, when it started, anything already tried) -- don't interrogate, get to useful guidance fast.
2. Walk through a clear diagnostic path: most-likely-cause first, with the specific test to confirm \
it (e.g. "check continuity across relay terminals 3 and 5 with the multimeter set to ohms").
3. If you use web search and find equipment-specific information (a manual, spec sheet, forum post \
about the same model), say so explicitly and note where it came from. If you are reasoning from \
general electrical principles rather than something model-specific you found, say that too -- never \
blur the line between "I found this for your exact machine" and "this is how this type of circuit \
usually behaves."
4. Always flag basic electrical safety: de-energize/lockout-tagout before working on a circuit, \
discharge capacitors, don't bypass safety interlocks to "test" something.
5. Be direct and field-practical. Technicians are under time pressure -- skip filler, get to the \
likely fault and the test that confirms it.
6. If the issue could be something you cannot safely guide via text (e.g. suspected high-voltage \
fault, damaged main power wiring, anything where a wrong move could cause injury), say so plainly \
and recommend escalation to a qualified electrician rather than continuing to guess.

You are a diagnostic aid, not a replacement for technician judgment or for Sunbelt's official \
service procedures when those are available."""

VISION_SYSTEM_PROMPT = """You are analyzing a photo submitted by a Sunbelt Rentals field technician \
during electrical troubleshooting. The photo may show: a wiring harness, a relay or fuse panel, a \
component (motor, solenoid, switch, control board), a wiring diagram/schematic, or a piece of \
equipment generally.

Describe precisely what you can see that's diagnostically relevant:
- Visible damage: burn marks, melted insulation, corrosion, broken/loose connectors, discoloration
- Component identification: relay type, fuse rating if legible, connector types, wire colors
- Anything that looks abnormal vs. what a healthy version of this would look like
- If it's a diagram/schematic, describe the circuit path relevant to the stated problem

Be specific and concrete -- technicians need actionable observations, not generic descriptions. If \
the image quality makes something ambiguous (e.g. you can't fully confirm a fuse rating or read a \
label), say so rather than guessing confidently."""


def get_diagnosis(conversation_history, equipment_type=None, issue_category=None):
    """
    Get an AI diagnosis response given the conversation history.

    conversation_history: list of {"role": "user"|"assistant", "content": str}
    Returns: dict with 'response' text and 'sources_used' (list of any URLs/titles
             the model's web search surfaced, if available).
    """
    context_prefix = ""
    if equipment_type:
        context_prefix += f"Equipment: {equipment_type}\n"
    if issue_category:
        context_prefix += f"Issue category: {issue_category}\n"

    messages = list(conversation_history)
    if context_prefix and messages:
        # Prepend equipment context to the first user message for clarity
        messages[0] = {
            "role": messages[0]["role"],
            "content": f"{context_prefix}\n{messages[0]['content']}",
        }

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        system=DIAGNOSIS_SYSTEM_PROMPT,
        messages=messages,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
    )

    response_text_parts = []
    sources_used = []

    for block in response.content:
        if block.type == "text":
            response_text_parts.append(block.text)
        elif block.type == "web_search_tool_result":
            # Capture source titles/urls surfaced during search for transparency/logging
            try:
                for result in block.content:
                    title = getattr(result, "title", None)
                    url = getattr(result, "url", None)
                    if url:
                        sources_used.append({"title": title, "url": url})
            except Exception:
                pass

    full_response = "\n".join(response_text_parts).strip()

    return {
        "response": full_response or "I wasn't able to generate a response. Please try rephrasing the issue.",
        "sources_used": sources_used,
    }


def analyze_photo(image_base64, media_type, user_question=None):
    """
    Analyze an uploaded photo (equipment, wiring, component, diagram) using
    Claude's vision capability.

    image_base64: base64-encoded image data (no data: prefix)
    media_type: e.g. "image/jpeg", "image/png"
    user_question: optional specific question the technician asked about the photo
    """
    prompt_text = (
        user_question
        or "Analyze this photo for anything diagnostically relevant to an electrical issue."
    )

    response = client.messages.create(
        model=CLAUDE_VISION_MODEL,
        max_tokens=1000,
        system=VISION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": prompt_text},
                ],
            }
        ],
    )

    text_parts = [block.text for block in response.content if block.type == "text"]
    return "\n".join(text_parts).strip()


def build_conversation_messages(db_messages, latest_photo_analysis=None):
    """
    Convert stored Message rows into the role/content format the Anthropic
    API expects. If the latest message has a photo with cached analysis,
    fold that analysis into the message content so the model has visual
    context without re-sending the image every turn.
    """
    api_messages = []
    for i, msg in enumerate(db_messages):
        role = "assistant" if msg.sender_type == "ai" else "user"
        content = msg.content

        if msg.photo and msg.photo.ai_analysis:
            content = f"{content}\n\n[Attached photo - AI visual analysis]: {msg.photo.ai_analysis}"

        # Anthropic API requires alternating user/assistant; merge consecutive same-role
        if api_messages and api_messages[-1]["role"] == role:
            api_messages[-1]["content"] += f"\n\n{content}"
        else:
            api_messages.append({"role": role, "content": content})

    # Must start with a user message
    if api_messages and api_messages[0]["role"] != "user":
        api_messages.insert(0, {"role": "user", "content": "(conversation continued)"})

    return api_messages
