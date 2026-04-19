# Rahiq — Plateforme e-learning

A content enrichment e-learning platform built with Next.js for deployment on Vercel.

## Features

- **OCR Document Processing** — Upload PDF or image files for OCR extraction via Mistral API
- **Content Studio** — Manage structured course content with modules, units, and chunks
- **AI Enrichment** — Automatically enrich content chunks with pedagogical metadata (objectives, concepts, takeaways, practical applications) via Anthropic Claude
- **Arabic RTL Support** — Full support for Arabic course content
- **Dark Mode** — Toggle between light and dark themes
- **DOCX Export** — Export documents with table of contents

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: CSS with custom design tokens (warm palette, dark mode support)
- **Fonts**: Geist, Noto Naskh Arabic, Amiri, Source Serif 4
- **OCR**: Mistral API (`mistral-ocr-latest`)
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`) — server-side
- **External Libraries**: pdf.js, html-docx-js, marked, mammoth

## Deployment

### 1. Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd rahiq-app
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and set your API keys:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Required API Keys:**
- `ANTHROPIC_API_KEY` — For AI content enrichment (server-side, set in Vercel project settings)

**Client-side (stored in browser localStorage):**
- Mistral API key — Entered via the UI, stored locally in browser

### 3. Vercel Project Settings

In your Vercel project dashboard:
1. Go to **Settings → Environment Variables**
2. Add `ANTHROPIC_API_KEY` with your Anthropic API key
3. Deploy

### 4. Build Locally

```bash
npm install
npm run build
npm start
```

## Project Structure

```
rahiq-app/
├── public/
│   └── client.js          # Client-side JavaScript (Content Studio + OCR)
├── src/
│   └── app/
│       ├── api/
│       │   └── enrich/
│       │       └── route.ts  # POST /api/enrich — Claude enrichment
│       ├── globals.css    # All styles (tokens, dark mode, components)
│       ├── layout.tsx     # Root layout with fonts
│       └── page.tsx       # Main page (client component)
├── vercel.json            # Vercel configuration (Paris region)
├── .env.local.example     # Example environment variables
└── README.md
```

## API

### POST /api/enrich

Enriches content with pedagogical metadata.

**Request:**
```json
{
  "content": "Texte du chunk à analyser..."
}
```

**Response:**
```json
{
  "objectives": ["Comprendre le concept de...", "Savoir appliquer..."],
  "concepts": [{"term": "Tawhid", "definition": "L'unicité de Dieu..."}],
  "takeaways": ["Point essentiel à retenir..."],
  "practicalApplications": ["Application dans la vie quotidienne..."]
}
```

## Notes

- The Claude API key is **server-side only** — never exposed to the browser
- The Mistral API key is entered via the UI and stored in browser localStorage
- Content Studio imports `.docx` files structured with Heading 1 and Heading 2 styles
