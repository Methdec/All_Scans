// src/utils/deckRules.js

export const DECK_FORMATS = {
  commander: {
    label: "Commander (EDH)",
    min: 100,
    max: 100,
    maxCopies: 1, 
    description: "100 cartes. 1 Commandant légendaire + 99 cartes uniques.",
  },
  standard: {
    label: "Standard",
    min: 60,
    max: null,
    maxCopies: 4,
    description: "60 cartes min. Max 4 exemplaires par carte.",
  },
  modern: {
    label: "Moderne",
    min: 60,
    max: null,
    maxCopies: 4,
    description: "60 cartes min. Max 4 exemplaires par carte."
  },
  vintage: {
    label: "Vintage",
    min: 60,
    max: null,
    maxCopies: 1, 
    description: "60 cartes min. Cartes uniques (Restricted)."
  },
  legacy: {
    label: "Legacy",
    min: 60,
    max: null,
    maxCopies: 4,
    allowedSets: ["Limited Edition Alpha", "Limited Edition Beta", "Unlimited Edition"], 
    description: "60 cartes min. Éditions Alpha, Beta, Unlimited uniquement."
  },
  freeform: {
    label: "Libre",
    min: 0,
    max: null,
    maxCopies: null,
    description: "Aucune restriction."
  }
};

const isBasicLand = (card) => {
  if (!card) return false;
  const typeLine = card.type_line || "";
  return typeLine.includes("Basic Land") || 
         ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"].includes(card.name);
};

/**
 * Valide un deck (Polymorphe : accepte un nombre OU une liste)
 * @param {string} formatKey 
 * @param {Array|number} data - Soit la liste des cartes, soit le nombre total
 */
export const validateDeck = (formatKey, data) => {
  const rules = DECK_FORMATS[formatKey] || DECK_FORMATS.freeform;
  
  let totalCount = 0;
  let cardsList = null;

  // 1. DÉTECTION DU TYPE DE DONNÉES
  if (typeof data === 'number') {
      // Cas ItemsPage : On a juste le nombre
      totalCount = data;
  } else if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'string') {
          // Cas Liste d'IDs (Backend brut)
          totalCount = data.length;
      } else {
          // Cas DeckDetails : On a les objets complets
          cardsList = data;
          totalCount = data.reduce((acc, card) => acc + (card.quantity || 1), 0);
      }
  }

  // --- Règle 1 : Minimum de cartes (Toujours vérifiable) ---
  if (rules.min && totalCount < rules.min) {
    return { 
      isValid: false, 
      message: `Trop peu de cartes : ${totalCount} / ${rules.min} minimum.`,
      severity: "error"
    };
  }

  // --- Règle 2 : Maximum de cartes ---
  if (rules.max && totalCount > rules.max) {
    return { 
      isValid: false, 
      message: `Trop de cartes : ${totalCount} / ${rules.max} maximum.`,
      severity: "error"
    };
  }
  
  // Cas Commander exact
  if (rules.max && rules.min === rules.max && totalCount !== rules.min) {
     return { 
      isValid: false, 
      message: `Commander requiert exactement 100 cartes (Actuel: ${totalCount}).`,
      severity: "error"
    };
  }

  // --- Règles Avancées (Vérifiables seulement si on a les objets complets) ---
  if (cardsList && cardsList.length > 0) {
      
      // Règle : Nombre d'exemplaires max
      if (rules.maxCopies) {
        for (const card of cardsList) {
          if (!isBasicLand(card)) {
            if (card.quantity > rules.maxCopies) {
              return {
                isValid: false,
                message: `Illégal : "${card.name}" est présent ${card.quantity} fois (Max: ${rules.maxCopies}).`,
                severity: "error"
              };
            }
          }
        }
      }

      // Règle : Sets autorisés (Legacy)
      if (rules.allowedSets && rules.allowedSets.length > 0) {
        for (const card of cardsList) {
          if (!card.set_name || !rules.allowedSets.includes(card.set_name)) {
            return {
              isValid: false,
              message: `Édition interdite : "${card.name}" vient de "${card.set_name || 'Inconnu'}".`,
              severity: "error"
            };
          }
        }
      }
  }

  return { isValid: true, message: "Deck valide", severity: "success" };
};