import React, { useEffect, useState } from "react";
import "../theme.css";
// Image par défaut (fallback) au cas où le dossier cards est vide
import backCardImg from "../assets/backCard.png";

// Fonction pour importer dynamiquement toutes les images d'un dossier
// Cela fonctionne avec Webpack (Create React App)
function importAll(r) {
  return r.keys().map(r);
}

// Chargement des images du dossier ../assets/cards
// Le premier argument est le chemin relatif
// Le second (false) indique qu'on ne cherche pas dans les sous-dossiers
// Le troisième est une Regex pour filtrer les extensions (.png, .jpg, .jpeg, .svg)
let cardImages = [];
try {
  cardImages = importAll(require.context('../assets/cards', false, /\.(png|jpe?g|svg)$/));
} catch (err) {
  // Si le dossier n'existe pas ou si on n'est pas sous Webpack, on ignore l'erreur
  // Le tableau restera vide et le code utilisera l'image par défaut
  console.log("Aucune image dynamique trouvée ou environnement incompatible.");
}

export default function AuthBackground() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const newCards = Array.from({ length: 20 }).map((_, i) => {
      // Logique de sélection d'image :
      // Si on a trouvé des images dans le dossier, on en prend une au hasard.
      // Sinon, on utilise l'image par défaut (backCardImg).
      let selectedImage = backCardImg;
      
      if (cardImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * cardImages.length);
        selectedImage = cardImages[randomIndex];
      }

      return {
        id: i,
        left: Math.floor(Math.random() * 95) + "%",
        delay: Math.floor(Math.random() * 20) * -1 + "s",
        duration: 20 + Math.random() * 20 + "s",
        image: selectedImage // On stocke l'URL de l'image choisie
      };
    });
    setCards(newCards);
  }, []);

  return (
    <div 
      className="auth-background"
      style={{
        // DÉGRADÉ : Centre gris-brun sombre, Extérieur noir pur
        background: "radial-gradient(circle at center, #2c1e10 0%, #121212 60%, #000000 100%)",
      }}
    >
      {/* Les cartes flottantes */}
      {cards.map((c) => (
        <div 
          key={c.id} 
          className="floating-card"
          style={{
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
            // On utilise l'image stockée dans l'objet carte
            backgroundImage: `url(${c.image})`,
          }}
        />
      ))}
      
      {/* Texture de bruit pour éviter l'effet trop "lisse" */}
      <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.05,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          zIndex: 0
      }}></div>
    </div>
  );
}