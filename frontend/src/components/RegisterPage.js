import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

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
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
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
        <h2 className="auth-title">Inscription</h2>
        
        <form onSubmit={handleRegister} className="flex-col gap-20">
          <div className="text-left">
            <label className="form-label text-muted font-normal">Nom d'utilisateur</label>
            <input 
              type="text"
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              required 
              placeholder="Pseudo"
              className="input-field w-full"
            />
          </div>

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
            <div className={success ? "alert-success" : "alert-danger"}>
              {msg}
            </div>
          )}

          <button type="submit" className="btn-primary mt-10" disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-20 text-muted text-sm">
          Déjà un compte ? <Link to="/login" className="text-primary font-bold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}