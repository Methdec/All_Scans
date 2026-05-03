import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { API_BASE_URL } from '../utils/api';

const CHART_COLORS = {
    White: "#F0E6BC", Blue: "#42a5f5", Black: "#5e5e5e", 
    Red: "#ef5350", Green: "#66bb6a", Colorless: "#b0bec5", Multicolor: "#ffd54f"
};

const TYPE_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6"
];

const controlContainerStyle = {
    background: "var(--bg-main)", padding: "4px", borderRadius: "8px", 
    display: "flex", gap: "5px", border: "1px solid var(--border)"
};

const getButtonStyle = (isActive) => ({
    background: isActive ? "var(--primary)" : "transparent",
    color: isActive ? "#fff" : "var(--text-muted)",
    border: "none", padding: "6px 12px", borderRadius: "6px",
    cursor: "pointer", fontSize: "0.8rem", fontWeight: isActive ? "bold" : "normal",
    transition: "all 0.2s ease"
});

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
          background: "#1e1e1e", border: "1px solid #444", padding: "12px", 
          borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", minWidth: "150px", zIndex: 100
      }}>
        {label && <p style={{ fontWeight: "bold", margin: "0 0 8px 0", color: "#fff", borderBottom:"1px solid #444", paddingBottom:4 }}>CMC {label}</p>}
        {payload.map((entry, index) => (
           entry.value > 0 && (
              <div key={index} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: entry.fill || entry.color, fontSize: "0.85rem", marginRight: 10 }}>● {entry.name}</span>
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>{entry.value}</span>
              </div>
           )
        ))}
      </div>
    );
  }
  return null;
};

export default function DeckStats({ deck, onUpdate }) {
  const [curveMode, setCurveMode] = useState("type"); 
  const [includeColorlessInPie, setIncludeColorlessInPie] = useState(false);
  const [loadingLands, setLoadingLands] = useState(false);

  // --- MODALE GENERIQUE ---
  const [infoModal, setInfoModal] = useState({
      isOpen: false,
      type: "info", // "info", "confirm", "success", "error"
      title: "",
      message: "",
      onConfirm: null
  });

  const cards = useMemo(() => deck?.cards || [], [deck]);
  
  const closeInfoModal = () => setInfoModal({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });

  // --- EQUILIBRAGE TERRAINS SANS ALERTE ---
  const promptAutoBalance = () => {
    setInfoModal({
        isOpen: true,
        type: "confirm",
        title: "Equilibrage des terrains",
        message: "Calculer et ajuster automatiquement les terrains basiques selon la couleur de vos sorts ?\n\nCela utilisera des terrains generiques si votre collection ne suffit pas.",
        onConfirm: executeAutoBalanceLands
    });
  };

  const executeAutoBalanceLands = async () => {
    closeInfoModal();
    setLoadingLands(true);
    try {
        const res = await fetch(`${API_BASE_URL}/items/${deck.id}/auto_balance_lands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.detail || "Erreur serveur");

        if (data.logs && data.logs.length > 0) {
            setInfoModal({
                isOpen: true, type: "success", title: "Ajustements effectues", message: data.logs.join("\n")
            });
        } else if (data.message) {
            setInfoModal({
                isOpen: true, type: "info", title: "Information", message: data.message
            });
        }

        if (onUpdate) await onUpdate();

    } catch (e) {
        console.error(e);
        setInfoModal({
            isOpen: true, type: "error", title: "Erreur", message: e.message
        });
    } finally {
        setLoadingLands(false);
    }
  };

  const manaCurveData = useMemo(() => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      cmc: i === 7 ? "7+" : i.toString(),
      total: 0,
      Creature: 0, Instant: 0, Sorcery: 0, Enchantment: 0, Artifact: 0, Planeswalker: 0, Battle: 0,
      White: 0, Blue: 0, Black: 0, Red: 0, Green: 0, Colorless: 0, Multicolor: 0
    }));

    if (!cards) return data;

    cards.forEach(card => {
        if (!card.type_line || card.type_line.includes("Land")) return;

        let cmc = Math.floor(card.cmc || 0);
        if (cmc > 7) cmc = 7;
        const quantity = card.quantity || 1;
        const entry = data[cmc];
        entry.total += quantity;

        const types = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Battle"];
        for (let t of types) {
            if (card.type_line.includes(t)) { entry[t] += quantity; break; }
        }
        
        if (card.colors && card.colors.length > 1) entry.Multicolor += quantity;
        else if (card.colors && card.colors.length === 1) {
            const map = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
            if (map[card.colors[0]]) entry[map[card.colors[0]]] += quantity;
            else entry.Colorless += quantity;
        } else entry.Colorless += quantity;
    });
    return data;
  }, [cards]);

  const statsMetrics = useMemo(() => {
    let totalCMC = 0, count = 0, cmcList = [];
    if (!cards) return { mean: 0, median: 0 };
    cards.forEach(card => {
        if (!card.type_line || card.type_line.includes("Land")) return;
        const qty = card.quantity || 1;
        const cmc = card.cmc || 0;
        totalCMC += cmc * qty;
        count += qty;
        for(let i=0; i<qty; i++) cmcList.push(cmc);
    });
    if (count === 0) return { mean: 0, median: 0 };
    const mean = (totalCMC / count).toFixed(2);
    cmcList.sort((a, b) => a - b);
    const mid = Math.floor(cmcList.length / 2);
    const median = cmcList.length % 2 !== 0 ? cmcList[mid] : (cmcList[mid - 1] + cmcList[mid]) / 2;
    return { mean, median };
  }, [cards]);

  const typePieData = useMemo(() => {
    const counts = {};
    if (!cards) return [];
    cards.forEach(card => {
        if (!card.type_line) return;
        let mainType = card.type_line.split("—")[0].trim().split(" ").pop();
        if (!counts[mainType]) counts[mainType] = 0;
        counts[mainType] += (card.quantity || 1);
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [cards]);

  const colorPieData = useMemo(() => {
      const counts = { White: 0, Blue: 0, Black: 0, Red: 0, Green: 0, Colorless: 0 };
      if (!cards) return [];
      cards.forEach(card => {
          const qty = card.quantity || 1;
          const matches = (card.mana_cost || "").match(/\{([^}]+)\}/g) || [];
          matches.forEach(symbol => {
              const clean = symbol.replace(/[{}]/g, "");
              if (clean.includes("W")) counts.White += qty;
              else if (clean.includes("U")) counts.Blue += qty;
              else if (clean.includes("B")) counts.Black += qty;
              else if (clean.includes("R")) counts.Red += qty;
              else if (clean.includes("G")) counts.Green += qty;
              else if (!isNaN(parseInt(clean)) && includeColorlessInPie) counts.Colorless += (parseInt(clean) * qty);
              else if (clean === "C" && includeColorlessInPie) counts.Colorless += qty;
          });
      });
      return Object.keys(counts).filter(key => counts[key] > 0).map(key => ({ name: key, value: counts[key], color: CHART_COLORS[key] }));
  }, [cards, includeColorlessInPie]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      <div style={{ marginBottom: 10, padding: 20, border: "1px dashed var(--border)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.02)" }}>
            <div>
                <h4 style={{ margin: "0 0 5px 0", color: "var(--text-main)" }}>Gestion des Terrains</h4>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    Ajoute automatiquement les terrains basiques manquants (Base sur la couleur).
                </p>
            </div>
            <button 
                onClick={promptAutoBalance} 
                disabled={loadingLands}
                className="btn-primary" 
                style={{ display: "flex", alignItems: "center", gap: 10, opacity: loadingLands ? 0.7 : 1 }}
            >
                <span>{loadingLands ? "Calcul en cours..." : "Equilibrer"}</span>
            </button>
      </div>

      <div className="stat-card">
          <h3>
              Courbe de Mana
              <div style={controlContainerStyle}>
                  <button onClick={() => setCurveMode("type")} style={getButtonStyle(curveMode === "type")}>Par Type</button>
                  <button onClick={() => setCurveMode("color")} style={getButtonStyle(curveMode === "color")}>Par Couleur</button>
              </div>
          </h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={manaCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis dataKey="cmc" stroke="#888" tickLine={false} axisLine={{stroke: '#444'}} />
                    <YAxis stroke="#888" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.03)'}} isAnimationActive={false} />
                    {curveMode === "type" ? (
                        <>
                            <Bar dataKey="Creature" stackId="a" fill={TYPE_COLORS[0]} />
                            <Bar dataKey="Instant" stackId="a" fill={TYPE_COLORS[1]} />
                            <Bar dataKey="Sorcery" stackId="a" fill={TYPE_COLORS[2]} />
                            <Bar dataKey="Enchantment" stackId="a" fill={TYPE_COLORS[3]} />
                            <Bar dataKey="Artifact" stackId="a" fill={TYPE_COLORS[4]} />
                            <Bar dataKey="Planeswalker" stackId="a" fill={TYPE_COLORS[5]} />
                            <Bar dataKey="Battle" stackId="a" fill={TYPE_COLORS[6]} />
                        </>
                    ) : (
                        Object.keys(CHART_COLORS).map(colorKey => (
                            <Bar key={colorKey} dataKey={colorKey} stackId="a" fill={CHART_COLORS[colorKey]} />
                        ))
                    )}
                </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "60px", marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "15px" }}>
               <div style={{textAlign: "center"}}>
                   <span style={{color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px"}}>Moyenne</span>
                   <div style={{fontSize: "1.8rem", fontWeight: "bold", color: "var(--primary)"}}>{statsMetrics.mean}</div>
               </div>
               <div style={{textAlign: "center"}}>
                   <span style={{color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px"}}>Mediane</span>
                   <div style={{fontSize: "1.8rem", fontWeight: "bold", color: "var(--primary)"}}>{statsMetrics.median}</div>
               </div>
          </div>
      </div>

      <div className="stats-grid">
          <div className="stat-card">
               <h3>Repartition par Type</h3>
               <div style={{ width: "100%", height: 250 }}>
                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                       <PieChart>
                           <Pie data={typePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="none">
                                {typePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />)}
                            </Pie>
                           <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                           <Legend iconType="circle" wrapperStyle={{fontSize: "0.85rem", color: "#ccc"}} />
                       </PieChart>
                   </ResponsiveContainer>
               </div>
          </div>

          <div className="stat-card">
               <h3>
                   Couts de Mana
                   <div style={controlContainerStyle}>
                       <button onClick={() => setIncludeColorlessInPie(!includeColorlessInPie)} style={getButtonStyle(includeColorlessInPie)}>
                            {includeColorlessInPie ? "Avec Incolore" : "Sans Incolore"}
                       </button>
                   </div>
               </h3>
               <div style={{ width: "100%", height: 250 }}>
                   <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                       <PieChart>
                           <Pie data={colorPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="none">
                                {colorPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                           <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                           <Legend iconType="circle" wrapperStyle={{fontSize: "0.85rem", color: "#ccc"}} />
                       </PieChart>
                   </ResponsiveContainer>
               </div>
          </div>
      </div>

      {/* --- MODALE D'INFORMATION / CONFIRMATION GENERIQUE --- */}
      {infoModal.isOpen && (
          <div className="modal-overlay" onClick={infoModal.type !== "confirm" ? closeInfoModal : null}>
              <div className="modal-box" style={{ width: "450px", flexDirection: "column", padding: "25px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ 
                      marginTop: 0, 
                      color: infoModal.type === "error" ? "var(--danger)" : infoModal.type === "success" ? "var(--success)" : "var(--primary)" 
                  }}>
                      {infoModal.title}
                  </h3>
                  
                  <div style={{ color: "var(--text-main)", fontSize: "0.95rem", whiteSpace: "pre-line", lineHeight: 1.6, margin: "15px 0 25px 0", textAlign: "left", background: "var(--bg-input)", padding: "15px", borderRadius: "8px", maxHeight: "200px", overflowY: "auto" }}>
                      {infoModal.message}
                  </div>
                  
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