import React, { useState, useEffect, useRef, useMemo } from "react";

// --- SOUS-COMPOSANT CARTE ---
const CardItem = React.memo(({ card, onClick, clickable, style }) => {
  const smallUrl = 
    card.image_uris?.small || 
    card.card_faces?.[0]?.image_uris?.small || 
    card.image_normal || 
    null;

  const normalUrl = 
    card.image_uris?.normal || 
    card.card_faces?.[0]?.image_uris?.normal || 
    card.image_normal || 
    card.image_border_crop || 
    null;

  const [currentSrc, setCurrentSrc] = useState(smallUrl);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    if (!normalUrl) return;
    const img = new Image();
    img.src = normalUrl;
    img.onload = () => {
      setCurrentSrc(normalUrl);
      setIsHighResLoaded(true);
    };
  }, [normalUrl]);

  return (
    <div
      className="card-item"
      onClick={() => clickable && onClick?.(card.id)}
      style={{
        ...style,
        cursor: clickable ? "pointer" : "default",
        transition: "transform 0.2s",
      }}
      onMouseOver={(e) => { if (clickable) e.currentTarget.style.transform = "scale(1.05)"; }}
      onMouseOut={(e) => { if (clickable) e.currentTarget.style.transform = "scale(1)"; }}
    >
      {card.count > 1 && (
        <div className="card-count-badge">{card.count}</div>
      )}
      
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={card.name}
          className="card-image"
          loading="lazy"
          style={{ 
            filter: isHighResLoaded ? "blur(0px)" : "blur(3px)",
            transition: "filter 0.3s ease-in-out, opacity 0.3s ease-in-out",
            transform: isHighResLoaded ? "scale(1)" : "scale(1.02)" 
          }}
        />
      ) : (
        <div style={{ width: "100%", aspectRatio: "63/88", background: "#ccc", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px" }}>
            {card.name}
        </div>
      )}
      
      <p style={{ marginTop: "5px", fontSize: "14px", fontWeight: "500", textAlign: "center" }}>
        {card.name}
      </p>
    </div>
  );
}, (prevProps, nextProps) => {
    return prevProps.card.id === nextProps.card.id && prevProps.card.count === nextProps.card.count;
});


// --- COMPOSANT PRINCIPAL ---
function VirtualizedCardGrid({ cards, onCardClick, clickableCards = true, onLoadMore, totalServerItems, isLoadingMore }) {
  const [visibleCards, setVisibleCards] = useState(60);
  const observerRef = useRef(null);
  const firstCardIdRef = useRef(cards[0]?.id);

  // Gestion du Reset lors d'une nouvelle recherche
  useEffect(() => {
    const currentFirstId = cards[0]?.id;
    if (currentFirstId !== firstCardIdRef.current) {
      setVisibleCards(60);
      firstCardIdRef.current = currentFirstId;
    } else if (cards.length <= 60 && visibleCards > 60) {
        setVisibleCards(60);
    }
  }, [cards, visibleCards]);

  const loadMoreCards = () => {
    if (visibleCards < cards.length) {
      setVisibleCards((prev) => Math.min(prev + 60, cards.length));
    }
    if (visibleCards >= cards.length - 20 && cards.length < totalServerItems && onLoadMore) {
        onLoadMore();
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreCards();
        }
      },
      { threshold: 0.1, rootMargin: "300px" } 
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => { if (observerRef.current) observer.unobserve(observerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCards, cards.length, totalServerItems]);

  const displayedCards = useMemo(() => cards.slice(0, visibleCards), [cards, visibleCards]);

  return (
    <div style={{ marginTop: "20px" }}>
      <style>
        {`
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 12px;
            padding: 0 20px;
          }
          .card-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            overflow: hidden;
          }
          .card-image {
            width: 100%;
            border-radius: 4.5% / 3.5%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            background-color: #e0e0e0;
            min-height: 250px;
            will-change: filter;
          }
          .card-count-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background-color: #d32f2f;
            color: white;
            border-radius: 50%;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            z-index: 10;
            border: 2px solid white;
          }

          /* --- STYLE DU SKELETON INTÉGRÉ --- */
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .skeleton-card {
            width: 100%;
            aspect-ratio: 63/88;
            border-radius: 4.5% / 3.5%;
            background: #e0e0e0;
            background-image: linear-gradient(
              90deg, 
              #e0e0e0 25%, 
              #f0f0f0 50%, 
              #e0e0e0 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
        `}
      </style>

      {/* ✅ GRILLE UNIQUE : Vraies cartes + Skeletons */}
      <div className="cards-grid">
        
        {/* 1. Les Vraies Cartes */}
        {displayedCards.map((card, index) => (
            <CardItem 
                key={`${card.id}-${index}`} 
                card={card} 
                onClick={onCardClick} 
                clickable={clickableCards}
            />
        ))}

        {/* 2. Les Skeletons (Ajoutés à la suite DANS la même grille) */}
        {isLoadingMore && Array.from({ length: 6 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="card-item">
                <div className="skeleton-card" />
                {/* On met un petit texte fantôme pour garder l'alignement */}
                <div style={{ width: "60%", height: "14px", background: "#e0e0e0", marginTop: "10px", borderRadius: "4px" }}></div>
            </div>
        ))}

      </div>

      {/* Observer (Invisible, juste pour déclencher le scroll) */}
      <div 
        ref={observerRef} 
        style={{ height: "20px", width: "100%", marginTop: "10px" }} 
      />
    </div>
  );
}

export default VirtualizedCardGrid;