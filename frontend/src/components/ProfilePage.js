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

  return (
    <div className="pp-container">
      <div className="pp-content">

        <div className="pp-section">
            <h3 className="pp-section-title">
                Informations Générales
            </h3>

            <div className="pp-avatar-wrapper">
                <img src={user?.avatar || defaultAvatar} alt="Avatar" className="pp-avatar-img" />
                <button onClick={() => setActiveModal("avatar")} className="pp-avatar-btn">
                    Modifier
                </button>
            </div>

            <div className="pp-info-container">
                <div className="pp-info-row">
                    <div></div>
                    <h2 className="pp-info-name">{user?.nom}</h2>
                    <div className="pp-info-edit-wrapper">
                        <button onClick={() => setActiveModal("nom")} className="pp-info-edit-btn">Modifier</button>
                    </div>
                </div>
                
                <div className="pp-info-row">
                    <div></div>
                    <p className="pp-info-email">{user?.email}</p>
                    <div className="pp-info-edit-wrapper">
                        <button onClick={() => setActiveModal("email")} className="pp-info-edit-btn">Modifier</button>
                    </div>
                </div>
            </div>

            <button onClick={() => setActiveModal("password")} className="btn-secondary pp-btn-dashed">
                Changer le mot de passe
            </button>

            {/* BLOC MFA */}
            <div className={`pp-mfa-box ${user?.mfa_enabled ? "pp-mfa-box-enabled" : "pp-mfa-box-disabled"}`}>
                <div>
                    <h4 className="pp-mfa-title">Double Authentification (A2F)</h4>
                    <p className={`pp-mfa-desc ${user?.mfa_enabled ? "pp-mfa-desc-enabled" : "pp-mfa-desc-disabled"}`}>
                        {user?.mfa_enabled ? "L'A2F est activée et sécurise votre compte." : "Protégez votre compte avec un code à 6 chiffres."}
                    </p>
                </div>
                {user?.mfa_enabled ? (
                    <button onClick={() => setActiveModal("disableMfa")} className="btn-secondary pp-mfa-disable-btn">Désactiver</button>
                ) : (
                    <button onClick={handleInitiateMfa} className="btn-primary">Activer</button>
                )}
            </div>
        </div>

        <div className="pp-section">
            <h3 className="pp-section-title">
                Gestion de la Collection
            </h3>
            
            <div className="pp-collection-actions">
                <div className="pp-update-wrapper">
                    {isUpdatingCollection && (
                        <div className="pp-update-progress" style={{ width: `${updateProgress}%` }} />
                    )}
                    
                    <button 
                        onClick={handleUpdateCollection} 
                        disabled={isUpdatingCollection} 
                        className="pp-update-btn"
                        style={{ cursor: isUpdatingCollection ? "not-allowed" : "pointer" }}
                    >
                        <span className="pp-update-text">Mettre à jour les données (Prix, légalités...)</span>
                        <span className="pp-update-pct">
                            {isUpdatingCollection ? `${updateProgress}%` : "Lancer"}
                        </span>
                    </button>
                </div>

                <button onClick={() => setActiveModal("deleteCollection")} className="btn-secondary pp-delete-coll-btn">
                    <span>Vider toute ma collection</span>
                    <span>Supprimer</span>
                </button>
            </div>
        </div>

        <div className="pp-section">
            <h3 className="pp-section-title">
                Préférences d'affichage
            </h3>
            <div className="pp-theme-row">
                <span className="pp-theme-text">Apparence de l'application :</span>
                <button onClick={toggleTheme} className="btn-secondary pp-theme-btn">
                    {theme === "light" ? "Passer en Mode Sombre" : "Passer en Mode Clair"}
                </button>
            </div>
        </div>

        <div className="pp-section pp-danger-section">
            <h3 className="pp-danger-title">
                Zone de Danger
            </h3>
            <div className="pp-danger-actions">
                <button onClick={handleLogout} className="btn-secondary pp-logout-btn">
                    Se déconnecter
                </button>
                <button onClick={() => setActiveModal("deleteAccount")} className="btn-primary pp-delete-acc-btn">
                    Supprimer mon compte définitivement
                </button>
            </div>
        </div>

      </div>

      {/* --- MODALES --- */}
      
      {activeModal === "avatar" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-avatar-content" onClick={e => e.stopPropagation()}>
            
            {imageToCrop ? (
                <div className="pp-modal-avatar-wrapper">
                    <h3 className="pp-modal-avatar-title">Cadrer votre avatar</h3>
                    
                    <div className="pp-cropper-container">
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
                    
                    <div className="pp-zoom-row">
                        <span className="pp-zoom-label">Zoom :</span>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} className="pp-zoom-input" />
                    </div>

                    <div className="pp-modal-footer-between">
                        <button className="btn-secondary" onClick={() => setImageToCrop(null)}>Retour</button>
                        <button className="btn-primary" onClick={handleConfirmCrop} disabled={isCropping}>{isCropping ? "Traitement..." : "Valider le cadrage"}</button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 className="pp-modal-avatar-title">Modifier la photo de profil</h3>
                    
                    <div className="pp-upload-box">
                        <h4 className="pp-upload-title">Option 1 : Importer depuis votre ordinateur</h4>
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleLocalImageUpload} className="pp-upload-input" />
                    </div>

                    <div className="pp-search-wrapper">
                        <h4 className="pp-upload-title">Option 2 : Choisir une illustration de carte</h4>
                        <form onSubmit={handleAvatarSearch} className="pp-search-form">
                        <input type="text" value={cardSearch} onChange={e => setCardSearch(e.target.value)} placeholder="Nom d'une carte (ex: Chandra)..." className="pp-search-input" autoFocus />
                        <button type="submit" className="btn-primary" disabled={isSearching}>{isSearching ? "..." : "Chercher"}</button>
                        </form>

                        <div className="pp-search-grid">
                        {avatarResults.map((c, i) => {
                            const img = c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop;
                            if (!img) return null;
                            return (
                            <div key={i} onClick={() => setImageToCrop(`${API_BASE_URL}/auth/proxy-image?url=${encodeURIComponent(img)}`)} className="pp-search-item">
                                <img src={img} alt={c.name} title={c.name} className="pp-search-item-img" />
                                <div className="pp-search-item-label">{c.name}</div>
                            </div>
                            );
                        })}
                        {!isSearching && cardSearch && avatarResults.length === 0 && <div className="pp-search-empty">Aucun résultat avec illustration.</div>}
                        </div>
                    </div>

                    <div className="pp-modal-footer-right">
                        <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    </div>
                </>
            )}
          </div>
        </div>
      )}

      {activeModal === "setupMfa" && mfaSetupData && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-setup-mfa" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-mfa-title">Activer la Double Authentification</h3>
            <p className="pp-modal-mfa-desc">
                1. Scannez ce QR Code avec une application comme <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
            </p>
            
            <div className="pp-modal-mfa-qr-box">
                <QRCodeCanvas value={mfaSetupData.uri} size={200} level={"H"} />
            </div>

            <p className="pp-modal-mfa-manual">
                Ou saisissez ce code manuellement : <br/>
                <strong className="pp-modal-mfa-secret">{mfaSetupData.secret}</strong>
            </p>

            <form onSubmit={handleEnableMfa}>
                <div className="pp-modal-mfa-form">
                    <label className="pp-modal-mfa-label">
                        2. Entrez le code à 6 chiffres généré :
                    </label>
                    <input 
                        type="text" 
                        required 
                        value={mfaCode} 
                        onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456" 
                        className="pp-modal-mfa-input" 
                    />
                </div>
                <div className="pp-modal-mfa-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button type="submit" className="btn-primary" disabled={mfaCode.length !== 6}>Valider et Activer</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "disableMfa" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-disable-mfa" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-disable-mfa-title">Désactiver la Double Authentification</h3>
            <p className="pp-modal-disable-mfa-desc">
                Désactiver l'A2F rendra votre compte vulnérable. Veuillez entrer votre mot de passe pour confirmer.
            </p>
            <form onSubmit={handleDisableMfa}>
                <div className="pp-modal-disable-mfa-group">
                    <label className="pp-modal-disable-mfa-label">Mot de passe actuel</label>
                    <input type="password" required value={mfaDisablePassword} onChange={e => setMfaDisablePassword(e.target.value)} className="pp-modal-disable-mfa-input" autoFocus />
                </div>
                <div className="pp-modal-mfa-actions">
                    <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button type="submit" className="btn-secondary pp-mfa-disable-btn" disabled={!mfaDisablePassword}>Désactiver</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "updateCollection" && (
        <div className="modal-overlay">
          <div className="modal-content pp-modal-update-coll" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-update-coll-title">Mise à jour de la collection</h3>
            <p className="pp-modal-update-coll-desc">Synchronisation des prix et légalités avec Scryfall...</p>
            <div className="pp-update-coll-bar-wrapper">
                <div className="pp-update-coll-bar-fill" style={{ width: `${updateProgress}%` }}></div>
            </div>
            <div className="pp-update-coll-stats">
                <span className="pp-update-coll-pct">{updateProgress}%</span>
                <span className="pp-update-coll-count">{processedCards} / {totalCards} cartes traitées</span>
            </div>
            <div className="pp-update-coll-footer">
                <button className="btn-primary pp-update-coll-btn" onClick={closeModal} disabled={isUpdatingCollection} style={{ opacity: isUpdatingCollection ? 0.5 : 1, cursor: isUpdatingCollection ? "not-allowed" : "pointer" }}>
                    {isUpdatingCollection ? "Veuillez patienter..." : "Terminer"}
                </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "nom" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-form-content" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-form-title">Modifier le pseudo</h3>
            <form onSubmit={handleUpdateNom} className="pp-modal-form-flex">
              <div>
                <label className="pp-modal-form-label">Nouveau pseudo</label>
                <input type="text" required value={nomData.nom} onChange={e => setNomData({nom: e.target.value})} maxLength={32} className="pp-modal-form-input" autoFocus />
              </div>
              <div className="pp-modal-form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!nomData.nom.trim()}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "email" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-form-content" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-form-title">Modifier l'email</h3>
            <form onSubmit={handleUpdateEmail} className="pp-modal-form-flex">
              <div>
                <label className="pp-modal-form-label">Nouvelle adresse email</label>
                <input type="email" required value={emailData.new_email} onChange={e => setEmailData({...emailData, new_email: e.target.value})} className="pp-modal-form-input" autoFocus />
              </div>
              <div>
                <label className="pp-modal-form-label">Mot de passe actuel (Sécurité)</label>
                <input type="password" required value={emailData.password} onChange={e => setEmailData({...emailData, password: e.target.value})} className="pp-modal-form-input" />
              </div>
              <div className="pp-modal-form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!emailData.new_email || !emailData.password}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "password" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content pp-modal-form-content" onClick={e => e.stopPropagation()}>
            <h3 className="pp-modal-form-title">Modifier le mot de passe</h3>
            <form onSubmit={handleUpdatePassword} className="pp-modal-form-flex">
              <div>
                <label className="pp-modal-form-label">Ancien mot de passe</label>
                <input type="password" required value={passwordData.old_password} onChange={e => setPasswordData({...passwordData, old_password: e.target.value})} className="pp-modal-form-input" autoFocus />
              </div>
              <div className="pp-modal-divider"></div>
              <div>
                <label className="pp-modal-form-label">Nouveau mot de passe</label>
                <input type="password" required value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} className="pp-modal-form-input" />
              </div>
              <div>
                <label className="pp-modal-form-label">Confirmez le nouveau mot de passe</label>
                <input type="password" required value={passwordData.confirm_password} onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})} className="pp-modal-form-input" />
              </div>
              <div className="pp-modal-form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password}>Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "deleteCollection" && (
        <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content pp-modal-delete" onClick={e => e.stopPropagation()}>
                <h3 className="pp-modal-delete-title">Vider la collection</h3>
                <p className="pp-modal-delete-desc">Cette action est irréversible. Toutes vos cartes enregistrées seront supprimées. Vos decks seront conservés mais s'afficheront comme virtuels si les cartes manquent.</p>
                <div className="pp-modal-delete-group">
                    <label className="pp-modal-delete-label">Veuillez taper <strong>SUPPRIMER</strong> pour confirmer :</label>
                    <input type="text" className={`pp-modal-delete-input ${deleteCollectionConfirm === "SUPPRIMER" ? "success" : "default"}`} placeholder="SUPPRIMER" value={deleteCollectionConfirm} onChange={e => setDeleteCollectionConfirm(e.target.value)} autoFocus />
                </div>
                <div className="pp-modal-delete-actions">
                    <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button className={`btn-secondary pp-btn-delete-confirm ${deleteCollectionConfirm === "SUPPRIMER" ? "active" : "inactive"}`} disabled={deleteCollectionConfirm !== "SUPPRIMER"} onClick={handleDeleteCollection}>Vider ma collection</button>
                </div>
            </div>
        </div>
      )}

      {activeModal === "deleteAccount" && (
        <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content pp-modal-delete" onClick={e => e.stopPropagation()}>
                <h3 className="pp-modal-delete-title">Supprimer le compte</h3>
                <p className="pp-modal-delete-desc">Cette action détruira complètement votre profil, vos decks, et toute votre collection sans aucun moyen de retour en arrière.</p>
                <div className="pp-modal-delete-group">
                    <label className="pp-modal-delete-label">Veuillez taper <strong>SUPPRIMER</strong> pour confirmer l'adieu :</label>
                    <input type="text" className={`pp-modal-delete-input ${deleteAccountConfirm === "SUPPRIMER" ? "success" : "default"}`} placeholder="SUPPRIMER" value={deleteAccountConfirm} onChange={e => setDeleteAccountConfirm(e.target.value)} autoFocus />
                </div>
                <div className="pp-modal-delete-actions">
                    <button className="btn-secondary" onClick={closeModal}>Annuler</button>
                    <button className={`btn-secondary pp-btn-delete-confirm ${deleteAccountConfirm === "SUPPRIMER" ? "active" : "inactive"}`} disabled={deleteAccountConfirm !== "SUPPRIMER"} onClick={handleDeleteAccount}>Supprimer mon compte</button>
                </div>
            </div>
        </div>
      )}

      {notification.show && (
        <div className={` ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}