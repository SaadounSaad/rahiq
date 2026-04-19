"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Load the client script
    const script = document.createElement("script");
    script.src = "/client.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      {/* ===== API KEY MODAL (Mistral only — Claude enrichment is server-side) ===== */}
      <div className="modal-overlay hidden" id="apiKeyModal">
        <div className="ocr-modal">
          <div className="modal-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Clé API Mistral</h2>
          <p>Stockée localement dans votre navigateur. Jamais envoyée ailleurs qu'à l'API Mistral.</p>
          <div className="input-wrap">
            <input type="password" id="apiKeyInput" placeholder="sk-..." autoComplete="off" spellCheck={false}/>
            <button className="btn-eye" id="toggleKeyVisibility" title="Afficher / Masquer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#9CA3AF" strokeWidth="2"/>
                <circle cx="12" cy="12" r="3" stroke="#9CA3AF" strokeWidth="2"/>
              </svg>
            </button>
          </div>
          <div className="modal-actions">
            <button className="btn-primary full-w" id="saveApiKey">Enregistrer &amp; continuer</button>
            <a href="https://console.mistral.ai/api-keys/" target="_blank" rel="noopener" className="modal-link">Obtenir une clé API Mistral →</a>
          </div>
        </div>
      </div>

      {/* ===== TOC MODAL ===== */}
      <div className="modal-overlay hidden" id="tocModal">
        <div className="ocr-modal toc-modal">
          <div className="toc-header">
            <h2>Table des matières</h2>
            <button className="toc-close-btn" id="closeTocBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="toc-body" id="tocContent">
            <p className="toc-empty">Aucun titre trouvé. Appliquez les styles H1/H2/H3 dans l'éditeur.</p>
          </div>
          <div className="toc-footer">
            <button className="btn-outline btn-sm" id="closeTocFooterBtn">Fermer</button>
            <button className="btn-primary btn-sm" id="insertTocBtn">Insérer au début du document</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN NAVBAR ===== */}
      <div className="main-navbar-stripe"></div>
      <nav className="main-navbar">
        <div className="nav-logo">
          <div className="nav-logo-mark">م</div>
          <div className="nav-logo-name">Rahiq</div>
        </div>
        <div className="nav-sep"></div>
        <div className="nav-tabs">
          <button className="nav-tab active" id="tab-ocr">OCR Document</button>
          <button className="nav-tab" id="tab-cs">Content Studio</button>
        </div>
        <div className="nav-spacer"></div>
        <button className="nav-new-btn hidden" id="newAnalysisBtn">← Nouvelle analyse</button>
        <button className="nav-theme-btn" id="themeToggle" title="Basculer clair / sombre" aria-label="Basculer le thème">
          <svg className="ic-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          <svg className="ic-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <button className="nav-api-btn" id="editApiKey">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Mistral
        </button>
      </nav>

      {/* ===== TAB: OCR DOCUMENT ===== */}
      <div id="ocr-tab" className="tab-panel active">

        {/* Upload section */}
        <div id="uploadSection" className="upload-section">
          <div className="upload-card">
            <div className="upload-banner">IMPORTER &amp; ANALYSER UN DOCUMENT</div>
            <div className="upload-body">
              <div className="drop-zone" id="dropZone">
                <input type="file" id="fileInput" hidden
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.gif,.bmp"/>
                <div className="drop-cloud">
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="drop-title">Déposez vos documents ici</p>
                <p className="drop-hint">PDF, PNG, JPG jusqu'à 50 Mo</p>
                <button className="btn-browse" id="browseBtn">Parcourir les fichiers</button>
              </div>
              <div className="upload-loading" id="uploadLoading">
                <div className="ocr-spinner"></div>
                <p>Analyse OCR en cours…</p>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div id="workspaceSection" className="workspace hidden">
          <div className="panels">

            {/* LEFT: Source */}
            <div className="panel">
              <div className="panel-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    stroke="currentColor" strokeWidth="2"/>
                </svg>
                Source
              </div>
              <div className="panel-body" id="sourcePanel">
                <div className="source-inner">
                  <canvas id="pdfCanvas"></canvas>
                  <img id="imgPreview" alt="Aperçu du document"/>
                </div>
                <div className="panel-spinner hidden" id="pdfLoading">
                  <div className="ocr-spinner-sm"></div>
                </div>
              </div>
            </div>

            <div className="panel-divider"></div>

            {/* RIGHT: Output editor */}
            <div className="panel">
              <div className="panel-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sortie
                <span className="editable-badge">éditable</span>
              </div>

              <div className="ocr-toolbar">
                <div className="toolbar-group">
                  <button className="fmt-btn" data-block="p" title="Paragraphe normal">¶</button>
                  <button className="fmt-btn fw-bold" data-block="h1" title="Titre 1">H1</button>
                  <button className="fmt-btn fw-bold" data-block="h2" title="Titre 2">H2</button>
                  <button className="fmt-btn fw-bold" data-block="h3" title="Titre 3">H3</button>
                </div>
                <div className="toolbar-sep"></div>
                <div className="toolbar-group">
                  <button className="fmt-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                  <button className="fmt-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                </div>
                <div className="toolbar-sep"></div>
                <div className="toolbar-group">
                  <span className="hl-label">Surligner</span>
                  <button className="hl-swatch" data-color="#FEF08A" style={{background:"#FEF08A"}} title="Jaune"></button>
                  <button className="hl-swatch" data-color="#BBF7D0" style={{background:"#BBF7D0"}} title="Vert"></button>
                  <button className="hl-swatch" data-color="#BFDBFE" style={{background:"#BFDBFE"}} title="Bleu"></button>
                  <button className="hl-swatch" data-color="#FCA5A5" style={{background:"#FCA5A5"}} title="Rouge"></button>
                  <button className="hl-swatch hl-remove" data-color="" title="Retirer le surlignage">✕</button>
                </div>
                <div className="toolbar-sep"></div>
                <button className="toolbar-action-btn" id="tocBtn" title="Générer la table des matières">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6h16M4 10h16M4 14h8M4 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  TDM
                </button>
                <button className="toolbar-action-btn" id="cutToEndBtn" title="Supprimer depuis le curseur jusqu'à la fin de la page">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 12h12M12 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Couper fin
                </button>
                <button className="toolbar-action-btn export-btn" id="exportDocxBtn" title="Télécharger en Word (.docx)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Télécharger .docx
                </button>
              </div>

              <div className="panel-body">
                <div id="editor" suppressContentEditableWarning={true}></div>
              </div>
            </div>
          </div>

          {/* Page navigation */}
          <div className="page-nav">
            <button className="nav-btn" id="prevBtn" disabled>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Préc.
            </button>
            <span className="page-counter">
              Page <input type="number" id="currentPageEl" defaultValue="1" min="1" className="page-input" title="Entrer un numéro de page puis Entrée"/> / <span id="totalPagesEl">1</span>
            </span>
            <button className="nav-btn" id="nextBtn" disabled>
              Suiv.
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

      </div>

      {/* ===== TAB: CONTENT STUDIO ===== */}
      <div id="cs-tab" className="tab-panel">
        <div id="cs-app"></div>
      </div>

      {/* TOAST */}
      <div className="toast" id="toast"></div>
    </>
  );
}
