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

      // Si le backend demande le MFA
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
        <h2 className="auth-title">
            {step === 1 ? "Connexion" : "Double Authentification"}
        </h2>
        
        {step === 1 && (
            <form onSubmit={handleLogin} className="flex-col gap-20">
              <div className="text-left">
                  <label className="form-label text-muted font-normal">Email</label>
                  <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      placeholder="exemple@mail.com" 
                      className="input-field w-full"
                  />
              </div>

              <div className="text-left">
                  <label className="form-label text-muted font-normal">Mot de passe</label>
                  <input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      placeholder="••••••••" 
                      className="input-field w-full"
                  />
              </div>

              {msg && (
                  <div className="alert-danger">
                    {msg}
                  </div>
              )}

              <button type="submit" className="btn-primary mt-10" disabled={loading}>
                  {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
        )}

        {step === 2 && (
            <form onSubmit={handleMfaSubmit} className="flex-col gap-20">
              <p className="text-main text-sm mt-0 mb-10">
                  Veuillez entrer le code à 6 chiffres affiché sur votre application d'authentification (Google Authenticator, Authy...).
              </p>

              <div className="text-left">
                  <label className="form-label text-muted font-normal">Code de vérification</label>
                  <input 
                      type="text" 
                      value={mfaCode} 
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} // Accepte uniquement 6 chiffres
                      required 
                      placeholder="123456" 
                      className="input-field w-full text-center text-primary font-bold mfa-input"
                  />
              </div>

              {msg && (
                  <div className="alert-danger">
                    {msg}
                  </div>
              )}

              <button type="submit" className="btn-primary mt-10" disabled={loading || mfaCode.length !== 6}>
                  {loading ? "Vérification..." : "Valider"}
              </button>

              <button type="button" onClick={() => setStep(1)} className="btn-link-cancel">
                  Retour
              </button>
            </form>
        )}

        <p className="mt-20 text-muted text-sm">
          Pas encore de compte ? <Link to="/register" className="text-primary font-bold">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}