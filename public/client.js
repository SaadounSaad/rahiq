/* global pdfjsLib, htmlDocx, marked, mammoth */

/* ═══ API KEY MODAL (Mistral only — Claude enrichment is server-side) ═══ */
const KEY_STORAGE = 'ocrl_mistral_api_key';
const OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
const OCR_MODEL = 'mistral-ocr-latest';
const MAX_BYTES = 50 * 1024 * 1024;

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ═══ TAB SWITCHING ═══ */
function switchTab(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id + '-tab').classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
}

/* Theme toggle */
(function initTheme() {
  const saved = localStorage.getItem('majalis:theme') || 'light';
  if (saved === 'dark') document.body.dataset.theme = 'dark';
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.body.dataset.theme = 'dark';
    else delete document.body.dataset.theme;
    localStorage.setItem('majalis:theme', next);
  });
})();

/* ═══ OCR MODULE ═══ */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let pages = [];
let currentPage = 0;
let totalPages = 0;
let pdfDoc = null;
let fileIsImage = false;
let imgDataURL = '';
let fileName = '';
let savedRange = null;

const apiKeyModal = $('apiKeyModal');
const apiKeyInput = $('apiKeyInput');
const saveApiKeyBtn = $('saveApiKey');
const editApiKeyBtn = $('editApiKey');
const toggleKeyBtn = $('toggleKeyVisibility');

const tocModal = $('tocModal');
const tocContent = $('tocContent');
const tocBtn = $('tocBtn');
const closeTocBtn = $('closeTocBtn');
const closeTocFooter = $('closeTocFooterBtn');
const insertTocBtn = $('insertTocBtn');

const uploadSection = $('uploadSection');
const dropZone = $('dropZone');
const fileInput = $('fileInput');
const browseBtn = $('browseBtn');
const uploadLoading = $('uploadLoading');

const workspace = $('workspaceSection');
const newAnalysisBtn = $('newAnalysisBtn');

const sourcePanel = $('sourcePanel');
const pdfCanvas = $('pdfCanvas');
const imgPreview = $('imgPreview');
const pdfLoading = $('pdfLoading');
const editor = $('editor');

const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const currentPageEl = $('currentPageEl');
const totalPagesEl = $('totalPagesEl');
const exportDocxBtn = $('exportDocxBtn');
const toastEl = $('toast');

function getApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }

function showApiModal() {
  apiKeyModal.classList.remove('hidden');
  setTimeout(() => apiKeyInput.focus(), 80);
}
function hideApiModal() { apiKeyModal.classList.add('hidden'); }

saveApiKeyBtn.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (!val) { showToast('Veuillez saisir une clé API.', 'err'); return; }
  localStorage.setItem(KEY_STORAGE, val);
  hideApiModal();
  showToast('Clé API enregistrée !', 'ok');
});

editApiKeyBtn.addEventListener('click', () => {
  apiKeyInput.value = getApiKey();
  showApiModal();
});

toggleKeyBtn.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

apiKeyModal.addEventListener('click', e => {
  if (e.target === apiKeyModal && getApiKey()) hideApiModal();
});

apiKeyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveApiKeyBtn.click();
});

/* File upload */
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  const apiKey = getApiKey();
  if (!apiKey) { showApiModal(); return; }
  if (file.size > MAX_BYTES) { showToast('Fichier trop volumineux (max 50 Mo).', 'err'); return; }

  fileName = file.name;
  fileIsImage = file.type.startsWith('image/');

  dropZone.style.display = 'none';
  uploadLoading.style.display = 'block';

  try {
    const dataURI = await readFileAsDataURL(file);
    const result = await callMistralOCR(apiKey, dataURI, file.type);
    const rawPages = Array.isArray(result.pages) ? result.pages : [];
    pages = rawPages.map(p => ({
      markdown: cleanPageNumbers(p.markdown || ''),
      editedHtml: null,
      header: cleanPageNumbers(extractText(p.header)),
      footer: cleanPageNumbers(extractText(p.footer))
    }));
    if (pages.length === 0) pages = [{ markdown: '', editedHtml: '<p>Aucun contenu extrait.</p>', header: '', footer: '' }];

    removeRepeatedLines(pages);

    totalPages = pages.length;
    currentPage = 0;

    if (fileIsImage) {
      imgDataURL = dataURI;
      pdfCanvas.style.display = 'none';
      imgPreview.src = dataURI;
      imgPreview.style.display = 'block';
    } else {
      imgPreview.style.display = 'none';
      pdfCanvas.style.display = 'block';
      const buf = dataURItoArrayBuffer(dataURI);
      pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    }

    uploadSection.style.display = 'none';
    workspace.classList.remove('hidden');
    newAnalysisBtn.classList.remove('hidden');

    navigateTo(0);
    showToast('OCR terminé · ' + totalPages + ' page(s) extraite(s).', 'ok');

  } catch (err) {
    console.error('[Rahiq OCR]', err);
    if (err.status === 401) { showToast('Clé API invalide (401).', 'err'); showApiModal(); }
    else showToast(err.message || 'Erreur OCR — voir la console.', 'err');
  } finally {
    dropZone.style.display = 'block';
    uploadLoading.style.display = 'none';
    fileInput.value = '';
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    r.readAsDataURL(file);
  });
}

function dataURItoArrayBuffer(dataURI) {
  const b64 = dataURI.split(',')[1];
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return buf;
}

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (val.text) return String(val.text).trim();
  if (val.markdown) return String(val.markdown).trim();
  return String(val).trim();
}

function cleanPageNumbers(md) {
  let result = md
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\[page[^\]]*\][ \t]*$/ugim, '')
    .replace(/^[ \t]*\*{1,3}([\p{Nd}\p{L}\s\p{Pd}\/\u00B7\.]{1,70})\*{1,3}[ \t]*$/ugm, '$1')
    .replace(/^#{1,6}[ \t]+([\p{Nd}\p{Pd}\p{L}\s\/\u00B7\.]{1,70})[ \t]*$/ugm, '$1')
    .replace(/^[ \t]*[\p{Pd}]?\s*\p{Nd}+\s*[\p{Pd}]?\s*$/ugm, '')
    .replace(/^[ \t]*\p{Nd}+\s*[\/\u060C]\s*\p{Nd}+\s*$/ugm, '')
    .replace(/^[ \t]*[\p{Pd}]?\s*[\p{L}]{0,8}\.?\s*\p{Nd}+\s*[\/\u00B7]\s*\p{Nd}+\s*[\p{Pd}]?[ \t]*$/ugm, '')
    .replace(/^[ \t]*\p{Nd}+\s+[\p{L}][\p{L}\s]{1,48}[ \t]*$/ugm, '')
    .replace(/^[ \t]*[\p{L}][\p{L}\s]{1,48}\s+\p{Nd}+[ \t]*$/ugm, '')
    .replace(/\[\^\d+\]|\^\d+\^|[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const isSep = s => {
    const t = s.trim().replace(/[\s\u00A0\u200B]+/g, '');
    return t.length >= 2 && /^[-—–\u2015_─━═\u2500-\u257F]+$/.test(t);
  };
  const isRef = s => /^[ \t]*[\(\[]?\p{Nd}{1,2}[\)\].]\s/u.test(s);

  const lines = result.split('\n');
  let cutAt = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isSep(lines[i])) continue;
    const after = lines.slice(i + 1).filter(l => l.trim());
    if (after.length === 0 || isRef(after[0]) || after.length <= 30) cutAt = i;
    break;
  }

  if (cutAt < 0) {
    let footStart = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      if (isRef(line)) { footStart = i; }
      else break;
    }
    if (footStart >= 0) {
      let cut = footStart, j = footStart - 1;
      while (j >= 0 && !lines[j].trim()) j--;
      if (j >= 0 && isSep(lines[j])) cut = j;
      const totalNonEmpty = lines.filter(l => l.trim()).length;
      const bodyNonEmpty = lines.slice(0, cut).filter(l => l.trim()).length;
      if (totalNonEmpty === 0 || bodyNonEmpty >= Math.ceil(totalNonEmpty * 0.3)) cutAt = cut;
    }
  }

  if (cutAt >= 0) result = lines.slice(0, cutAt).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  result = result.replace(/^[-—–_─━═\u2500-\u257F]{2,}[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return result;
}

function removeRepeatedLines(pages) {
  if (pages.length < 2) return;
  function normLine(line) {
    return line.replace(/^[\p{Nd}\p{Pd}\s]+/u, '').replace(/[\p{Nd}\p{Pd}\s]+$/u, '').trim();
  }
  const freq = new Map();
  pages.forEach(pg => {
    const seen = new Set();
    pg.markdown.split('\n').forEach(raw => {
      const line = raw.trim();
      if (line.length === 0 || line.length >= 80) return;
      const norm = normLine(line);
      if (norm.length === 0) return;
      if (!seen.has(norm)) { seen.add(norm); freq.set(norm, (freq.get(norm) || 0) + 1); }
    });
  });
  const threshold = Math.max(2, Math.floor(pages.length * 0.25));
  const toRemove = new Set([...freq.entries()].filter(([, c]) => c >= threshold).map(([n]) => n));
  if (toRemove.size === 0) return;
  pages.forEach(pg => {
    pg.markdown = pg.markdown.split('\n')
      .filter(raw => {
        const line = raw.trim();
        if (line.length === 0 || line.length >= 80) return true;
        return !toRemove.has(normLine(line));
      })
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  });
}

async function callMistralOCR(apiKey, dataURI, mimeType) {
  const doc = mimeType.startsWith('image/')
    ? { type: 'image_url', image_url: dataURI }
    : { type: 'document_url', document_url: dataURI };

  const res = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OCR_MODEL, document: doc, extract_header: true, extract_footer: true })
  });

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const b = await res.json(); msg = b.message || b.error || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.json();
}

async function callClaudeChat(content) {
  const res = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const b = await res.json(); msg = b.error || msg; } catch {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  const data = await res.json();
  return { raw: JSON.stringify(data) };
}

async function renderPdfPage(num) {
  if (!pdfDoc) return;
  pdfLoading.classList.remove('hidden');
  try {
    const page = await pdfDoc.getPage(num);
    const panelW = sourcePanel.clientWidth > 0 ? sourcePanel.clientWidth - 40 : 560;
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(panelW / vp0.width, 2.5);
    const vp = page.getViewport({ scale });
    pdfCanvas.width = vp.width;
    pdfCanvas.height = vp.height;
    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport: vp }).promise;
  } finally {
    pdfLoading.classList.add('hidden');
  }
}

function saveCurrentPage() {
  if (pages[currentPage]) pages[currentPage].editedHtml = editor.innerHTML;
}

function navigateTo(idx) {
  if (idx !== currentPage) saveCurrentPage();
  currentPage = Math.max(0, Math.min(idx, totalPages - 1));
  if (!fileIsImage && pdfDoc) renderPdfPage(currentPage + 1);
  const pg = pages[currentPage];
  if (pg.editedHtml !== null) {
    editor.innerHTML = pg.editedHtml;
  } else {
    editor.innerHTML = marked.parse(pg.markdown);
    pg.editedHtml = editor.innerHTML;
  }
  currentPageEl.value = currentPage + 1;
  currentPageEl.max = totalPages;
  totalPagesEl.textContent = totalPages;
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage === totalPages - 1;
}

prevBtn.addEventListener('click', () => navigateTo(currentPage - 1));
nextBtn.addEventListener('click', () => navigateTo(currentPage + 1));

currentPageEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const n = parseInt(currentPageEl.value, 10);
    if (!isNaN(n)) navigateTo(n - 1);
    currentPageEl.blur();
  }
  if (e.key === 'Escape') { currentPageEl.value = currentPage + 1; currentPageEl.blur(); }
});
currentPageEl.addEventListener('blur', () => {
  const n = parseInt(currentPageEl.value, 10);
  if (!isNaN(n) && n - 1 !== currentPage) navigateTo(n - 1);
  else currentPageEl.value = currentPage + 1;
});
currentPageEl.addEventListener('focus', () => currentPageEl.select());

document.addEventListener('keydown', e => {
  if (!workspace.classList.contains('hidden')) {
    if ((e.altKey && e.key === 'ArrowLeft') || e.key === 'PageUp') { e.preventDefault(); navigateTo(currentPage - 1); }
    if ((e.altKey && e.key === 'ArrowRight') || e.key === 'PageDown') { e.preventDefault(); navigateTo(currentPage + 1); }
  }
});

newAnalysisBtn.addEventListener('click', () => {
  if (!confirm('Démarrer une nouvelle analyse ? Les modifications non enregistrées seront perdues.')) return;
  pages = []; currentPage = 0; totalPages = 0;
  pdfDoc = null; fileIsImage = false;
  editor.innerHTML = '';
  pdfCanvas.style.display = 'none';
  imgPreview.style.display = 'none';
  imgPreview.src = '';
  workspace.classList.add('hidden');
  newAnalysisBtn.classList.add('hidden');
  uploadSection.style.display = '';
  fileInput.value = '';
});

/* Rich text editing */
editor.addEventListener('mouseup', saveSelection);
editor.addEventListener('keyup', saveSelection);
editor.addEventListener('focus', saveSelection);

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode))
    savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return true;
}

$$('.fmt-btn[data-block]').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    restoreSelection();
    document.execCommand('formatBlock', false, btn.dataset.block);
    editor.focus(); saveCurrentPage(); updateToolbarState();
  });
});

$$('.fmt-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    restoreSelection();
    document.execCommand(btn.dataset.cmd);
    editor.focus(); saveCurrentPage();
  });
});

$$('.hl-swatch').forEach(swatch => {
  swatch.addEventListener('mousedown', e => e.preventDefault());
  swatch.addEventListener('click', () => {
    if (!restoreSelection()) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { showToast('Sélectionnez du texte pour le surligner.', 'err'); return; }
    const color = swatch.dataset.color;
    const range = sel.getRangeAt(0);
    if (color === '') removeHighlight(range);
    else applyHighlight(range, color);
    editor.focus(); saveCurrentPage();
  });
});

function applyHighlight(range, color) {
  const span = document.createElement('span');
  span.style.backgroundColor = color;
  span.style.borderRadius = '2px';
  span.style.padding = '0 1px';
  try { range.surroundContents(span); }
  catch { span.appendChild(range.extractContents()); range.insertNode(span); }
}

function removeHighlight(range) {
  const ancestor = range.commonAncestorContainer;
  const root = ancestor.nodeType === 1 ? ancestor : ancestor.parentElement;
  if (!root) return;
  root.querySelectorAll('span[style]').forEach(span => {
    if (range.intersectsNode(span) && span.style.backgroundColor) {
      span.style.backgroundColor = '';
      span.style.padding = '';
      if (!span.getAttribute('style') || !span.getAttribute('style').trim()) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }
    }
  });
}

document.addEventListener('selectionchange', updateToolbarState);

function updateToolbarState() {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return;
  let node = sel.anchorNode;
  while (node && node !== editor) {
    const tag = node.nodeName && node.nodeName.toLowerCase();
    $$('.fmt-btn[data-block]').forEach(b => b.classList.toggle('active', b.dataset.block === tag));
    if (['h1', 'h2', 'h3', 'p', 'div'].includes(tag)) break;
    node = node.parentNode;
  }
}

/* TOC */
tocBtn.addEventListener('click', () => {
  saveCurrentPage(); renderToc();
  tocModal.classList.remove('hidden');
});

$('cutToEndBtn').addEventListener('click', () => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    showToast('Cliquez d\'abord dans le texte à l\'endroit de la coupure.', 'err');
    return;
  }
  const range = sel.getRangeAt(0);
  const endRange = document.createRange();
  endRange.selectNodeContents(editor);
  range.setEnd(endRange.endContainer, endRange.endOffset);
  range.deleteContents();
  saveCurrentPage();
  showToast('Contenu supprimé jusqu\'à la fin de la page.');
});

[closeTocBtn, closeTocFooter].forEach(btn => btn.addEventListener('click', () => tocModal.classList.add('hidden')));
tocModal.addEventListener('click', e => { if (e.target === tocModal) tocModal.classList.add('hidden'); });

function collectHeadings() {
  const list = [];
  pages.forEach((pg, pageIdx) => {
    const html = pg.editedHtml !== null ? pg.editedHtml : marked.parse(pg.markdown);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('h1, h2, h3').forEach(h => {
      list.push({ level: parseInt(h.tagName[1]), text: h.textContent.trim(), page: pageIdx });
    });
  });
  return list;
}

function renderToc() {
  const headings = collectHeadings();
  if (headings.length === 0) {
    tocContent.innerHTML = '<p class="toc-empty">Aucun titre (H1/H2/H3) trouvé. Appliquez les styles dans l\'éditeur.</p>';
    return;
  }
  const ul = document.createElement('ul');
  headings.forEach(h => {
    const li = document.createElement('li');
    li.className = 'toc-h' + h.level;
    const label = document.createElement('span'); label.textContent = h.text;
    const pg = document.createElement('span'); pg.className = 'toc-page'; pg.textContent = 'p.' + (h.page + 1);
    li.append(label, pg);
    li.addEventListener('click', () => { tocModal.classList.add('hidden'); navigateTo(h.page); });
    ul.appendChild(li);
  });
  tocContent.innerHTML = '';
  tocContent.appendChild(ul);
}

insertTocBtn.addEventListener('click', () => {
  saveCurrentPage();
  const headings = collectHeadings();
  if (headings.length === 0) { showToast('Aucun titre trouvé.', 'err'); return; }

  let tocHtml = '<div style="margin-bottom:1.5rem;padding:1rem;background:#F6F3EE;border-left:3px solid #24386B;border-radius:8px">' +
    '<strong style="font-size:1rem;display:block;margin-bottom:.75rem">Table des matières</strong>' +
    '<ul style="list-style:none;padding:0;margin:0">';
  headings.forEach(h => {
    const indent = (h.level - 1) * 18;
    const weight = h.level === 1 ? '700' : '400';
    const color = h.level === 3 ? '#9C988F' : '#2B2A28';
    tocHtml += '<li style="padding:.2rem 0 .2rem ' + indent + 'px;font-weight:' + weight + ';color:' + color + ';font-size:.875rem">' +
      h.text + ' <span style="color:#9CA3AF;font-size:.75rem">— p.' + (h.page + 1) + '</span></li>';
  });
  tocHtml += '</ul></div><hr style="margin:1rem 0"/>';

  pages[0].editedHtml = tocHtml + (pages[0].editedHtml || marked.parse(pages[0].markdown));
  if (currentPage === 0) editor.innerHTML = pages[0].editedHtml;

  tocModal.classList.add('hidden');
  showToast('TDM insérée au début du document.', 'ok');
});

/* DOCX export */
exportDocxBtn.addEventListener('click', exportDocx);

function exportDocx() {
  saveCurrentPage();
  pages.forEach(pg => { if (pg.editedHtml === null) pg.editedHtml = marked.parse(pg.markdown); });

  if (typeof htmlDocx === 'undefined') {
    showToast('Bibliothèque DOCX non chargée.', 'err'); return;
  }

  const headings = collectHeadings();
  let tocSection = '';
  if (headings.length > 0) {
    tocSection = '<div style="margin-bottom:36pt"><h2 style="font-size:16pt;margin-bottom:14pt">Table des matières</h2>' +
      '<ul style="list-style:none;padding:0;margin:0">';
    headings.forEach(h => {
      const indent = (h.level - 1) * 18;
      tocSection += '<li style="padding:3pt 0 3pt ' + indent + 'pt;font-weight:' + (h.level === 1 ? 'bold' : 'normal') + ';font-size:11pt">' +
        h.text + '<span style="color:#9CA3AF"> — p.' + (h.page + 1) + '</span></li>';
    });
    tocSection += '</ul></div><hr style="margin:24pt 0"/>';
  }

  let bodyHtml = '';
  pages.forEach((pg, i) => {
    let html = (pg.editedHtml !== null ? pg.editedHtml : marked.parse(pg.markdown)).replace(/<hr\b[^>]*>/gi, '');
    if (i > 0 && totalPages > 1) bodyHtml += '<p style="page-break-before:always;margin:0"></p>';
    bodyHtml += html;
  });

  const fullDoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#2B2A28}' +
    'h1{font-size:20pt;font-weight:bold;margin:20pt 0 8pt}' +
    'h2{font-size:15pt;font-weight:bold;margin:16pt 0 6pt;color:#24386B}' +
    'h3{font-size:13pt;font-weight:bold;margin:12pt 0 5pt;color:#24386B}' +
    'p{margin:0 0 8pt}ul,ol{padding-left:18pt;margin-bottom:8pt}li{margin-bottom:3pt}' +
    'table{border-collapse:collapse;width:100%;margin:8pt 0}' +
    'th,td{border:1pt solid #E6E1D7;padding:4pt 6pt;font-size:10pt}th{background:#F6F3EE;font-weight:bold}' +
    'code{font-family:\'Courier New\',monospace;font-size:9pt;background:#F6F3EE}' +
    '</style></head><body>' + tocSection + bodyHtml + '</body></html>';

  try {
    const blob = htmlDocx.asBlob(fullDoc);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: (fileName.replace(/\.[^.]+$/, '') || 'document') + '_Rahiq.docx'
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast('Fichier DOCX téléchargé !', 'ok');
  } catch (err) {
    console.error('[Rahiq] DOCX export error:', err);
    showToast('Échec de l\'export — voir la console.', 'err');
  }
}

/* Toast */
let toastTimer = null;
function showToast(msg, type) {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (type ? ' ' + type : '');
  toastEl.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 4500);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getApiKey()) showApiModal();
});

/* ═══ CONTENT STUDIO MODULE ═══ */
var TYPE_LABELS = { text: "Texte", hadith: "Hadith", ayah: "Verset", quote: "Citation", natiija: "Conclusion", tatbiq: "Application", remarque: "Remarque" };
var CHUNK_TYPES = Object.keys(TYPE_LABELS);

function countWords(t) { return t.trim().split(/\s+/).filter(Boolean).length; }

var CS_STATE = {
  source: { id: "", title: "", author: "", language: "ar", totalModules: 0, totalUnits: 0, totalChunks: 0 },
  units: []
};
var csActiveModule = null;
var csLoading = false;
var csLoadingMsg = "";
var csOpenUnits = new Set();
var csEditingChunks = new Set();
var csEditDrafts = {};

function csHasData() { return CS_STATE.units.length > 0; }

/* DOCX extractor */
async function csExtractDocx(file) {
  var ab = await file.arrayBuffer();
  var result = await mammoth.convertToHtml({ arrayBuffer: ab });
  var doc = new DOMParser().parseFromString(result.value, "text/html");
  var els = Array.from(doc.body.children);
  var units = [];
  var currentH1 = "", currentUnit = null, moduleNumber = 0, unitOrder = 0, chunkOrder = 0, paraBuffer = [], pendingH3 = null;

  var makeId = function (m, u) { return 'M' + String(m).padStart(2, "0") + '_U' + String(u).padStart(2, "0"); };
  var flushBuffer = function () {
    if (!paraBuffer.length || !currentUnit) return;
    var content = paraBuffer.join("\n\n").trim(); paraBuffer = [];
    if (content.length < 10) return;
    chunkOrder++;
    currentUnit.chunks.push({
      id: currentUnit.id + '_C' + String(chunkOrder).padStart(2, "0"),
      unitId: currentUnit.id, order: chunkOrder, type: "text",
      title: pendingH3 || "", content: content, lineStart: 0, lineEnd: 0
    });
    pendingH3 = null;
  };

  var levelsUsed = new Set();
  els.forEach(function (el) { var m = el.tagName.toLowerCase().match(/^h([1-6])$/); if (m) levelsUsed.add(+m[1]); });
  var sorted = [...levelsUsed].sort();
  var modLvl = sorted[0] || 1, unitLvl = sorted[1] || null;

  els.forEach(function (el) {
    var tag = el.tagName.toLowerCase(), text = el.textContent.trim();
    if (!text) return;
    var hlvl = tag.match(/^h([1-6])$/) ? +tag[1] : 0;
    if (hlvl === modLvl) {
      flushBuffer(); pendingH3 = null; moduleNumber++; currentH1 = text; currentUnit = null; chunkOrder = 0;
      if (!unitLvl) {
        unitOrder++; chunkOrder = 0;
        currentUnit = { id: makeId(moduleNumber, unitOrder), sourceId: "", moduleNumber: moduleNumber, moduleTitle: text, moduleTitleFr: "", unitNumber: unitOrder, title: text, titleFr: "", pageStart: 0, order: unitOrder, estimatedMinutes: 5, chunks: [] };
        units.push(currentUnit);
      }
    } else if (unitLvl && hlvl === unitLvl) {
      flushBuffer(); pendingH3 = null; unitOrder++; chunkOrder = 0;
      currentUnit = { id: makeId(moduleNumber || 1, unitOrder), sourceId: "", moduleNumber: moduleNumber || 1, moduleTitle: currentH1 || text, moduleTitleFr: "", unitNumber: unitOrder, title: text, titleFr: "", pageStart: 0, order: unitOrder, estimatedMinutes: 5, chunks: [] };
      units.push(currentUnit);
    } else if (hlvl > 0) {
      if (paraBuffer.length > 0) flushBuffer();
      pendingH3 = text;
    } else {
      if (!currentUnit) {
        if (!moduleNumber) { moduleNumber = 1; currentH1 = text.length < 80 ? text : "مقدمة"; }
        unitOrder++; chunkOrder = 0;
        currentUnit = { id: makeId(moduleNumber, unitOrder), sourceId: "", moduleNumber: moduleNumber, moduleTitle: currentH1, moduleTitleFr: "", unitNumber: unitOrder, title: currentH1, titleFr: "", pageStart: 0, order: unitOrder, estimatedMinutes: 5, chunks: [] };
        units.push(currentUnit);
      }
      if (pendingH3) { paraBuffer.push(text); flushBuffer(); }
      else { paraBuffer.push(text); if (countWords(paraBuffer.join(" ")) > 300) flushBuffer(); }
    }
  });
  flushBuffer();
  units.forEach(function (u) { var w = u.chunks.reduce(function (s, c) { return s + countWords(c.content); }, 0); u.estimatedMinutes = Math.max(5, Math.round(w / 200)); });

  var slug = file.name.replace(/\.docx$/i, "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 50) || "cours";
  units.forEach(function (u) { u.sourceId = slug; });
  return {
    source: { id: slug, title: units[0] ? units[0].moduleTitle : file.name.replace(/\.docx$/i, ""), author: "", language: "ar", totalModules: moduleNumber || 1, totalUnits: units.length, totalChunks: units.reduce(function (s, u) { return s + u.chunks.length; }, 0) },
    units: units
  };
}

/* Import / Export */
async function csDoImportDocx(file) {
  csLoadingMsg = 'Extraction de "' + file.name + '"…'; csLoading = true; csRender();
  try { CS_STATE = await csExtractDocx(file); csActiveModule = null; }
  catch (err) { alert("Erreur : " + err.message); }
  finally { csLoading = false; csRender(); }
}

function csDoImportJSON(file) {
  var r = new FileReader();
  r.onload = function (ev) {
    try { CS_STATE = JSON.parse(ev.target.result); csActiveModule = null; csRender(); }
    catch { alert("JSON invalide"); }
  };
  r.readAsText(file);
}

function csDoExport() {
  var tc = CS_STATE.units.reduce(function (s, u) { return s + u.chunks.length; }, 0);
  var out = Object.assign({}, CS_STATE, { source: Object.assign({}, CS_STATE.source, { totalChunks: tc, totalUnits: CS_STATE.units.length, totalModules: new Set(CS_STATE.units.map(function (u) { return u.moduleNumber; })).size }) });
  var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = (CS_STATE.source.id || "course") + ".json"; a.click();
}

/* Chunk ops */
function csUpdateChunk(uid, ci, upd) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var c = [...u.chunks]; c[ci] = upd;
    return Object.assign({}, u, { chunks: c });
  });
  csRender();
}

function csDeleteChunk(uid, ci) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var c = u.chunks.filter(function (_, i) { return i !== ci; });
    c.forEach(function (x, i) { x.order = i + 1; x.id = uid + '_C' + String(i + 1).padStart(2, "0"); });
    return Object.assign({}, u, { chunks: c });
  });
  csRender();
}

function csAddChunk(uid) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var nc = { id: uid + '_C' + String(u.chunks.length + 1).padStart(2, "0"), unitId: uid, order: u.chunks.length + 1, type: "text", title: "", content: "محتوى جديد", lineStart: 0, lineEnd: 0 };
    return Object.assign({}, u, { chunks: [...u.chunks, nc] });
  });
  csRender();
}

function csMoveChunk(uid, ci, dir) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var c = [...u.chunks];
    var ni = ci + dir;
    if (ni < 0 || ni >= c.length) return u;
    var _ref = [c[ni], c[ci]]; c[ci] = _ref[0]; c[ni] = _ref[1];
    c.forEach(function (x, i) { x.order = i + 1; x.id = uid + '_C' + String(i + 1).padStart(2, "0"); });
    return Object.assign({}, u, { chunks: c });
  });
  csRender();
}

function csSplitChunk(uid, ci) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var c = u.chunks[ci];
    var w = c.content.split(/\s+/);
    var m = Math.ceil(w.length / 2);
    var c1 = Object.assign({}, c, { content: w.slice(0, m).join(" ") });
    var c2 = Object.assign({}, c, { id: "", content: w.slice(m).join(" "), title: "" });
    var chunks = [...u.chunks];
    chunks.splice(ci, 1, c1, c2);
    chunks.forEach(function (x, i) { x.order = i + 1; x.id = uid + '_C' + String(i + 1).padStart(2, "0"); });
    return Object.assign({}, u, { chunks: chunks });
  });
  csRender();
}

function csUpdateSrc(k, v) { CS_STATE.source = Object.assign({}, CS_STATE.source, { [k]: v }); }

/* AI Enrichment (server-side) */
function csUpdateChunkLocal(uid, ci, updatedChunk) {
  CS_STATE.units = CS_STATE.units.map(function (u) {
    if (u.id !== uid) return u;
    var c = [...u.chunks]; c[ci] = updatedChunk;
    return Object.assign({}, u, { chunks: c });
  });
}

async function csEnrichChunk(uid, ci) {
  var unit = CS_STATE.units.find(function (u) { return u.id === uid; });
  if (!unit) return;
  var chunk = unit.chunks[ci];
  if (!chunk) return;

  var loading = Object.assign({}, chunk, { enrichment: { status: 'enriching', enrichedAt: null, error: null, data: null } });
  csUpdateChunkLocal(uid, ci, loading); csRender();

  try {
    var response = await callClaudeChat(chunk.content);
    var data = response;
    var enriched = Object.assign({}, chunk, {
      enrichment: {
        status: 'enriched', enrichedAt: new Date().toISOString(), error: null,
        data: {
          lang: data.lang || 'fr',
          objectives: Array.isArray(data.objectives) ? data.objectives : [],
          concepts: Array.isArray(data.concepts) ? data.concepts : [],
          takeaways: Array.isArray(data.takeaways) ? data.takeaways : [],
          practicalApplications: Array.isArray(data.practicalApplications) ? data.practicalApplications : []
        }
      }
    });
    csUpdateChunkLocal(uid, ci, enriched); csRender();
  } catch (err) {
    var failed = Object.assign({}, chunk, { enrichment: { status: 'error', enrichedAt: null, error: err.message, data: null } });
    csUpdateChunkLocal(uid, ci, failed); csRender();
    showToast('Enrichissement échoué : ' + err.message, 'err');
  }
}

async function csEnrichUnit(unitId) {
  var unit = CS_STATE.units.find(function (u) { return u.id === unitId; });
  if (!unit) return;
  for (var i = 0; i < unit.chunks.length; i++) {
    var c = unit.chunks[i];
    if (c.enrichment && c.enrichment.status === 'enriched' || c.content.length < 50) continue;
    await csEnrichChunk(unitId, i);
    await new Promise(function (r) { setTimeout(r, 500); });
  }
}

async function csEnrichAll() {
  var units = CS_STATE.units;
  if (!confirm('Enrichir tous les chunks de ' + units.length + ' unités ? Cela peut prendre plusieurs minutes.')) return;
  for (var idx = 0; idx < units.length; idx++) {
    await csEnrichUnit(units[idx].id);
  }
}

/* Validation */
function csValidate() {
  var issues = [], ids = new Set();
  CS_STATE.units.forEach(function (u) {
    u.chunks.forEach(function (c) {
      if (ids.has(c.id)) issues.push({ id: c.id, msg: "ID dupliqué" }); ids.add(c.id);
      if (!c.content || c.content.trim().length < 30) issues.push({ id: c.id, msg: "Contenu trop court" });
      if (c.unitId !== u.id) issues.push({ id: c.id, msg: "unitId incorrect" });
      if (countWords(c.content) > 700) issues.push({ id: c.id, msg: "Trop long — " + countWords(c.content) + " mots" });
    });
  });
  return issues;
}

/* DOM helper */
function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(function (_ref2) {
    var k = _ref2[0], v = _ref2[1];
    if (k === "className") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === null || v === false || v === undefined) el.removeAttribute(k);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  });
  for (var _len = arguments.length, ch = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    ch[_key - 2] = arguments[_key];
  }
  ch.flat(Infinity).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return el;
}

/* Render */
function csRender() {
  var app = document.getElementById("cs-app");
  app.innerHTML = "";
  app.appendChild(csRenderTopBar());
  if (csLoading) { app.appendChild(csRenderLoading()); return; }
  var layout = h("div", { className: "cs-layout" });
  if (csHasData()) layout.appendChild(csRenderSidebar());
  layout.appendChild(csRenderMain());
  app.appendChild(layout);
}

function csRenderTopBar() {
  var tc = CS_STATE.units.reduce(function (s, u) { return s + u.chunks.length; }, 0);
  var tw = CS_STATE.units.reduce(function (s, u) { return s + u.chunks.reduce(function (ss, c) { return ss + countWords(c.content); }, 0); }, 0);
  var di = h("input", { type: "file", accept: ".docx", style: { display: "none" }, onchange: function (e) { var f = e.target.files[0]; if (f) csDoImportDocx(f); e.target.value = ""; } });
  var ji = h("input", { type: "file", accept: ".json", style: { display: "none" }, onchange: function (e) { var f = e.target.files[0]; if (f) csDoImportJSON(f); e.target.value = ""; } });
  return h("div", { className: "cs-topbar" },
    h("div", { className: "topbar-logo" }, "Content Studio"),
    h("div", { className: "topbar-sep" }),
    h("div", { className: "topbar-title", style: { color: csHasData() ? "var(--surface)" : "rgba(255,255,255,.5)" } },
      csHasData() ? CS_STATE.source.title : "Aucune source chargée"),
    csHasData() ? [
      h("span", { className: "topbar-stat" }, CS_STATE.units.length + " unités"),
      h("span", { className: "topbar-stat" }, tc + " chunks"),
      h("span", { className: "topbar-stat" }, tw.toLocaleString() + " mots")
    ] : [],
    di, h("button", { className: "btn", onClick: function () { return di.click(); } }, "Importer .docx"),
    ji, h("button", { className: "btn", onClick: function () { return ji.click(); } }, "Importer JSON"),
    h("button", { className: "btn", disabled: !csHasData(), onClick: csEnrichAll, title: "Enrichir tous les chunks avec IA" }, "✦ Tout enrichir"),
    h("button", { className: (csHasData() ? "btn btn-primary" : "btn"), disabled: !csHasData(), onClick: csDoExport }, "Exporter JSON")
  );
}

function csRenderSidebar() {
  var modules = [...new Map(CS_STATE.units.map(function (u) { return [u.moduleNumber, { num: u.moduleNumber, ar: u.moduleTitle }]; })).values()].sort(function (a, b) { return a.num - b.num; });
  var sb = h("div", { className: "cs-sidebar" });
  var src = h("div", { className: "source-block" });
  src.appendChild(h("div", { className: "side-label" }, "Source"));
  src.appendChild(h("div", { className: "author" }, CS_STATE.source.author || "—"));
  src.appendChild(h("div", { className: "meta" }, CS_STATE.source.language.toUpperCase() + " · " + CS_STATE.source.id));
  sb.appendChild(src);
  sb.appendChild(h("div", { className: "side-label" }, "Modules"));
  sb.appendChild(h("div", { className: (csActiveModule === null ? "nav-item active" : "nav-item"), onClick: function () { csActiveModule = null; csRender(); } },
    h("b", { style: { fontSize: "12px" } }, "Tous"),
    h("span", { style: { fontSize: "11px", color: "var(--ink-2)" } }, " — " + CS_STATE.units.length + " unités")));
  modules.forEach(function (m) {
    var uc = CS_STATE.units.filter(function (u) { return u.moduleNumber === m.num; }).length;
    sb.appendChild(h("div", { className: (csActiveModule === m.num ? "nav-item active" : "nav-item"), onClick: function () { csActiveModule = m.num; csRender(); } },
      h("div", { className: "code" }, "M" + String(m.num).padStart(2, "0") + " · " + uc + " unités"),
      h("div", { className: "label-ar" }, m.ar)));
  });
  var typeColors = { text: "var(--navy)", hadith: "#2E9B54", ayah: "#C27A00", quote: "#8B4BC2", natiija: "var(--red)", tatbiq: "var(--blue)", remarque: "var(--ink-2)" };
  sb.appendChild(h("div", { className: "side-label", style: { marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "16px" } }, "Types de chunks"));
  CHUNK_TYPES.forEach(function (t) {
    var n = CS_STATE.units.reduce(function (s, u) { return s + u.chunks.filter(function (c) { return c.type === t; }).length; }, 0);
    if (n > 0) sb.appendChild(h("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 16px" } },
      h("div", { style: { width: "8px", height: "8px", borderRadius: "2px", background: typeColors[t], flexShrink: "0" } }),
      h("span", { style: { fontSize: "12px", color: "var(--ink-2)", flex: "1" } }, TYPE_LABELS[t]),
      h("span", { style: { fontSize: "11px", color: "var(--ink-2)", fontFamily: "var(--f-mono)" } }, String(n))));
  });
  return sb;
}

function csRenderMain() {
  var main = h("div", { className: "cs-main", style: { padding: csHasData() ? "22px 28px" : "0" } });
  if (!csHasData()) { main.appendChild(csRenderEmpty()); return main; }
  main.appendChild(csRenderSourceForm());
  main.appendChild(csRenderValidation());
  var filtered = csActiveModule !== null ? CS_STATE.units.filter(function (u) { return u.moduleNumber === csActiveModule; }) : CS_STATE.units;
  filtered.forEach(function (u) { main.appendChild(csRenderUnit(u)); });
  return main;
}

function csRenderSourceForm() {
  var f = h("div", { className: "source-form" });
  f.appendChild(h("h3", null, "Métadonnées de la source"));
  f.appendChild(h("div", { className: "form-row" },
    csMakeField("Identifiant", "text", CS_STATE.source.id, function (v) { return csUpdateSrc("id", v); }),
    csMakeField("Langue", "text", CS_STATE.source.language, function (v) { return csUpdateSrc("language", v); }, { style: { maxWidth: "80px" } })));
  f.appendChild(h("div", { className: "form-row" }, csMakeField("Titre", "text", CS_STATE.source.title, function (v) { return csUpdateSrc("title", v); }, { dir: "rtl" })));
  f.appendChild(h("div", { className: "form-row" }, csMakeField("Auteur", "text", CS_STATE.source.author, function (v) { return csUpdateSrc("author", v); }, { dir: "rtl" })));
  return f;
}

function csMakeField(label, type, value, onChange, extra) {
  var f = h("div", { className: "fld" });
  f.appendChild(h("label", null, label));
  var inp = h("input", Object.assign({ type: type, value: value }, (extra || {}), { onInput: function (e) { return onChange(e.target.value); }, onBlur: function () { return csRender(); } }));
  f.appendChild(inp);
  return f;
}

function csRenderValidation() {
  var issues = csValidate();
  var tc = CS_STATE.units.reduce(function (s, u) { return s + u.chunks.length; }, 0);
  if (tc === 0) return h("div");
  var ok = issues.length === 0;
  var b = h("div", { className: (ok ? "banner ok" : "banner warn") });
  b.appendChild(h("div", { className: "title" }, ok ? "✓  Validation réussie — " + tc + " chunks prêts à exporter" : "⚠  " + issues.length + " problème" + (issues.length > 1 ? "s" : "") + " à corriger"));
  if (!ok) issues.forEach(function (iss) {
    b.appendChild(h("div", { className: "issue" }, h("b", { style: { fontFamily: "var(--f-mono)" } }, iss.id), " — " + iss.msg));
  });
  return b;
}

function csRenderUnit(unit) {
  var isOpen = csOpenUnits.has(unit.id);
  var tw = unit.chunks.reduce(function (s, c) { return s + countWords(c.content); }, 0);
  var p = h("div", { className: "unit-panel" });
  p.appendChild(h("div", { className: "unit-header", onClick: function () { if (isOpen) csOpenUnits.delete(unit.id); else csOpenUnits.add(unit.id); csRender(); } },
    h("span", { className: "unit-id" }, unit.id),
    h("div", { className: "unit-title" }, unit.title),
    h("div", { className: "unit-stats" },
      h("div", { className: "count" }, unit.chunks.length + " chunks · " + tw.toLocaleString() + " mots"),
      h("div", { className: "time" }, "~" + unit.estimatedMinutes + " min")),
    h("span", { className: "unit-arrow", style: { transform: isOpen ? "rotate(90deg)" : "none" } }, "▶")));
  if (isOpen) {
    var body = h("div", { className: "unit-body" });
    var hasUnenriched = unit.chunks.some(function (c) { return !c.enrichment || !c.enrichment.data && c.content.length > 50; });
    if (hasUnenriched) body.appendChild(h("button", { className: "unit-enrich-btn", onClick: function () { return csEnrichUnit(unit.id); } }, "✦ Enrichir tous les chunks avec IA"));
    unit.chunks.forEach(function (c, i) { body.appendChild(csRenderChunk(unit.id, c, i, unit.chunks.length)); });
    body.appendChild(h("button", { className: "add-chunk-btn", onClick: function () { return csAddChunk(unit.id); } }, "+ Ajouter un chunk"));
    p.appendChild(body);
  }
  return p;
}

function csRenderChunk(uid, chunk, idx, total) {
  var isEd = csEditingChunks.has(chunk.id);
  var card = h("div", { className: ("chunk-card type-" + (chunk.type || "text") + " " + (isEd ? "editing" : "")) });
  var hdr = h("div", { className: "chunk-header" });
  hdr.appendChild(h("span", { className: "chunk-type-badge" }, TYPE_LABELS[chunk.type] || "Texte"));
  hdr.appendChild(h("span", { className: "chunk-title-text" }, chunk.title || "—"));
  if (!isEd) {
    hdr.appendChild(h("span", { className: "chunk-words" }, countWords(chunk.content) + " mots"));
    var act = h("div", { className: "chunk-actions" });
    act.appendChild(h("button", { className: "ibtn", title: "Monter", disabled: idx === 0, onClick: function () { return csMoveChunk(uid, idx, -1); } }, "↑"));
    act.appendChild(h("button", { className: "ibtn", title: "Descendre", disabled: idx === total - 1, onClick: function () { return csMoveChunk(uid, idx, 1); } }, "↓"));
    act.appendChild(h("button", { className: "ibtn accent", title: "Éditer", onClick: function () { csEditingChunks.add(chunk.id); csEditDrafts[chunk.id] = Object.assign({}, chunk); csRender(); } }, "✎"));
    act.appendChild(h("button", { className: "ibtn", title: "Diviser", onClick: function () { return csSplitChunk(uid, idx); } }, "⌥"));
    act.appendChild(h("button", { className: "ibtn danger", title: "Supprimer", onClick: function () { if (confirm("Supprimer ce chunk ?")) csDeleteChunk(uid, idx); } }, "×"));
    var enrichStatus = (chunk.enrichment && chunk.enrichment.status) || 'idle';
    var enrichIcon = enrichStatus === 'enriching' ? h("span", { className: "enrich-spinner" }) : enrichStatus === 'enriched' ? '✓' : enrichStatus === 'error' ? '!' : '✦';
    var enrichBtnClass = "ibtn ai-btn " + (enrichStatus === 'enriched' ? 'done' : '');
    var enrichTitle = enrichStatus === 'idle' ? "Enrichir avec IA" : enrichStatus === 'enriching' ? "Enrichissement…" : enrichStatus === 'enriched' ? "Déjà enrichi" : "Erreur";
    act.appendChild(h("button", { className: enrichBtnClass, title: enrichTitle, disabled: enrichStatus === 'enriching', onClick: function () { return csEnrichChunk(uid, idx); } }, enrichIcon));
    hdr.appendChild(act);
  } else {
    var act2 = h("div", { className: "chunk-actions" });
    act2.appendChild(h("button", { className: "ibtn", title: "Annuler", onClick: function () { csEditingChunks.delete(chunk.id); delete csEditDrafts[chunk.id]; csRender(); } }, "✕"));
    act2.appendChild(h("button", { className: "ibtn accent", title: "Enregistrer", onClick: function () { csUpdateChunk(uid, idx, csEditDrafts[chunk.id]); csEditingChunks.delete(chunk.id); delete csEditDrafts[chunk.id]; csRender(); } }, "✓"));
    hdr.appendChild(act2);
  }
  card.appendChild(hdr);
  if (isEd) {
    var draft = csEditDrafts[chunk.id];
    var form = h("div", { className: "edit-form" });
    var row = h("div", { className: "edit-row" });
    row.appendChild(csMakeField("Titre", "text", draft.title, function (v) { csEditDrafts[chunk.id].title = v; }, { dir: "rtl", style: { flex: "2", minWidth: "150px" } }));
    var tf = h("div", { className: "fld", style: { minWidth: "120px" } });
    tf.appendChild(h("label", null, "Type"));
    var sel = h("select", { onChange: function (e) { csEditDrafts[chunk.id].type = e.target.value; csRender(); } });
    sel.style.cssText = "width:100%;background:var(--paper);border:1px solid var(--line);border-radius:6px;color:var(--ink);font-size:13px;padding:7px 10px";
    CHUNK_TYPES.forEach(function (t) {
      var o = h("option", { value: t }, TYPE_LABELS[t]);
      if (t === draft.type) o.selected = true;
      sel.appendChild(o);
    });
    tf.appendChild(sel); row.appendChild(tf); form.appendChild(row);
    var cf = h("div", { className: "fld" });
    cf.appendChild(h("label", null, "Contenu — " + countWords(draft.content) + " mots"));
    var ta = h("textarea", { dir: "rtl", rows: "6", onInput: function (e) { csEditDrafts[chunk.id].content = e.target.value; } });
    ta.value = draft.content; cf.appendChild(ta); form.appendChild(cf); card.appendChild(form);
  } else {
    card.appendChild(h("div", { className: "chunk-content" }, chunk.content || ""));
    var footer = h("div", { className: "chunk-footer", style: { display: "flex", alignItems: "center", justifyContent: "space-between" } });
    footer.appendChild(h("span", null, chunk.id));
    var badge = (chunk.enrichment && chunk.enrichment.status) || 'idle';
    var badgeLabel = badge === 'idle' ? 'Non enrichi' : badge === 'enriching' ? 'Enrichissement…' : badge === 'enriched' ? (chunk.enrichment && chunk.enrichment.enrichedAt ? 'Enrichi · ' + new Date(chunk.enrichment.enrichedAt).toLocaleDateString('fr') : 'Enrichi') : 'Erreur';
    footer.appendChild(h("span", { className: ("enrich-badge " + badge) }, badgeLabel));
    card.appendChild(footer);
    if (chunk.enrichment && chunk.enrichment.status === 'enriched' && chunk.enrichment.data) {
      var d = chunk.enrichment.data;
      var panel = h("div", { className: "enrich-panel" });
      if (d.objectives && d.objectives.length) {
        var sec = h("div", { className: "enrich-section" }); sec.appendChild(h("div", { className: "enrich-section-title" }, "Objectifs"));
        d.objectives.forEach(function (o) { sec.appendChild(h("div", { className: "enrich-objective" }, o)); });
        panel.appendChild(sec);
      }
      if (d.concepts && d.concepts.length) {
        var sec = h("div", { className: "enrich-section" }); sec.appendChild(h("div", { className: "enrich-section-title" }, "Concepts clés"));
        d.concepts.forEach(function (c) { sec.appendChild(h("div", { className: "enrich-concept" }, h("strong", null, c.term || ''), c.definition ? ' — ' : '', c.definition || '')); });
        panel.appendChild(sec);
      }
      if (d.takeaways && d.takeaways.length) {
        var sec = h("div", { className: "enrich-section" }); sec.appendChild(h("div", { className: "enrich-section-title" }, "Points clés"));
        d.takeaways.forEach(function (t) { sec.appendChild(h("div", { className: "enrich-takeaway" }, t)); });
        panel.appendChild(sec);
      }
      if (d.practicalApplications && d.practicalApplications.length) {
        var sec = h("div", { className: "enrich-section" }); sec.appendChild(h("div", { className: "enrich-section-title" }, "Applications pratiques"));
        d.practicalApplications.forEach(function (p) { sec.appendChild(h("div", { className: "enrich-practical" }, p)); });
        panel.appendChild(sec);
      }
      card.appendChild(panel);
    } else if (chunk.enrichment && chunk.enrichment.status === 'error') {
      card.appendChild(h("div", { className: "enrich-panel" }, h("div", { className: "enrich-error-msg" }, "Échec: " + (chunk.enrichment.error || ''))));
    }
  }
  return card;
}

function csRenderEmpty() {
  var di = h("input", { type: "file", accept: ".docx", style: { display: "none" }, onchange: function (e) { var f = e.target.files[0]; if (f) csDoImportDocx(f); e.target.value = ""; } });
  var ji = h("input", { type: "file", accept: ".json", style: { display: "none" }, onchange: function (e) { var f = e.target.files[0]; if (f) csDoImportJSON(f); e.target.value = ""; } });
  return h("div", { className: "empty" },
    h("div", { className: "empty-icon" }, "📄"),
    h("div", null,
      h("h2", null, "Aucune source chargée"),
      h("p", null, "Importez un fichier .docx structuré avec des titres (Heading 1, Heading 2) pour extraire automatiquement la structure modules/unités/chunks, ou chargez un .json existant.")),
    h("div", { style: { display: "flex", gap: "10px" } },
      di, h("button", { className: "btn btn-primary", style: { padding: "10px 20px", borderRadius: "8px" }, onClick: function () { return di.click(); } }, "Importer .docx"),
      ji, h("button", { className: "btn", style: { padding: "10px 20px", borderRadius: "8px" }, onClick: function () { return ji.click(); } }, "Charger un JSON")));
}

function csRenderLoading() {
  return h("div", { className: "cs-loading-overlay" },
    h("div", { className: "cs-spinner" }),
    h("div", { className: "loading-text" }, csLoadingMsg));
}

csRender();
