import React, { useState, useEffect, useMemo } from "react";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

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

  // Etats de la Modale Recapitulatif
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

  // Calcul des statistiques du recap
  const recapStats = useMemo(() => {
    if (!recapModalData || recapModalData._loading || !recapModalData.cards) return null;

    let totalPrice = 0;
    let maxPrice = 0;
    let mostExpensiveCard = null;
    let typeDistribution = {};
    let manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "6+": 0 };
    let maxManaCurveCount = 0;
    let totalCardsImported = 0;

    recapModalData.cards.forEach(card => {
        const qty = card.quantity || 1;
        totalCardsImported += qty;

        const price = parseFloat(card.prices?.eur || card.prices?.usd || 0);
        totalPrice += price * qty;

        if (price > maxPrice) {
            maxPrice = price;
            mostExpensiveCard = card;
        }

        const cat = getCardCategory(card.type_line);
        typeDistribution[cat] = (typeDistribution[cat] || 0) + qty;

        if (cat !== "Land") {
            const cmc = Math.floor(card.cmc || 0);
            const key = cmc >= 6 ? "6+" : cmc;
            manaCurve[key] += qty;
            if (manaCurve[key] > maxManaCurveCount) {
                maxManaCurveCount = manaCurve[key];
            }
        }
    });

    const sortedTypes = Object.entries(typeDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }));

    return { totalPrice, mostExpensiveCard, maxPrice, sortedTypes, manaCurve, maxManaCurveCount, totalCardsImported };
  }, [recapModalData]);

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
        <div style={{ marginBottom: "12px", opacity: isWaiting ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem", color: "var(--text-main)" }}>
                <span>{label} {countText}</span>
                <span style={{ color: color, fontWeight: "bold" }}>{percent}%</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ height: "100%", width: `${percent}%`, background: color, transition: "width 0.3s ease-out" }} />
            </div>
        </div>
    );
  };

  const customStyles = `
    .custom-select { appearance: none; background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); border: 1px solid var(--border, #444); padding: 10px 30px 10px 12px; border-radius: 4px; font-size: 0.95rem; width: 100%; cursor: pointer; box-sizing: border-box; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 10px center; background-size: 20px; transition: all 0.2s ease; }
    .custom-select:hover, .custom-select:focus { border-color: #FF9800; outline: none; }
    .custom-textarea { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border, #444); background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); font-size: 0.9rem; box-sizing: border-box; outline: none; transition: border-color 0.2s; resize: vertical; min-height: 150px; }
    .custom-textarea:hover, .custom-textarea:focus { border-color: #FF9800; }
    .file-drop-area { display: block; width: 100%; padding: 25px 20px; border-radius: 8px; border: 2px dashed var(--border, #444); background-color: var(--bg-input, #2a2a2a); color: var(--text-main, #fff); cursor: pointer; transition: all 0.2s; box-sizing: border-box; text-align: center; }
    .file-drop-area:hover { border-color: #FF9800; background-color: rgba(255, 152, 0, 0.05); }
    .file-drop-area input[type="file"] { display: none; } 
    .divider-container { display: flex; align-items: center; text-align: center; margin: 25px 0; color: var(--text-muted); font-size: 0.9rem; font-weight: bold; }
    .divider-container::before, .divider-container::after { content: ''; flex: 1; border-bottom: 1px solid var(--border); }
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

  return (
    <>
    <div className="split-layout" style={{ height: "calc(100vh - 110px)", overflow: "hidden", display: "flex" }}>
      <style>{customStyles}</style>

      {/* PANNEAU DE GAUCHE : IMPORT / EXPORT */}
      <div className="sidebar-filters" style={{ 
          width: "350px", 
          height: "100%", 
          padding: "20px", 
          paddingBottom: "50px", 
          overflowY: "auto", 
          borderRight: "1px solid var(--border)", 
          background: "var(--bg-panel)",
          boxSizing: "border-box" 
      }}>
        <h2 style={{ marginTop: 0, marginBottom: "25px", color: "var(--primary)" }}>Gestion de la Collection</h2>

        <div style={{ background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: "12px", padding: "25px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", color: "var(--text-main)", fontSize: "1.25rem" }}>Importer des cartes</h3>
          
          <label className="file-drop-area">
            <input id="file-import-input" type="file" accept=".txt,.csv,.dek" onChange={handleFileChange} disabled={importPhase !== "idle"} />
            <div style={{ color: "var(--primary)", fontWeight: "bold", marginBottom: "8px", fontSize: "1rem" }}>Choisir un fichier</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{importFile ? importFile.name : "Aucun fichier (.txt, .csv)"}</div>
          </label>

          <div className="divider-container">OU</div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "bold" }}>Coller une liste</label>
            <textarea value={importText} onChange={handleTextChange} disabled={importPhase !== "idle"} placeholder="Ex:&#10;4 Lightning Bolt" className="custom-textarea" />
          </div>

          {importPhase !== "idle" ? (
            <div style={{ marginTop: "20px", padding: "15px", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                {renderProgressBar("Lecture du fichier", progressReading, "reading")}
                {renderProgressBar("Nettoyage", progressCleaning, "cleaning")}
                {renderProgressBar("Ajout BDD", progressDb, "db", `(${processedDbCount} / ${totalDbCount})`)}
            </div>
          ) : (
            <button onClick={handleStartImport} disabled={(!importText.trim() && !importFile) || isExporting} className="btn-action btn-primary" style={{ marginTop: "10px" }}>
              Lancer l'importation
            </button>
          )}
        </div>

        <div style={{ background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: "12px", padding: "25px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", color: "var(--text-main)", fontSize: "1.25rem" }}>Exporter la collection</h3>
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
            {isExporting ? "Génération en cours..." : "Générer l'export"}
          </button>
        </div>

        {/* CALE POUR LE SCROLL */}
        <div style={{ height: "40px", width: "100%" }}></div>

      </div>

      {/* PANNEAU DE DROITE : HISTORIQUE */}
      <div className="results-area" style={{ flex: 1, padding: "30px", overflowY: "auto", position: "relative", backgroundColor: "var(--bg-main)", boxSizing: "border-box" }}>
        <h2 style={{ marginTop: 0, marginBottom: "25px", color: "var(--text-main)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

    {/* MODALE DU RECAPITULATIF BDD */}
    {recapModalData && (
        <div className="modal-overlay" onClick={() => setRecapModalData(null)}>
            <div className="modal-content" style={{ width: "90%", maxWidth: "900px", maxHeight: "85vh", overflowY: "auto", padding: "30px", border: "1px solid var(--primary)" }} onClick={e => e.stopPropagation()}>
                
                {recapModalData._loading ? (
                    <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>Génération du rapport en cours...</div>
                ) : !recapStats ? (
                    <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>
                        <p>Aucune donnée détaillée à analyser pour cet événement.</p>
                        <button className="btn-secondary" onClick={() => setRecapModalData(null)} style={{ marginTop: "20px" }}>Fermer</button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "15px", marginBottom: "25px" }}>
                            <h2 style={{ margin: 0, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                                Bilan de l'opération
                            </h2>
                            <button onClick={() => setRecapModalData(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
                        </div>

                        <p style={{ color: "var(--text-main)", marginBottom: "20px", fontSize: "1.1rem" }}>{recapModalData.log_details}</p>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                            <div style={{ background: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center" }}>
                                <p style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Valeur Estimée Ajoutée</p>
                                <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "bold", color: "var(--success)" }}>
                                    {recapStats.totalPrice.toFixed(2)} €
                                </p>
                            </div>

                            <div style={{ background: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                                <p style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Plus belle trouvaille</p>
                                {recapStats.mostExpensiveCard ? (
                                    <div style={{ textAlign: "center" }}>
                                        <p style={{ margin: "0 0 5px 0", color: "var(--primary)", fontWeight: "bold", fontSize: "1.1rem" }}>{recapStats.mostExpensiveCard.name}</p>
                                        <p style={{ margin: 0, color: "var(--text-main)", fontSize: "1.2rem" }}>{recapStats.maxPrice.toFixed(2)} €</p>
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, color: "var(--text-muted)" }}>N/A</p>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "30px" }}>
                            <div style={{ background: "var(--bg-main)", padding: "25px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)" }}>Courbe de Mana (hors terrains)</h3>
                                <div style={{ display: "flex", alignItems: "flex-end", height: "200px", gap: "10px", paddingBottom: "30px", borderBottom: "1px solid #444", position: "relative" }}>
                                    {Object.entries(recapStats.manaCurve).map(([cmc, count]) => {
                                        const heightPercent = recapStats.maxManaCurveCount > 0 ? (count / recapStats.maxManaCurveCount) * 100 : 0;
                                        return (
                                            <div key={cmc} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative" }}>
                                                <div style={{ width: "100%", maxWidth: "40px", height: `${Math.max(heightPercent, 2)}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0", transition: "height 0.5s ease" }}></div>
                                                {count > 0 && <span style={{ position: "absolute", top: `calc(100% - ${Math.max(heightPercent, 2)}% - 20px)`, fontSize: "0.8rem", fontWeight: "bold", color: "var(--text-main)" }}>{count}</span>}
                                                <span style={{ position: "absolute", bottom: "-25px", color: "var(--text-muted)", fontWeight: "bold" }}>{cmc}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ background: "var(--bg-main)", padding: "25px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)" }}>Répartition de l'Import</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                    {recapStats.sortedTypes.map(({ type, count }) => {
                                        const percentage = ((count / recapStats.totalCardsImported) * 100).toFixed(1);
                                        return (
                                            <div key={type} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                                                    <span style={{ color: "var(--text-main)", fontWeight: "bold" }}>{TYPE_TRANSLATIONS[type] || type}</span>
                                                    <span style={{ color: "var(--text-muted)" }}>{count} cartes ({percentage}%)</span>
                                                </div>
                                                <div style={{ height: "8px", width: "100%", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${percentage}%`, background: type === "Land" ? "#4CAF50" : type === "Creature" ? "#FF9800" : "var(--primary)", borderRadius: "4px" }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
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