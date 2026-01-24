// src/components/CardSkeleton.js
import React from "react";

export default function CardSkeleton({ count = 12 }) {
  const items = Array.from({ length: count });

  return (
    <div style={{
      display: "grid",
      /* 👇 MODIFICATION ICI : passage de 180px à 210px */
      gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
      gap: "12px",
      padding: "0 20px",
      marginTop: "20px"
    }}>
      <style>{`
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
      `}</style>

      {items.map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}