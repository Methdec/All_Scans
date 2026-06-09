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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((curr) => (curr === "light" ? "dark" : "light"));

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

  const closeTab = (deckId) => {
    const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
    const updatedDecks = storedDecks.filter(d => d.id !== deckId);
    localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
    window.dispatchEvent(new Event("decksUpdated"));

    if (window.location.pathname === `/deck/${deckId}`) {
        window.location.href = "/items";
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (!authChecked) return null; 

  const navLinkStyle = ({ isActive }) => ({
    height: "100%", display: "flex", alignItems: "center", padding: "0 15px", textDecoration: "none",
    color: isActive ? "var(--primary)" : "var(--text-main)", fontWeight: isActive ? "bold" : "normal",
    borderBottom: isActive ? "3px solid var(--primary)" : "3px solid transparent"
  });

  return (
    <Router>
      {/* --- MENU LATÉRAL (TIROIR MOBILE) --- */}
      <div className={`mobile-overlay ${isMobileMenuOpen ? "open" : ""}`} onClick={closeMobileMenu}></div>
      <div className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}>
          <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "1.2rem" }}>Menu</span>
              <button onClick={closeMobileMenu} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
          </div>

          <NavLink to="/search" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
              Recherche
          </NavLink>
          
          {/* LIENS AFFICHÉS UNIQUEMENT QUAND DECONNECTÉ */}
          {!user && (
              <>
                  <NavLink to="/login" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                      Se connecter
                  </NavLink>
                  <NavLink to="/register" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                      Créer un compte
                  </NavLink>
              </>
          )}

          {/* LIENS AFFICHÉS UNIQUEMENT QUAND CONNECTÉ */}
          {user && (
              <>
                  <NavLink to="/cards" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                      Collection
                  </NavLink>
                  <NavLink to="/device" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                      Matériel
                  </NavLink>
                  <NavLink to="/items" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu} end>
                      Mes Decks
                  </NavLink>
              </>
          )}

          {user && openDecks.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                  <div style={{ padding: "10px 25px", color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                      Decks ouverts
                  </div>
                  {openDecks.map(deck => (
                      <NavLink 
                          key={deck.id}
                          to={`/deck/${deck.id}`} 
                          className={({ isActive }) => `mobile-deck-link ${isActive ? 'active' : ''}`}
                          onClick={closeMobileMenu}
                      >
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: "10px" }}>
                              {deck.name}
                          </span>
                          <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeTab(deck.id); }}
                              style={{ background: "transparent", border: "none", color: "var(--danger)", fontWeight: "bold", fontSize: "1.1rem", padding: "5px" }}
                          >
                              ✕
                          </button>
                      </NavLink>
                  ))}
              </div>
          )}
      </div>

      {/* BOUTON BURGER FLOTTANT (Apparaît uniquement sur mobile sur les pages d'auth) */}
      <button className="mobile-burger-floating" onClick={() => setIsMobileMenuOpen(true)}>
          ☰
      </button>

      <nav className="header" style={{ 
          background: "var(--bg-header)", borderBottom: "1px solid var(--border)", display: "flex", 
          alignItems: "center", padding: "0 20px", height: "60px", position: "sticky", top: 0, 
          zIndex: 100, justifyContent: "space-between"
      }}>
        
        {/* BOUTON BURGER CLASSIQUE (MOBILE UNIQUEMENT) */}
        <button className="mobile-burger" onClick={() => setIsMobileMenuOpen(true)}>
            ☰
        </button>

        {/* LIENS DE NAVIGATION (PC UNIQUEMENT) */}
        <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: "5px", height: "100%", flexShrink: 0 }}>
            <NavLink to="/search" style={navLinkStyle}>Recherche</NavLink>
            {user && (
              <>
                <NavLink to="/cards" style={navLinkStyle}>Collection</NavLink>
                <NavLink to="/device" style={navLinkStyle}>Matériel</NavLink>
                <NavLink to="/items" style={navLinkStyle} end>Mes Decks</NavLink>
              </>
            )}
        </div>

        {/* ZONE DES ONGLETS DYNAMIQUES (PC UNIQUEMENT) */}
        <div className="scrollable-nav desktop-tabs" style={{ 
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
                        paddingRight: "25px"
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

        {/* AVATAR OU BOUTON DE CONNEXION (VISIBLE PARTOUT) */}
        <div style={{ display: "flex", gap: "15px", alignItems: "center", flexShrink: 0 }}>
          {user ? (
            <Link to="/profile" className="item-header" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--primary)", fontWeight: "bold", textDecoration: "none" }}>
              <img 
                src={user.avatar || DEFAULT_AVATAR} 
                alt="Profil" 
                style={{ width: "35px", height: "35px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--primary)", backgroundColor: "var(--bg-main)" }} 
              />
              <span className="desktop-nav">{user.nom}</span>
            </Link>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Link to="/login" className="item-header desktop-nav" style={{ textDecoration: "none", color: "var(--text-main)" }}>Connexion</Link>
              <Link to="/register" className="desktop-nav" style={{ textDecoration: "none" }}>
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