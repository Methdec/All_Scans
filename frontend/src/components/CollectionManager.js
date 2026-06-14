import React, { useState, useEffect, useMemo } from "react";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';
import RecapModal from "./RecapModal"; // <-- L'IMPORT MANQUANT ÉTAIT LÀ !

const TYPE_PRIORITY = [
  "Creature", "Planeswalker", "Instant", "Sorcery", 
  "Enchantment", "Artifact", "Battle", "Land", "Other"
];

const TYPE_TRANSLATIONS = {
  Creature: "Créatures", Planeswalker: "Planeswalkers", Instant: "Éphémères",
  Sorcery: "Rituels", Enchantment: "Enchantements", Artifact: "Artefacts",
  Battle: "Batailles", Land: "Terrains", Other: "Autres"
};

const getCardCategory = (typeLine) => {
    if (!typeLine) return "Other";
    const ignored = ["legendary", "basic", "snow", "world", "tribal"];
    const mainTypeString = typeLine.split("—")[0].split("-")[0].trim();
    const types = mainTypeString.split(" ");
    
    let bestType = "Other";
    let bestPriorityIndex = 999;

    for (let t of types) {
        if (ignored.includes(t.toLowerCase())) continue;
        const cleanType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        const priorityIdx = TYPE_PRIORITY.indexOf(cleanType);
        if (priorityIdx !== -1 && priorityIdx < bestPriorityIndex) {
            bestPriorityIndex = priorityIdx;
            bestType = cleanType;
        }
    }
    return bestType;
};

export default function CollectionManager() {
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [exportFormat, setExportFormat] = useState("txt");
  
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [recapModalData, setRecapModalData] = useState(null);
  
  const [importPhase, setImportPhase] = useState("idle"); 
  const [progressReading, setProgressReading] = useState(0);
  const [progressCleaning, setProgressCleaning] = useState(0);
  const [progressDb, setProgressDb] = useState(0);
  
  const [totalDbCount, setTotalDbCount] = useState(0);
  const [processedDbCount, setProcessedDbCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [actionModal, setActionModal] = useState({
    isOpen: false, type: null, id: null, status: "idle", message: ""
  });

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/history?_t=${Date.now()}`, {
        method: "GET", credentials: "include", headers: { "Cache-Control": "no-cache" }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) { console.error("Erreur historique:", error); } 
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  const toggleHistory = (id) => {
    setExpandedHistoryId(expandedHistoryId === id ? null : id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const validDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    const date = new Date(validDateString);
    return date.toLocaleString("fr-FR", { 
      day: "2-digit", month: "2-digit", year: "numeric", 
      hour: "2-digit", minute: "2-digit" 
    }).replace(",", " à");
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportText("");
    }
  };

  const handleTextChange = (e) => {
    setImportText(e.target.value);
    setImportFile(null); 
  };

  const openRevertModal = (historyId) => {
    setActionModal({ isOpen: true, type: "revert", id: historyId, status: "confirm", message: "Attention : Cela va retirer de votre collection toutes les cartes ajoutées lors de cet import. Continuer ?" });
  };

  const openClearModal = () => {
    setActionModal({ isOpen: true, type: "clear", id: null, status: "confirm", message: "Voulez-vous vraiment effacer tout l'historique ? (Cela ne supprimera pas vos cartes)" });
  };

  const closeModal = () => setActionModal({ isOpen: false, type: null, id: null, status: "idle", message: "" });

  const executeAction = async () => {
    const { type, id } = actionModal;
    setActionModal(prev => ({ ...prev, status: "loading" }));

    if (type === "clear") {
      try {
        const response = await fetch(`${API_BASE_URL}/history`, { method: "DELETE", credentials: "include" });
        if (response.ok) {
          setHistory([]);
          setActionModal(prev => ({ ...prev, status: "success", message: "Historique effacé avec succès." }));
          setTimeout(closeModal, 1500);
        } else throw new Error("Erreur serveur");
      } catch (error) { setActionModal(prev => ({ ...prev, status: "error", message: "Erreur lors de la suppression." })); }
    } 
    else if (type === "revert") {
      try {
        const response = await fetch(`${API_BASE_URL}/history/${id}/revert`, { method: "POST", credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setActionModal(prev => ({ ...prev, status: "success", message: data.message || "Import annulé avec succès." }));
          setExpandedHistoryId(null);
          fetchHistory();
          setTimeout(closeModal, 2000);
        } else {
          const errorData = await response.json();
          setActionModal(prev => ({ ...prev, status: "error", message: `Erreur : ${errorData.detail}` }));
        }
      } catch (error) { setActionModal(prev => ({ ...prev, status: "error", message: "Une erreur est survenue lors de l'annulation." })); }
    }
  };

  const handleOpenRecap = async (logId) => {
      setRecapModalData({ _loading: true }); 
      try {
          const res = await fetch(`${API_BASE_URL}/history/${logId}/recap`, { credentials: "include" });
          if (res.ok) {
              const data = await res.json();
              setRecapModalData(data);
          } else {
              setRecapModalData(null);
              setActionModal({ isOpen: true, type: "error", status: "error", message: "Erreur du serveur (404). Vérifiez que la route Python est bien active." });
          }
      } catch (err) {
          console.error("Erreur chargement recap", err);
          setRecapModalData(null);
          setActionModal({ isOpen: true, type: "error", status: "error", message: "Impossible de joindre le serveur pour générer le bilan." });
      }
  };

  const handleStartImport = () => {
    if (!importText.trim() && !importFile) return;
    setImportPhase("reading");
    setProgressReading(0); setProgressCleaning(0); setProgressDb(0);
    setProcessedDbCount(0); setTotalDbCount(0);

    if (importFile) {
        const reader = new FileReader();
        reader.onprogress = (e) => { if (e.lengthComputable) setProgressReading(Math.round((e.loaded / e.total) * 100)); };
        reader.onload = (e) => { setProgressReading(100); setTimeout(() => executeCleaning(e.target.result), 300); };
        reader.onerror = () => { setActionModal({ isOpen: true, type: "error", status: "error", message: "Erreur lecture." }); setImportPhase("idle"); };
        reader.readAsText(importFile);
    } else {
        setProgressReading(100); setTimeout(() => executeCleaning(importText), 300);
    }
  };

  const executeCleaning = (textToParse) => {
    setImportPhase("cleaning");
    const lines = textToParse.split("\n").filter((l) => l.trim() !== "");
    setTotalDbCount(lines.length);

    if (lines.length === 0) return setImportPhase("idle");

    const parsedData = [];
    const chunkSize = 500; 
    let currentIndex = 0;

    const processChunk = () => {
        const end = Math.min(currentIndex + chunkSize, lines.length);
        for(let i = currentIndex; i < end; i++) {
            const match = lines[i].trim().match(/^(\d+)\s+(.+)$/);
            if (match) parsedData.push({ quantity: parseInt(match[1], 10), name: match[2].trim() });
            else parsedData.push({ quantity: 1, name: lines[i].trim() });
        }
        currentIndex = end;
        setProgressCleaning(Math.floor((currentIndex / lines.length) * 100));

        if (currentIndex < lines.length) setTimeout(processChunk, 15); 
        else setTimeout(() => executeServerImport(parsedData, lines.length), 300);
    };
    processChunk();
  };

  const executeServerImport = async (parsedData, linesCount) => {
    setImportPhase("db");
    try {
        const res = await fetch(`${API_BASE_URL}/usercards/import`, {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(parsedData),
        });
        if (!res.ok) throw new Error("Erreur interne du serveur.");

        let errorsCount = 0;
        const interval = setInterval(async () => {
            try {
                const progRes = await fetch(`${API_BASE_URL}/usercards/import/progress?_t=${Date.now()}`, { method: "GET", credentials: "include" });
                if (progRes.ok) {
                    const data = await progRes.json();
                    if (data.status === "starting" || data.status === "processing") {
                        setProcessedDbCount(data.processed);
                        setProgressDb(Math.floor((data.processed / (data.total || linesCount)) * 100));
                    }
                    if (data.status === "completed" || data.status === "error") {
                        clearInterval(interval);
                        setProgressDb(100); setProcessedDbCount(data.total || linesCount);
                        setTimeout(() => {
                            setImportPhase("idle"); setImportText(""); setImportFile(null);
                            const fileInput = document.getElementById("file-import-input");
                            if (fileInput) fileInput.value = "";
                            fetchHistory();
                            if (data.status === "error") setActionModal({ isOpen: true, type: "error", status: "error", message: data.error || "Erreur serveur." });
                        }, 1000);
                    }
                }
            } catch (err) {
                errorsCount++;
                if (errorsCount > 10) {
                    clearInterval(interval); setImportPhase("idle");
                    setActionModal({ isOpen: true, type: "error", status: "error", message: "Perte de connexion." });
                }
            }
        }, 500);
    } catch (err) {
        setImportPhase("idle");
        setActionModal({ isOpen: true, type: "error", status: "error", message: err.message });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usercards/export?format=${exportFormat}`, { method: "GET", credentials: "include" });
      if (!response.ok) throw new Error("Erreur lors de l'exportation");

      const disposition = response.headers.get('Content-Disposition');
      let filename = `collection_export.${exportFormat === "mtgo" ? "dek" : exportFormat}`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
          if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      fetchHistory();
    } catch (error) {
      setActionModal({ isOpen: true, type: "error", status: "error", message: "Erreur d'exportation." });
    } finally { setIsExporting(false); }
  };

  const renderProgressBar = (label, percent, phaseName, countText = "") => {
    const isDone = percent === 100;
    const isWaiting = importPhase === "idle" || (percent === 0 && importPhase !== phaseName);
    let color = "var(--primary)"; 
    if (isDone) color = "var(--success, #4CAF50)"; 
    if (isWaiting) color = "var(--text-muted)"; 

    return (
        <div className="cm-progress-item" style={{ opacity: isWaiting ? 0.5 : 1 }}>
            <div className="cm-progress-header">
                <span>{label} {countText}</span>
                <span style={{ color: color, fontWeight: "bold" }}>{percent}%</span>
            </div>
            <div className="cm-progress-bg">
                <div className="cm-progress-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
        </div>
    );
  };

  return (
    <>
    <div className="cm-split-layout">
      
      {/* PANNEAU : IMPORT / EXPORT (En haut sur Mobile, à gauche sur PC) */}
      <div className="cm-sidebar">
        <h2 className="cm-title">Gestion de la Collection</h2>

        <div className="cm-box">
          <h3 className="cm-subtitle">Importer des cartes</h3>
          
          <label className="file-drop-area">
            <input id="file-import-input" type="file" accept=".txt,.csv,.dek" onChange={handleFileChange} disabled={importPhase !== "idle"} />
            <div style={{ color: "var(--primary)", fontWeight: "bold", marginBottom: "8px", fontSize: "1rem" }}>Choisir un fichier</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{importFile ? importFile.name : "Aucun fichier (.txt, .csv)"}</div>
          </label>

          <div className="divider-container">OU</div>

          <div style={{ marginBottom: "20px" }}>
            <label className="cm-label">Coller une liste</label>
            <textarea value={importText} onChange={handleTextChange} disabled={importPhase !== "idle"} placeholder="Ex:&#10;4 Lightning Bolt" className="custom-textarea" />
          </div>

          {importPhase !== "idle" ? (
            <div className="cm-progress-container">
                {renderProgressBar("Lecture du fichier", progressReading, "reading")}
                {renderProgressBar("Nettoyage", progressCleaning, "cleaning")}
                {renderProgressBar("Ajout BDD", progressDb, "db", `(${processedDbCount} / ${totalDbCount})`)}
            </div>
          ) : (
            <button onClick={handleStartImport} disabled={(!importText.trim() && !importFile) || isExporting} className="btn-action btn-primary">
              Lancer l'importation
            </button>
          )}
        </div>

        <div className="cm-box">
          <h3 className="cm-subtitle">Exporter la collection</h3>
          <div style={{ marginBottom: "25px" }}>
            <label className="cm-label">Format de sortie</label>
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="custom-select">
              <option value="txt">Fichier Texte (.txt)</option>
              <option value="csv">Fichier CSV standard</option>
              <option value="mtgo">Format MTGO (.dek)</option>
              <option value="json">Format JSON (Backup complet)</option>
            </select>
          </div>
          <button onClick={handleExport} disabled={isExporting || importPhase !== "idle"} className="btn-action btn-outline">
            {isExporting ? "Génération en cours..." : "Générer l'export"}
          </button>
        </div>
      </div>

      {/* PANNEAU : HISTORIQUE (En bas sur Mobile, à droite sur PC) */}
      <div className="cm-results-area">
        <h2 className="cm-title">
          Historique des opérations
          <button onClick={openClearModal} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", textDecoration: "underline" }}>Effacer l'historique</button>
        </h2>

        {loadingHistory ? (
          <div style={{ textAlign: "center", marginTop: "100px", color: "var(--text-muted)" }}>Chargement de l'historique...</div>
        ) : history.length > 0 ? (
          <div>
            {history.map((item) => {
              const hasCards = item.cards && item.cards.length > 0;
              return (
                <div key={item._id} className={`history-card-container ${item.status}`}>
                  <div className="history-card-header" onClick={() => toggleHistory(item._id)}>
                    <div className={`badge ${item.type ? item.type.toLowerCase() : "import"}`}>{item.type || "IMPORT"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", color: "var(--text-main)", marginBottom: "4px", fontSize: "1rem" }}>{item.details}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{formatDate(item.date)}</div>
                    </div>
                    
                    {hasCards && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenRecap(item._id); }} 
                            className="btn-outline" 
                            style={{ marginRight: "15px", padding: "4px 10px", fontSize: "0.8rem", borderRadius: "4px", borderWidth: "1px", height: "fit-content" }}
                        >
                            Bilan
                        </button>
                    )}

                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", color: item.status === "success" ? "#4CAF50" : item.status === "warning" ? "#FFC107" : "#F44336", marginRight: "15px" }}>
                      {item.status === "success" ? "Terminé" : item.status === "warning" ? "Attention" : "Erreur"}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "1.2rem", transform: expandedHistoryId === item._id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</div>
                  </div>

                  {expandedHistoryId === item._id && hasCards && (
                    <div className="history-details-list">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", marginBottom: "5px" }}>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Cartes affectées :</span>
                        {item.type === "IMPORT" && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); openRevertModal(item._id); }}
                            className="cm-btn-revert"
                          >
                            Annuler cet import
                          </button>
                        )}
                      </div>
                      {[...item.cards]
                        .sort((a, b) => (a.found === b.found ? 0 : a.found ? 1 : -1))
                        .map((c, i) => {
                            const isFoil = c.name.includes("(Foil)");
                            const displayName = c.name.replace(" (Foil)", "");
                            return (
                                <div key={i} className="history-card-item">
                                  <span className={c.found ? "card-found" : "card-not-found"}>
                                    {c.quantity && `${c.quantity}x `}{displayName}
                                    {isFoil && <span className="foil-badge-sm">F</span>}
                                  </span>
                                  <span style={{ fontSize: "0.8rem", color: c.found ? "#4CAF50" : "#F44336" }}>
                                    {c.found ? "Trouvée" : "Introuvable"}
                                  </span>
                                </div>
                            );
                        })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: "100px", color: "var(--text-muted)" }}>Aucune opération récente.</div>
        )}
      </div>

    </div>

    {/* MODALE DU RECAPITULATIF BDD DEPORTEE ICI */}
    {recapModalData && (
        <RecapModal 
            recapData={recapModalData} 
            loading={recapModalData._loading} 
            onClose={() => setRecapModalData(null)} 
        />
    )}

    {/* MODALES D'ACTIONS (CONFIRMATION, ERREUR...) */}
    {actionModal.isOpen && (
      <div className="modal-overlay" onClick={actionModal.status === "confirm" || actionModal.status === "error" || actionModal.status === "success" ? closeModal : null}>
        <div className="modal-box" style={{ width: "450px", flexDirection: "column", padding: "25px", textAlign: "center", alignItems: "center" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, color: "var(--primary)", fontSize: "1.4rem", marginBottom: "20px" }}>
            {actionModal.type === "revert" ? "Annuler l'importation" : actionModal.type === "clear" ? "Effacer l'historique" : "Erreur"}
          </h3>
          
          {actionModal.status === "confirm" && (
            <>
              <p style={{ color: "var(--text-main)", fontSize: "1rem", lineHeight: "1.5" }}>{actionModal.message}</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "25px", width: "100%" }}>
                <button onClick={closeModal} className="btn-secondary" style={{ flex: 1 }}>Non, annuler</button>
                <button onClick={executeAction} className="btn-primary" style={{ flex: 1, background: "var(--danger, #F44336)" }}>Oui, confirmer</button>
              </div>
            </>
          )}
          {actionModal.status === "loading" && <div style={{ margin: "20px 0", color: "var(--text-main)" }}><p>Traitement en cours, veuillez patienter...</p></div>}
          {actionModal.status === "success" && (
             <>
               <p style={{ color: "var(--success, #4CAF50)", fontWeight: "bold", fontSize: "1.1rem", margin: "20px 0" }}>{actionModal.message}</p>
               <button onClick={closeModal} className="btn-primary" style={{ width: "100%" }}>Fermer</button>
             </>
          )}
          {actionModal.status === "error" && (
             <>
               <p style={{ color: "var(--danger, #F44336)", fontWeight: "bold", fontSize: "1.1rem", margin: "20px 0" }}>{actionModal.message}</p>
               <button onClick={closeModal} className="btn-secondary" style={{ width: "100%" }}>Fermer</button>
             </>
          )}
        </div>
      </div>
    )}
    </>
  );
}