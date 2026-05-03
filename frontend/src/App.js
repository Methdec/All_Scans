import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate } from "react-router-dom";
import "./App.css";
import "./theme.css"; 
import { API_BASE_URL } from './utils/api';

import CardsList from "./components/CardsList";
import CardSearchBar from "./components/CardSearchBar";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ItemsPage from "./components/ItemsPage";
import DeckDetails from "./components/DeckDetails"; 
import ProfilePage from "./components/ProfilePage";
import DevicePage from "./components/DevicePage";

const DEFAULT_AVATAR = "https://cards.scryfall.io/art_crop/front/0/0/00020b05-ecb9-4603-8cc1-8cfa7a14befc.jpg";

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  
  const [openDecks, setOpenDecks] = useState([]);

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
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
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

  useEffect(() => {
    const loadOpenDecks = () => {
      const stored = JSON.parse(localStorage.getItem("openDecks") || "[]");
      setOpenDecks(stored);
    };
    
    loadOpenDecks();
    window.addEventListener("decksUpdated", loadOpenDecks);
    return () => window.removeEventListener("decksUpdated", loadOpenDecks);
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    
    setTheme("light");
    localStorage.setItem("theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
    
    localStorage.removeItem("openDecks");

    window.location.href = "/login";
  };

  // --- NOUVEAU : Fonction pour fermer un onglet ---
  const closeTab = (deckId) => {
    const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
    const updatedDecks = storedDecks.filter(d => d.id !== deckId);
    localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
    window.dispatchEvent(new Event("decksUpdated"));

    // Si on ferme le deck qu'on est en train de regarder, on retourne sur /items
    if (window.location.pathname === `/deck/${deckId}`) {
        window.location.href = "/items";
    }
  };

  if (!authChecked) return null; 

  const navLinkStyle = ({ isActive }) => ({
    height: "100%",
    display: "flex",
    alignItems: "center",
    padding: "0 15px",
    textDecoration: "none",
    color: isActive ? "var(--primary)" : "var(--text-main)",
    fontWeight: isActive ? "bold" : "normal",
    borderBottom: isActive ? "3px solid var(--primary)" : "3px solid transparent",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap"
  });

  return (
    <Router>
      <style>{`
        .scrollable-nav::-webkit-scrollbar { display: none; }
        .scrollable-nav { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* CSS POUR L'ONGLET ET LA CROIX */
        .deck-tab { position: relative; display: flex; alignItems: center; }
        .deck-tab .close-tab-btn {
            opacity: 0;
            transition: opacity 0.2s ease;
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--danger);
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px;
        }
        .deck-tab:hover .close-tab-btn { opacity: 1; }
      `}</style>

      <nav className="header" style={{ 
          background: "var(--bg-header)", borderBottom: "1px solid var(--border)", display: "flex", 
          alignItems: "center", padding: "0 20px", height: "60px", position: "sticky", top: 0, 
          zIndex: 100, justifyContent: "space-between"
      }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "5px", height: "100%", flexShrink: 0 }}>
            <NavLink to="/search" style={navLinkStyle}>Recherche</NavLink>
            {user && (
              <>
                <NavLink to="/cards" style={navLinkStyle}>Collection</NavLink>
                <NavLink to="/device" style={navLinkStyle}>Matériel</NavLink>
                <NavLink to="/items" style={navLinkStyle} end>Mes Decks</NavLink>
              </>
            )}
        </div>

        {/* ZONE DES ONGLETS DYNAMIQUES */}
        <div className="scrollable-nav" style={{ 
            flex: 1, display: "flex", alignItems: "center", gap: "5px", height: "100%", 
            overflowX: "auto", padding: "0 10px", margin: "0 10px",
            borderLeft: openDecks.length > 0 ? "1px solid var(--border)" : "none",
            borderRight: openDecks.length > 0 ? "1px solid var(--border)" : "none"
        }}>
            {user && openDecks.map(deck => (
                <div key={deck.id} className="deck-tab" style={{ height: "100%" }}>
                  <NavLink 
                    to={`/deck/${deck.id}`} 
                    style={(params) => ({
                        ...navLinkStyle(params),
                        fontStyle: "italic",
                        opacity: params.isActive ? 1 : 0.7,
                        paddingRight: "25px" // Laisse la place pour la croix sans que le texte saute
                    })}
                  >
                    {deck.name}
                  </NavLink>
                  <button 
                    className="close-tab-btn" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeTab(deck.id); }}
                    title="Fermer l'onglet"
                  >
                    ✕
                  </button>
                </div>
            ))}
        </div>

        <div style={{ display: "flex", gap: "15px", alignItems: "center", flexShrink: 0 }}>
          {user ? (
            <Link to="/profile" className="item-header" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary)", fontWeight: "bold", textDecoration: "none" }}>
              <img 
                src={user.avatar || DEFAULT_AVATAR} 
                alt="Profil" 
                style={{ width: "35px", height: "35px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--primary)", backgroundColor: "var(--bg-main)" }} 
              />
              {user.nom}
            </Link>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Link to="/login" className="item-header" style={{ textDecoration: "none", color: "var(--text-main)" }}>Connexion</Link>
              <Link to="/register" style={{ textDecoration: "none" }}>
                  <button className="btn-primary" style={{ padding: "6px 12px", fontSize: "0.9rem" }}>Créer un compte</button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to={user ? "/items" : "/login"} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/search" element={<CardSearchBar />} />
            <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
            <Route path="/deck/:id" element={<ProtectedRoute><DeckDetails /></ProtectedRoute>}/>
            <Route path="/cards" element={<ProtectedRoute><CardsList /></ProtectedRoute>} />
            <Route path="/device" element={<ProtectedRoute><DevicePage /></ProtectedRoute>} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage user={user} setUser={setUser} theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} />
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