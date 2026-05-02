import React, { useState } from "react";
import "../theme.css";

export default function DevicePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceIp, setDeviceIp] = useState("10.1.7.158"); 
  const [logs, setLogs] = useState([]);
  const [ledState, setLedState] = useState("OFF");
  
  // NOUVEAU : Etats pour les reseaux
  const [scannedNetworks, setScannedNetworks] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const addLog = (type, message) => {
      const newLog = {
          time: new Date().toLocaleTimeString(),
          type: type,
          message: message
      };
      setLogs(prev => [newLog, ...prev]);
  };

  const testConnection = async () => {
      if (!deviceIp) return addLog("ERROR", "Veuillez entrer une adresse IP.");
      
      addLog("INFO", `Tentative de connexion a http://${deviceIp}/status...`);
      try {
          const response = await fetch(`http://${deviceIp}/status`, { method: "GET" });
          if (response.ok) {
              setIsConnected(true);
              addLog("SUCCESS", "ESP32 connectee et prete !");
          } else {
              throw new Error("Mauvaise reponse");
          }
      } catch (error) {
          setIsConnected(false);
          addLog("ERROR", "Impossible de joindre l'ESP32. Verifiez l'IP.");
      }
  };

  const handleLedOn = async () => {
      try {
          const response = await fetch(`http://${deviceIp}/led/on`, { method: "GET" });
          if (response.ok) {
              setLedState("ON");
              addLog("SUCCESS", "LED ALLUMEE");
          }
      } catch (error) { addLog("ERROR", "Echec : LED ON"); setIsConnected(false); }
  };

  const handleLedOff = async () => {
      try {
          const response = await fetch(`http://${deviceIp}/led/off`, { method: "GET" });
          if (response.ok) {
              setLedState("OFF");
              addLog("SUCCESS", "LED ETEINTE");
          }
      } catch (error) { addLog("ERROR", "Echec : LED OFF"); setIsConnected(false); }
  };

  // --- NOUVELLES FONCTIONS RESEAU ---

  const handleScanNetworks = async () => {
      setIsScanning(true);
      addLog("INFO", "Demande de scan des reseaux...");
      try {
          const response = await fetch(`http://${deviceIp}/wifi/scan`, { method: "GET" });
          if (response.ok) {
              const data = await response.json();
              // On retire les doublons potentiels
              const uniqueNetworks = [...new Set(data.networks)];
              setScannedNetworks(uniqueNetworks);
              addLog("SUCCESS", `${uniqueNetworks.length} reseaux trouves.`);
          }
      } catch (error) {
          addLog("ERROR", "Le scan a echoue.");
      } finally {
          setIsScanning(false);
      }
  };

  const handleStartAP = async () => {
      addLog("WARNING", "Ouverture du portail... L'ESP32 va se deconnecter du reseau actuel !");
      try {
          await fetch(`http://${deviceIp}/wifi/ap`, { method: "GET" });
          setIsConnected(false); // On force la deconnexion car l'ESP32 quitte le Wi-Fi
      } catch (error) {
          // L'erreur est presque normale ici car l'ESP coupe la connexion tres vite
          setIsConnected(false);
      }
  };

  const handleResetWiFi = async () => {
      if(!window.confirm("L'ESP32 va oublier ta box et redemarrer. Es-tu sur ?")) return;

      addLog("WARNING", "Reinitialisation du Wi-Fi en cours...");
      try {
          await fetch(`http://${deviceIp}/wifi/reset`, { method: "GET" });
          setIsConnected(false);
      } catch (error) {
          setIsConnected(false);
      }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <h1 style={{ margin: 0, color: "var(--primary)" }}>Moniteur Matériel (ESP32)</h1>
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-input)", padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ 
                    width: "15px", height: "15px", borderRadius: "50%", 
                    background: isConnected ? "var(--success)" : "var(--danger)",
                    boxShadow: isConnected ? "0 0 10px var(--success)" : "0 0 10px var(--danger)"
                }}></div>
                <span style={{ fontWeight: "bold", color: "var(--text-main)" }}>
                    {isConnected ? "Connecté" : "Hors ligne"}
                </span>
            </div>
        </div>

        <div style={{ display: "flex", gap: "25px", alignItems: "flex-start", flexWrap: "wrap" }}>
            
            {/* COLONNE GAUCHE : CONTROLES */}
            <div style={{ flex: "0 0 350px", display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* CARTE 1 : LIAISON */}
                <div style={{ background: "var(--bg-input)", padding: "25px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, color: "var(--text-main)", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                        Liaison Locale
                    </h3>
                    
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{ color: "var(--text-muted)", fontSize: "0.9rem", display: "block", marginBottom: "5px" }}>
                            Adresse IP de l'ESP32 :
                        </label>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <input 
                                type="text" 
                                value={deviceIp} 
                                onChange={(e) => setDeviceIp(e.target.value)}
                                style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontFamily: "monospace" }} 
                            />
                            <button className="btn-primary" onClick={testConnection}>Lier</button>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <h4 style={{ margin: "0 0 5px 0", color: "var(--text-main)" }}>Test Hardware (LED)</h4>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button className="btn-primary" onClick={handleLedOn} disabled={!isConnected} style={{ flex: 1, opacity: !isConnected ? 0.5 : 1 }}>
                                Allumer
                            </button>
                            <button className="btn-secondary" onClick={handleLedOff} disabled={!isConnected} style={{ flex: 1, opacity: !isConnected ? 0.5 : 1 }}>
                                Éteindre
                            </button>
                        </div>
                    </div>
                </div>

                {/* CARTE 2 : GESTION RESEAU */}
                <div style={{ background: "var(--bg-input)", padding: "25px", borderRadius: "12px", border: "1px solid var(--danger)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                    <h3 style={{ marginTop: 0, color: "var(--danger)", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                        Administration Wi-Fi
                    </h3>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                        
                        <button className="btn-secondary" onClick={handleScanNetworks} disabled={!isConnected || isScanning} style={{ width: "100%", opacity: !isConnected ? 0.5 : 1 }}>
                            {isScanning ? "Analyse en cours..." : "Scanner les réseaux alentours"}
                        </button>

                        {/* Affichage des resultats du scan */}
                        {scannedNetworks.length > 0 && (
                            <div style={{ background: "var(--bg-main)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", maxHeight: "150px", overflowY: "auto" }}>
                                <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-main)", fontSize: "0.9rem" }}>
                                    {scannedNetworks.map((net, i) => <li key={i}>{net}</li>)}
                                </ul>
                            </div>
                        )}

                        <button className="btn-secondary" onClick={handleStartAP} disabled={!isConnected} style={{ width: "100%", opacity: !isConnected ? 0.5 : 1 }}>
                            Ouvrir le Portail (ESP32_Configuration)
                        </button>

                        <button className="btn-primary" onClick={handleResetWiFi} disabled={!isConnected} style={{ width: "100%", background: "var(--danger)", border: "none", opacity: !isConnected ? 0.5 : 1 }}>
                            Oublier ma box & Réinitialiser
                        </button>

                    </div>
                </div>
            </div>

            {/* COLONNE DROITE : CONSOLE */}
            <div style={{ flex: 1, minWidth: "400px", background: "#1e1e1e", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", height: "650px", overflow: "hidden" }}>
                <div style={{ background: "#2a2a2a", padding: "15px 20px", borderBottom: "1px solid #444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: "1rem" }}>Console d'Événements</h3>
                    <button onClick={() => setLogs([])} style={{ background: "transparent", border: "1px solid #666", color: "#ccc", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
                        Effacer
                    </button>
                </div>
                
                <div style={{ flex: 1, padding: "15px", overflowY: "auto", fontFamily: "monospace", fontSize: "0.9rem" }}>
                    {logs.length === 0 ? (
                        <div style={{ color: "#666", textAlign: "center", marginTop: "50px" }}>
                            Aucun événement pour le moment.
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} style={{ marginBottom: "8px", borderBottom: "1px solid #333", paddingBottom: "8px" }}>
                                <span style={{ color: "#888", marginRight: "10px" }}>[{log.time}]</span>
                                <span style={{ 
                                    color: log.type === "ERROR" ? "#F44336" : log.type === "WARNING" ? "#FF9800" : "#4CAF50",
                                    fontWeight: "bold",
                                    marginRight: "10px" 
                                }}>
                                    {log.type}
                                </span>
                                <span style={{ color: "#ddd" }}>{log.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    </div>
  );
}