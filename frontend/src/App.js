import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import "./App.css";
import "./theme.css"; 

import CardsList from "./components/CardsList";
import CardSearchBar from "./components/CardSearchBar";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ItemsPage from "./components/ItemsPage";
import DeckDetails from "./components/DeckDetails"; 

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((curr) => (curr === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("http://localhost:8000/auth/me", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await fetch("http://localhost:8000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    
    // ✅ RETOUR AU MODE CLAIR AUTOMATIQUE
    setTheme("light");
    localStorage.setItem("theme", "light");
    document.documentElement.setAttribute("data-theme", "light");

    window.location.href = "/login";
  };

  if (!authChecked) return null; 

  return (
    <Router>
      {/* HEADER FIXE */}
      <nav className="header" style={{ 
          background: "var(--bg-header)", 
          borderBottom: "1px solid var(--border)",
          display: "flex", 
          alignItems: "center", 
          padding: "0 20px", 
          height: "60px",
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 100
      }}>
        
        {/* --- PARTIE GAUCHE : NAVIGATION --- */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            {/* 1. Recherche (Toujours là) */}
            <Link to="/search" className="item-header">Recherche</Link>

            {/* 2 & 3. Collection et Decks (Si connecté) */}
            {user && (
              <>
                <Link to="/cards" className="item-header">Collection</Link>
                <Link to="/items" className="item-header">Mes Decks</Link>
              </>
            )}
        </div>

        {/* --- PARTIE DROITE : PROFIL / AUTH --- */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "15px", alignItems: "center" }}>
          {user ? (
            <Link to="/profile" className="item-header" style={{ color: "var(--primary)", fontWeight: "bold" }}>
              {user.nom}
            </Link>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/login" className="item-header">Connexion</Link>
              <Link to="/register" style={{ textDecoration: "none" }}>
                  <button className="btn-primary" style={{ padding: "6px 12px", fontSize: "0.9rem" }}>
                      Créer un compte
                  </button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* CONTENU PRINCIPAL */}
      <div style={{ paddingTop: "60px" }}>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to={user ? "/items" : "/login"} />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/search" element={<CardSearchBar />} />
            
            <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
            <Route path="/items/:id" element={<ProtectedRoute><DeckDetails /></ProtectedRoute>}/>
            <Route path="/cards" element={<ProtectedRoute><CardsList /></ProtectedRoute>} />
            
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
                    <div className="auth-box" style={{ maxWidth: "600px", textAlign: "left" }}>
                      <h2 style={{color: "var(--primary)", marginTop: 0, borderBottom: "1px solid var(--border)", paddingBottom: "10px"}}>Profil utilisateur</h2>
                      
                      <p><strong>Nom :</strong> {user?.nom}</p>
                      <p><strong>Email :</strong> {user?.email}</p>
                      
                      {/* Préférences dans le profil */}
                      <div style={{ marginTop: "30px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                          <h4 style={{marginTop: 0, marginBottom: 15}}>Préférences</h4>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span>Apparence de l'application :</span>
                              <button onClick={toggleTheme} className="btn-secondary">
                                  {theme === "light" ? "Passer en Mode Sombre" : "Passer en Mode Clair"}
                              </button>
                          </div>
                      </div>

                      <button onClick={handleLogout} className="btn-danger" style={{ marginTop: "30px", width: "100%" }}>
                        Déconnexion
                      </button>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;