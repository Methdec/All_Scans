import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../theme.css"; 
import { DECK_FORMATS } from "../utils/deckRules";
import Loader from "./Loader";
import { API_BASE_URL } from '../utils/api';

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
        ? `${API_BASE_URL}/items?parent_id=${currentFolderId}`
        : `${API_BASE_URL}/items`;
        
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
          const res = await fetch(`${API_BASE_URL}/items/path/${currentFolderId}`, { credentials: "include" });
          if(res.ok) {
              const data = await res.json();
              setPath(data.path || []);
          }
      } catch(e) { console.error("Erreur path", e); }
  }, [currentFolderId]);

  const fetchAllFolders = useCallback(async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/items/folders/all`, { credentials: "include" });
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
      await fetch(`${API_BASE_URL}/items`, {
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
      await fetch(`${API_BASE_URL}/items/${itemToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchItems();
      if (itemToDelete.type === "folder") fetchAllFolders();
      
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
              const res = await fetch(`${API_BASE_URL}/items/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ parent_id: moveTargetId || null })
              });
              
              if (!res.ok) {
                  const errorData = await res.json();
                  throw new Error(errorData.detail || "Erreur de déplacement");
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
              await fetch(`${API_BASE_URL}/items/${id}`, {
                  method: "DELETE",
                  credentials: "include",
              });
          }
          await fetchItems();
          fetchAllFolders();
          
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
          
          const res = await fetch(`${API_BASE_URL}/items/import_deck`, {
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
              setInfoModal({ isOpen: true, type: "success", title: "Succès", message: "Le deck a été importé avec succès." });
          }
      } catch (err) {
          setErrorModal({ isOpen: true, message: "Erreur lors de l'importation du deck. Veuillez vérifier votre liste." });
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
            className={`item-card ${isSelected ? 'ip-card-selected' : ''}`}
            onClick={() => {
                if (isSelectionMode) {
                    toggleItemSelection(item.id);
                } else {
                    item.type === "folder" ? openFolder(item) : navigate(`/deck/${item.id}`);
                }
            }}
        >
          {isSelectionMode && (
              <div className={`ip-checkbox ${isSelected ? 'active' : ''}`}>
                  {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                  )}
              </div>
          )}

          {item.type !== "deck" && !isSelectionMode && (
            <button className="delete-btn" onClick={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}>X</button>
          )}

          {item.image ? (
            <img src={item.image} alt={item.nom} className="item-image" style={{ objectFit: "cover", objectPosition: "center" }} />
          ) : (
            <div className="ip-folder-icon">
                {item.type === "folder" ? (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                )}
            </div>
          )}

          <div className="font-bold text-main mt-8">{item.nom}</div>
          
          {item.type === "deck" && (
              <div className="text-sm text-primary mt-5">
                  {item.is_constructed ? "(Construit) " : ""} 
                  {item.cards ? item.cards.length : 0} cartes
              </div>
          )}
        </div>
    );
  };

  return (
    <div className="p-20">
      
      <div className="ip-header">
          <h2 className="m-0 text-primary">Bibliothèque</h2>
          
          <div className="flex gap-10">
              <button className={isSelectionMode ? "btn-primary" : "btn-secondary"} onClick={toggleSelectionMode}>
                  {isSelectionMode ? "Annuler la sélection" : "Sélectionner"}
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
          <div className="ip-selection-bar">
              <span className="text-main font-bold">
                  {selectedItems.length} élément(s) sélectionné(s)
              </span>
              <div className="flex gap-10">
                  <button className="btn-secondary" onClick={() => setShowMoveModal(true)}>Déplacer</button>
                  <button className="btn-danger" onClick={confirmBulkDelete}>Supprimer</button>
              </div>
          </div>
      )}

      <div className="ip-breadcrumb">
        <span onClick={goRoot} className={!currentFolderId ? "ip-breadcrumb-active" : "ip-breadcrumb-link text-primary"}>
            Racine
        </span>
        
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-5">
             <span>/</span>
             {i === path.length - 1 ? (
                 <span className="text-main font-bold">{p.name}</span>
             ) : (
                 <span className="ip-breadcrumb-link text-primary" onClick={() => goToPathIndex(p.id)}>
                    {p.name}
                 </span>
             )}
          </span>
        ))}

        {currentFolderId && !isSelectionMode && (
            <button className="btn-secondary ml-auto" onClick={goBackOneLevel} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                Remonter
            </button>
        )}
      </div>

      <div className="items-grid">
        {items.length > 0 ? items.map(renderItem) : <p className="w-full text-center text-muted mt-20">Dossier vide.</p>}
      </div>

      {/* --- MODALE CRÉATION --- */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-sm">
            <h3 className="m-0 mb-15">Créer un élément</h3>
            <form onSubmit={handleCreateItem}>
              <div className="form-group">
                  <label className="form-label">Nom</label>
                  <input type="text" className="input-field w-full" value={newItem.nom} onChange={(e) => setNewItem({ ...newItem, nom: e.target.value })} autoFocus />
              </div>

              <div className="form-group">
                  <label className="form-label">Type</label>
                  <div className="flex gap-10">
                      <button type="button" className={newItem.type === "folder" ? "btn-primary flex-1" : "btn-secondary flex-1"} onClick={() => setNewItem({...newItem, type: "folder"})}>Dossier</button>
                      <button type="button" className={newItem.type === "deck" ? "btn-primary flex-1" : "btn-secondary flex-1"} onClick={() => setNewItem({...newItem, type: "deck"})}>Deck</button>
                  </div>
              </div>

              {newItem.type === "deck" && (
                  <div className="form-group">
                      <label className="form-label">Format</label>
                      <select className="input-field w-full" value={newItem.format} onChange={(e) => setNewItem({...newItem, format: e.target.value})}>
                          {Object.entries(DECK_FORMATS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                  </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODALE IMPORT DECK --- */}
      {showImportDeckModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-md">
            {isImporting ? (
                <div className="flex-col items-center py-12">
                    <Loader />
                    <p className="mt-20 text-main font-bold">Analyse et construction du deck en cours...</p>
                </div>
            ) : importResult ? (
                <div>
                    <h3 className="m-0 text-primary mb-10">Importation partielle</h3>
                    <p className="text-main text-sm mb-15" style={{ lineHeight: 1.5 }}>Le deck a bien été créé, mais certaines cartes n'ont pas pu être trouvées dans la base de données (nom incorrect ou syntaxe non reconnue) :</p>
                    
                    <div className="ip-import-result">
                        <ul className="m-0 pl-20">
                            {importResult.map((c, i) => (
                                <li key={i} className="mb-5">
                                    <strong>{c.qty}x</strong> {c.name} <span className="text-muted text-sm">({c.zone})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="modal-actions">
                        <button type="button" className="btn-primary" onClick={closeImportModal}>Terminer</button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 className="m-0 mb-15">Importer une liste de Deck</h3>
                    <form onSubmit={handleImportDeck}>
                      <div className="flex gap-10 mb-15">
                          <div style={{flex: 2}}>
                              <label className="form-label">Nom du deck</label>
                              <input type="text" className="input-field w-full" value={importDeckData.nom} onChange={(e) => setImportDeckData({ ...importDeckData, nom: e.target.value })} autoFocus />
                          </div>
                          <div className="flex-1">
                              <label className="form-label">Format</label>
                              <select className="input-field w-full" value={importDeckData.format} onChange={(e) => setImportDeckData({...importDeckData, format: e.target.value})}>
                                  {Object.entries(DECK_FORMATS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                              </select>
                          </div>
                      </div>

                      <div className="form-group">
                          <label className="form-label">Fichier (.txt, .csv, .dek)</label>
                          <input type="file" accept=".txt,.csv,.dek" className="input-field w-full" onChange={handleImportFileChange} />
                      </div>

                      <div className="text-center mb-15 text-muted text-sm font-bold">OU</div>

                      <div className="form-group">
                          <label className="form-label">Liste (Copier/Coller)</label>
                          <textarea 
                              className="input-field w-full"
                              style={{ height: "150px", resize: "vertical" }}
                              value={importDeckData.decklist} 
                              onChange={(e) => setImportDeckData({ ...importDeckData, decklist: e.target.value })} 
                              placeholder="Ex:&#10;4 Lightning Bolt&#10;1 Black Lotus"
                          />
                      </div>

                      <div className="modal-actions">
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

      {/* --- MODALE SUPPRESSION --- */}
      {showDeleteModal && (
          <div className="modal-overlay">
              <div className="modal-content ip-modal-danger modal-md">
                  <h3 className="m-0 text-danger mb-10">Suppression définitive</h3>
                  
                  {deleteType === "single" ? (
                      <>
                          <p>Voulez-vous vraiment supprimer <strong>{itemToDelete?.nom}</strong> ?</p>
                          {itemToDelete?.type === "folder" && (
                              <p className="text-sm text-muted">Attention : Tout le contenu de ce dossier sera perdu à jamais.</p>
                          )}
                          <div className="mt-15 mb-20">
                              <label className="form-label text-sm font-normal">Veuillez taper <strong>{itemToDelete?.nom}</strong> pour confirmer :</label>
                              <input 
                                  type="text" 
                                  className={`input-field w-full ${deleteInput === itemToDelete?.nom ? "input-success" : ""}`}
                                  placeholder={itemToDelete?.nom} 
                                  value={deleteInput} 
                                  onChange={e => setDeleteInput(e.target.value)} 
                                  autoFocus
                              />
                          </div>
                      </>
                  ) : (
                      <>
                          <p className="mb-10">Voulez-vous vraiment supprimer les <strong>{selectedItems.length} éléments</strong> sélectionnés ?</p>
                          
                          <div className="ip-delete-list">
                              <ul className="m-0 pl-20">
                                  {items.filter(item => selectedItems.includes(item.id)).map(item => (
                                      <li key={item.id} className="mb-5">
                                          {item.nom} <span className="text-muted">({item.type === "folder" ? "Dossier" : "Deck"})</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                          
                          <p className="text-sm text-muted mt-0">Attention : Le contenu des dossiers sélectionnés sera également perdu à jamais.</p>
                          <div className="mt-15 mb-20">
                              <label className="form-label text-sm font-normal">Veuillez taper <strong>SUPPRIMER</strong> pour confirmer :</label>
                              <input 
                                  type="text" 
                                  className={`input-field w-full ${deleteInput === "SUPPRIMER" ? "input-success" : ""}`}
                                  placeholder="SUPPRIMER" 
                                  value={deleteInput} 
                                  onChange={e => setDeleteInput(e.target.value)} 
                                  autoFocus
                              />
                          </div>
                      </>
                  )}

                  <div className="modal-actions">
                      <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                      
                      {deleteType === "single" ? (
                          <button 
                              className="btn-danger-filled" 
                              disabled={deleteInput !== itemToDelete?.nom} 
                              onClick={handleDeleteItem}
                          >
                              Confirmer la suppression
                          </button>
                      ) : (
                          <button 
                              className="btn-danger-filled" 
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

      {/* --- MODALE DÉPLACEMENT --- */}
      {showMoveModal && (
          <div className="modal-overlay">
              <div className="modal-content modal-sm">
                  <h3 className="m-0 mb-15">Déplacer la sélection</h3>
                  <form onSubmit={handleBulkMove}>
                      <div className="form-group">
                          <label className="form-label">Vers le dossier :</label>
                          <select className="input-field w-full" value={moveTargetId} onChange={(e) => setMoveTargetId(e.target.value)}>
                              <option value="">Racine (Aucun dossier)</option>
                              {allFolders
                                  .filter(f => !selectedItems.includes(f.id)) 
                                  .map(f => (
                                  <option key={f.id} value={f.id}>{f.nom}</option>
                              ))}
                          </select>
                      </div>
                      <div className="modal-actions">
                          <button type="button" className="btn-secondary" onClick={() => setShowMoveModal(false)}>Annuler</button>
                          <button type="submit" className="btn-primary">Déplacer</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- MODALES INFO / ERREUR --- */}
      {errorModal.isOpen && (
          <div className="modal-overlay">
              <div className="modal-content ip-modal-danger modal-sm">
                  <h3 className="m-0 text-danger mb-10">Erreur</h3>
                  <p className="text-main" style={{ lineHeight: 1.5 }}>{errorModal.message}</p>
                  <div className="modal-actions mt-20">
                      <button className="btn-secondary" onClick={() => setErrorModal({ isOpen: false, message: "" })}>Fermer</button>
                  </div>
              </div>
          </div>
      )}
      
      {infoModal.isOpen && (
          <div className="modal-overlay">
              <div className="modal-content ip-modal-success modal-sm">
                  <h3 className="m-0 text-success mb-10">{infoModal.title}</h3>
                  <p className="text-main" style={{ lineHeight: 1.5 }}>{infoModal.message}</p>
                  <div className="modal-actions mt-20">
                      <button className="btn-primary" onClick={() => setInfoModal({ isOpen: false, type: "info", title: "", message: "" })}>Fermer</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}