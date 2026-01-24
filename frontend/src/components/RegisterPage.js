import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import "../theme.css";

export default function RegisterPage() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    console.log("Data envoyée :", { nom, email, password });

    try {
      const res = await fetch("http://localhost:8000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nom, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data.detail || "Erreur lors de l'inscription");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setMsg("Compte créé avec succès ! Redirection...");
      setTimeout(() => (window.location.href = "/login"), 1500);
      
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
        <h2 style={{ color: "var(--primary)", marginBottom: 30, fontSize: "2rem" }}>Inscription</h2>
        
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "left" }}>
            <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Nom d'utilisateur</label>
            <input 
              type="text"
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              required 
              placeholder="Pseudo"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

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
              background: success ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)", 
              color: success ? "var(--success)" : "var(--danger)",
              fontSize: "0.9rem",
              border: `1px solid ${success ? "var(--success)" : "var(--danger)"}`
            }}>
              {msg}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p style={{ marginTop: 20, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Déjà un compte ? <Link to="/login" style={{ color: "var(--primary)", fontWeight: "bold" }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}