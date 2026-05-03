import React, { useState, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import { QRCodeCanvas } from "qrcode.react";
import "../theme.css";
import { API_BASE_URL } from '../utils/api';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); 
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const size = 250;
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);

  return canvas.toDataURL("image/jpeg", 0.8);
}

export default function ProfilePage({ user, setUser, theme, toggleTheme, handleLogout }) {
  const [activeModal, setActiveModal] = useState(null); 
  const [notification, setNotification] = useState({ show: false, message: "", type: "success" });

  const [cardSearch, setCardSearch] = useState("");
  const [avatarResults, setAvatarResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const [nomData, setNomData] = useState({ nom: "" });
  const [emailData, setEmailData] = useState({ new_email: "", password: "" });
  const [passwordData, setPasswordData] = useState({ old_password: "", new_password: "", confirm_password: "" });

  const [isUpdatingCollection, setIsUpdatingCollection] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [processedCards, setProcessedCards] = useState(0);
  const [totalCards, setTotalCards] = useState(0);

  const [deleteCollectionConfirm, setDeleteCollectionConfirm] = useState("");
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");

  // Etats pour le MFA
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaDisablePassword, setMfaDisablePassword] = useState("");

  useEffect(() => {
      if (user?.nom) setNomData({ nom: user.nom });
  }, [user]);

  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "success" }), 3000);
  };

  const closeModal = () => {
    if (activeModal === "updateCollection" && isUpdatingCollection) return;

    setActiveModal(null);
    setCardSearch("");
    setAvatarResults([]);
    setEmailData({ new_email: "", password: "" });
    setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
    setNomData({ nom: user?.nom || "" });
    setImageToCrop(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setDeleteCollectionConfirm("");
    setDeleteAccountConfirm("");
    setMfaCode("");
    setMfaDisablePassword("");
  };

  const handleLocalImageUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5000000) { 
          return showNotification("L'image est trop lourde (Max 5Mo).", "error");
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          setImageToCrop(reader.result); 
      };
      reader.readAsDataURL(file);
  };

  const handleAvatarSearch = async (e) => {
    e.preventDefault();
    if (!cardSearch.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardSearch)}`);
      const data = await res.json();
      if (data.data) {
        setAvatarResults(data.data.filter(c => c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop));
      } else {
        setAvatarResults([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirmCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const croppedBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
      
      const res = await fetch(`${API_BASE_URL}/auth/me/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatar: croppedBase64 })
      });
      
      if (res.ok) {
        setUser(prev => ({ ...prev, avatar: croppedBase64 }));
        showNotification("Photo de profil mise à jour !");
        closeModal();
      } else {
          showNotification("Erreur lors de la mise à jour.", "error");
      }
    } catch (err) {
      showNotification("Erreur de traitement de l'image", "error");
    } finally {
      setIsCropping(false);
    }
  };

  const handleUpdateNom = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me/nom`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nom: nomData.nom })
        });
        if (res.ok) {
          setUser(prev => ({ ...prev, nom: nomData.nom }));
          showNotification("Pseudo mis à jour !");
          closeModal();
        } else {
          const errorData = await res.json();
          showNotification(errorData.detail || "Erreur", "error");
        }
      } catch (err) {
        showNotification("Erreur serveur", "error");
      }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(emailData)
      });
      if (res.ok) {
        setUser(prev => ({ ...prev, email: emailData.new_email }));
        showNotification("Adresse email mise à jour !");
        closeModal();
      } else {
        const errorData = await res.json();
        showNotification(errorData.detail || "Erreur", "error");
      }
    } catch (err) {
      showNotification("Erreur serveur", "error");
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
        return showNotification("Les nouveaux mots de passe ne correspondent pas.", "error");
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            old_password: passwordData.old_password,
            new_password: passwordData.new_password
        })
      });
      if (res.ok) {
        showNotification("Mot de passe mis à jour !");
        closeModal();
      } else {
        const errorData = await res.json();
        showNotification(errorData.detail || "Erreur", "error");
      }
    } catch (err) {
      showNotification("Erreur serveur", "error");
    }
  };

  const handleUpdateCollection = async () => {
    setActiveModal("updateCollection");
    setIsUpdatingCollection(true);
    setUpdateProgress(0);
    setProcessedCards(0);
    setTotalCards(0);
    
    try {
        const resIds = await fetch(`${API_BASE_URL}/auth/me/collection/ids`, { credentials: "include" });
        const dataIds = await resIds.json();
        
        if (!resIds.ok) throw new Error("Erreur de récupération des IDs");
        
        const ids = dataIds.ids || [];
        if (ids.length === 0) {
            showNotification("Votre collection est vide.");
            setIsUpdatingCollection(false);
            return;
        }

        setTotalCards(ids.length);

        const chunkSize = 75;
        let processed = 0;

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            
            await fetch(`${API_BASE_URL}/auth/me/collection/update/chunk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ids: chunk })
            });
            
            processed += chunk.length;
            setProcessedCards(processed);
            setUpdateProgress(Math.min(100, Math.round((processed / ids.length) * 100)));
        }

        await fetch(`${API_BASE_URL}/auth/me/collection/update/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ processed: ids.length })
        });

        showNotification("Collection mise à jour avec succès !");
    } catch (err) {
        showNotification("Erreur serveur lors de la mise à jour", "error");
    } finally {
        setTimeout(() => {
            setIsUpdatingCollection(false);
        }, 1000); 
    }
  };

  const handleDeleteCollection = async () => {
      if (deleteCollectionConfirm !== "SUPPRIMER") return;
      try {
          const res = await fetch(`${API_BASE_URL}/auth/me/collection`, { method: "DELETE", credentials: "include" });
          const data = await res.json();
          if (res.ok) {
              showNotification(data.message || "Collection vidée !");
              closeModal();
          } else {
              showNotification(data.detail || "Erreur lors de la suppression", "error");
          }
      } catch (err) { showNotification("Erreur serveur", "error"); }
  };

  const handleDeleteAccount = async () => {
      if (deleteAccountConfirm !== "SUPPRIMER") return;
      try {
          const res = await fetch(`${API_BASE_URL}/auth/me`, { method: "DELETE", credentials: "include" });
          if (res.ok) {
              localStorage.removeItem("openDecks");
              window.location.href = "/login";
          } else {
              const data = await res.json();
              showNotification(data.detail || "Erreur lors de la suppression du compte", "error");
          }
      } catch (err) { showNotification("Erreur serveur", "error"); }
  };

  // --- FONCTIONS MFA ---
  const handleInitiateMfa = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/auth/me/mfa/setup`, { credentials: "include" });
          const data = await res.json();
          if (res.ok) {
              setMfaSetupData(data);
              setActiveModal("setupMfa");
          } else {
              showNotification("Impossible d'initialiser l'A2F", "error");
          }
      } catch (err) {
          showNotification("Erreur serveur", "error");
      }
  };

  const handleEnableMfa = async (e) => {
      e.preventDefault();
      try {
          const res = await fetch(`${API_BASE_URL}/auth/me/mfa/enable`, {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({ mfa_code: mfaCode })
          });
          const data = await res.json();
          if (res.ok) {
              setUser(prev => ({ ...prev, mfa_enabled: true }));
              showNotification("Authentification à double facteur activée !");
              closeModal();
          } else {
              showNotification(data.detail || "Code incorrect", "error");
          }
      } catch (err) {
          showNotification("Erreur serveur", "error");
      }
  };

  const handleDisableMfa = async (e) => {
      e.preventDefault();
      try {
          const res = await fetch(`${API_BASE_URL}/auth/me/mfa/disable`, {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({ password: mfaDisablePassword })
          });
          const data = await res.json();
          if (res.ok) {
              setUser(prev => ({ ...prev, mfa_enabled: false }));
              showNotification("Authentification à double facteur désactivée.");
              closeModal();
          } else {
              showNotification(data.detail || "Mot de passe incorrect", "error");
          }
      } catch (err) {
          showNotification("Erreur serveur", "error");
      }
  };

  const defaultAvatar = "https://cards.scryfall.io/art_crop/front/0/0/00020b05-ecb9-4603-8cc1-8cfa7a14befc.jpg";

  const sectionStyle = {
      background: "var(--bg-input)", 
      padding: "30px", 
      borderRadius: "12px", 
      border: "1px solid var(--border)", 
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      marginBottom: "25px",
  };

  return (
    <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column" }}>

        <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 20px 0", color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", textAlign: "left" }}>
                Informations Générales
            </h3>

            <div style={{ position: "relative", width: "140px", height: "140px", margin: "0 auto 20px auto" }}>
                <img src={user?.avatar || defaultAvatar} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "4px solid var(--primary)", backgroundColor: "var(--bg-main)" }} />
                <button onClick={() => setActiveModal("avatar")} style={{ position: "absolute", bottom: "0", right: "-10px", background: "var(--primary)", color: "var(--bg-main)", border: "4px solid var(--bg-input)", borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem", boxShadow: "0 2px 5px rgba(0,0,0,0.3)" }}>
                    Modifier
                </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "25px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
                    <div></div>
                    <h2 style={{ color: "var(--text-main)", margin: "0", fontSize: "2rem", textAlign: "center" }}>{user?.nom}</h2>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => setActiveModal("nom")} style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Modifier</button>
                    </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
                    <div></div>
                    <p style={{ color: "var(--text-muted)", margin: "0", fontSize: "1rem", textAlign: "center" }}>{user?.email}</p>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => setActiveModal("email")} style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Modifier</button>
                    </div>
                </div>
            </div>

            <button onClick={() => setActiveModal("password")} className="btn-secondary" style={{ width: "100%", padding: "12px", borderStyle: "dashed", borderColor: "var(--text-muted)", marginBottom: "15px" }}>
                Changer le mot de passe
            </button>

            {/* BLOC MFA */}
            <div style={{ padding: "15px", borderRadius: "8px", background: user?.mfa_enabled ? "rgba(76, 175, 80, 0.05)" : "rgba(255, 152, 0, 0.05)", border: `1px solid ${user?.mfa_enabled ? "var(--success)" : "var(--primary)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h4 style={{ margin: "0 0 5px 0", color: "var(--text-main)", fontSize: "1rem" }}>Double Authentification (A2F)</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: user?.mfa_enabled ? "var(--success)" : "var(--text-muted)" }}>
                        {user?.mfa_enabled ? "L'A2F est activée et sécurise votre compte." : "Protégez votre compte avec un code à 6 chiffres."}
                    </p>
                </div>
                {user?.mfa_enabled ? (
                    <button onClick={() => setActiveModal("disableMfa")} className="btn-secondary" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Désactiver</button>
                ) : (
                    <button onClick={handleInitiateMfa} className="btn-primary">Activer</button>
                )}
            </div>
        </div>

        <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", textAlign: "left" }}>
                Gestion de la Collection
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--primary)" }}>
                    {isUpdatingCollection && (
                        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${updateProgress}%`, background: "var(--primary)", opacity: 0.15, transition: "width 0.3s ease" }} />
                    )}
                    
                    <button 
                        onClick={handleUpdateCollection} 
                        disabled={isUpdatingCollection} 
                        style={{ width: "100%", padding: "12px", background: "transparent", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1, cursor: isUpdatingCollection ? "not-allowed" : "pointer" }}
                    >
                        <span style={{ color: "var(--text-main)", fontSize: "1rem" }}>Mettre à jour les données (Prix, légalités...)</span>
                        <span style={{ color: "var(--primary)", fontWeight: "bold" }}>
                            {isUpdatingCollection ? `${updateProgress}%` : "Lancer"}
                        </span>
                    </button>
                </div>

                <button onClick={() => setActiveModal("deleteCollection")} className="btn-secondary" style={{ width: "100%", padding: "12px", borderColor: "var(--danger)", color: "var(--danger)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Vider toute ma collection</span>
                    <span style={{ fontWeight: "bold" }}>Supprimer</span>
                </button>
            </div>
        </div>

        <div style={sectionStyle}>
            <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", textAlign: "left" }}>
                Préférences d'affichage
            </h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-main)" }}>Apparence de l'application :</span>
                <button onClick={toggleTheme} className="btn-secondary" style={{ padding: "8px 15px" }}>
                    {theme === "light" ? "Passer en Mode Sombre" : "Passer en Mode Clair"}
                </button>
            </div>
        </div>

        <div style={{ ...sectionStyle, border: "1px solid var(--danger)", marginBottom: "0" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "var(--danger)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", textAlign: "left" }}>
                Zone de Danger
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button onClick={handleLogout} className="btn-secondary" style={{ width: "100%", padding: "12px", fontWeight: "bold", display: "flex", justifyContent: "center" }}>
                    Se déconnecter
                </button>
                <button onClick={() => setActiveModal("deleteAccount")} className="btn-primary" style={{ width: "100%", background: "var(--danger)", color: "white", border: "none", padding: "12px", fontWeight: "bold", display: "flex", justifyContent: "center" }}>
                    Supprimer mon compte définitivement
                </button>
            </div>
        </div>

      </div>

      {/* --- MODALES --- */}
      
      {/* MODALE AVATAR COMPLETEMENT RESTAUREE */}
      {activeModal === "avatar" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "650px", maxWidth: "90%", display: "flex", flexDirection: "column", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
            
            {imageToCrop ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <h3 style={{ marginTop: 0, color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>Cadrer votre avatar</h3>
                    
                    <div style={{ position: "relative", width: "100%", height: "350px", background: "#333", borderRadius: "8px", overflow: "hidden" }}>
                        <Cropper
                            image={imageToCrop}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                        />
                    </div>
                    
                    <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "15px" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Zoom :</span>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} style={{ flex: 1 }} />
                    </div>

                    <div style={{ textAlign: "right", marginTop: "30px", paddingTop: "15px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                        <button className="btn-secondary" onClick={() => setImageToCrop(null)}>Retour</button>
                        <button className="btn-primary" onClick={handleConfirmCrop} disabled={isCropping}>{isCropping ? "Traitement..." : "Valider le cadrage"}</button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 style={{ marginTop: 0, color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>Modifier la photo de profil</h3>
                    
                    <div style={{ marginBottom: "25px", background: "var(--bg-main)", padding: "15px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <h4 style={{ marginTop: 0, color: "var(--text-main)", fontSize: "1rem", marginBottom: "10px" }}>Option 1 : Importer depuis votre ordinateur</h4>
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleLocalImageUpload} style={{ color: "var(--text-main)" }} />
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <h4 style={{ marginTop: 0, color: "var(--text-main)", fontSize: "1rem", marginBottom: "10px" }}>Option 2 : Choisir une illustration de carte</h4>
                        <form onSubmit={handleAvatarSearch} style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                        <input type="text" value={cardSearch} onChange={e => setCardSearch(e.target.value)} placeholder="Nom d'une carte (ex: Chandra)..." style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} autoFocus />
                        <button type="submit" className="btn-primary" disabled={isSearching}>{isSearching ? "..." : "Chercher"}</button>
                        </form>

                        <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "15px", padding: "5px" }}>
                        {avatarResults.map((c, i) => {
                            const img = c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop;
                            if (!img) return null;
                            return (
                            <div key={i} onClick={() => setImageToCrop(`${API_BASE_URL}/auth/proxy-image?url=${encodeURIComponent(img)}`)} style={{ cursor: "pointer" }}>
                                <img src={img} alt={c.name} title={c.name} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "8px", border: "2px solid transparent", transition: "border 0.2s" }} onMouseOver={e => e.target.style.borderColor="var(--primary)"} onMouseOut={e => e.target.style.borderColor="transparent"} />
                                <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            </div>
                            );
                        })}
                        {!isSearching && cardSearch && avatarResults.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>Aucun résultat avec illustration.</div>}
                        </div>
                    </div>

                    <div style={{ textAlign: "right", marginTop: "20px", paddingTop: "15px", borderTop: "1px solid var(--border)" }}>
                        <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    </div>
                </>
            )}
          </div>
        </div>
      )}

      {/* MODALE SETUP MFA */}
      {activeModal === "setupMfa" && mfaSetupData && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "450px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "var(--primary)" }}>Activer la Double Authentification</h3>
            <p style={{ color: "var(--text-main)", fontSize: "0.9rem", marginBottom: "20px" }}>
                1. Scannez ce QR Code avec une application comme <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
            </p>
            
            <div style={{ background: "white", padding: "15px", display: "inline-block", borderRadius: "8px", marginBottom: "20px" }}>
                <QRCodeCanvas value={mfaSetupData.uri} size={200} level={"H"} />
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                Ou saisissez ce code manuellement : <br/>
                <strong style={{ color: "var(--text-main)", letterSpacing: "2px" }}>{mfaSetupData.secret}</strong>
            </p>

            <form onSubmit={handleEnableMfa}>
                <div style={{ textAlign: "left", marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-main)" }}>
                        2. Entrez le code à 6 chiffres généré :
                    </label>
                    <input 
                        type="text" 
                        required 
                        value={mfaCode} 
                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456" 
                        style={{ width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--primary)", fontSize: "1.2rem", textAlign: "center", letterSpacing: "5px", fontWeight: "bold" }} 
                    />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button type="submit" className="btn-primary" disabled={mfaCode.length !== 6}>Valider et Activer</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DESACTIVER MFA */}
      {activeModal === "disableMfa" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "var(--danger)" }}>Désactiver la Double Authentification</h3>
            <p style={{ color: "var(--text-main)", fontSize: "0.9rem", marginBottom: "20px" }}>
                Désactiver l'A2F rendra votre compte vulnérable. Veuillez entrer votre mot de passe pour confirmer.
            </p>
            <form onSubmit={handleDisableMfa}>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Mot de passe actuel</label>
                    <input type="password" required value={mfaDisablePassword} onChange={e => setMfaDisablePassword(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} autoFocus />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button type="submit" className="btn-primary" style={{ background: "var(--danger)", border: "none" }} disabled={!mfaDisablePassword}>Désactiver</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALES UPDATE, NOM, EMAIL, PASSWORD, DELETE... */}
      {activeModal === "updateCollection" && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: "450px", textAlign: "center", boxSizing: "border-box", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "var(--primary)", marginBottom: "20px" }}>Mise à jour de la collection</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-main)", marginBottom: "25px" }}>Synchronisation des prix et légalités avec Scryfall...</p>
            <div style={{ height: "20px", width: "100%", boxSizing: "border-box", background: "var(--bg-main)", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
                <div style={{ height: "100%", width: `${updateProgress}%`, background: "var(--primary)", transition: "width 0.3s ease" }}></div>
            </div>
            <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "1.2rem" }}>{updateProgress}%</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{processedCards} / {totalCards} cartes traitées</span>
            </div>
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
                <button className="btn-primary" onClick={closeModal} disabled={isUpdatingCollection} style={{ opacity: isUpdatingCollection ? 0.5 : 1, cursor: isUpdatingCollection ? "not-allowed" : "pointer", padding: "10px 30px" }}>
                    {isUpdatingCollection ? "Veuillez patienter..." : "Terminer"}
                </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "nom" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Modifier le pseudo</h3>
            <form onSubmit={handleUpdateNom} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Nouveau pseudo</label>
                <input type="text" required value={nomData.nom} onChange={e => setNomData({nom: e.target.value})} maxLength={32} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} autoFocus />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!nomData.nom.trim()}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "email" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Modifier l'email</h3>
            <form onSubmit={handleUpdateEmail} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Nouvelle adresse email</label>
                <input type="email" required value={emailData.new_email} onChange={e => setEmailData({...emailData, new_email: e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} autoFocus />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Mot de passe actuel (Sécurité)</label>
                <input type="password" required value={emailData.password} onChange={e => setEmailData({...emailData, password: e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!emailData.new_email || !emailData.password}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "password" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: "400px" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Modifier le mot de passe</h3>
            <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Ancien mot de passe</label>
                <input type="password" required value={passwordData.old_password} onChange={e => setPasswordData({...passwordData, old_password: e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} autoFocus />
              </div>
              <div style={{ borderTop: "1px solid var(--border)", margin: "5px 0" }}></div>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Nouveau mot de passe</label>
                <input type="password" required value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: "0.85rem", color: "var(--text-muted)" }}>Confirmez le nouveau mot de passe</label>
                <input type="password" required value={passwordData.confirm_password} onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})} style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-main)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "deleteCollection" && (
        <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" style={{ width: "450px", border: "1px solid var(--danger)" }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, color: "var(--danger)" }}>Vider la collection</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Cette action est irréversible. Toutes vos cartes enregistrées seront supprimées. Vos decks seront conservés mais s'afficheront comme virtuels si les cartes manquent.</p>
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display:"block", marginBottom: 5, fontSize: "0.85rem" }}>Veuillez taper <strong>SUPPRIMER</strong> pour confirmer :</label>
                    <input type="text" className="input-field" placeholder="SUPPRIMER" value={deleteCollectionConfirm} onChange={e => setDeleteCollectionConfirm(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid", borderColor: deleteCollectionConfirm === "SUPPRIMER" ? "var(--success)" : "var(--border)", background: "var(--bg-input)", color: "var(--text-main)", boxSizing: "border-box" }} autoFocus />
                </div>
                <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                    <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button className="btn-secondary" style={{ background: deleteCollectionConfirm === "SUPPRIMER" ? "var(--danger)" : "var(--bg-input)", color: deleteCollectionConfirm === "SUPPRIMER" ? "white" : "var(--text-muted)", border: "none", cursor: deleteCollectionConfirm === "SUPPRIMER" ? "pointer" : "not-allowed" }} disabled={deleteCollectionConfirm !== "SUPPRIMER"} onClick={handleDeleteCollection}>Vider ma collection</button>
                </div>
            </div>
        </div>
      )}

      {activeModal === "deleteAccount" && (
        <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" style={{ width: "450px", border: "1px solid var(--danger)" }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, color: "var(--danger)" }}>Supprimer le compte</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Cette action détruira complètement votre profil, vos decks, et toute votre collection sans aucun moyen de retour en arrière.</p>
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display:"block", marginBottom: 5, fontSize: "0.85rem" }}>Veuillez taper <strong>SUPPRIMER</strong> pour confirmer l'adieu :</label>
                    <input type="text" className="input-field" placeholder="SUPPRIMER" value={deleteAccountConfirm} onChange={e => setDeleteAccountConfirm(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid", borderColor: deleteAccountConfirm === "SUPPRIMER" ? "var(--success)" : "var(--border)", background: "var(--bg-input)", color: "var(--text-main)", boxSizing: "border-box" }} autoFocus />
                </div>
                <div style={{ textAlign: "right", display:"flex", gap:10, justifyContent:"flex-end" }}>
                    <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button className="btn-secondary" style={{ background: deleteAccountConfirm === "SUPPRIMER" ? "var(--danger)" : "var(--bg-input)", color: deleteAccountConfirm === "SUPPRIMER" ? "white" : "var(--text-muted)", border: "none", cursor: deleteAccountConfirm === "SUPPRIMER" ? "pointer" : "not-allowed" }} disabled={deleteAccountConfirm !== "SUPPRIMER"} onClick={handleDeleteAccount}>Supprimer mon compte</button>
                </div>
            </div>
        </div>
      )}

      {notification.show && (
        <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", background: notification.type === "error" ? "var(--danger)" : "var(--success)", color: "white", padding: "12px 25px", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", fontWeight: "bold", zIndex: 10000 }}>
          {notification.message}
        </div>
      )}
    </div>
  );
}