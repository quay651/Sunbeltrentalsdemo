import React, { useState } from "react";
import { Zap } from "lucide-react";
import { createOrGetTechnician } from "../api";

export default function TechLogin({ onLogin }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const tech = await createOrGetTechnician(name.trim());
      onLogin(tech);
    } catch (err) {
      setError("Couldn't reach the server. Check the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconRow}>
          <Zap size={26} color="var(--accent-green)" strokeWidth={2.5} />
          <span style={styles.brandMark}>SUNBELT DIAG</span>
        </div>
        <h1 style={styles.title}>Electrical Diagnostic Console</h1>
        <p style={styles.subtitle}>
          Enter your name to start or join a diagnostic session.
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={styles.input}
          />
          <button type="submit" disabled={loading || !name.trim()} style={styles.button}>
            {loading ? "Connecting…" : "Enter"}
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
