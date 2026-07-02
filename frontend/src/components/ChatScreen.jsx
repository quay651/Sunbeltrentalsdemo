import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Paperclip, Zap, User, AlertTriangle, Loader2, ChevronLeft, X } from "lucide-react";
import {
  getConversation,
  postMessage,
  uploadPhoto,
  photoFileUrl,
  socket,
} from "../api";

export default function ChatScreen({ conversationId, technician, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null); // { file, previewUrl }
  const [photoQuestion, setPhotoQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [waitingForAi, setWaitingForAi] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    const data = await getConversation(conversationId);
    setConversation(data);
    setMessages(data.messages || []);
  }, [conversationId]);

  useEffect(() => {
    loadConversation();
  }, [conversationId, loadConversation]);

  useEffect(() => {
    if (!conversationId) return;
    socket.emit("join_conversation", { conversation_id: conversationId });

    const handleNewMessage = (msg) => {
      if (msg.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.sender_type === "ai") setWaitingForAi(false);
    };

    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waitingForAi]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !pendingPhoto) return;
    if (sending || uploadingPhoto) return;

    setSending(true);
    let photoId = null;

    try {
      if (pendingPhoto) {
        setUploadingPhoto(true);
        const uploaded = await uploadPhoto(pendingPhoto.file, technician?.id, photoQuestion || input);
        photoId = uploaded.id;
        setUploadingPhoto(false);
      }

      const content = input.trim() || "(see attached photo)";
      setInput("");
      setPendingPhoto(null);
      setPhotoQuestion("");
      setWaitingForAi(true);

      await postMessage(conversationId, {
        content,
        technician_id: technician?.id,
        photo_id: photoId,
      });
    } catch (err) {
      setWaitingForAi(false);
      alert("Message failed to send. Check the backend connection.");
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div style={s.screen}>
        <div style={s.chatHeader}>
          <button onClick={onBack} style={s.backBtn} aria-label="Back to sessions">
            <ChevronLeft size={24} color="var(--text-primary)" />
          </button>
        </div>
        <div style={s.loadingState}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} color="var(--text-tertiary)" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.screen, animation: "slideIn 0.2s ease-out" }}>
      <div style={s.chatHeader}>
        <button onClick={onBack} style={s.backBtn} aria-label="Back to sessions">
          <ChevronLeft size={24} color="var(--text-primary)" />
        </button>
        <div style={s.chatHeaderText}>
          <span style={s.chatHeaderTitle}>{conversation.title}</span>
          <div style={s.chatHeaderMeta}>
            {conversation.equipment_type && <span style={s.metaTag}>{conversation.equipment_type}</span>}
            {conversation.status === "resolved" && <span style={s.resolvedTag}>RESOLVED</span>}
          </div>
        </div>
      </div>

      <div style={s.safetyBanner}>
        <AlertTriangle size={13} color="#b08900" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Lock out circuits before hands-on testing. AI guidance doesn't replace qualified electrician sign-off.</span>
      </div>

      <div ref={scrollRef} style={s.messageList}>
        {messages.length === 0 && <p style={s.noMessages}>No messages yet. Describe the issue below to get started.</p>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {waitingForAi && (
          <div style={s.aiThinking}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} color="var(--text-secondary)" />
            <span>Analyzing…</span>
          </div>
        )}
      </div>

      <div style={s.inputArea}>
        {pendingPhoto && (
          <div style={s.photoPreviewBar}>
            <img src={pendingPhoto.previewUrl} alt="Pending upload" style={s.photoPreviewImg} />
            <input
              placeholder="Anything specific to ask? (optional)"
              value={photoQuestion}
              onChange={(e) => setPhotoQuestion(e.target.value)}
              style={s.photoQuestionInput}
            />
            <button onClick={() => setPendingPhoto(null)} style={s.removePhotoBtn} aria-label="Remove photo">
              <X size={16} color="var(--text-secondary)" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} style={s.inputBar}>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} style={s.attachBtn} aria-label="Attach photo">
            <Paperclip size={20} color="var(--text-secondary)" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the issue…"
            style={s.textInput}
          />
          <button
            type="submit"
            disabled={sending || uploadingPhoto || (!input.trim() && !pendingPhoto)}
            style={{ ...s.sendBtn, opacity: sending || uploadingPhoto || (!input.trim() && !pendingPhoto) ? 0.4 : 1 }}
          >
            {uploadingPhoto ? <Loader2 size={16} color="#ffffff" style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} color="#ffffff" />}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isAi = msg.sender_type === "ai";
  return (
    <div style={{ display: "flex", justifyContent: isAi ? "flex-start" : "flex-end", animation: "fadeUp 0.2s ease-out" }}>
      <div style={{ ...s.bubble, ...(isAi ? s.bubbleAi : s.bubbleTech) }}>
        <div style={s.bubbleHeader}>
          {isAi ? (
            <><Zap size={11} color="var(--accent-green)" /><span style={{ ...s.bubbleAuthor, color: "var(--text-secondary)" }}>AI DIAGNOSTIC</span></>
          ) : (
            <><User size={11} color="rgba(255,255,255,0.85)" /><span style={{ ...s.bubbleAuthor, color: "rgba(255,255,255,0.85)" }}>{(msg.technician_name || "TECH").toUpperCase()}</span></>
          )}
        </div>
        {msg.photo && (
          <img src={photoFileUrl(msg.photo.id)} alt="Uploaded diagnostic photo" style={s.messageImg} />
        )}
        <p style={{ ...s.bubbleText, color: isAi ? "var(--text-primary)" : "#ffffff" }}>{msg.content}</p>
      </div>
    </div>
  );
}

const FONT_MONO = "var(--font-mono)";

const s = {
  screen: { width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 480, margin: "0 auto", background: "var(--bg-base)", boxShadow: "0 0 0 1px var(--border-subtle)" },
  loadingState: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },

  chatHeader: { display: "flex", alignItems: "center", gap: 6, padding: "14px 12px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, background: "var(--bg-base)" },
  backBtn: { width: 40, height: 40, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chatHeaderText: { flex: 1, minWidth: 0 },
  chatHeaderTitle: { fontSize: 15.5, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" },
  chatHeaderMeta: { display: "flex", gap: 6, marginTop: 4 },
  metaTag: { fontSize: 10.5, fontFamily: FONT_MONO, padding: "2px 7px", background: "var(--accent-green-tint)", border: "1px solid var(--border-subtle)", borderRadius: 4, color: "var(--accent-green-dark)" },
  resolvedTag: { fontSize: 10.5, fontFamily: FONT_MONO, padding: "2px 7px", background: "var(--accent-green-tint)", border: "1px solid var(--accent-green)", borderRadius: 4, color: "var(--accent-green-dark)", fontWeight: 600 },

  safetyBanner: { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 16px", background: "var(--accent-yellow-tint)", borderBottom: "1px solid var(--accent-yellow-border)", fontSize: 11.5, color: "#6b5400", lineHeight: 1.45, flexShrink: 0 },

  messageList: { flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-subtle)" },
  noMessages: { color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", marginTop: 40 },
  bubble: { maxWidth: "85%", padding: "12px 14px", borderRadius: 14 },
  bubbleAi: { background: "var(--bg-panel)", border: "1px solid var(--accent-green)", borderBottomLeftRadius: 4, boxShadow: "0 1px 2px rgba(21,32,26,0.05)" },
  bubbleTech: { background: "var(--accent-green)", border: "1px solid var(--accent-green-dark)", borderBottomRightRadius: 4 },
  bubbleHeader: { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 },
  bubbleAuthor: { fontSize: 10, fontFamily: FONT_MONO, letterSpacing: "0.04em" },
  bubbleText: { margin: 0, fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  messageImg: { maxWidth: "100%", borderRadius: 8, marginBottom: 8, display: "block" },
  aiThinking: { display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", fontSize: 13, paddingLeft: 4 },

  inputArea: { padding: "10px 12px 14px 12px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-base)", flexShrink: 0 },
  photoPreviewBar: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 10, background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10 },
  photoPreviewImg: { width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border-subtle)" },
  photoQuestionInput: { flex: 1, padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" },
  removePhotoBtn: { background: "transparent", border: "none", display: "flex", alignItems: "center" },
  inputBar: { display: "flex", alignItems: "center", gap: 8 },
  attachBtn: { width: 44, height: 44, borderRadius: "50%", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  textInput: { flex: 1, padding: "12px 16px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 22, color: "var(--text-primary)", outline: "none" },
  sendBtn: { width: 44, height: 44, borderRadius: "50%", background: "var(--accent-green)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(31,138,76,0.3)" },
};
