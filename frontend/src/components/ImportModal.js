import React, { useState, useEffect } from "react";
import "../theme.css"; 
import { API_BASE_URL } from '../utils/api';

export default function ImportModal({ onClose, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("selection"); 
  const [totalCards, setTotalCards] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [log, setLog] = useState(null);

  useEffect(() => {
    return () => setFile(null);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setFile(e.target.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;

    // 1. Pre-calcul
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    setTotalCards(lines.length);
    setStep("importing");
    setProgressPercent(0);
    setProcessedCount(0);

    // 2. Parsing Frontend simple
    const parsedData = lines.map(line => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
            return { quantity: parseInt(match[1], 10), name: match[2].trim() };
        }
        return { quantity: 1, name: line.trim() };
    });

    try {
        const res = await fetch(`${API_BASE_URL}/usercards/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(parsedData),
        });

        if (!res.ok) throw new Error("Erreur lors de l'envoi");

        // 3. Polling robuste
        let errorsCount = 0;
        const interval = setInterval(async () => {
            try {
                const progRes = await fetch(`${API_BASE_URL}/usercards/import/progress`, {
                    method: "GET",
                    credentials: "include"
                });
                
                if (progRes.ok) {
                    const data = await progRes.json();

                    if (data.status === "starting" || data.status === "processing") {
                        setProcessedCount(data.processed);
                        const serverTotal = data.total || lines.length;
                        const pct = Math.floor((data.processed / serverTotal) * 100);
                        setProgressPercent(pct);
                    }

                    if (data.status === "completed") {
                        clearInterval(interval);
                        setProgressPercent(100);
                        setLog({ success: true, imported: data.imported, notFound: data.not_found || [] });
                        setStep("finished");
                        if (onImportComplete) onImportComplete();
                    } 
                    else if (data.status === "error") {
                        clearInterval(interval);
                        setLog({ success: false, message: data.error });
                        setStep("finished");
                    }
                }
            } catch (err) {
                console.error("Erreur polling", err);
                errorsCount++;
                if (errorsCount > 10) clearInterval(interval);
            }
        }, 500); 

    } catch (err) {
        setLog({ success: false, message: err.message });
        setStep("finished");
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: "500px", flexDirection: "column", height: "auto", overflow: "visible" }}>
        
        <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, color: "var(--primary)" }}>Importer des cartes</h2>
        </div>

        <div style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>

            {step === "selection" && (
                <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <label style={{ fontWeight: "bold", color: "var(--text-main)" }}>Choisir un fichier (.txt)</label>
                        <input type="file" accept=".txt" onChange={handleFileChange} style={{ padding: "10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius, 4px)", color: "var(--text-main)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button onClick={onClose} className="btn-secondary">Annuler</button>
                        <button onClick={handleStartImport} disabled={!file} className="btn-primary">Lancer l'import</button>
                    </div>
                </>
            )}

            {step === "importing" && (
                <div style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-main)" }}>
                        <span>Total a importer : <strong>{totalCards}</strong></span>
                        <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{progressPercent}%</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", background: "var(--bg-input)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)" }}>
                        <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--primary)", transition: "width 0.3s ease-out" }} />
                    </div>
                    <p style={{ marginTop: "15px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Traitement en cours... ({processedCount} / {totalCards})</p>
                </div>
            )}

            {step === "finished" && log && (
                <div>
                    {log.success ? (
                        <div style={{ textAlign: "center" }}>
                            <h3 style={{ color: "var(--success)", marginTop: 0 }}>Termine !</h3>
                            <p><strong>{log.imported}</strong> cartes ajoutees.</p>
                        </div>
                    ) : (
                        <div style={{ textAlign: "center", color: "var(--danger)" }}>
                            <h3>Erreur</h3>
                            <p>{log.message}</p>
                        </div>
                    )}
                    <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
                        <button onClick={onClose} className="btn-primary">Fermer</button>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}