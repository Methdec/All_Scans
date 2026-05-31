import React, { useEffect, useState } from "react";
import "../theme.css";
import backCardImg from "../assets/backCard.png";

function importAll(r) {
  return r.keys().map(r);
}

let cardImages = [];
try {
  cardImages = importAll(require.context('../assets/cards', false, /\.(png|jpe?g|svg)$/));
} catch (err) {
  console.log("Aucune image dynamique trouvée ou environnement incompatible.");
}

export default function AuthBackground() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const newCards = Array.from({ length: 20 }).map((_, i) => {
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
        image: selectedImage
      };
    });
    setCards(newCards);
  }, []);

  return (
    <div className="auth-background">
      {/* Les cartes flottantes */}
      {cards.map((c) => (
        <div 
          key={c.id} 
          className="floating-card"
          style={{
            // On ne garde en inline QUE ce qui est dynamique (généré aléatoirement)
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
            backgroundImage: `url(${c.image})`,
          }}
        />
      ))}
      
      {/* Texture de bruit */}
      <div className="noise-overlay"></div>
    </div>
  );
}