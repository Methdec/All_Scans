import React, { useState, useEffect } from "react";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

const MANA_SYMBOLS = {
    W: "https://svgs.scryfall.io/card-symbols/W.svg",
    U: "https://svgs.scryfall.io/card-symbols/U.svg",
    B: "https://svgs.scryfall.io/card-symbols/B.svg",
    R: "https://svgs.scryfall.io/card-symbols/R.svg",
    G: "https://svgs.scryfall.io/card-symbols/G.svg",
    C: "https://svgs.scryfall.io/card-symbols/C.svg"
};

export default function TagsManager({ onClose }) {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [tagName, setTagName] = useState("");
    const [tagColor, setTagColor] = useState("#FF9800"); // NOUVEAU
    const [conditions, setConditions] = useState([{ field: "type_line", operator: "contains", value: "" }]);
    const [ruleLogic, setRuleLogic] = useState("AND"); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState(null);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/tags/rules`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setRules(data.rules || []);
            } else {
                setError("Impossible de charger les règles.");
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const addCondition = () => {
        setConditions([...conditions, { field: "oracle_text", operator: "contains", value: "" }]);
    };

    const removeCondition = (index) => {
        const newConditions = [...conditions];
        newConditions.splice(index, 1);
        setConditions(newConditions);
    };

    const updateCondition = (index, key, val) => {
        const newConditions = [...conditions];
        newConditions[index][key] = val;
        
        if (key === "field") {
            if (val === "color_exact" || val === "color_approx") {
                newConditions[index].value = "";
                newConditions[index].operator = "equals"; 
            } else if (["type_line", "oracle_text", "name", "set"].includes(val)) {
                if (!["contains", "not_contains", "equals", "is_empty"].includes(newConditions[index].operator)) {
                    newConditions[index].operator = "contains";
                }
            } else if (["power", "toughness", "cmc", "price", "date_added"].includes(val)) {
                if (![">", "<", "=="].includes(newConditions[index].operator)) {
                    newConditions[index].operator = "==";
                }
            }
            if (val === "date_added") newConditions[index].value = "";
        }
        
        setConditions(newConditions);
    };

    const toggleConditionColor = (index, code) => {
        const newConditions = [...conditions];
        let currentColors = newConditions[index].value ? newConditions[index].value.split(",") : [];
        
        if (code === "C") {
            currentColors = currentColors.includes("C") ? [] : ["C"];
        } else {
            if (currentColors.includes("C")) currentColors = [];
            if (currentColors.includes(code)) {
                currentColors = currentColors.filter(c => c !== code);
            } else {
                currentColors.push(code);
            }
        }
        
        newConditions[index].value = currentColors.join(",");
        setConditions(newConditions);
    };

    const handleEditClick = (rule) => {
        setEditingRuleId(rule.id);
        setTagName(rule.tag_name);
        setTagColor(rule.color || "#FF9800"); // NOUVEAU
        setConditions(JSON.parse(JSON.stringify(rule.conditions)));
        setRuleLogic(rule.logic || "AND"); 
        setError("");
        
        const modalContainer = document.getElementById("tags-modal-container");
        if (modalContainer) modalContainer.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingRuleId(null);
        setTagName("");
        setTagColor("#FF9800"); // NOUVEAU
        setConditions([{ field: "type_line", operator: "contains", value: "" }]);
        setRuleLogic("AND"); 
        setError("");
    };

    const handleSubmitRule = async (e) => {
        e.preventDefault();
        setError("");
        
        if (!tagName.trim()) {
            return setError("Veuillez donner un nom au tag.");
        }

        const hasEmptyCondition = conditions.some(c => c.operator !== "is_empty" && !c.value.trim());
        if (hasEmptyCondition) {
            return setError("Veuillez remplir (ou sélectionner) les valeurs de toutes les conditions.");
        }

        setIsSubmitting(true);
        try {
            const ruleData = {
                tag_name: tagName.trim(),
                logic: ruleLogic,
                color: tagColor, // NOUVEAU
                conditions: conditions.map(c => ({ ...c, value: c.value.trim() })) 
            };

            const url = editingRuleId 
                ? `${API_BASE_URL}/tags/rules/${editingRuleId}` 
                : `${API_BASE_URL}/tags/rules`;
            
            const method = editingRuleId ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(ruleData)
            });

            if (res.ok) {
                cancelEdit(); 
                fetchRules(); 
            } else {
                const errData = await res.json();
                setError(errData.detail || "Erreur lors de l'enregistrement.");
            }
        } catch (err) {
            setError("Erreur de communication avec le serveur.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        try {
            const res = await fetch(`${API_BASE_URL}/tags/rules/${ruleId}`, {
                method: "DELETE",
                credentials: "include"
            });
            if (res.ok) {
                setRules(rules.filter(r => r.id !== ruleId));
                if (editingRuleId === ruleId) {
                    cancelEdit();
                }
            }
        } catch (err) {
            setError("Erreur lors de la suppression.");
        }
    };

    const renderOperator = (op, field) => {
        if (field === "date_added") {
            const dateOps = { ">": "Après le", "<": "Avant le", "==": "Le jour exact" };
            return dateOps[op] || op;
        }
        const ops = { "contains": "contient", "not_contains": "ne contient pas", "equals": "est égal à", ">": ">", "<": "<", "==": "==" };
        return ops[op] || op;
    };

    const renderField = (f) => {
        const fields = { 
            "oracle_text": "Texte de la carte", "type_line": "Type", "name": "Nom de la carte", 
            "power": "Force", "toughness": "Endurance", "cmc": "Coût de mana", 
            "color_exact": "Mana exacte", "color_approx": "Mana approx",
            "price": "Valeur (€)", "set": "Extension", "date_added": "Date d'ajout"
        };
        return fields[f] || f;
    };

    const sectionStyle = {
        background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: "12px", 
        padding: "25px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div 
                id="tags-modal-container"
                className="modal-content" 
                style={{ width: "900px", maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", padding: "30px", textAlign: "left" }} 
                onClick={e => e.stopPropagation()}
            >
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "15px", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, color: "var(--primary)" }}>Automatisation des Tags</h2>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 15px", fontWeight: "bold" }}>
                        Fermer
                    </button>
                </div>

                <div style={{ padding: "12px 15px", background: "rgba(255, 152, 0, 0.1)", border: "1px solid var(--primary)", borderRadius: "8px", marginBottom: "25px", color: "var(--text-main)", fontSize: "0.95rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span>
                            Les modifications effectuées ici ne s'appliqueront à vos cartes qu'après avoir synchronisé votre collection depuis le bouton <strong>"Mettre à jour les données"</strong> de votre profil.
                        </span>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: 10, borderRadius: "8px", background: "rgba(244, 67, 54, 0.1)", color: "var(--danger)", border: "1px solid var(--danger)", marginBottom: "20px" }}>
                        {error}
                    </div>
                )}

                <div style={{...sectionStyle, border: editingRuleId ? "2px solid var(--primary)" : "1px solid var(--border)"}}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h3 style={{ marginTop: 0, color: "var(--text-main)", marginBottom: 0 }}>
                            {editingRuleId ? "Modifier la règle" : "Créer une nouvelle règle"}
                        </h3>
                        {editingRuleId && (
                            <button type="button" onClick={cancelEdit} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem" }}>
                                Annuler l'édition
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmitRule} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-input)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            <label style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: "bold", marginBottom: "5px" }}>
                                Conditions de la règle
                            </label>
                            
                            {conditions.map((cond, index) => {
                                const isColorField = cond.field === "color_exact" || cond.field === "color_approx";
                                const isTextField = ["type_line", "oracle_text", "name", "set"].includes(cond.field);
                                const isNumericField = ["power", "toughness", "cmc", "price"].includes(cond.field);
                                const isDateField = cond.field === "date_added";

                                return (
                                    <div key={index} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                        {index > 0 && (
                                            <button 
                                                type="button" 
                                                onClick={() => setRuleLogic(ruleLogic === "AND" ? "OR" : "AND")}
                                                style={{ 
                                                    background: ruleLogic === "AND" ? "var(--primary)" : "#2196F3", 
                                                    color: "white", border: "none", padding: "4px 10px", 
                                                    borderRadius: "4px", cursor: "pointer", fontWeight: "bold",
                                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                                                }}
                                                title="Cliquer pour basculer la règle entière entre ET / OU"
                                            >
                                                {ruleLogic === "AND" ? "ET" : "OU"}
                                            </button>
                                        )}
                                        
                                        <select value={cond.field} onChange={(e) => updateCondition(index, "field", e.target.value)} className="custom-select" style={{ flex: 1, minWidth: "150px" }}>
                                            <option value="type_line">Type</option>
                                            <option value="oracle_text">Texte de la carte</option>
                                            <option value="name">Nom de la carte</option>
                                            <option value="set">Extension (Code)</option>
                                            <option value="power">Force</option>
                                            <option value="toughness">Endurance</option>
                                            <option value="cmc">Valeur de mana (CMC)</option>
                                            <option value="price">Valeur estimée (€)</option>
                                            <option value="color_exact">Mana exacte</option>
                                            <option value="color_approx">Mana approx</option>
                                            <option value="date_added">Date d'ajout</option>
                                        </select>
                                        
                                        {!isColorField && (
                                            <select value={cond.operator} onChange={(e) => updateCondition(index, "operator", e.target.value)} className="custom-select" style={{ flex: 1, minWidth: "120px" }}>
                                                {isTextField && (
                                                    <>
                                                        <option value="contains">Contient</option>
                                                        <option value="not_contains">Ne contient pas</option>
                                                        <option value="equals">Est égal à</option>
                                                        <option value="is_empty">Est vide</option>
                                                    </>
                                                )}
                                                {(isNumericField || isDateField) && (
                                                    <>
                                                        <option value=">">{isDateField ? "Après le" : "Supérieur à (>)"}</option>
                                                        <option value="<">{isDateField ? "Avant le" : "Inférieur à (<)"}</option>
                                                        <option value="==">{isDateField ? "Le jour exact" : "Égal à (==)"}</option>
                                                    </>
                                                )}
                                            </select>
                                        )}

                                        {isColorField ? (
                                            <div style={{ display: "flex", gap: "8px", flex: 2, minWidth: "150px", background: "var(--bg-main)", padding: "5px 10px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                                {Object.keys(MANA_SYMBOLS).map(c => {
                                                    const isSelected = cond.value.split(",").includes(c);
                                                    return (
                                                        <img key={c} src={MANA_SYMBOLS[c]} alt={c} onClick={() => toggleConditionColor(index, c)}
                                                            style={{ width: "26px", height: "26px", cursor: "pointer", borderRadius: "50%", border: isSelected ? "2px solid var(--primary)" : "2px solid transparent", opacity: isSelected ? 1 : 0.4, transition: "all 0.2s" }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ) : cond.operator !== "is_empty" ? (
                                            <input 
                                                type={isDateField ? "date" : "text"} 
                                                value={cond.value} 
                                                onChange={(e) => updateCondition(index, "value", e.target.value)} 
                                                placeholder={isNumericField ? "Ex: 10" : isDateField ? "" : "Ex: creature"} 
                                                className="custom-input" 
                                                style={{ flex: 2, minWidth: "150px", padding: "10px", colorScheme: "dark" }}
                                            />
                                        ) : null}

                                        {conditions.length > 1 && (
                                            <button type="button" onClick={() => removeCondition(index)} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem", padding: "5px 10px" }} title="Retirer cette condition">
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            <button type="button" onClick={addCondition} style={{ alignSelf: "flex-start", background: "transparent", border: "1px dashed var(--primary)", color: "var(--primary)", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", marginTop: "5px" }}>
                                + Ajouter une condition
                            </button>
                        </div>

                        <div style={{ display: "flex", gap: "15px", alignItems: "flex-end" }}>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Appliquer le Tag suivant :</label>
                                <input 
                                    type="text" 
                                    value={tagName} 
                                    onChange={(e) => setTagName(e.target.value)} 
                                    placeholder="Ex: Ramp, Removal..." 
                                    className="custom-input" 
                                    style={{ padding: "8px 10px", borderColor: "var(--primary)", fontSize: "0.95rem" }}
                                />
                            </div>
                            <div style={{ flex: 0 }}>
                                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold", textAlign: "center" }}>Couleur</label>
                                <input 
                                    type="color" 
                                    value={tagColor} 
                                    onChange={(e) => setTagColor(e.target.value)} 
                                    style={{ width: "60px", height: "38px", padding: "0", border: "none", cursor: "pointer", background: "transparent" }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <button type="submit" className={editingRuleId ? "btn-secondary" : "btn-primary"} style={{ width: "100%", padding: "8px 12px", fontSize: "0.95rem", borderColor: editingRuleId ? "var(--primary)" : "", color: editingRuleId ? "var(--primary)" : "" }} disabled={isSubmitting}>
                                    {isSubmitting ? "Enregistrement..." : (editingRuleId ? "Mettre à jour" : "Sauvegarder la règle")}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <div style={sectionStyle}>
                    <h3 style={{ marginTop: 0, color: "var(--text-main)", marginBottom: "20px" }}>Vos règles actives ({rules.length})</h3>
                    
                    {loading ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>Chargement...</div>
                    ) : rules.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", background: "var(--bg-input)", borderRadius: "8px" }}>
                            Aucune règle configurée.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                            {rules.map((rule) => (
                                <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", background: "var(--bg-input)", padding: "15px", borderRadius: "8px", border: "1px solid", borderColor: editingRuleId === rule.id ? "var(--primary)" : "var(--border)" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "bold" }}>Appliquer le tag :</span>
                                            <span style={{ background: rule.color || "var(--primary)", color: "white", padding: "4px 10px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold", letterSpacing: "1px" }}>
                                                {rule.tag_name.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ paddingLeft: "10px", borderLeft: "2px solid var(--border)" }}>
                                            {rule.conditions.map((c, i) => {
                                                const isColorField = c.field === "color_exact" || c.field === "color_approx";
                                                return (
                                                    <div key={i} style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "4px 0" }}>
                                                        {i > 0 && <span style={{ color: rule.logic === "OR" ? "#2196F3" : "var(--primary)", fontWeight: "bold", marginRight: "8px" }}>{rule.logic === "OR" ? "OU" : "ET"}</span>}
                                                        Si <strong style={{ color: "var(--text-main)" }}>{renderField(c.field)}</strong> 
                                                        {!isColorField && ` ${renderOperator(c.operator, c.field)} `}
                                                        {c.operator !== "is_empty" && (
                                                            isColorField ? <strong style={{ color: "var(--text-main)", marginLeft: "5px" }}>[{c.value}]</strong> 
                                                            : <strong style={{ color: "var(--text-main)", marginLeft: "5px" }}>"{c.value}"</strong>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", borderLeft: "1px solid var(--border)", paddingLeft: "15px", marginLeft: "15px" }}>
                                        <button 
                                            onClick={() => handleEditClick(rule)}
                                            style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem", padding: "5px" }}
                                        >
                                            Modifier
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteRule(rule.id)}
                                            style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem", padding: "5px" }}
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}