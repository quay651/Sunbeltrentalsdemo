import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Search, X, Users, Loader2 } from "lucide-react";
import { searchAll, getCategories } from "../api";

export default function SearchScreen({ onBack }) {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [activeEquipment, setActiveEquipment] = useState(null);
  const [activeIssue, setActiveIssue] = useState(null);
  const [categories, setCategories] = useState({ equipment_types: [], issue_categories: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load filter chip options once on mount
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories({ equipment_types: [], issue_categories: [] }));
  }, []);

  // Debounce free-text input so we don't fire a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchAll({
        q: debouncedKeyword || undefined,
        equipment_type: activeEquipment || undefined,
        issue_category: activeIssue || undefined,
      });
      setResults(data.results || []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, activeEquipment, activeIssue]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const clearFilters = () => {
    setActiveEquipment(null);
    setActiveIssue(null);
    setKeyword("");
  };
  const hasFilters = activeEquipment || activeIssue || keyword.trim();

  return (
    <div style={{ ...s.screen, animation: "slideIn 0.2s ease-out" }}>
      <div style={s.chatHeader}>
        <button onClick={onBack} style={s.backBtn} aria-label="Back">
          <ChevronLeft size={24} color="var(--text-primary)" />
        </button>
        <div style={s.chatHeaderText}>
          <span style={s.chatHeaderTitle}>Search all technicians</span>
          <div style={s.chatHeaderMeta}>
            <Users size={11} color="var(--text-secondary)" />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Pulled from every logged session</span>
          </div>
        </div>
      </div>

      <div style={s.searchInputWrap}>
        <Search size={17} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        <input
          autoFocus
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search symptoms, fixes, equipment…"
          style={s.searchInput}
        />
        {hasFilters && (
          <button onClick={clearFilters} style={s.clearFiltersBtn} aria-label="Clear filters">
            <X size={16} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      <div style={s.filterSection}>
        {categories.equipment_types.length > 0 && (
          <>
            <div style={s.filterLabel}>EQUIPMENT</div>
            <div style={s.chipRow}>
              {categories.equipment_types.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setActiveEquipment(activeEquipment === opt ? null : opt)}
                  style={{ ...s.chip, ...(activeEquipment === opt ? s.chipActive : {}) }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
        {categories.issue_categories.length > 0 && (
          <>
            <div style={s.filterLabel}>ISSUE CATEGORY</div>
            <div style={s.chipRow}>
              {categories.issue_categories.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setActiveIssue(activeIssue === opt ? null : opt)}
                  style={{ ...s.chip, ...(activeIssue === opt ? s.chipActive : {}) }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={s.searchResultsList}>
        <div style={s.sectionLabel}>
          {loading ? "SEARCHING…" : `${results.length} RESULT${results.length === 1 ? "" : "S"}`}
        </div>
        {loading && (
          <div style={s.loadingRow}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} color="var(--text-tertiary)" />
          </div>
        )}
        {!loading && results.length === 0 && (
          <p style={s.noMessages}>No matches. Try a different keyword or clear filters.</p>
        )}
        {!loading && results.map((r) => (
          <div key={`${r.source}-${r.id}`} style={s.resultCard}>
            <div style={s.resultCardTop}>
              <span style={s.resultTechnician}>{r.technician_name || "Unknown technician"}</span>
              <span style={s.resultSourceTag}>{r.source === "diagnostic_log" ? "LOGGED Q&A" : "MESSAGE"}</span>
            </div>
            <p style={s.resultContent}>{r.content || r.question || r.ai_response}</p>
            {(r.equipment_type || r.issue_category) && (
              <div style={s.resultTagsRow}>
                {r.equipment_type && <span style={s.tag}>{r.equipment_type}</span>}
                {r.issue_category && <span style={s.tag}>{r.issue_category}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const FONT_MONO = "var(--font-mono)";

const s = {
  screen: { width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: 480, margin: "0 auto", background: "var(--bg-base)", boxShadow: "0 0 0 1px var(--border-subtle)" },

  chatHeader: { display: "flex", alignItems: "center", gap: 6, padding: "14px 12px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, background: "var(--bg-base)" },
  backBtn: { width: 40, height: 40, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chatHeaderText: { flex: 1, minWidth: 0 },
  chatHeaderTitle: { fontSize: 15.5, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" },
  chatHeaderMeta: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 },

  searchInputWrap: { display: "flex", alignItems: "center", gap: 10, margin: "14px 16px 0 16px", padding: "12px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 12, flexShrink: 0 },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", color: "var(--text-primary)", fontSize: 15 },
  clearFiltersBtn: { background: "transparent", border: "none", display: "flex", alignItems: "center", flexShrink: 0 },

  filterSection: { padding: "16px 16px 4px 16px", flexShrink: 0 },
  filterLabel: { fontSize: 10.5, fontFamily: FONT_MONO, letterSpacing: "0.1em", color: "var(--text-tertiary)", marginBottom: 8 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { fontSize: 12.5, padding: "7px 13px", borderRadius: 18, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-secondary)" },
  chipActive: { background: "var(--accent-green)", borderColor: "var(--accent-green-dark)", color: "#ffffff", fontWeight: 600 },

  searchResultsList: { flex: 1, overflowY: "auto", padding: "8px 16px 18px 16px", background: "var(--bg-subtle)" },
  sectionLabel: { fontSize: 10.5, fontFamily: FONT_MONO, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 10, paddingLeft: 2 },
  loadingRow: { display: "flex", justifyContent: "center", padding: "24px 0" },
  noMessages: { color: "var(--text-tertiary)", fontSize: 13.5, textAlign: "center", marginTop: 30 },
  resultCard: { background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 14px", marginBottom: 10, boxShadow: "0 1px 2px rgba(21,32,26,0.04)" },
  resultCardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  resultTechnician: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },
  resultSourceTag: { fontSize: 9.5, fontFamily: FONT_MONO, letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 4, background: "var(--accent-yellow-tint)", border: "1px solid var(--accent-yellow-border)", color: "#6b5400" },
  resultContent: { fontSize: 13.5, lineHeight: 1.5, color: "var(--text-primary)", margin: "0 0 10px 0" },
  resultTagsRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: { fontSize: 11.5, fontFamily: FONT_MONO, padding: "3px 8px", background: "var(--accent-green-tint)", border: "1px solid var(--border-subtle)", borderRadius: 5, color: "var(--accent-green-dark)" },
};
