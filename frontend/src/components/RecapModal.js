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
        <div className="modal-overlay recap-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
            
            <div className="modal-content recap-modal-content" onClick={e => e.stopPropagation()}>
                
                <div className="recap-header">
                    <h2 className="recap-title m-0">Bilan de l'opération</h2>
                    <button onClick={onClose} className="recap-close-btn" title="Fermer">✕</button>
                </div>

                <div className="recap-scrollable-body">
                    {loading ? (
                        <div className="p-20 text-center text-muted mt-20">Génération du rapport en cours...</div>
                    ) : !stats ? (
                        <div className="p-20 text-center text-muted mt-20">
                            <p>Aucune donnée détaillée à analyser pour cet événement.</p>
                        </div>
                    ) : (
                        <>
                            <p className="recap-subtitle" style={{ marginTop: "10px" }}>{recapData.log_details}</p>

                            <div className="recap-grid-2">
                                <div className="recap-box" style={{ padding: "20px" }}>
                                    <p className="recap-box-label">Valeur Estimée Ajoutée</p>
                                    <p className="recap-box-val-success">
                                        {stats.totalPrice.toFixed(2)} €
                                    </p>
                                </div>

                                <div className="recap-box recap-box-flex" style={{ padding: "20px" }}>
                                    <p className="recap-box-label">Plus belle trouvaille</p>
                                    {stats.mostExpensiveCard ? (
                                        <div className="text-center">
                                            <p className="recap-box-card-name">{stats.mostExpensiveCard.name}</p>
                                            <p className="recap-box-card-price">{stats.maxPrice.toFixed(2)} €</p>
                                        </div>
                                    ) : (
                                        <p className="m-0 text-muted">N/A</p>
                                    )}
                                </div>
                            </div>

                            <div className="recap-grid-large">
                                <div className="recap-box text-left">
                                    <h3 className="recap-chart-title">Courbe de Mana (hors terrains)</h3>
                                    <div className="recap-mana-container">
                                        {Object.entries(stats.manaCurve).map(([cmc, count]) => {
                                            const heightPercent = stats.maxManaCurveCount > 0 ? (count / stats.maxManaCurveCount) * 100 : 0;
                                            return (
                                                <div key={cmc} className="recap-mana-col">
                                                    <div className="recap-mana-bar" style={{ height: `${Math.max(heightPercent, 2)}%` }}></div>
                                                    {count > 0 && <span className="recap-mana-count" style={{ top: `calc(100% - ${Math.max(heightPercent, 2)}% - 20px)` }}>{count}</span>}
                                                    <span className="recap-mana-label">{cmc}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="recap-box text-left">
                                    <h3 className="recap-chart-title">Répartition de l'Import</h3>
                                    <div className="recap-type-container">
                                        {stats.sortedTypes.map(({ type, count }) => {
                                            const percentage = ((count / stats.totalCardsImported) * 100).toFixed(1);
                                            return (
                                                <div key={type} className="recap-type-row">
                                                    <div className="recap-type-header">
                                                        <span className="recap-type-name">{TYPE_TRANSLATIONS[type] || type}</span>
                                                        <span className="recap-type-stats">{count} cartes ({percentage}%)</span>
                                                    </div>
                                                    <div className="recap-type-bar-bg">
                                                        <div className="recap-type-bar-fill" style={{ width: `${percentage}%`, background: type === "Land" ? "#4CAF50" : type === "Creature" ? "#FF9800" : "var(--primary)" }}></div>
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
        </div>
    );
}