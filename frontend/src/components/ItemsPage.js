import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../theme.css"; 
import { validateDeck, DECK_FORMATS } from "../utils/deckRules";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  
  // Lecture de l'URL pour savoir où on est
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("parent_id");

  const [path, setPath] = useState([]); // Le fil d'ariane visuel
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [newItem, setNewItem] = useState({ nom: "", image: "", type: "folder", format: "standard" });
  const [showImageModal, setShowImageModal] = useState(false);
  const [userCards, setUserCards] = useState([]);

  const navigate = useNavigate();

  // --- 1. CHARGEMENT DES ITEMS (Contenu du dossier) ---
  const fetchItems = useCallback(async () => {
    try {
      const url = currentFolderId
        ? `http://localhost:8000/items?parent_id=${currentFolderId}`
        : "http://localhost:8000/items";
        
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setItems(data.items);
    } catch (err) { console.error(err); }
  }, [currentFolderId]);

  // --- 2. CHARGEMENT DU CHEMIN (Fil d'Ariane Complet) ---
  const fetchPath = useCallback(async () => {
      if (!currentFolderId) {
          setPath([]); // Racine
          return;
      }
      try {
          // Appel à la nouvelle route Backend qui calcule toute la hiérarchie
          const res = await fetch(`http://localhost:8000/items/path/${currentFolderId}`, { credentials: "include" });
          if(res.ok) {
              const data = await res.json();
              setPath(data.path || []);
          }
      } catch(e) { console.error("Erreur path", e); }
  }, [currentFolderId]);

  // On lance les deux chargements quand l'ID change
  useEffect(() => { 
      fetchItems(); 
      fetchPath(); 
  }, [fetchItems, fetchPath]);


  // --- NAVIGATION ---

  const openFolder = (item) => {
    // On change juste l'URL, le useEffect fera le reste (chargement items + calcul path)
    setSearchParams({ parent_id: item.id });
  };

  const goRoot = () => {
      setSearchParams({});
  };

  const goToPathIndex = (folderId) => {
      setSearchParams({ parent_id: folderId });
  };

  const goBackOneLevel = () => {
    if (path.length > 1) {
        // On va à l'avant-dernier élément du path
        const parent = path[path.length - 2];
        setSearchParams({ parent_id: parent.id });
    } else {
        // Sinon racine
        setSearchParams({});
    }
  };

  // --- ACTIONS CRUD ---

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItem.nom.trim()) return;
    try {
      const payload = {
        nom: newItem.nom,
        image: newItem.type === "folder" ? null : newItem.image,
        type: newItem.type,
        parent_id: currentFolderId,
        ...(newItem.type === "deck" && { format: newItem.format })
      };
      await fetch("http://localhost:8000/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      await fetchItems();
      setNewItem({ nom: "", image: "", type: "folder", format: "standard" });
      setShowCreateModal(false);
    } catch (err) { console.error(err); }
  };

  const confirmDeleteItem = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDeleteItem = async () => {
    try {
      await fetch(`http://localhost:8000/items/${itemToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchItems();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) { console.error(err); }
  };

  const openImagePicker = async () => {
    try {
      const res = await fetch("http://localhost:8000/usercards", { credentials: "include" });
      const data = await res.json();
      setUserCards(data.cards || []);
      setShowImageModal(true);
    } catch (err) { console.error(err); }
  };

  const handleSelectImage = (img) => {
    setNewItem({ ...newItem, image: img });
    setShowImageModal(false);
  };

  // --- RENDU ITEM ---
  const renderItem = (item) => {
    let validation = null;
    if (item.type === "deck") {
        validation = validateDeck(item.format, item.cards || []);
    }

    return (
        <div key={item.id} className="item-card" onClick={() => item.type === "folder" ? openFolder(item) : navigate(`/items/${item.id}`)}>
          {/* Badge Validation */}
          {validation && !validation.isValid && (
             <div title={validation.message} style={{ position: "absolute", top: -5, left: -5, background: "var(--danger)", color: "white", borderRadius: "50%", width: 20, height: 20, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>!</div>
          )}

          {/* Bouton Suppression : UNIQUEMENT POUR LES DOSSIERS */}
          {item.type !== "deck" && (
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}>
                ✕
            </button>
          )}

          {/* Image ou Icône */}
          {item.image ? (
            <img src={item.image} alt={item.nom} className="item-image" />
          ) : (
            <div className="item-image" style={{background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)"}}>
                {item.type === "folder" ? (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                )}
            </div>
          )}

          <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 8 }}>{item.nom}</div>
          
          {item.type === "deck" && (
              <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: 2 }}>
                  {item.is_constructed ? "🏗️ " : ""} 
                  {item.cards ? item.cards.length : 0} cartes
              </div>
          )}
        </div>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{margin: 0, color: "var(--primary)"}}>Bibliothèque</h2>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Nouveau</button>
      </div>

      {/* Fil d'ariane Amélioré */}
      <div style={{ marginBottom: "20px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span onClick={goRoot} style={{ cursor: "pointer", color: !currentFolderId ? "var(--text-main)" : "var(--primary)", fontWeight: !currentFolderId ? "bold" : "normal" }}>
            Racine
        </span>
        
        {path.map((p, i) => (
          <span key={p.id} style={{display: "flex", gap: 5, alignItems: "center"}}>
             <span>/</span>
             {/* Le dernier élément est en gras (courant), les autres sont cliquables */}
             {i === path.length - 1 ? (
                 <span style={{ color: "var(--text-main)", fontWeight: "bold" }}>{p.name}</span>
             ) : (
                 <span 
                    style={{ cursor: "pointer", color: "var(--primary)" }} 
                    onClick={() => goToPathIndex(p.id)}
                 >
                    {p.name}
                 </span>
             )}
          </span>
        ))}

        {currentFolderId && (
            <button className="btn-secondary" onClick={goBackOneLevel} style={{marginLeft: "auto", padding: "4px 10px", fontSize: "0.8rem"}}>
                ↑ Remonter
            </button>
        )}
      </div>

      {/* Grille */}
      <div className="items-grid">
        {items.length > 0 ? items.map(renderItem) : <p style={{ color: "var(--text-muted)", width: "100%", textAlign: "center", marginTop: 40 }}>Dossier vide.</p>}
      </div>

      {/* --- MODALES --- */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 400 }}>
            <h3 style={{marginTop:0}}>Créer un élément</h3>
            <form onSubmit={handleCreateItem}>
              <label style={{display: "block", marginBottom: 5}}>Nom</label>
              <input type="text" value={newItem.nom} onChange={(e) => setNewItem({ ...newItem, nom: e.target.value })} autoFocus style={{width: "93%", marginBottom: 15}} />

              <label style={{display: "block", marginBottom: 5}}>Type</label>
              <div style={{display: "flex", gap: 10, marginBottom: 15}}>
                  <button type="button" className={newItem.type === "folder" ? "btn-primary" : "btn-secondary"} onClick={() => setNewItem({...newItem, type: "folder"})} style={{flex:1}}>Dossier</button>
                  <button type="button" className={newItem.type === "deck" ? "btn-primary" : "btn-secondary"} onClick={() => setNewItem({...newItem, type: "deck"})} style={{flex:1}}>Deck</button>
              </div>

              {newItem.type === "deck" && (
                  <div style={{marginBottom: 15}}>
                      <label style={{display: "block", marginBottom: 5}}>Format</label>
                      <select value={newItem.format} onChange={(e) => setNewItem({...newItem, format: e.target.value})} style={{width: "100%"}}>
                          {Object.entries(DECK_FORMATS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                  </div>
              )}

              {newItem.type === "deck" && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{display: "block", marginBottom: 5}}>Image</label>
                  {newItem.image ? (
                    <div style={{ position: "relative" }}>
                      <img src={newItem.image} alt="Preview" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: "var(--radius)" }} />
                      <button type="button" onClick={() => setNewItem({ ...newItem, image: "" })} className="btn-danger" style={{ position: "absolute", top: 5, right: 5 }}>Supprimer</button>
                    </div>
                  ) : (
                    <button type="button" onClick={openImagePicker} className="btn-secondary" style={{width: "100%"}}>Choisir une carte</button>
                  )}
                </div>
              )}

              <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20}}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE SUPPRESSION */}
      {showDeleteModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{width: 350}}>
                  <h3>Supprimer ?</h3>
                  <p>Voulez-vous vraiment supprimer <strong>{itemToDelete?.nom}</strong> ?</p>
                  <p style={{fontSize: "0.8rem", color: "var(--text-muted)"}}>Si c'est un dossier, tout son contenu sera perdu.</p>
                  <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20}}>
                      <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                      <button className="btn-danger" onClick={handleDeleteItem}>Supprimer</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODALE IMAGE */}
      {showImageModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{ width: "80%", height: "80%", display: "flex", flexDirection: "column" }}>
                  <h3>Choisir une image</h3>
                  <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                      {userCards.map(c => (
                          c.image_normal && <img key={c.id} src={c.image_normal} alt={c.name} onClick={() => handleSelectImage(c.image_normal)} style={{width: "100%", cursor: "pointer", borderRadius: 8}} />
                      ))}
                  </div>
                  <div style={{marginTop: 20, textAlign: "right"}}>
                      <button className="btn-secondary" onClick={() => setShowImageModal(false)}>Fermer</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}