import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FORMATS = ["standard", "commander", "modern", "pioneer", "legacy", "vintage", "pauper"];

export default function DeckSettings({ deck, onUpdate }) {
    const navigate = useNavigate();
    const [folders, setFolders] = useState([]);

    const [showEditModal, setShowEditModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState("txt");
    
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    
    const [buildErrorModal, setBuildErrorModal] = useState({
        isOpen: false,
        missingCards: []
    });

    const [infoModal, setInfoModal] = useState({
        isOpen: false,
        type: "info", 
        title: "",
        message: "",
        onConfirm: null
    });

    const [editData, setEditData] = useState({ nom: deck.nom, format: deck.format });
    const [moveData, setMoveData] = useState({ parent_id: deck.parent_id || "" });
    const [duplicateData, setDuplicateData] = useState({ new_name: `Copie - ${deck.nom}`, parent_id: "" });

    useEffect(() => {
        fetch("http://localhost:8000/items/folders/all", { credentials: "include" })
            .then(res => res.json())
            .then(data => setFolders(data.folders || []))
            .catch(err => console.error(err));
    }, []);

    const closeInfoModal = () => setInfoModal({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });

    const handleEdit = async () => {
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify(editData)
            });
            if (res.ok) { 
                // --- NOUVEAU : Met à jour le nom dans l'onglet si le deck est ouvert ---
                const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
                const updatedDecks = storedDecks.map(d => d.id === deck.id ? { ...d, name: editData.nom } : d);
                localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
                window.dispatchEvent(new Event("decksUpdated"));

                setShowEditModal(false); 
                onUpdate(); 
            }
        } catch (e) { console.error(e); }
    };

    const handleMove = async () => {
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ parent_id: moveData.parent_id || null })
            });
            if (res.ok) { 
                setShowMoveModal(false); 
                onUpdate(); 
                setInfoModal({
                    isOpen: true, type: "success", title: "Succès", message: "Le deck a bien été déplacé."
                });
            }
        } catch (e) { console.error(e); }
    };

    const toggleConstruction = () => {
        const newState = !deck.is_constructed;
        const msg = newState 
            ? "Voulez-vous marquer ce deck comme CONSTRUIT ?\nCela signifie qu'il est physiquement assemblé et bloquera les cartes dans votre collection."
            : "Voulez-vous marquer ce deck comme VIRTUEL ?\nLes cartes seront libérées et de nouveau disponibles pour d'autres decks.";
            
        setInfoModal({
            isOpen: true,
            type: "confirm",
            title: "Confirmation",
            message: msg,
            onConfirm: () => executeToggleConstruction(newState)
        });
    };

    const executeToggleConstruction = async (newState) => {
        closeInfoModal();
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ is_constructed: newState })
            });
            
            if (res.ok) { 
                onUpdate(); 
            } else {
                const errorData = await res.json();
                if (errorData.detail && errorData.detail.missing_cards) {
                    setBuildErrorModal({ isOpen: true, missingCards: errorData.detail.missing_cards });
                } else {
                    setInfoModal({ isOpen: true, type: "error", title: "Erreur", message: errorData.detail || "Impossible de modifier le deck" });
                }
            }
        } catch(e) { console.error(e); }
    };

    const handleDuplicate = async () => {
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}/duplicate`, {
                method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ new_name: duplicateData.new_name, parent_id: duplicateData.parent_id || null })
            });
            if (res.ok) {
                const data = await res.json();
                navigate(`/deck/${data.new_id}`);
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = async () => {
        if (deleteConfirmation !== deck.nom) return;
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, { method: "DELETE", credentials: "include" });
            if (res.ok) { 
                // --- NOUVEAU : Ferme l'onglet automatiquement à la suppression ---
                const storedDecks = JSON.parse(localStorage.getItem("openDecks") || "[]");
                const updatedDecks = storedDecks.filter(d => d.id !== deck.id);
                localStorage.setItem("openDecks", JSON.stringify(updatedDecks));
                window.dispatchEvent(new Event("decksUpdated"));

                navigate("/items"); 
            }
        } catch (e) { console.error(e); }
    };

    const handleExportDeck = () => {
        if (!deck || !deck.cards || deck.cards.length === 0) {
            setShowExportModal(false);
            setInfoModal({ isOpen: true, type: "error", title: "Erreur", message: "Ce deck est vide, il n'y a rien à exporter." });
            return;
        }

        let content = "";
        let safeFilename = deck.nom.replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_export";
        let mimeType = "text/plain";

        const mainboard = deck.cards.filter(c => !c.is_sideboard);
        const sideboard = deck.cards.filter(c => c.is_sideboard);

        if (exportFormat === "txt") {
            const formatCards = (cardsList) => cardsList.map(c => `${c.quantity} ${c.name}`).join("\n");
            content += formatCards(mainboard);
            if (sideboard.length > 0) {
                content += "\n\nSIDEBOARD:\n";
                content += formatCards(sideboard);
            }
            safeFilename += ".txt";
            
        } else if (exportFormat === "mtgo") {
            content = `<?xml version="1.0" encoding="UTF-8"?>\n<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <NetDeckID>0</NetDeckID>\n  <PreconstructedDeckID>0</PreconstructedDeckID>\n`;
            deck.cards.forEach(c => {
                content += `  <Cards CatID="0" Quantity="${c.quantity}" Sideboard="${c.is_sideboard ? 'true' : 'false'}" Name="${c.name}" />\n`;
            });
            content += `</Deck>`;
            
            safeFilename += ".dek";
            mimeType = "application/xml";
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setShowExportModal(false);
        setInfoModal({ isOpen: true, type: "success", title: "Succès", message: "Le deck a été exporté avec succès !" });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderLeft: deck.is_constructed ? "5px solid var(--success)" : "5px solid var(--text-muted)" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>État du Deck</h3>
                    <p style={{ margin: "5px 0 0 0", color: deck.is_constructed ? "var(--success)" : "var(--text-muted)", fontSize: "0.9rem", fontWeight: "bold" }}>
                        {deck.is_constructed ? "CONSTRUIT (Physique)" : "VIRTUEL (Liste)"}
                    </p>
                </div>
                <button 
                    className="btn-secondary" 
                    style={{ borderColor: deck.is_constructed ? "var(--success)" : "var(--primary)", color: deck.is_constructed ? "var(--success)" : "var(--primary)" }}
                    onClick={toggleConstruction}
                >
                    {deck.is_constructed ? "Démonter" : "Construire"}
                </button>
            </div>

            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Informations Générales</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Modifier le nom ou le format.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowEditModal(true)}>Modifier</button>
            </div>

            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Exporter</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Télécharger la liste du deck (Arena, MTGO...).</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowExportModal(true)}>Exporter</button>
            </div>

            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Déplacer</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Changer le dossier contenant ce deck.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowMoveModal(true)}>Déplacer</button>
            </div>

            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Dupliquer</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Créer une copie exacte.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowDuplicateModal(true)}>Dupliquer</button>
            </div>

            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderColor: "var(--danger)" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none", color: "var(--danger)" }}>Zone de Danger</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Supprimer définitivement ce deck.</p>
                </div>
                <button className="btn-secondary" style={{ background: "var(--danger)", color: "white", border: "none" }} onClick={() => { setDeleteConfirmation(""); setShowDeleteModal(true); }}>Supprimer</button>
            </div>

            {/* --- MODALES FORMULAIRES --- */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Modifier le deck</h3>
                        <div style={{ marginBottom: 15 }}>
                            <label>Nom</label>
                            <input type="text" className="input-field" value={editData.nom} onChange={e => setEditData({...editData, nom: e.target.value})} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label>Format</label>
                            <select className="input-field" value={editData.format} onChange={e => setEditData({...editData, format: e.target.value})}>
                                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                            <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleEdit}>Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Exporter le deck</h3>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "bold" }}>Format de sortie</label>
                            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }}>
                                <option value="txt">Texte brut (.txt / MTG Arena)</option>
                                <option value="mtgo">MTGO (.dek)</option>
                            </select>
                        </div>
                        <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                            <button className="btn-secondary" onClick={() => setShowExportModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleExportDeck}>Télécharger</button>
                        </div>
                    </div>
                </div>
            )}

            {showMoveModal && (
                <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
                    <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Déplacer le deck</h3>
                        <div style={{ marginBottom: 20 }}>
                            <label>Vers le dossier :</label>
                            <select className="input-field" value={moveData.parent_id} onChange={e => setMoveData({parent_id: e.target.value})}>
                                <option value="">Racine (Aucun dossier)</option>
                                {folders.filter(f => f.id !== deck.id).map(f => (
                                    <option key={f.id} value={f.id}>{f.nom}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                            <button className="btn-secondary" onClick={() => setShowMoveModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleMove}>Déplacer</button>
                        </div>
                    </div>
                </div>
            )}

            {showDuplicateModal && (
                <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
                    <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Dupliquer le deck</h3>
                        <div style={{ marginBottom: 15 }}>
                            <label>Nom de la copie</label>
                            <input type="text" className="input-field" value={duplicateData.new_name} onChange={e => setDuplicateData({...duplicateData, new_name: e.target.value})} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label>Destination</label>
                            <select className="input-field" value={duplicateData.parent_id} onChange={e => setDuplicateData({...duplicateData, parent_id: e.target.value})}>
                                <option value="">Racine</option>
                                {folders.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                            </select>
                        </div>
                        <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                            <button className="btn-secondary" onClick={() => setShowDuplicateModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleDuplicate}>Copier</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" style={{ width: "450px", border: "1px solid var(--danger)" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, color: "var(--danger)" }}>Suppression définitive</h3>
                        <p style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Cette action est irréversible. Le deck <strong>{deck.nom}</strong> sera perdu à jamais.</p>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display:"block", marginBottom: 5, fontSize: "0.85rem" }}>Veuillez taper <strong>{deck.nom}</strong> pour confirmer :</label>
                            <input type="text" className="input-field" placeholder={deck.nom} value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} style={{ borderColor: deleteConfirmation === deck.nom ? "var(--success)" : "var(--border)" }} />
                        </div>
                        <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                            <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                            <button className="btn-secondary" style={{ background: deleteConfirmation === deck.nom ? "var(--danger)" : "var(--bg-input)", color: deleteConfirmation === deck.nom ? "white" : "var(--text-muted)", border: "none", cursor: deleteConfirmation === deck.nom ? "pointer" : "not-allowed" }} disabled={deleteConfirmation !== deck.nom} onClick={handleDelete}>Je comprends, supprimer ce deck</button>
                        </div>
                    </div>
                </div>
            )}

            {buildErrorModal.isOpen && (
                <div className="modal-overlay" onClick={() => setBuildErrorModal({ isOpen: false, missingCards: [] })}>
                  <div className="modal-box" style={{ width: "550px", flexDirection: "column", padding: "25px", maxHeight: "80vh", display: "flex", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "15px", marginBottom: "15px", flexShrink: 0 }}>
                        <h3 style={{ marginTop: 0, color: "var(--danger, #F44336)", fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "10px" }}>Cartes manquantes</h3>
                        <p style={{ color: "var(--text-main)", margin: 0, fontSize: "0.95rem" }}>Vous ne possédez pas les exemplaires disponibles requis pour assembler ce deck physiquement.</p>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1, paddingRight: "5px" }}>
                        {buildErrorModal.missingCards.map((card, index) => (
                            <div key={index} style={{ background: "var(--bg-input)", borderLeft: `4px solid ${card.reason === "not_in_collection" ? "#F44336" : "#FF9800"}`, padding: "12px 15px", borderRadius: "4px", marginBottom: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                                    <strong style={{ color: "var(--text-main)", fontSize: "1rem" }}>{card.name}</strong>
                                    <span style={{ fontWeight: "bold", color: "var(--text-muted)" }}>{card.available} / {card.required} dispo</span>
                                </div>
                                {card.reason === "not_in_collection" ? (
                                    <div style={{ color: "var(--danger, #F44336)", fontSize: "0.85rem" }}>Exemplaires manquants dans votre collection globale.</div>
                                ) : (
                                    <div style={{ color: "var(--primary, #FF9800)", fontSize: "0.85rem" }}><span style={{ color: "var(--text-muted)" }}>Cartes utilisées dans : </span><strong>{card.used_in.join(", ")}</strong></div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                        <button onClick={() => setBuildErrorModal({ isOpen: false, missingCards: [] })} className="btn-primary">Fermer</button>
                    </div>
                  </div>
                </div>
            )}

            {infoModal.isOpen && (
                <div className="modal-overlay" onClick={infoModal.type !== "confirm" ? closeInfoModal : null}>
                    <div className="modal-box" style={{ width: "400px", flexDirection: "column", padding: "25px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, color: infoModal.type === "error" ? "var(--danger)" : infoModal.type === "success" ? "var(--success)" : "var(--primary)" }}>{infoModal.title}</h3>
                        <p style={{ color: "var(--text-main)", fontSize: "1rem", whiteSpace: "pre-line", lineHeight: 1.5, margin: "15px 0 25px 0" }}>{infoModal.message}</p>
                        <div style={{ display: "flex", justifyContent: "center", gap: "15px", width: "100%" }}>
                            {infoModal.type === "confirm" ? (
                                <>
                                    <button onClick={closeInfoModal} className="btn-secondary" style={{ flex: 1 }}>Annuler</button>
                                    <button onClick={infoModal.onConfirm} className="btn-primary" style={{ flex: 1 }}>Confirmer</button>
                                </>
                            ) : (
                                <button onClick={closeInfoModal} className="btn-primary" style={{ width: "100%" }}>Fermer</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}