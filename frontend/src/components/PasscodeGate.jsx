import React, { useState } from "react";
import { Lock } from "lucide-react";
import { verifyPasscode, setStoredPasscode } from "../api";

// Shared-passcode screen shown in front of the whole app when this build is
// being demoed over a public tunnel. Not real per-user auth -- just keeps a
// forwarded link from letting strangers spend against the live API key.
export default function PasscodeGate({ onUnlock }) {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setLoading(true);
    setError(null);
    const ok = await verifyPasscode(passcode.trim());
    setLoading(false);
    if (!ok) {
      setError("Incorrect passcode.");
      return;
    }
    setStoredPasscode(passcode.trim());
    onUnlock();
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconRow}>
          <Lock size={22} color="var(--accent-green)" strokeWidth={2.5} />
          <span style={styles.brandMark}>SUNBELT DIAG — DEMO</span>
        </div>
        <h1 style={styles.title}>Enter demo passcode</h1>
        <p style={styles.subtitle}>Ask whoever shared this link for the passcode.</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            autoFocus
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            style={styles.input}
          />
          <button type="submit" disabled={loading || !passcode.trim()} style={styles.button}>
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 50% 0%, rgba(31,138,76,0.06), transparent 60%), var(--bg-subtle)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    padding: "36px 32px",
    background: "var(--bg-panel)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 4px 16px rgba(21,32,26,0.06)",
  },
  iconRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  brandMark: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    letterSpacing: "0.12em",
    color: "var(--accent-green-dark)",
    fontWeight: 600,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: "0 0 8px 0",
    color: "var(--text-primary)",
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    margin: "0 0 24px 0",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: "13px 14px",
    background: "var(--bg-subtle)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 15,
    outline: "none",
  },
  button: {
    padding: "13px 14px",
    background: "var(--accent-green)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 15,
  },
  error: {
    color: "var(--signal-red)",
    fontSize: 13,
    marginTop: 12,
  },
};
