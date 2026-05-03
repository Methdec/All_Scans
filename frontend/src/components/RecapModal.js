import React, { useMemo } from "react";
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

export default function RecapModal({ recapData, loading, onClose }) {
    
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

    const stats = useMemo(() => {
        if (!recapData || !recapData.cards || recapData.cards.length === 0) return null;

        let totalPrice = 0;
        let maxPrice = 0;
        let mostExpensiveCard = null;
        let typeDistribution = {};
        let manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "6+": 0 };
        let maxManaCurveCount = 0;
        let totalCardsImported = 0;

        recapData.cards.forEach(card => {
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
    }, [recapData]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ width: "90%", maxWidth: "900px", maxHeight: "85vh", overflowY: "auto", padding: "30px", border: "1px solid var(--primary)" }} onClick={e => e.stopPropagation()}>
                
                {loading ? (
                    <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>Génération du rapport en cours...</div>
                ) : !stats ? (
                    <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>
                        <p>Aucune donnée détaillée à analyser pour cet événement.</p>
                        <button className="btn-secondary" onClick={onClose} style={{ marginTop: "20px" }}>Fermer</button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "15px", marginBottom: "25px" }}>
                            <h2 style={{ margin: 0, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                                Bilan de l'opération
                            </h2>
                            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
                        </div>

                        <p style={{ color: "var(--text-main)", marginBottom: "20px", fontSize: "1.1rem" }}>{recapData.log_details}</p>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                            {/* PRIX GLOBAL */}
                            <div style={{ background: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center" }}>
                                <p style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Valeur Estimée Ajoutée</p>
                                <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: "bold", color: "var(--success)" }}>
                                    {stats.totalPrice.toFixed(2)} €
                                </p>
                            </div>

                            {/* CARTE LA PLUS CHERE */}
                            <div style={{ background: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                                <p style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Plus belle trouvaille</p>
                                {stats.mostExpensiveCard ? (
                                    <div style={{ textAlign: "center" }}>
                                        <p style={{ margin: "0 0 5px 0", color: "var(--primary)", fontWeight: "bold", fontSize: "1.1rem" }}>{stats.mostExpensiveCard.name}</p>
                                        <p style={{ margin: 0, color: "var(--text-main)", fontSize: "1.2rem" }}>{stats.maxPrice.toFixed(2)} €</p>
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, color: "var(--text-muted)" }}>N/A</p>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "30px" }}>
                            {/* COURBE DE MANA */}
                            <div style={{ background: "var(--bg-main)", padding: "25px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)" }}>Courbe de Mana (hors terrains)</h3>
                                <div style={{ display: "flex", alignItems: "flex-end", height: "200px", gap: "10px", paddingBottom: "30px", borderBottom: "1px solid #444", position: "relative" }}>
                                    {Object.entries(stats.manaCurve).map(([cmc, count]) => {
                                        const heightPercent = stats.maxManaCurveCount > 0 ? (count / stats.maxManaCurveCount) * 100 : 0;
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

                            {/* REPARTITION DES TYPES */}
                            <div style={{ background: "var(--bg-main)", padding: "25px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)" }}>Répartition de l'Import</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                    {stats.sortedTypes.map(({ type, count }) => {
                                        const percentage = ((count / stats.totalCardsImported) * 100).toFixed(1);
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
                        
                        <div style={{ marginTop: "30px", textAlign: "right" }}>
                            <button className="btn-secondary" onClick={onClose}>Fermer le bilan</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}