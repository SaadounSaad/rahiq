# Rahiq — Plateforme e-learning

Une plateforme d'enrichissement de contenu pour l'e-learning, bâtie avec Next.js et déployée sur Vercel.

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **OCR Document** | Upload PDF/image → extraction OCR via Mistral API (mistral-ocr-latest) |
| **Content Studio** | Importer un DOCX structuré → JSON avec modules/unités/chunks |
| **Enrichissement IA** | Enrichir chaque chunk avec : objectifs, concepts clés, points clés, applications pratiques |
| **Multilingue** | Détection automatique de la langue (ar/fr/en) — réponses dans la même langue |
| **Progression** | Indicateur de progression en temps réel pendant l'enrichissement batch |
| **Mode sombre** | Toggle clair/sombre |
| **Export DOCX** | Export avec table des matières |

## Architecture

```
PDF/Image
    ↓ (Mistral OCR)
DOCX editable
    ↓ (Content Studio)
JSON (units/chunks)
    ↓ (/api/enrich — Claude server-side)
JSON enrichi (objectives, concepts, takeaways, practical_applications)
```

## Stack technique

- **Framework**: Next.js 16 (App Router)
- **Styling**: CSS avec design tokens (palette chaude, mode sombre)
- **Fonts**: Geist, Noto Naskh Arabic, Amiri, Source Serif 4
- **OCR**: Mistral API (`mistral-ocr-latest`) — côté client
- **IA**: Anthropic Claude (`claude-sonnet-4-6`) — côté serveur (Vercel serverless)
- **Librairies**: pdf.js, html-docx-js, marked, mammoth

## Structure du projet

```
rahiq-app/
├── public/
│   └── client.js           # JS côté client (OCR + Content Studio)
├── src/
│   └── app/
│       ├── api/
│       │   └── enrich/
│       │       └── route.ts  # POST /api/enrich — proxy Claude
│       ├── globals.css       # Tous les styles
│       ├── layout.tsx        # Layout racine + fonts
│       └── page.tsx          # Page principale (onglets React)
├── vercel.json              # Config Vercel (région Paris)
├── .env.local.example       # Template variables d'environnement
└── README.md
```

## Déploiement

### Variables d'environnement sur Vercel

1. Aller sur **Settings → Environment Variables**
2. Ajouter :

| Nom | Valeur |
|-----|--------|
| `ANTHROPIC_API_KEY` | `sk-ant-votre-clé` |

3. **Redeploy** après ajout

### Déployer depuis GitHub

1. Connecter le dépôt `SaadounSaad/rahiq` à Vercel
2. Vercel détecte automatiquement Next.js
3. Ajouter `ANTHROPIC_API_KEY` dans les variables d'environnement
4. Déployer

### Build local

```bash
npm install
npm run build
npm start
```

## API

### POST /api/enrich

Enrichit un chunk avec des métadonnées pédagogiques.

**Requête :**
```json
{ "content": "Texte du chunk à analyser..." }
```

**Réponse :**
```json
{
  "lang": "fr",
  "objectives": ["Comprendre le concept de...", "Savoir appliquer..."],
  "concepts": [{"term": "Tawhid", "definition": "L'unicité de Dieu..."}],
  "takeaways": ["Point essentiel à retenir..."],
  "applications": ["Application concrète..."]
}
```

La langue est détectée automatiquement (ar/fr/en) et la réponse est renvoyée dans la même langue.

## Notes

- La clé API Claude est **côté serveur uniquement** — jamais exposée au navigateur
- La clé Mistral est entrée via l'UI et stockée dans localStorage
- Content Studio importe des fichiers `.docx` structurés avec les styles Heading 1 et Heading 2
