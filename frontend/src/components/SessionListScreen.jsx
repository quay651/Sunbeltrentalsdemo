import React, { useState } from "react";
import { Zap, Plus, CircleDot, CheckCircle2, Search, X } from "lucide-react";

export default function SessionListScreen({ conversations, onSelect, onCreate, onOpenSearch, technician }) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [issueCategory, setIssueCategory] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      equipment_type: equipmentType.trim() || null,
      issue_category: issueCategory.trim() || null,
      conversation_type: "shared",
    });
    setTitle("");
    setEquipmentType("");
    setIssueCategory("");
    setShowNew(false);
  };

  return (
    <div style={s.screen}>
      <div style={s.homeHeader}>
        <div style={s.brandRow}>
          <Zap size={20} color="var(--accent-green)" strokeWidth={2.5} />
          <span style={s.brandText}>SUNBELT DIAG</span>
        </div>
        <div style={s.headerActions}>
          <button onClick={onOpenSearch} style={s.searchIconBtn} aria-label="Search all technicians' diagnostics">
            <Search size={19} color="var(--text-primary)" />
          </button>
          <button onClick={() => setShowNew(true)} style={s.fab} aria-label="New diagnostic session">
            <Plus size={22} color="#ffffff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div style={s.homeBody}>
        <div style={s.sectionLabel}>{technician?.name ? `${technician.name.toUpperCase()}'S SESSIONS` : "YOUR SESSIONS"}</div>
        <div style={s.convoList}>
          {conversations.length === 0 && (
            <p style={s.empty}>No sessions yet. Tap the + button to start one.</p>
          )}
          {conversations.map((c) => (
            <button key={c.id} onClick={() => onSelect(c.id)} style={s.convoCard}>
              <div style={s.convoCardTop}>
                {c.status === "resolved" ? (
                  <CheckCircle2 size={16} color="var(--accent-green)" />
                ) : (
                  <CircleDot size={16} color="#e8b400" />
                )}
                <span style={s.convoCardTitle}>{c.title}</span>
              </div>
              {(c.equipment_type || c.issue_category) && (
                <div style={s.convoCardTags}>
                  {c.equipment_type && <span style={s.tag}>{c.equipment_type}</span>}
                  {c.issue_category && <span style={s.tag}>{c.issue_category}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {showNew && (
        <div style={s.sheetOverlay} onClick={() => setShowNew(false)}>
          <form onSubmit={submit} style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetHandle} />
            <div style={s.sheetHeaderRow}>
              <span style={s.sheetTitle}>New diagnostic session</span>
              <button type="button" onClick={() => setShowNew(false)} style={s.sheetCloseBtn} aria-label="Close">
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>
            <input
              autoFocus
              placeholder="What's the issue? (e.g. Lift won't start)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={s.sheetInput}
            />
            <input
              placeholder="Equipment (optional)"
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              style={s.sheetInput}
            />
            <input
              placeholder="Issue category (optional)"
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              style={s.sheetInput}
            />
            <button type="submit" style={s.sheetSubmitBtn}>Start session</button>
          </form>
        </div>
      )}
    </div>
  );
}

const FONT_MONO = "var(--font-mono)";

const s = {
  screen: { width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 480, margin: "0 auto", background: "var(--bg-base)", boxShadow: "0 0 0 1px var(--border-subtle)" },
  homeHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 14px 18px", flexShrink: 0, background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" },
  brandRow: { display: "flex", alignItems: "center", gap: 8 },
  brandText: { fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.1em", color: "var(--accent-green-dark)", fontWeight: 600 },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  searchIconBtn: { width: 40, height: 40, borderRadius: 12, background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fab: { width: 40, height: 40, borderRadius: 12, background: "var(--accent-green)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(31,138,76,0.3)" },
  homeBody: { flex: 1, overflowY: "auto", padding: "14px 18px 18px 18px", background: "var(--bg-subtle)" },
  sectionLabel: { fontSize: 11, fontFamily: FONT_MONO, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 10, paddingLeft: 2 },
  empty: { color: "var(--text-tertiary)", fontSize: 13.5, textAlign: "center", marginTop: 40 },
  convoList: { display: "flex", flexDirection: "column", gap: 10 },
  convoCard: { width: "100%", textAlign: "left", padding: "16px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 1px 2px rgba(21,32,26,0.04)" },
  convoCardTop: { display: "flex", alignItems: "center", gap: 10 },
  convoCardTitle: { fontSize: 15, color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.3 },
  convoCardTags: { display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 26 },
  tag: { fontSize: 11.5, fontFamily: FONT_MONO, padding: "3px 8px", background: "var(--accent-green-tint)", border: "1px solid var(--border-subtle)", borderRadius: 5, color: "var(--accent-green-dark)" },
  sheetOverlay: { position: "fixed", inset: 0, background: "rgba(21,32,26,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 10 },
  sheet: { width: "100%", maxWidth: 480, background: "var(--bg-panel)", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "10px 20px 28px 20px", display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border-subtle)", borderBottom: "none" },
  sheetHandle: { width: 36, height: 4, background: "var(--border-strong)", borderRadius: 3, alignSelf: "center", marginBottom: 6 },
  sheetHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { fontSize: 16, fontWeight: 600, color: "var(--text-primary)" },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: "50%", background: "var(--bg-subtle)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" },
  sheetInput: { padding: "14px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--text-primary)", outline: "none" },
  sheetSubmitBtn: { padding: "15px 14px", background: "var(--accent-green)", border: "none", borderRadius: 10, color: "#ffffff", fontWeight: 600, fontSize: 15, marginTop: 4 },
};
