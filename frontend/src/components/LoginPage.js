import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

export default function LoginPage() {
  // Etape 1: Identifiants
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Etape 2: Authentification Multifacteur (MFA)
  const [step, setStep] = useState(1);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Soumission de l'Email / Mot de passe
  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setMsg(data.detail || "Erreur de connexion");
        setLoading(false);
        return;
      }

      // NOUVEAU : Si le backend demande le MFA
      if (data.requires_mfa) {
          setMfaToken(data.mfa_token);
          setStep(2); // On passe a l'etape 2 (le code a 6 chiffres)
          setMsg("");
          setLoading(false);
      } else {
          // Connexion reussie directement (MFA non active)
          window.location.href = "/items";
      }

    } catch (err) {
      setMsg("Impossible de joindre le serveur.");
      setLoading(false);
    }
  };

  // Soumission du code Google Authenticator (6 chiffres)
  const handleMfaSubmit = async (e) => {
      e.preventDefault();
      setMsg("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE_URL}/auth/login/mfa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mfa_token: mfaToken, mfa_code: mfaCode }),
        });
  
        const data = await res.json();
        
        if (!res.ok) {
          setMsg(data.detail || "Code MFA incorrect");
          setLoading(false);
          return;
        }
  
        // MFA valide, session creee !
        window.location.href = "/items";
  
      } catch (err) {
        setMsg("Impossible de joindre le serveur.");
        setLoading(false);
      }
  }

  return (
    <div className="auth-container">
      <AuthBackground />

      <div className="auth-box">
        <h2 style={{ color: "var(--primary)", marginBottom: 30, fontSize: "2rem" }}>
            {step === 1 ? "Connexion" : "Double Authentification"}
        </h2>
        
        {step === 1 && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "left" }}>
                <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="exemple@mail.com" style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
            </div>

            <div style={{ textAlign: "left" }}>
                <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
            </div>

            {msg && (
                <div style={{ padding: 10, borderRadius: "var(--radius)", background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)", fontSize: "0.9rem", border: "1px solid var(--danger)" }}>
                {msg}
                </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 10 }}>
                {loading ? "Connexion..." : "Se connecter"}
            </button>
            </form>
        )}

        {step === 2 && (
            <form onSubmit={handleMfaSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ color: "var(--text-main)", fontSize: "0.9rem", marginTop: "-10px", marginBottom: "10px" }}>
                Veuillez entrer le code a 6 chiffres affiche sur votre application d'authentification (Google Authenticator, Authy...).
            </p>

            <div style={{ textAlign: "left" }}>
                <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 5, display: "block" }}>Code de verification</label>
                <input 
                    type="text" 
                    value={mfaCode} 
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} // Accepte uniquement 6 chiffres
                    required 
                    placeholder="123456" 
                    style={{ width: "100%", boxSizing: "border-box", padding: "15px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--primary)", fontSize: "1.5rem", textAlign: "center", letterSpacing: "5px", fontWeight: "bold" }} 
                />
            </div>

            {msg && (
                <div style={{ padding: 10, borderRadius: "var(--radius)", background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)", fontSize: "0.9rem", border: "1px solid var(--danger)" }}>
                {msg}
                </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading || mfaCode.length !== 6} style={{ marginTop: 10 }}>
                {loading ? "Verification..." : "Valider"}
            </button>

            <button type="button" onClick={() => setStep(1)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline", fontSize: "0.85rem" }}>
                Retour
            </button>
            </form>
        )}

        <p style={{ marginTop: 20, color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Pas encore de compte ? <Link to="/register" style={{ color: "var(--primary)", fontWeight: "bold" }}>Creer un compte</Link>
        </p>
      </div>
    </div>
  );
}