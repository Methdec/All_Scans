import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FORMATS = ["standard", "commander", "modern", "pioneer", "legacy", "vintage", "pauper"];

export default function DeckSettings({ deck, onUpdate }) {
    const navigate = useNavigate();
    const [folders, setFolders] = useState([]);

    // --- STATES MODALES ---
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    // --- FORM DATA ---
    const [editData, setEditData] = useState({ nom: deck.nom, format: deck.format });
    const [moveData, setMoveData] = useState({ parent_id: deck.parent_id || "" });
    const [duplicateData, setDuplicateData] = useState({ new_name: `Copie - ${deck.nom}`, parent_id: "" });

    useEffect(() => {
        fetch("http://localhost:8000/items/folders/all", { credentials: "include" })
            .then(res => res.json())
            .then(data => setFolders(data.folders || []))
            .catch(err => console.error(err));
    }, []);

    // --- ACTIONS ---

    const handleEdit = async () => {
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify(editData)
            });
            if (res.ok) { setShowEditModal(false); onUpdate(); }
        } catch (e) { console.error(e); }
    };

    const handleMove = async () => {
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ parent_id: moveData.parent_id || null })
            });
            if (res.ok) { setShowMoveModal(false); onUpdate(); alert("Deck déplacé."); }
        } catch (e) { console.error(e); }
    };

    // --- NOUVELLE FONCTION : BASCULER CONSTRUCTION ---
    const toggleConstruction = async () => {
        const newState = !deck.is_constructed;
        const confirmMsg = newState 
            ? "Voulez-vous marquer ce deck comme CONSTRUIT ?\n(Cela signifie qu'il est physiquement assemblé)."
            : "Voulez-vous marquer ce deck comme VIRTUEL ?\n(Les cartes seront considérées comme libres).";
            
        if(!window.confirm(confirmMsg)) return;

        try {
            // On utilise la route générique PUT car elle met à jour n'importe quel champ
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
                // On triche un peu en envoyant un champ que le backend ne filtre pas explicitement dans update_item
                // IL FAUT AJOUTER "is_constructed" DANS LA LISTE DES CHAMPS AUTORISÉS DU BACKEND (voir étape suivante)
                body: JSON.stringify({ is_constructed: newState })
            });
            if (res.ok) { onUpdate(); }
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
                navigate(`/items/${data.new_id}`);
                window.location.reload();
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = async () => {
        if (deleteConfirmation !== deck.nom) return;
        try {
            const res = await fetch(`http://localhost:8000/items/${deck.id}`, { method: "DELETE", credentials: "include" });
            if (res.ok) { navigate("/items"); }
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* 0. ÉTAT DU DECK (NOUVEAU) */}
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderLeft: deck.is_constructed ? "5px solid var(--success)" : "5px solid var(--text-muted)" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>État du Deck</h3>
                    <p style={{ margin: "5px 0 0 0", color: deck.is_constructed ? "var(--success)" : "var(--text-muted)", fontSize: "0.9rem", fontWeight: "bold" }}>
                        {deck.is_constructed ? "🏗️ CONSTRUIT (Physique)" : "💻 VIRTUEL (Liste)"}
                    </p>
                </div>
                <button 
                    className="btn-secondary" 
                    style={{ borderColor: deck.is_constructed ? "var(--success)" : "var(--primary)", color: deck.is_constructed ? "var(--success)" : "var(--primary)" }}
                    onClick={toggleConstruction}
                >
                    {deck.is_constructed ? "♻️ Démonter" : "🏗️ Construire"}
                </button>
            </div>

            {/* 1. MODIFICATION */}
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Informations Générales</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Modifier le nom ou le format.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowEditModal(true)}>🖊️ Modifier</button>
            </div>

            {/* 2. DÉPLACEMENT */}
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Déplacer</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Changer le dossier contenant ce deck.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowMoveModal(true)}>📂 Déplacer</button>
            </div>

            {/* 3. DUPLICATION */}
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none" }}>Dupliquer</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Créer une copie exacte dans un autre dossier.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowDuplicateModal(true)}>📋 Dupliquer</button>
            </div>

            {/* 4. SUPPRESSION */}
            <div className="stat-card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderColor: "var(--danger)" }}>
                <div>
                    <h3 style={{ margin: 0, border: "none", color: "var(--danger)" }}>Zone de Danger</h3>
                    <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Supprimer définitivement ce deck.</p>
                </div>
                <button className="btn-secondary" style={{ background: "var(--danger)", color: "white", border: "none" }} onClick={() => { setDeleteConfirmation(""); setShowDeleteModal(true); }}>🗑️ Supprimer</button>
            </div>

            {/* --- MODALES --- */}
            {/* (Les modales restent identiques à ton code précédent, je ne les répète pas pour alléger, 
                 garde les modales Edit, Move, Duplicate, Delete que je t'ai données juste avant) */}
             {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: "400px" }}>
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

            {showMoveModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: "400px" }}>
                        <h3 style={{ marginTop: 0 }}>Déplacer le deck</h3>
                        <div style={{ marginBottom: 20 }}>
                            <label>Vers le dossier :</label>
                            <select className="input-field" value={moveData.parent_id} onChange={e => setMoveData({parent_id: e.target.value})}>
                                <option value="">Racine (Aucun dossier)</option>
                                {folders.filter(f => f.id !== deck.id).map(f => (
                                    <option key={f.id} value={f.id}>📁 {f.nom}</option>
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
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: "400px" }}>
                        <h3 style={{ marginTop: 0 }}>Dupliquer le deck</h3>
                        <div style={{ marginBottom: 15 }}>
                            <label>Nom de la copie</label>
                            <input type="text" className="input-field" value={duplicateData.new_name} onChange={e => setDuplicateData({...duplicateData, new_name: e.target.value})} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label>Destination</label>
                            <select className="input-field" value={duplicateData.parent_id} onChange={e => setDuplicateData({...duplicateData, parent_id: e.target.value})}>
                                <option value="">Racine</option>
                                {folders.map(f => <option key={f.id} value={f.id}>📁 {f.nom}</option>)}
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
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: "450px", border: "1px solid var(--danger)" }}>
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
        </div>
    );
}