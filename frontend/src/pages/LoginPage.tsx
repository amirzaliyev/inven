import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.appName}>Inven</h1>
          <p style={styles.subtitle}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          {error && (
            <div style={styles.errorBanner} role="alert">
              {error}
            </div>
          )}

          <div style={styles.field}>
            <label htmlFor="username" style={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              ...styles.button,
              ...(loading || !username || !password
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f5f7",
    padding: "1rem",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  header: {
    padding: "2rem 2rem 1.25rem",
    borderBottom: "1px solid #f0f0f0",
  },
  appName: {
    margin: "0 0 0.25rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#111827",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  form: {
    padding: "1.75rem 2rem 2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    lineHeight: 1.4,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "0.625rem 0.875rem",
    fontSize: "0.9375rem",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    outline: "none",
    color: "#111827",
    backgroundColor: "#fff",
    transition: "border-color 0.15s, box-shadow 0.15s",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    marginTop: "0.25rem",
    padding: "0.6875rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "#ffffff",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background-color 0.15s",
    width: "100%",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
    cursor: "not-allowed",
  },
};
