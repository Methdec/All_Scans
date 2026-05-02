import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../theme.css"; 
import { DECK_FORMATS } from "../utils/deckRules";
import Loader from "./Loader";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [allFolders, setAllFolders] = useState([]); 
  
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("parent_id");
  const [path, setPath] = useState([]); 
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItem, setNewItem] = useState({ nom: "", type: "folder", format: "standard" });

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); 
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState("");
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState("single"); 
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteInput, setDeleteInput] = useState("");

  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });
  const [infoModal, setInfoModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const [showImportDeckModal, setShowImportDeckModal] = useState(false);
  const [importDeckData, setImportDeckData] = useState({ nom: "", format: "standard", decklist: "" });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); 

  const navigate = useNavigate();

  const fetchItems = useCallback(async () => {
    try {
      const url = currentFolderId
        ? `http://127.0.0.1:8000/items?parent_id=${currentFolderId}`
        : "http://127.0.0.1:8000/items";
        
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setItems(data.items);
    } catch (err) { console.error(err); }
  }, [currentFolderId]);

  const fetchPath = useCallback(async () => {
      if (!currentFolderId) {
          setPath([]); 
          return;
      }
      try {
          const res = await fetch(`http://127.0.0.1:8000/items/path/${currentFolderId}`, { credentials: "include" });
          if(res.ok) {
              const data = await res.json();
              setPath(data.path || []);
          }
      } catch(e) { console.error("Erreur path", e); }
  }, [currentFolderId]);

  const fetchAllFolders = useCallback(async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/items/folders/all", { credentials: "include" });
          if (res.ok) {
              const data = await res.json();
              setAllFolders(data.folders || []);
          }
      } catch(e) { console.error("Erreur chargement dossiers", e); }
  }, []);

  useEffect(() => { 
      fetchItems(); 
      fetchPath(); 
      fetchAllFolders();
  }, [fetchItems, fetchPath, fetchAllFolders]);

  const openFolder = (item) => {
    setSearchParams({ parent_id: item.id });
    setIsSelectionMode(false);
    setSelectedItems([]);
  };

  const goRoot = () => {
      setSearchParams({});
      setIsSelectionMode(false);
      setSelectedItems([]);
  };

  const goToPathIndex = (folderId) => {
      setSearchParams({ parent_id: folderId });
      setIsSelectionMode(false);
      setSelectedItems([]);
  };

  const goBackOneLevel = () => {
    if (path.length > 1) {
        const parent = path[path.length - 2];
        setSearchParams({ parent_id: parent.id });
    } else {
        setSearchParams({});
    }
    setIsSelectionMode(false);
    setSelectedItems([]);
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItem.nom.trim()) return;
    try {
      const payload = {
        nom: newItem.nom,
        type: newItem.type,
        parent_id: currentFolderId,
        ...(newItem.type === "deck" && { format: newItem.format })
      };
      await fetch("http://127.0.0.1:8000/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      await fetchItems();
      if (newItem.type === "folder") fetchAllFolders();
      setNewItem({ nom: "", type: "folder", format: "standard" });
      setShowCreateModal(false);
    } catch (err) { console.error(err); }
  };

  const confirmDeleteItem = (item) => {
    setItemToDelete(item);
    setDeleteType("single");
    setDeleteInput("");
    setShowDeleteModal(true);
  };

  const handleDeleteItem = async () => {
    try {
      await fetch(`http://127.0.0.1:8000/items/${itemToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchItems();
      if (itemToDelete.type === "folder") fetchAllFolders();
      
      // --- CORRECTION : Fermeture de l'onglet individuel ---
      const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
      const updatedDecks = storedDecks.filter(d => d.id !== itemToDelete.id);
      localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
      window.dispatchEvent(new Event("decksUpdated"));

      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) { console.error(err); }
  };

  const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      if (isSelectionMode) setSelectedItems([]); 
  };

  const toggleItemSelection = (id) => {
      setSelectedItems(prev => 
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
  };

  const handleBulkMove = async (e) => {
      e.preventDefault();
      if (selectedItems.length === 0) return;

      try {
          for (const id of selectedItems) {
              const res = await fetch(`http://127.0.0.1:8000/items/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ parent_id: moveTargetId || null })
              });
              
              if (!res.ok) {
                  const errorData = await res.json();
                  throw new Error(errorData.detail || "Erreur de deplacement");
              }
          }
          await fetchItems();
          fetchAllFolders();
          setShowMoveModal(false);
          setSelectedItems([]);
          setIsSelectionMode(false);
          setMoveTargetId("");
      } catch (err) {
          setShowMoveModal(false);
          setErrorModal({ isOpen: true, message: err.message });
      }
  };

  const confirmBulkDelete = () => {
      if (selectedItems.length === 0) return;
      setDeleteType("bulk");
      setDeleteInput("");
      setShowDeleteModal(true);
  };

  const executeBulkDelete = async () => {
      try {
          for (const id of selectedItems) {
              await fetch(`http://127.0.0.1:8000/items/${id}`, {
                  method: "DELETE",
                  credentials: "include",
              });
          }
          await fetchItems();
          fetchAllFolders();
          
          // --- CORRECTION : Fermeture des onglets multiples ---
          const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
          const updatedDecks = storedDecks.filter(d => !selectedItems.includes(d.id));
          localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
          window.dispatchEvent(new Event("decksUpdated"));

          setSelectedItems([]);
          setIsSelectionMode(false);
          setShowDeleteModal(false);
      } catch (err) {
          console.error("Erreur suppression multiple", err);
      }
  };

  const handleImportFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          setImportDeckData(prev => ({ ...prev, decklist: event.target.result }));
      };
      reader.readAsText(file);
  };

  const handleImportDeck = async (e) => {
      e.preventDefault();
      if (!importDeckData.nom.trim() || !importDeckData.decklist.trim()) return;
      setIsImporting(true);
      
      try {
          const payload = {
              nom: importDeckData.nom,
              format: importDeckData.format,
              decklist: importDeckData.decklist,
              parent_id: currentFolderId
          };
          
          const res = await fetch("http://127.0.0.1:8000/items/import_deck", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
          });
          
          if (!res.ok) throw new Error("Erreur d'importation");
          
          const data = await res.json();
          await fetchItems();
          
          if (data.missing_cards && data.missing_cards.length > 0) {
              setImportResult(data.missing_cards);
          } else {
              setShowImportDeckModal(false);
              setImportDeckData({ nom: "", format: "standard", decklist: "" });
              setInfoModal({ isOpen: true, type: "success", title: "Succes", message: "Le deck a ete importe avec succes." });
          }
      } catch (err) {
          setErrorModal({ isOpen: true, message: "Erreur lors de l'importation du deck. Veuillez verifier votre liste." });
      } finally {
          setIsImporting(false);
      }
  };

  const closeImportModal = () => {
      setShowImportDeckModal(false);
      setImportResult(null);
      setImportDeckData({ nom: "", format: "standard", decklist: "" });
  };

  const renderItem = (item) => {
    const isSelected = selectedItems.includes(item.id);

    return (
        <div 
            key={item.id} 
            className="item-card" 
            onClick={() => {
                if (isSelectionMode) {
                    toggleItemSelection(item.id);
                } else {
                    item.type === "folder" ? openFolder(item) : navigate(`/deck/${item.id}`);
                }
            }}
            style={{
                position: "relative",
                border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                transform: isSelected ? "translateY(-4px)" : "none",
                boxShadow: isSelected ? "0 8px 16px rgba(0,0,0,0.4)" : "none"
            }}
        >
          {isSelectionMode && (
              <div style={{
                  position: "absolute", top: 10, right: 10, width: 22, height: 22, 
                  borderRadius: "4px", border: "2px solid var(--primary)",
                  background: isSelected ? "var(--primary)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5
              }}>
                  {isSelected && <span style={{ color: "white", fontSize: "16px", fontWeight: "bold", marginTop: "-2px" }}>✓</span>}
              </div>
          )}

          {item.type !== "deck" && !isSelectionMode && (
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}>
                X
            </button>
          )}

          {item.image ? (
            <img 
                src={item.image} 
                alt={item.nom} 
                className="item-image" 
                style={{ objectFit: "cover", objectPosition: "center" }} 
            />
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
                  {item.is_constructed ? "(Construit) " : ""} 
                  {item.cards ? item.cards.length : 0} cartes
              </div>
          )}
        </div>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{margin: 0, color: "var(--primary)"}}>Bibliotheque</h2>
          
          <div style={{ display: "flex", gap: "10px" }}>
              <button 
                  className={isSelectionMode ? "btn-primary" : "btn-secondary"} 
                  onClick={toggleSelectionMode}
              >
                  {isSelectionMode ? "Annuler la selection" : "Selectionner"}
              </button>
              {!isSelectionMode && (
                  <>
                      <button className="btn-secondary" onClick={() => setShowImportDeckModal(true)}>Importer un Deck</button>
                      <button className="btn-primary" onClick={() => setShowCreateModal(true)}>+ Nouveau</button>
                  </>
              )}
          </div>
      </div>

      {isSelectionMode && selectedItems.length > 0 && (
          <div style={{ background: "var(--bg-input)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-main)", fontWeight: "bold" }}>
                  {selectedItems.length} element(s) selectionne(s)
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                  <button className="btn-secondary" onClick={() => setShowMoveModal(true)}>Deplacer</button>
                  <button className="btn-danger" onClick={confirmBulkDelete}>Supprimer</button>
              </div>
          </div>
      )}

      <div style={{ marginBottom: "20px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span onClick={goRoot} style={{ cursor: "pointer", color: !currentFolderId ? "var(--text-main)" : "var(--primary)", fontWeight: !currentFolderId ? "bold" : "normal" }}>
            Racine
        </span>
        
        {path.map((p, i) => (
          <span key={p.id} style={{display: "flex", gap: 5, alignItems: "center"}}>
             <span>/</span>
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

        {currentFolderId && !isSelectionMode && (
            <button className="btn-secondary" onClick={goBackOneLevel} style={{marginLeft: "auto", padding: "4px 10px", fontSize: "0.8rem"}}>
                Remonter
            </button>
        )}
      </div>

      <div className="items-grid">
        {items.length > 0 ? items.map(renderItem) : <p style={{ color: "var(--text-muted)", width: "100%", textAlign: "center", marginTop: 40 }}>Dossier vide.</p>}
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 400 }}>
            <h3 style={{marginTop:0}}>Creer un element</h3>
            <form onSubmit={handleCreateItem}>
              <label style={{display: "block", marginBottom: 5}}>Nom</label>
              <input type="text" value={newItem.nom} onChange={(e) => setNewItem({ ...newItem, nom: e.target.value })} autoFocus style={{width: "93%", marginBottom: 15, padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}} />

              <label style={{display: "block", marginBottom: 5}}>Type</label>
              <div style={{display: "flex", gap: 10, marginBottom: 15}}>
                  <button type="button" className={newItem.type === "folder" ? "btn-primary" : "btn-secondary"} onClick={() => setNewItem({...newItem, type: "folder"})} style={{flex:1}}>Dossier</button>
                  <button type="button" className={newItem.type === "deck" ? "btn-primary" : "btn-secondary"} onClick={() => setNewItem({...newItem, type: "deck"})} style={{flex:1}}>Deck</button>
              </div>

              {newItem.type === "deck" && (
                  <div style={{marginBottom: 15}}>
                      <label style={{display: "block", marginBottom: 5}}>Format</label>
                      <select value={newItem.format} onChange={(e) => setNewItem({...newItem, format: e.target.value})} style={{width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}}>
                          {Object.entries(DECK_FORMATS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                  </div>
              )}

              <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20}}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Creer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportDeckModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 500 }}>
            {isImporting ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0" }}>
                    <Loader />
                    <p style={{ marginTop: "20px", color: "var(--text-main)", fontWeight: "bold" }}>Analyse et construction du deck en cours...</p>
                </div>
            ) : importResult ? (
                <div>
                    <h3 style={{marginTop:0, color: "var(--primary)"}}>Importation partielle</h3>
                    <p style={{color: "var(--text-main)", fontSize: "0.9rem", lineHeight: 1.5}}>Le deck a bien ete cree, mais certaines cartes n'ont pas pu etre trouvees dans la base de donnees (nom incorrect ou syntaxe non reconnue) :</p>
                    
                    <div style={{ background: "var(--bg-input)", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", maxHeight: "200px", overflowY: "auto", marginBottom: "15px", fontSize: "0.85rem", color: "var(--danger)" }}>
                        <ul style={{ margin: 0, paddingLeft: "20px" }}>
                            {importResult.map((c, i) => (
                                <li key={i} style={{ marginBottom: "4px" }}>
                                    <strong>{c.qty}x</strong> {c.name} <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>({c.zone})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div style={{display: "flex", justifyContent: "flex-end", marginTop: 20}}>
                        <button type="button" className="btn-primary" onClick={closeImportModal}>Terminer</button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 style={{marginTop:0}}>Importer une liste de Deck</h3>
                    <form onSubmit={handleImportDeck}>
                      <div style={{display: "flex", gap: "10px", marginBottom: "15px"}}>
                          <div style={{flex: 2}}>
                              <label style={{display: "block", marginBottom: 5}}>Nom du deck</label>
                              <input 
                                  type="text" 
                                  value={importDeckData.nom} 
                                  onChange={(e) => setImportDeckData({ ...importDeckData, nom: e.target.value })} 
                                  autoFocus 
                                  style={{width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}} 
                              />
                          </div>
                          <div style={{flex: 1}}>
                              <label style={{display: "block", marginBottom: 5}}>Format</label>
                              <select 
                                  value={importDeckData.format} 
                                  onChange={(e) => setImportDeckData({...importDeckData, format: e.target.value})} 
                                  style={{width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}}
                              >
                                  {Object.entries(DECK_FORMATS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                              </select>
                          </div>
                      </div>

                      <div style={{marginBottom: 15}}>
                          <label style={{display: "block", marginBottom: 5}}>Fichier (.txt, .csv, .dek)</label>
                          <input 
                              type="file" 
                              accept=".txt,.csv,.dek" 
                              onChange={handleImportFileChange} 
                              style={{width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}} 
                          />
                      </div>

                      <div style={{textAlign: "center", marginBottom: "15px", color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: "bold"}}>OU</div>

                      <div style={{marginBottom: 15}}>
                          <label style={{display: "block", marginBottom: 5}}>Liste (Copier/Coller)</label>
                          <textarea 
                              value={importDeckData.decklist} 
                              onChange={(e) => setImportDeckData({ ...importDeckData, decklist: e.target.value })} 
                              placeholder="Ex:&#10;4 Lightning Bolt&#10;1 Black Lotus"
                              style={{width: "100%", height: "150px", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)", resize: "vertical"}}
                          />
                      </div>

                      <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20}}>
                        <button type="button" className="btn-secondary" onClick={closeImportModal}>Annuler</button>
                        <button type="submit" className="btn-primary" disabled={!importDeckData.nom.trim() || !importDeckData.decklist.trim()}>
                            Importer
                        </button>
                      </div>
                    </form>
                </>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{width: 450, border: "1px solid var(--danger)"}}>
                  <h3 style={{marginTop:0, color: "var(--danger)"}}>Suppression definitive</h3>
                  
                  {deleteType === "single" ? (
                      <>
                          <p>Voulez-vous vraiment supprimer <strong>{itemToDelete?.nom}</strong> ?</p>
                          {itemToDelete?.type === "folder" && (
                              <p style={{fontSize: "0.85rem", color: "var(--text-muted)"}}>Attention : Tout le contenu de ce dossier sera perdu a jamais.</p>
                          )}
                          <div style={{ marginBottom: 20, marginTop: 15 }}>
                              <label style={{ display:"block", marginBottom: 5, fontSize: "0.85rem" }}>Veuillez taper <strong>{itemToDelete?.nom}</strong> pour confirmer :</label>
                              <input 
                                  type="text" 
                                  placeholder={itemToDelete?.nom} 
                                  value={deleteInput} 
                                  onChange={e => setDeleteInput(e.target.value)} 
                                  autoFocus
                                  style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid", borderColor: deleteInput === itemToDelete?.nom ? "var(--success)" : "var(--border)", background: "var(--bg-input)", color: "var(--text-main)", boxSizing: "border-box" }} 
                              />
                          </div>
                      </>
                  ) : (
                      <>
                          <p>Voulez-vous vraiment supprimer les <strong>{selectedItems.length} elements</strong> selectionnes ?</p>
                          
                          <div style={{ background: "var(--bg-input)", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", maxHeight: "120px", overflowY: "auto", marginBottom: "15px", fontSize: "0.85rem", color: "var(--text-main)" }}>
                              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                                  {items.filter(item => selectedItems.includes(item.id)).map(item => (
                                      <li key={item.id} style={{ marginBottom: "4px" }}>
                                          {item.nom} <span style={{ color: "var(--text-muted)" }}>({item.type === "folder" ? "Dossier" : "Deck"})</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                          
                          <p style={{fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 0}}>Attention : Le contenu des dossiers selectionnes sera egalement perdu a jamais.</p>
                          <div style={{ marginBottom: 20, marginTop: 15 }}>
                              <label style={{ display:"block", marginBottom: 5, fontSize: "0.85rem" }}>Veuillez taper <strong>SUPPRIMER</strong> pour confirmer :</label>
                              <input 
                                  type="text" 
                                  placeholder="SUPPRIMER" 
                                  value={deleteInput} 
                                  onChange={e => setDeleteInput(e.target.value)} 
                                  autoFocus
                                  style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid", borderColor: deleteInput === "SUPPRIMER" ? "var(--success)" : "var(--border)", background: "var(--bg-input)", color: "var(--text-main)", boxSizing: "border-box" }} 
                              />
                          </div>
                      </>
                  )}

                  <div style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20}}>
                      <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                      
                      {deleteType === "single" ? (
                          <button 
                              className="btn-secondary" 
                              style={{ background: deleteInput === itemToDelete?.nom ? "var(--danger)" : "var(--bg-input)", color: deleteInput === itemToDelete?.nom ? "white" : "var(--text-muted)", border: "none", cursor: deleteInput === itemToDelete?.nom ? "pointer" : "not-allowed" }} 
                              disabled={deleteInput !== itemToDelete?.nom} 
                              onClick={handleDeleteItem}
                          >
                              Confirmer la suppression
                          </button>
                      ) : (
                          <button 
                              className="btn-secondary" 
                              style={{ background: deleteInput === "SUPPRIMER" ? "var(--danger)" : "var(--bg-input)", color: deleteInput === "SUPPRIMER" ? "white" : "var(--text-muted)", border: "none", cursor: deleteInput === "SUPPRIMER" ? "pointer" : "not-allowed" }} 
                              disabled={deleteInput !== "SUPPRIMER"} 
                              onClick={executeBulkDelete}
                          >
                              Confirmer la suppression
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showMoveModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{width: 400}}>
                  <h3 style={{marginTop:0}}>Deplacer la selection</h3>
                  <form onSubmit={handleBulkMove}>
                      <div style={{ marginBottom: 20 }}>
                          <label style={{display: "block", marginBottom: 5}}>Vers le dossier :</label>
                          <select 
                              value={moveTargetId} 
                              onChange={(e) => setMoveTargetId(e.target.value)}
                              style={{width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)"}}
                          >
                              <option value="">Racine (Aucun dossier)</option>
                              {allFolders
                                  .filter(f => !selectedItems.includes(f.id)) 
                                  .map(f => (
                                  <option key={f.id} value={f.id}>{f.nom}</option>
                              ))}
                          </select>
                      </div>
                      <div style={{display: "flex", justifyContent: "flex-end", gap: 10}}>
                          <button type="button" className="btn-secondary" onClick={() => setShowMoveModal(false)}>Annuler</button>
                          <button type="submit" className="btn-primary">Deplacer</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {errorModal.isOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{width: 350, border: "1px solid var(--danger)"}}>
                  <h3 style={{marginTop:0, color: "var(--danger)"}}>Erreur</h3>
                  <p style={{color: "var(--text-main)", lineHeight: 1.5}}>{errorModal.message}</p>
                  <div style={{display: "flex", justifyContent: "flex-end", marginTop: 20}}>
                      <button className="btn-secondary" onClick={() => setErrorModal({ isOpen: false, message: "" })}>Fermer</button>
                  </div>
              </div>
          </div>
      )}
      
      {infoModal.isOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{width: 350, border: "1px solid var(--success)"}}>
                  <h3 style={{marginTop:0, color: "var(--success)"}}>{infoModal.title}</h3>
                  <p style={{color: "var(--text-main)", lineHeight: 1.5}}>{infoModal.message}</p>
                  <div style={{display: "flex", justifyContent: "flex-end", marginTop: 20}}>
                      <button className="btn-primary" onClick={() => setInfoModal({ isOpen: false, type: "info", title: "", message: "" })}>Fermer</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}