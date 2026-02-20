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

// Liste des terrains de base pour l'exemption de limite d'exemplaires
const BASIC_LANDS = [
    "Plains", "Island", "Swamp", "Mountain", "Forest", 
    "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp", 
    "Snow-Covered Mountain", "Snow-Covered Forest", 
    "Wastes"
];

export function validateDeck(format, cards) {
    const errors = [];
    
    // 1. Calcul du nombre total de cartes
    // On s'assure que quantity est un nombre (base 10)
    const totalCards = cards.reduce((acc, card) => acc + (parseInt(card.quantity, 10) || 0), 0);

    // --- RÈGLES COMMANDER ---
    if (format && format.toLowerCase() === "commander") {
        
        // Règle 1 : Taille du deck (100 cartes pile)
        if (totalCards !== 100) {
            errors.push(`Le deck doit contenir exactement 100 cartes (actuellement : ${totalCards}).`);
        }

        // Règle 2 : Singleton (1 seul exemplaire par carte, sauf terrains de base)
        cards.forEach(card => {
            const isBasic = BASIC_LANDS.includes(card.name);
            // Si ce n'est pas un terrain de base et qu'il y en a plus de 1
            if (!isBasic && card.quantity > 1) {
                errors.push(`"${card.name}" est limité à 1 exemplaire en Commander.`);
            }
        });
    } 
    
    // --- RÈGLES STANDARD / MODERN / PIONEER ---
    else {
        // Règle 1 : Taille minimum (60 cartes)
        if (totalCards < 60) {
            errors.push(`Le deck doit contenir au moins 60 cartes (actuellement : ${totalCards}).`);
        }

        // Règle 2 : Limite de 4 exemplaires
        cards.forEach(card => {
            const isBasic = BASIC_LANDS.includes(card.name);
            if (!isBasic && card.quantity > 4) {
                errors.push(`"${card.name}" est limité à 4 exemplaires.`);
            }
        });
    }

    // Retourne l'objet de validation complet
    return {
        isValid: errors.length === 0,
        errors: errors, // C'est ce tableau qui permettra de compter "3 erreurs"
        message: errors.length > 0 ? "Le deck ne respecte pas les règles." : "Deck valide."
    };
}