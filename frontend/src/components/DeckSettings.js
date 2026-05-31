import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

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
        fetch(`${API_BASE_URL}/items/folders/all`, { credentials: "include" })
            .then(res => res.json())
            .then(data => setFolders(data.folders || []))
            .catch(err => console.error(err));
    }, []);

    const closeInfoModal = () => setInfoModal({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });

    const handleEdit = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify(editData)
            });
            if (res.ok) { 
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
            const res = await fetch(`${API_BASE_URL}/items/${deck.id}`, {
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
            const res = await fetch(`${API_BASE_URL}/items/${deck.id}`, {
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
            const res = await fetch(`${API_BASE_URL}/items/${deck.id}/duplicate`, {
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
            const res = await fetch(`${API_BASE_URL}/items/${deck.id}`, { method: "DELETE", credentials: "include" });
            if (res.ok) { 
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
        <div className="deck-settings-container">
            
            <div className={`stat-card stat-card-row ${deck.is_constructed ? "border-left-success" : "border-left-muted"}`}>
                <div>
                    <h3 className="stat-card-title">État du Deck</h3>
                    <p className={`stat-card-desc ${deck.is_constructed ? "success" : ""}`}>
                        {deck.is_constructed ? "CONSTRUIT (Physique)" : "VIRTUEL (Liste)"}
                    </p>
                </div>
                <button 
                    className={deck.is_constructed ? "btn-outline-success" : "btn-outline-primary"}
                    onClick={toggleConstruction}
                >
                    {deck.is_constructed ? "Démonter" : "Construire"}
                </button>
            </div>

            <div className="stat-card stat-card-row">
                <div>
                    <h3 className="stat-card-title">Informations Générales</h3>
                    <p className="stat-card-desc">Modifier le nom ou le format.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowEditModal(true)}>Modifier</button>
            </div>

            <div className="stat-card stat-card-row">
                <div>
                    <h3 className="stat-card-title">Exporter</h3>
                    <p className="stat-card-desc">Télécharger la liste de cartes au format texte ou MTGO.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowExportModal(true)}>Exporter</button>
            </div>

            <div className="stat-card stat-card-row">
                <div>
                    <h3 className="stat-card-title">Déplacer</h3>
                    <p className="stat-card-desc">Changer le dossier contenant ce deck.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowMoveModal(true)}>Déplacer</button>
            </div>

            <div className="stat-card stat-card-row">
                <div>
                    <h3 className="stat-card-title">Dupliquer</h3>
                    <p className="stat-card-desc">Créer une copie exacte.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowDuplicateModal(true)}>Dupliquer</button>
            </div>

            <div className="stat-card stat-card-row border-danger-card">
                <div>
                    <h3 className="stat-card-title text-danger">Zone de Danger</h3>
                    <p className="stat-card-desc">Supprimer définitivement ce deck.</p>
                </div>
                <button className="btn-danger-filled" onClick={() => { setDeleteConfirmation(""); setShowDeleteModal(true); }}>Supprimer</button>
            </div>

            {/* --- MODALES FORMULAIRES --- */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Modifier le deck</h3>
                        <div className="form-group">
                            <label className="form-label">Nom</label>
                            <input type="text" className="input-field" value={editData.nom} onChange={e => setEditData({...editData, nom: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Format</label>
                            <select className="input-field" value={editData.format} onChange={e => setEditData({...editData, format: e.target.value})}>
                                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleEdit}>Valider</button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Exporter le deck</h3>
                        <div className="form-group">
                            <label className="form-label">Format de sortie</label>
                            <select className="input-field" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                                <option value="txt">Texte brut (.txt / MTG Arena)</option>
                                <option value="mtgo">MTGO (.dek)</option>
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowExportModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleExportDeck}>Télécharger</button>
                        </div>
                    </div>
                </div>
            )}

            {showMoveModal && (
                <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
                    <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Déplacer le deck</h3>
                        <div className="form-group">
                            <label className="form-label">Vers le dossier :</label>
                            <select className="input-field" value={moveData.parent_id} onChange={e => setMoveData({parent_id: e.target.value})}>
                                <option value="">Racine (Aucun dossier)</option>
                                {folders.filter(f => f.id !== deck.id).map(f => (
                                    <option key={f.id} value={f.id}>{f.nom}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowMoveModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleMove}>Déplacer</button>
                        </div>
                    </div>
                </div>
            )}

            {showDuplicateModal && (
                <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
                    <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Dupliquer le deck</h3>
                        <div className="form-group">
                            <label className="form-label">Nom de la copie</label>
                            <input type="text" className="input-field" value={duplicateData.new_name} onChange={e => setDuplicateData({...duplicateData, new_name: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Destination</label>
                            <select className="input-field" value={duplicateData.parent_id} onChange={e => setDuplicateData({...duplicateData, parent_id: e.target.value})}>
                                <option value="">Racine</option>
                                {folders.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowDuplicateModal(false)}>Annuler</button>
                            <button className="btn-primary" onClick={handleDuplicate}>Copier</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content modal-md border-danger-card" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title text-danger">Suppression définitive</h3>
                        <p className="modal-subtitle">Cette action est irréversible. Le deck <strong>{deck.nom}</strong> sera perdu à jamais.</p>
                        <div className="form-group mt-20">
                            <label className="form-label text-sm font-normal">Veuillez taper <strong>{deck.nom}</strong> pour confirmer :</label>
                            <input 
                                type="text" 
                                className={`input-field ${deleteConfirmation === deck.nom ? "input-success" : ""}`}
                                placeholder={deck.nom} 
                                value={deleteConfirmation} 
                                onChange={e => setDeleteConfirmation(e.target.value)} 
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Annuler</button>
                            <button 
                                className="btn-danger-filled" 
                                disabled={deleteConfirmation !== deck.nom} 
                                onClick={handleDelete}
                            >
                                Je comprends, supprimer ce deck
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {buildErrorModal.isOpen && (
                <div className="modal-overlay" onClick={() => setBuildErrorModal({ isOpen: false, missingCards: [] })}>
                  <div className="modal-box modal-lg modal-flex-col" onClick={e => e.stopPropagation()}>
                    <div className="modal-header-bordered">
                        <h3 className="modal-title-danger">Cartes manquantes</h3>
                        <p className="modal-subtitle">Vous ne possédez pas les exemplaires disponibles requis pour assembler ce deck physiquement.</p>
                    </div>
                    <div className="missing-cards-list">
                        {buildErrorModal.missingCards.map((card, index) => (
                            <div key={index} className={`missing-card-item ${card.reason === "not_in_collection" ? "reason-not-in-collection" : "reason-used-elsewhere"}`}>
                                <div className="missing-card-header">
                                    <strong className="missing-card-name">{card.name}</strong>
                                    <span className="missing-card-count">{card.available} / {card.required} dispo</span>
                                </div>
                                {card.reason === "not_in_collection" ? (
                                    <div className="text-danger text-sm">Exemplaires manquants dans votre collection globale.</div>
                                ) : (
                                    <div className="text-primary text-sm"><span className="text-muted">Cartes utilisées dans : </span><strong>{card.used_in.join(", ")}</strong></div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="modal-actions">
                        <button onClick={() => setBuildErrorModal({ isOpen: false, missingCards: [] })} className="btn-primary">Fermer</button>
                    </div>
                  </div>
                </div>
            )}

            {infoModal.isOpen && (
                <div className="modal-overlay" onClick={infoModal.type !== "confirm" ? closeInfoModal : null}>
                    <div className="modal-box modal-sm modal-flex-col text-center items-center" onClick={e => e.stopPropagation()}>
                        <h3 className={`modal-title ${infoModal.type === "error" ? "text-danger" : infoModal.type === "success" ? "text-success" : "text-primary"}`}>
                            {infoModal.title}
                        </h3>
                        <p className="info-modal-message">{infoModal.message}</p>
                        <div className="modal-actions justify-center w-full mt-0">
                            {infoModal.type === "confirm" ? (
                                <>
                                    <button onClick={closeInfoModal} className="btn-secondary flex-1">Annuler</button>
                                    <button onClick={infoModal.onConfirm} className="btn-primary flex-1">Confirmer</button>
                                </>
                            ) : (
                                <button onClick={closeInfoModal} className="btn-primary w-full">Fermer</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}