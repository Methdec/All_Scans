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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        {label && <p className="custom-tooltip-title">CMC {label}</p>}
        {payload.map((entry, index) => (
           entry.value > 0 && (
              <div key={index} className="custom-tooltip-item">
                  <span className="custom-tooltip-label" style={{ color: entry.fill || entry.color }}>● {entry.name}</span>
                  <span className="custom-tooltip-value">{entry.value}</span>
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

  const [infoModal, setInfoModal] = useState({
      isOpen: false,
      type: "info", 
      title: "",
      message: "",
      onConfirm: null
  });

  const cards = useMemo(() => deck?.cards || [], [deck]);
  
  const closeInfoModal = () => setInfoModal({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });

  const promptAutoBalance = () => {
    setInfoModal({
        isOpen: true,
        type: "confirm",
        title: "Équilibrage des terrains",
        message: "Calculer et ajuster automatiquement les terrains basiques selon la couleur de vos sorts ?\n\nCela utilisera des terrains génériques si votre collection ne suffit pas.",
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
                isOpen: true, type: "success", title: "Ajustements effectués", message: data.logs.join("\n")
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
    <div className="stats-container">
      
      <div className="stats-alert-box">
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
                <span>{loadingLands ? "Calcul en cours..." : "Équilibrer"}</span>
            </button>
      </div>

      <div className="stat-card">
          <h3>
              Courbe de Mana
              <div className="chart-controls-container">
                  <button 
                      onClick={() => setCurveMode("type")} 
                      className={`chart-toggle-btn ${curveMode === "type" ? "active" : ""}`}
                  >
                      Par Type
                  </button>
                  <button 
                      onClick={() => setCurveMode("color")} 
                      className={`chart-toggle-btn ${curveMode === "color" ? "active" : ""}`}
                  >
                      Par Couleur
                  </button>
              </div>
          </h3>
          <div className="chart-wrapper-large">
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
          <div className="metrics-container">
               <div className="metric-block">
                   <span className="metric-label">Moyenne</span>
                   <div className="metric-value">{statsMetrics.mean}</div>
               </div>
               <div className="metric-block">
                   <span className="metric-label">Médiane</span>
                   <div className="metric-value">{statsMetrics.median}</div>
               </div>
          </div>
      </div>

      <div className="stats-grid">
          <div className="stat-card">
               <h3>Répartition par Type</h3>
               <div className="chart-wrapper-small">
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
                   Coûts de Mana
                   <div className="chart-controls-container">
                       <button 
                           onClick={() => setIncludeColorlessInPie(!includeColorlessInPie)} 
                           className={`chart-toggle-btn ${includeColorlessInPie ? "active" : ""}`}
                       >
                            {includeColorlessInPie ? "Avec Incolore" : "Sans Incolore"}
                       </button>
                   </div>
               </h3>
               <div className="chart-wrapper-small">
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
              <div className="modal-box modal-md modal-flex-col" style={{ textAlign: "center", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  <h3 className={`modal-title ${infoModal.type === "error" ? "text-danger" : infoModal.type === "success" ? "text-success" : "text-primary"}`}>
                      {infoModal.title}
                  </h3>
                  
                  <div className="info-modal-scrollable" style={{ width: "100%" }}>
                      {infoModal.message}
                  </div>
                  
                  <div className="modal-actions" style={{ justifyContent: "center", width: "100%", marginTop: 0 }}>
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