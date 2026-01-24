// src/components/Loader.js
import React from "react";

export default function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", minHeight: "200px" }}>
      <div className="mana-spinner"></div>
      <style>{`
        .mana-spinner {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 4px solid transparent;
          border-top-color: #F0E68C; /* Blanc/Jaune */
          border-right-color: #4682B4; /* Bleu */
          border-bottom-color: #2F4F4F; /* Noir */
          border-left-color: #B22222; /* Rouge */
          animation: spin 1s linear infinite;
          position: relative;
        }
        .mana-spinner::after {
          content: '';
          position: absolute;
          top: -4px; left: -4px; right: -4px; bottom: -4px;
          border-radius: 50%;
          border: 4px solid transparent;
          border-bottom-color: #228B22; /* Vert */
          transform: rotate(45deg);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}