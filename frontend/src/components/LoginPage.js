import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import "../theme.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMsg(data.detail || "Erreur lors de la connexion");
        setLoading(false);
        return;
      }

      window.location.href = "/items";
    } catch (err) {
      console.error("Failed to fetch", err);
      setMsg("Impossible de joindre le serveur.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <AuthBackground />
      
      <div className="auth-box">
        <h2 style={{ color: "var(--primary)", marginBottom: 30, fontSize: "2rem" }}>Connexion</h2>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "left" }}>
            <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="exemple@mail.com"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          
          <div style={{ textAlign: "left" }}>
            <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Mot de passe</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          {msg && (
            <div style={{ 
              padding: 10, 
              borderRadius: "var(--radius)", 
              background: "rgba(244, 67, 54, 0.1)", 
              color: "var(--danger)",
              fontSize: "0.9rem",
              border: "1px solid var(--danger)"
            }}>
              {msg}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p style={{ marginTop: 20, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Pas encore de compte ? <Link to="/register" style={{ color: "var(--primary)", fontWeight: "bold" }}>Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}