"""
Sunbelt Electrical Diagnostic Tool - Backend
==============================================
Flask + Socket.IO backend providing:
- REST API for technicians, conversations, messages, photos, diagnostic logs
- Real-time chat via Socket.IO so multiple technicians see updates live
- AI diagnosis + vision analysis via ai_engine.py
"""
import os
import base64
import json
import uuid
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

from models import db, Technician, Conversation, Message, Photo, DiagnosticLog
import ai_engine

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///sunbelt_diag.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/app/uploads")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", 15))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(app, resources={r"/api/*": {"origins": FRONTEND_ORIGIN}})
socketio = SocketIO(app, cors_allowed_origins=FRONTEND_ORIGIN)

db.init_app(app)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "heic"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def media_type_for(filename):
    ext = filename.rsplit(".", 1)[1].lower()
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "heic": "image/heic",
    }.get(ext, "image/jpeg")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


# ---------------------------------------------------------------------------
# Technicians
# ---------------------------------------------------------------------------
@app.route("/api/technicians", methods=["GET"])
def list_technicians():
    techs = Technician.query.order_by(Technician.name).all()
    return jsonify([t.to_dict() for t in techs])


@app.route("/api/technicians", methods=["POST"])
def create_technician():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    existing = Technician.query.filter_by(name=name).first()
    if existing:
        return jsonify(existing.to_dict())

    tech = Technician(
        name=name,
        email=data.get("email"),
        role=data.get("role", "technician"),
    )
    db.session.add(tech)
    db.session.commit()
    return jsonify(tech.to_dict()), 201


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
@app.route("/api/conversations", methods=["GET"])
def list_conversations():
    status_filter = request.args.get("status")
    query = Conversation.query
    if status_filter:
        query = query.filter_by(status=status_filter)
    conversations = query.order_by(Conversation.updated_at.desc()).all()
    return jsonify([c.to_dict() for c in conversations])


@app.route("/api/conversations", methods=["POST"])
def create_conversation():
    data = request.get_json() or {}
    convo = Conversation(
        title=data.get("title", "Untitled Diagnosis"),
        conversation_type=data.get("conversation_type", "shared"),
        equipment_type=data.get("equipment_type"),
        issue_category=data.get("issue_category"),
    )
    db.session.add(convo)
    db.session.commit()
    return jsonify(convo.to_dict()), 201


@app.route("/api/conversations/<int:conversation_id>", methods=["GET"])
def get_conversation(conversation_id):
    convo = Conversation.query.get_or_404(conversation_id)
    return jsonify(convo.to_dict(include_messages=True))


@app.route("/api/conversations/<int:conversation_id>", methods=["PATCH"])
def update_conversation(conversation_id):
    convo = Conversation.query.get_or_404(conversation_id)
    data = request.get_json() or {}
    for field in ["title", "status", "equipment_type", "issue_category"]:
        if field in data:
            setattr(convo, field, data[field])
    convo.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(convo.to_dict())


# ---------------------------------------------------------------------------
# Photos
# ---------------------------------------------------------------------------
@app.route("/api/photos/upload", methods=["POST"])
def upload_photo():
    if "photo" not in request.files:
        return jsonify({"error": "no photo file provided"}), 400

    file = request.files["photo"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"error": "invalid or unsupported file type"}), 400

    technician_id = request.form.get("technician_id")
    user_question = request.form.get("question", "").strip() or None

    safe_name = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)
    file.save(filepath)

    photo = Photo(
        filename=safe_name,
        filepath=filepath,
        uploaded_by=int(technician_id) if technician_id else None,
    )
    db.session.add(photo)
    db.session.commit()

    # Run AI vision analysis immediately and cache the result
    try:
        with open(filepath, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")
        media_type = media_type_for(safe_name)
        analysis = ai_engine.analyze_photo(image_b64, media_type, user_question)
        photo.ai_analysis = analysis
        photo.analyzed_at = datetime.utcnow()
        db.session.commit()
    except Exception as e:
        # Don't fail the upload if vision analysis errors -- the photo is
        # still saved and can be analyzed/retried later.
        photo.ai_analysis = f"[Analysis failed: {str(e)}]"
        db.session.commit()

    return jsonify(photo.to_dict()), 201


@app.route("/api/photos/<int:photo_id>/file", methods=["GET"])
def get_photo_file(photo_id):
    photo = Photo.query.get_or_404(photo_id)
    directory = os.path.dirname(photo.filepath)
    filename = os.path.basename(photo.filepath)
    return send_from_directory(directory, filename)


# ---------------------------------------------------------------------------
# Messages + AI Diagnosis
# ---------------------------------------------------------------------------
@app.route("/api/conversations/<int:conversation_id>/messages", methods=["POST"])
def post_message(conversation_id):
    """
    Post a technician message into a conversation, then trigger an AI
    diagnosis response. Broadcasts both messages over Socket.IO so all
    technicians viewing the conversation see them live.
    """
    convo = Conversation.query.get_or_404(conversation_id)
    data = request.get_json() or {}

    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400

    technician_id = data.get("technician_id")
    photo_id = data.get("photo_id")
    skip_ai = data.get("skip_ai", False)  # allow tech-to-tech chat without triggering AI

    user_msg = Message(
        conversation_id=conversation_id,
        technician_id=technician_id,
        sender_type="technician",
        content=content,
        photo_id=photo_id,
    )
    db.session.add(user_msg)
    convo.updated_at = datetime.utcnow()
    db.session.commit()

    socketio.emit(
        "new_message", user_msg.to_dict(), room=f"conversation_{conversation_id}"
    )

    if skip_ai:
        return jsonify({"user_message": user_msg.to_dict()}), 201

    # Build full conversation history and get AI response
    all_messages = Message.query.filter_by(conversation_id=conversation_id).order_by(
        Message.created_at
    ).all()
    api_messages = ai_engine.build_conversation_messages(all_messages)

    try:
        result = ai_engine.get_diagnosis(
            api_messages,
            equipment_type=convo.equipment_type,
            issue_category=convo.issue_category,
        )
    except Exception as e:
        result = {
            "response": f"The AI diagnosis service hit an error: {str(e)}. "
                         f"Please check the ANTHROPIC_API_KEY configuration and try again.",
            "sources_used": [],
        }

    ai_msg = Message(
        conversation_id=conversation_id,
        sender_type="ai",
        content=result["response"],
    )
    db.session.add(ai_msg)
    convo.updated_at = datetime.utcnow()
    db.session.commit()

    # Log to the structured diagnostic log for future knowledge-base use
    log_entry = DiagnosticLog(
        conversation_id=conversation_id,
        technician_id=technician_id,
        equipment_type=convo.equipment_type,
        issue_category=convo.issue_category,
        question=content,
        ai_response=result["response"],
        sources_used=json.dumps(result.get("sources_used", [])),
    )
    db.session.add(log_entry)
    db.session.commit()

    socketio.emit(
        "new_message", ai_msg.to_dict(), room=f"conversation_{conversation_id}"
    )

    return jsonify({"user_message": user_msg.to_dict(), "ai_message": ai_msg.to_dict()}), 201


# ---------------------------------------------------------------------------
# Diagnostic Logs (for future knowledge-base / export use)
# ---------------------------------------------------------------------------
@app.route("/api/diagnostic-logs", methods=["GET"])
def list_diagnostic_logs():
    equipment_filter = request.args.get("equipment_type")
    issue_filter = request.args.get("issue_category")
    query = DiagnosticLog.query
    if equipment_filter:
        query = query.filter_by(equipment_type=equipment_filter)
    if issue_filter:
        query = query.filter_by(issue_category=issue_filter)
    logs = query.order_by(DiagnosticLog.created_at.desc()).limit(500).all()
    return jsonify([log.to_dict() for log in logs])


@app.route("/api/categories", methods=["GET"])
def list_categories():
    """
    Returns the distinct equipment types and issue categories that exist
    across ALL technicians' sessions so far -- used to populate filter
    chips/dropdowns in the search UI before the user types anything.
    """
    equipment_rows = (
        db.session.query(Conversation.equipment_type)
        .filter(Conversation.equipment_type.isnot(None))
        .distinct()
        .all()
    )
    issue_rows = (
        db.session.query(Conversation.issue_category)
        .filter(Conversation.issue_category.isnot(None))
        .distinct()
        .all()
    )
    equipment_types = sorted({row[0] for row in equipment_rows if row[0]})
    issue_categories = sorted({row[0] for row in issue_rows if row[0]})
    return jsonify({"equipment_types": equipment_types, "issue_categories": issue_categories})


@app.route("/api/search", methods=["GET"])
def search_all():
    """
    Unified search across everything logged by every technician:
    - Message content (technician questions + AI responses), joined with
      the parent Conversation for equipment/issue context
    - DiagnosticLog entries (the structured Q&A log)

    Query params:
      q               free-text keyword, matched against message/question/answer content
      equipment_type  exact-match filter
      issue_category  exact-match filter
      limit           max results per source (default 50)

    This is intentionally a search across the whole team's history, not
    scoped to the requesting technician -- the point is to let any tech
    find out what others have already run into.
    """
    keyword = request.args.get("q", "").strip()
    equipment_filter = request.args.get("equipment_type")
    issue_filter = request.args.get("issue_category")
    limit = min(int(request.args.get("limit", 50)), 200)

    # --- Search Messages (joined with Conversation for equipment/issue) ---
    msg_query = (
        db.session.query(Message, Conversation)
        .join(Conversation, Message.conversation_id == Conversation.id)
    )
    if equipment_filter:
        msg_query = msg_query.filter(Conversation.equipment_type == equipment_filter)
    if issue_filter:
        msg_query = msg_query.filter(Conversation.issue_category == issue_filter)
    if keyword:
        msg_query = msg_query.filter(Message.content.ilike(f"%{keyword}%"))

    msg_results = (
        msg_query.order_by(Message.created_at.desc()).limit(limit).all()
    )

    message_hits = []
    for msg, convo in msg_results:
        message_hits.append({
            "source": "message",
            "id": msg.id,
            "conversation_id": convo.id,
            "conversation_title": convo.title,
            "equipment_type": convo.equipment_type,
            "issue_category": convo.issue_category,
            "sender_type": msg.sender_type,
            "technician_name": msg.author.name if msg.author else None,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

    # --- Search DiagnosticLog entries ---
    log_query = DiagnosticLog.query
    if equipment_filter:
        log_query = log_query.filter_by(equipment_type=equipment_filter)
    if issue_filter:
        log_query = log_query.filter_by(issue_category=issue_filter)
    if keyword:
        log_query = log_query.filter(
            db.or_(
                DiagnosticLog.question.ilike(f"%{keyword}%"),
                DiagnosticLog.ai_response.ilike(f"%{keyword}%"),
            )
        )
    log_results = log_query.order_by(DiagnosticLog.created_at.desc()).limit(limit).all()

    log_hits = []
    for log_entry in log_results:
        log_hits.append({
            "source": "diagnostic_log",
            "id": log_entry.id,
            "conversation_id": log_entry.conversation_id,
            "equipment_type": log_entry.equipment_type,
            "issue_category": log_entry.issue_category,
            "technician_id": log_entry.technician_id,
            "question": log_entry.question,
            "ai_response": log_entry.ai_response,
            "was_helpful": log_entry.was_helpful,
            "created_at": log_entry.created_at.isoformat() if log_entry.created_at else None,
        })

    # Merge and sort combined results by recency so the two sources read
    # as one unified feed rather than two separate lists.
    combined = message_hits + log_hits
    combined.sort(key=lambda r: r.get("created_at") or "", reverse=True)

    return jsonify({
        "query": keyword,
        "equipment_type": equipment_filter,
        "issue_category": issue_filter,
        "total_results": len(combined),
        "results": combined,
    })


@app.route("/api/diagnostic-logs/<int:log_id>/feedback", methods=["PATCH"])
def update_log_feedback(log_id):
    """Optional: mark whether a diagnosis was helpful, for future use."""
    log_entry = DiagnosticLog.query.get_or_404(log_id)
    data = request.get_json() or {}
    if "was_helpful" in data:
        log_entry.was_helpful = data["was_helpful"]
    if "resolution_notes" in data:
        log_entry.resolution_notes = data["resolution_notes"]
    db.session.commit()
    return jsonify(log_entry.to_dict())


# ---------------------------------------------------------------------------
# Socket.IO events
# ---------------------------------------------------------------------------
@socketio.on("join_conversation")
def handle_join(data):
    conversation_id = data.get("conversation_id")
    if conversation_id:
        join_room(f"conversation_{conversation_id}")
        emit("joined", {"conversation_id": conversation_id})


@socketio.on("connect")
def handle_connect():
    emit("connected", {"status": "connected"})


# ---------------------------------------------------------------------------
# App entrypoint
# ---------------------------------------------------------------------------
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
