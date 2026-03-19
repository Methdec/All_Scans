import React, { useState, useEffect } from "react";
import "../theme.css";

export default function CollectionManager() {
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [exportFormat, setExportFormat] = useState("txt");
  
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [importPhase, setImportPhase] = useState("idle"); 
  const [progressReading, setProgressReading] = useState(0);
  const [progressCleaning, setProgressCleaning] = useState(0);
  const [progressDb, setProgressDb] = useState(0);
  
  const [totalDbCount, setTotalDbCount] = useState(0);
  const [processedDbCount, setProcessedDbCount] = useState(0);
  
  const [isExporting, setIsExporting] = useState(false);

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, 
    id: null,
    status: "idle", 
    message: ""
  });

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`http://localhost:8000/history?_t=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Erreur historique:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
    }).replace(",", " a");
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
    setActionModal({
      isOpen: true,
      type: "revert",
      id: historyId,
      status: "confirm",
      message: "Attention : Cela va retirer de votre collection toutes les cartes ajoutees lors de cet import. Continuer ?"
    });
  };

  const openClearModal = () => {
    setActionModal({
      isOpen: true,
      type: "clear",
      id: null,
      status: "confirm",
      message: "Voulez-vous vraiment effacer tout l'historique ? (Cela ne supprimera pas vos cartes)"
    });
  };

  const closeModal = () => {
    setActionModal({ isOpen: false, type: null, id: null, status: "idle", message: "" });
  };

  const executeAction = async () => {
    const { type, id } = actionModal;
    setActionModal(prev => ({ ...prev, status: "loading" }));

    if (type === "clear") {
      try {
        const response = await fetch("http://localhost:8000/history", {
          method: "DELETE",
          credentials: "include"
        });
        if (response.ok) {
          setHistory([]);
          setActionModal(prev => ({ ...prev, status: "success", message: "Historique efface avec succes." }));
          setTimeout(closeModal, 1500);
        } else {
          throw new Error("Erreur serveur");
        }
      } catch (error) {
        setActionModal(prev => ({ ...prev, status: "error", message: "Erreur lors de la suppression." }));
      }
    } 
    else if (type === "revert") {
      try {
        const response = await fetch(`http://localhost:8000/history/${id}/revert`, {
          method: "POST",
          credentials: "include"
        });

        if (response.ok) {
          const data = await response.json();
          setActionModal(prev => ({ ...prev, status: "success", message: data.message || "Import annule avec succes." }));
          setExpandedHistoryId(null);
          fetchHistory();
          setTimeout(closeModal, 2000);
        } else {
          const errorData = await response.json();
          setActionModal(prev => ({ ...prev, status: "error", message: `Erreur : ${errorData.detail}` }));
        }
      } catch (error) {
        setActionModal(prev => ({ ...prev, status: "error", message: "Une erreur est survenue lors de l'annulation." }));
      }
    }
  };

  const handleStartImport = () => {
    if (!importText.trim() && !importFile) return;

    setImportPhase("reading");
    setProgressReading(0);
    setProgressCleaning(0);
    setProgressDb(0);
    setProcessedDbCount(0);
    setTotalDbCount(0);

    if (importFile) {
        const reader = new FileReader();
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setProgressReading(percent);
            }
        };
        reader.onload = (e) => {
            setProgressReading(100);
            setTimeout(() => executeCleaning(e.target.result), 300);
        };
        reader.onerror = () => {
            setActionModal({ isOpen: true, type: "error", id: null, status: "error", message: "Erreur lors de la lecture du fichier." });
            setImportPhase("idle");
        };
        reader.readAsText(importFile);
    } else {
        setProgressReading(100);
        setTimeout(() => executeCleaning(importText), 300);
    }
  };

  const executeCleaning = (textToParse) => {
    setImportPhase("cleaning");
    const lines = textToParse.split("\n").filter((l) => l.trim() !== "");
    setTotalDbCount(lines.length);

    if (lines.length === 0) {
        setImportPhase("idle");
        return;
    }

    const parsedData = [];
    const chunkSize = 500; 
    let currentIndex = 0;

    const processChunk = () => {
        const end = Math.min(currentIndex + chunkSize, lines.length);
        for(let i = currentIndex; i < end; i++) {
            const match = lines[i].trim().match(/^(\d+)\s+(.+)$/);
            if (match) {
                parsedData.push({ quantity: parseInt(match[1], 10), name: match[2].trim() });
            } else {
                parsedData.push({ quantity: 1, name: lines[i].trim() });
            }
        }
        
        currentIndex = end;
        setProgressCleaning(Math.floor((currentIndex / lines.length) * 100));

        if (currentIndex < lines.length) {
            setTimeout(processChunk, 15); 
        } else {
            setTimeout(() => executeServerImport(parsedData, lines.length), 300);
        }
    };

    processChunk();
  };

  const executeServerImport = async (parsedData, linesCount) => {
    setImportPhase("db");

    try {
        const res = await fetch("http://localhost:8000/usercards/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(parsedData),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Erreur interne du serveur.");
        }

        let errorsCount = 0;
        const interval = setInterval(async () => {
            try {
                const progRes = await fetch(`http://localhost:8000/usercards/import/progress?_t=${Date.now()}`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Cache-Control": "no-cache" }
                });
                
                if (progRes.ok) {
                    const data = await progRes.json();

                    if (data.status === "starting" || data.status === "processing") {
                        setProcessedDbCount(data.processed);
                        const serverTotal = data.total || linesCount;
                        const pct = Math.floor((data.processed / serverTotal) * 100);
                        setProgressDb(pct);
                    }

                    if (data.status === "completed" || data.status === "error") {
                        clearInterval(interval);
                        setProgressDb(100);
                        setProcessedDbCount(data.total || linesCount);
                        
                        setTimeout(() => {
                            setImportPhase("idle");
                            setImportText("");
                            setImportFile(null);
                            
                            // CORRECTION : On vide l'input file HTML pour pouvoir re-cliquer dessus
                            const fileInput = document.getElementById("file-import-input");
                            if (fileInput) fileInput.value = "";

                            fetchHistory();
                            
                            if (data.status === "error") {
                                setActionModal({ isOpen: true, type: "error", status: "error", message: data.error || "Erreur serveur." });
                            }
                        }, 1000);
                    }
                }
            } catch (err) {
                errorsCount++;
                if (errorsCount > 10) {
                    clearInterval(interval);
                    setImportPhase("idle");
                    setActionModal({ isOpen: true, type: "error", status: "error", message: "Perte de connexion." });
                }
            }
        }, 500);

    } catch (err) {
        console.error(err);
        setImportPhase("idle");
        setActionModal({ isOpen: true, type: "error", status: "error", message: err.message });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`http://localhost:8000/usercards/export?format=${exportFormat}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Erreur lors de l'exportation");

      const disposition = response.headers.get('Content-Disposition');
      let filename = `collection_export.${exportFormat === "mtgo" ? "dek" : exportFormat}`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[1]) { 
            filename = matches[1].replace(/['"]/g, '');
          }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      fetchHistory();

    } catch (error) {
      console.error(error);
      setActionModal({ isOpen: true, type: "error", status: "error", message: "Une erreur est survenue lors de l'exportation." });
    } finally {
      setIsExporting(false);
    }
  };

  const renderProgressBar = (label, percent, phaseName, countText = "") => {
    const isDone = percent === 100;
    const isWaiting = importPhase === "idle" || (percent === 0 && importPhase !== phaseName);

    let color = "var(--primary)"; 
    if (isDone) color = "var(--success, #4CAF50)"; 
    if (isWaiting) color = "var(--text-muted)"; 

    return (
        <div style={{ marginBottom: "12px", opacity: isWaiting ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem", color: "var(--text-main)" }}>
                <span>{label} {countText}</span>
                <span style={{ color: color, fontWeight: "bold" }}>{percent}%</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ height: "100%", width: `${percent}%`, background: color, transition: "width 0.3s ease-out, background 0.3s" }} />
            </div>
        </div>
    );
  };

  const customStyles = `
    .custom-select { 
      appearance: none; background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); 
      border: 1px solid var(--border, #444); padding: 10px 30px 10px 12px; border-radius: 4px; 
      font-size: 0.95rem; width: 100%; cursor: pointer; box-sizing: border-box; 
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e"); 
      background-repeat: no-repeat; background-position: right 10px center; background-size: 20px; transition: all 0.2s ease; 
    }
    .custom-select:hover, .custom-select:focus { border-color: #FF9800; outline: none; }
    
    .custom-textarea { 
      width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border, #444); 
      background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); font-size: 0.9rem; 
      box-sizing: border-box; outline: none; transition: border-color 0.2s; resize: vertical; min-height: 150px; 
    }
    .custom-textarea:hover, .custom-textarea:focus { border-color: #FF9800; }
    
    .file-drop-area {
      display: block; width: 100%; padding: 25px 20px; border-radius: 8px; 
      border: 2px dashed var(--border, #444); background-color: var(--bg-input, #2a2a2a); 
      color: var(--text-main, #fff); cursor: pointer; transition: all 0.2s; 
      box-sizing: border-box; text-align: center;
    }
    .file-drop-area:hover { border-color: #FF9800; background-color: rgba(255, 152, 0, 0.05); }
    .file-drop-area input[type="file"] { display: none; } 
    
    .divider-container {
      display: flex; align-items: center; text-align: center; 
      margin: 25px 0; color: var(--text-muted); font-size: 0.9rem; font-weight: bold;
    }
    .divider-container::before, .divider-container::after {
      content: ''; flex: 1; border-bottom: 1px solid var(--border);
    }
    .divider-container:not(:empty)::before { margin-right: 15px; }
    .divider-container:not(:empty)::after { margin-left: 15px; }

    .btn-action { width: 100%; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: all 0.2s; }
    .btn-primary { background: var(--primary, #FF9800); color: white; border: none; }
    .btn-primary:hover:not(:disabled) { background: #e68a00; }
    .btn-primary:disabled { background: var(--border, #ccc); color: var(--text-muted, #888); cursor: not-allowed; }
    
    .btn-outline { background: transparent; color: var(--primary, #FF9800); border: 2px solid var(--primary, #FF9800); }
    .btn-outline:hover:not(:disabled) { background: rgba(255, 152, 0, 0.1); }
    .btn-outline:disabled { border-color: var(--border, #ccc); color: var(--text-muted, #888); cursor: not-allowed; }

    .history-card-container { background-color: var(--bg-input, #1e1e1e); border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); overflow: hidden; border-left: 4px solid transparent; transition: all 0.2s; border: 1px solid var(--border); }
    .history-card-container.success { border-left-color: #4CAF50; }
    .history-card-container.warning { border-left-color: #FFC107; }
    .history-card-container.error { border-left-color: #F44336; }
    .history-card-header { padding: 15px; display: flex; align-items: center; cursor: pointer; }
    .history-card-header:hover { background-color: rgba(255,255,255,0.02); }
    .history-details-list { padding: 0 15px 15px 15px; border-top: 1px solid var(--border); }
    .history-card-item { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 0.9rem; align-items: center; }
    .history-card-item:last-child { border-bottom: none; }
    
    .card-found { color: var(--primary, #FF9800); font-weight: 500; }
    .card-not-found { color: var(--text-muted, #777); font-style: italic; }

    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 15px; }
    .badge.import { background-color: rgba(33, 150, 243, 0.1); color: #2196F3; border: 1px solid #2196F3; }
    .badge.export { background-color: rgba(156, 39, 176, 0.1); color: #9C27B0; border: 1px solid #9C27B0; }
  `;

  const sectionCardStyle = { 
    background: "var(--bg-main, #fff)", border: "1px solid var(--border)", borderRadius: "12px", 
    padding: "25px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
  };
  const sectionTitleStyle = { marginTop: 0, marginBottom: "20px", color: "var(--text-main)", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "10px" };

  return (
    <>
    <div className="split-layout" style={{ height: "calc(100vh - 110px)", overflow: "hidden" }}>
      <style>{customStyles}</style>

      <div className="sidebar-filters" style={{ height: "100%", padding: "20px", overflowY: "auto", overflowX: "hidden", borderRight: "1px solid var(--border)", background: "var(--bg-panel)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "25px", color: "var(--primary)" }}>Gestion de la Collection</h2>

        <div style={sectionCardStyle}>
          <h3 style={sectionTitleStyle}>Importer des cartes</h3>
          
          <label className="file-drop-area">
            {/* CORRECTION : Ajout de l'ID pour pouvoir vider l'input via JS */}
            <input id="file-import-input" type="file" accept=".txt,.csv,.dek" onChange={handleFileChange} disabled={importPhase !== "idle"} />
            <div style={{ color: "var(--primary)", fontWeight: "bold", marginBottom: "8px", fontSize: "1rem" }}>
              Choisir un fichier
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {importFile ? importFile.name : "Aucun fichier selectionne (.txt, .csv)"}
            </div>
          </label>

          <div className="divider-container">OU</div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "bold" }}>Coller une liste</label>
            <textarea 
              value={importText} onChange={handleTextChange} disabled={importPhase !== "idle"} 
              placeholder="Ex:&#10;4 Lightning Bolt&#10;1 Black Lotus" className="custom-textarea" 
            />
          </div>

          {importPhase !== "idle" ? (
            <div style={{ marginTop: "20px", padding: "15px", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                {renderProgressBar("Lecture du fichier", progressReading, "reading")}
                {renderProgressBar("Nettoyage des lignes", progressCleaning, "cleaning")}
                {renderProgressBar("Ajout a la base de donnees", progressDb, "db", `(${processedDbCount} / ${totalDbCount})`)}
            </div>
          ) : (
            <button onClick={handleStartImport} disabled={(!importText.trim() && !importFile) || isExporting} className="btn-action btn-primary" style={{ marginTop: "10px" }}>
              Lancer l'importation
            </button>
          )}
        </div>

        <div style={sectionCardStyle}>
          <h3 style={sectionTitleStyle}>Exporter la collection</h3>
          <div style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "bold" }}>Format de sortie</label>
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="custom-select">
              <option value="txt">Fichier Texte (.txt)</option>
              <option value="csv">Fichier CSV standard</option>
              <option value="mtgo">Format MTGO (.dek)</option>
              <option value="json">Format JSON (Backup complet)</option>
            </select>
          </div>
          <button onClick={handleExport} disabled={isExporting || importPhase !== "idle"} className="btn-action btn-outline">
            {isExporting ? "Generation en cours..." : "Generer l'export"}
          </button>
        </div>
      </div>

      <div className="results-area" style={{ padding: "30px", overflowY: "auto", position: "relative", backgroundColor: "var(--bg-main)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "25px", color: "var(--text-main)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Historique des operations
          <button onClick={openClearModal} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", textDecoration: "underline" }}>Effacer l'historique</button>
        </h2>

        {loadingHistory ? (
          <div style={{ textAlign: "center", marginTop: "100px", color: "var(--text-muted)" }}>Chargement de l'historique...</div>
        ) : history.length > 0 ? (
          <div>
            {history.map((item) => (
              <div key={item._id} className={`history-card-container ${item.status}`}>
                <div className="history-card-header" onClick={() => toggleHistory(item._id)}>
                  <div className={`badge ${item.type ? item.type.toLowerCase() : "import"}`}>{item.type || "IMPORT"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", color: "var(--text-main)", marginBottom: "4px", fontSize: "1rem" }}>{item.details}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{formatDate(item.date)}</div>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", color: item.status === "success" ? "#4CAF50" : item.status === "warning" ? "#FFC107" : "#F44336", marginRight: "15px" }}>
                    {item.status === "success" ? "Termine" : item.status === "warning" ? "Attention" : "Erreur"}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "1.2rem", transform: expandedHistoryId === item._id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</div>
                </div>

                {expandedHistoryId === item._id && item.cards && item.cards.length > 0 && (
                  <div className="history-details-list">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", marginBottom: "5px" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Cartes affectees :</span>
                      {item.type === "IMPORT" && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); openRevertModal(item._id); }}
                          style={{ background: "var(--danger, #F44336)", color: "white", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold", transition: "background 0.2s" }}
                          onMouseOver={(e) => e.currentTarget.style.background = "#D32F2F"}
                          onMouseOut={(e) => e.currentTarget.style.background = "var(--danger, #F44336)"}
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
                                  {isFoil && (
                                     <span style={{ marginLeft: "6px", background: "linear-gradient(45deg, #FFD700, #FF9800)", color: "#121212", fontSize: "0.65rem", fontWeight: "bold", padding: "2px 4px", borderRadius: "4px", verticalAlign: "middle" }}>
                                         F
                                     </span>
                                  )}
                                </span>
                                <span style={{ fontSize: "0.8rem", color: c.found ? "#4CAF50" : "#F44336" }}>
                                  {c.found ? "Trouvee" : "Introuvable"}
                                </span>
                              </div>
                          );
                      })
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: "100px", color: "var(--text-muted)" }}>Aucune operation recente.</div>
        )}
      </div>
    </div>

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
          {actionModal.status === "loading" && (
             <div style={{ margin: "20px 0", color: "var(--text-main)" }}><p>Traitement en cours, veuillez patienter...</p></div>
          )}
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