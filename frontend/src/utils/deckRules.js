export const DECK_FORMATS = {
  commander: {
    label: "Commander (EDH)",
    min: 100,
    max: 100,
    maxCopies: 1, 
    description: "100 cartes. 1 ou 2 Commandants + reste du deck unique.",
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
    description: "60 cartes min. Editions Alpha, Beta, Unlimited uniquement."
  },
  freeform: {
    label: "Libre",
    min: 0,
    max: null,
    maxCopies: null,
    description: "Aucune restriction."
  }
};

const BASIC_LANDS = [
    "Plains", "Island", "Swamp", "Mountain", "Forest", 
    "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp", 
    "Snow-Covered Mountain", "Snow-Covered Forest", 
    "Wastes"
];

const ANY_NUMBER_CARDS = [
    "Relentless Rats", 
    "Shadowborn Apostle", 
    "Rat Colony", 
    "Persistent Petitioners", 
    "Dragon's Approach", 
    "Slime Against Humanity", 
    "Nazgûl", 
    "Templar Knight"
];

export function validateDeck(format, cards) {
    const errors = [];
    const invalidCardIds = new Set(); 
    
    const formatKey = format ? format.toLowerCase() : "freeform";
    const totalCards = cards.reduce((acc, card) => acc + (parseInt(card.quantity, 10) || 0), 0);

    // --- REGLES COMMANDER ---
    if (formatKey === "commander") {
        if (totalCards !== 100) {
            errors.push(`Le deck doit contenir exactement 100 cartes (actuellement : ${totalCards}).`);
        }

        const commanders = cards.filter(card => card.is_commander === true);
        let commanderColorIdentity = [];

        if (commanders.length === 0) {
            errors.push("Vous devez definir au moins un commandant pour ce deck.");
        } else if (commanders.length > 2) {
            errors.push("Vous ne pouvez pas avoir plus de 2 commandants (Mecanique Partenaire maximum).");
            commanders.forEach(c => invalidCardIds.add(c.card_id));
        } else {
            const combinedColors = new Set();
            commanders.forEach(cmd => {
                const colors = cmd.color_identity || [];
                colors.forEach(color => combinedColors.add(color));
            });
            commanderColorIdentity = Array.from(combinedColors);
        }

        cards.forEach(card => {
            const isBasic = BASIC_LANDS.includes(card.name);
            const isAnyNumberAllowed = ANY_NUMBER_CARDS.includes(card.name);
            
            if (!isBasic && !isAnyNumberAllowed && card.quantity > 1) {
                errors.push(`"${card.name}" est limite a 1 exemplaire en Commander.`);
                invalidCardIds.add(card.card_id);
            }

            if (commanders.length > 0 && commanders.length <= 2 && !card.is_commander) {
                const cardColors = card.color_identity || [];
                const hasInvalidColor = cardColors.some(color => !commanderColorIdentity.includes(color));

                if (hasInvalidColor) {
                    const cmdColorsStr = commanderColorIdentity.length > 0 ? commanderColorIdentity.join(", ") : "Incolore";
                    const cardColorsStr = cardColors.length > 0 ? cardColors.join(", ") : "Incolore";
                    errors.push(`"${card.name}" (${cardColorsStr}) est incompatible avec l'identite de couleur de votre commandant (${cmdColorsStr}).`);
                    invalidCardIds.add(card.card_id);
                }
            }

            if (card.legalities) {
                const legality = card.legalities[formatKey];
                if (legality === "banned") {
                    errors.push(`"${card.name}" est bannie en Commander.`);
                    invalidCardIds.add(card.card_id);
                } else if (legality === "not_legal") {
                    errors.push(`"${card.name}" n'est pas legale dans ce format.`);
                    invalidCardIds.add(card.card_id);
                }
            }
        });
    } 
    
    // --- REGLES STANDARD / MODERN / VINTAGE / ETC ---
    else if (formatKey !== "freeform") {
        if (totalCards < 60) {
            errors.push(`Le deck doit contenir au moins 60 cartes (actuellement : ${totalCards}).`);
        }

        const formatMaxCopies = DECK_FORMATS[formatKey]?.maxCopies || 4;

        cards.forEach(card => {
            const isBasic = BASIC_LANDS.includes(card.name);
            const isAnyNumberAllowed = ANY_NUMBER_CARDS.includes(card.name);

            if (!isBasic && !isAnyNumberAllowed && card.quantity > formatMaxCopies) {
                errors.push(`"${card.name}" est limite a ${formatMaxCopies} exemplaires dans ce format.`);
                invalidCardIds.add(card.card_id);
            }

            if (card.legalities) {
                const legality = card.legalities[formatKey];
                if (legality === "banned") {
                    errors.push(`"${card.name}" est bannie en ${DECK_FORMATS[formatKey]?.label || format}.`);
                    invalidCardIds.add(card.card_id);
                } else if (legality === "not_legal") {
                    errors.push(`"${card.name}" n'est pas legale en ${DECK_FORMATS[formatKey]?.label || format}.`);
                    invalidCardIds.add(card.card_id);
                } else if (legality === "restricted" && card.quantity > 1) {
                    errors.push(`"${card.name}" est restreinte (1 exemplaire max) en ${DECK_FORMATS[formatKey]?.label || format}.`);
                    invalidCardIds.add(card.card_id);
                }
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
        invalidCardIds: Array.from(invalidCardIds), 
        message: errors.length > 0 ? "Le deck ne respecte pas les regles du format." : "Deck valide."
    };
}