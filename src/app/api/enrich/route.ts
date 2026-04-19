import { NextRequest, NextResponse } from 'next/server';

const ENRICHMENT_PROMPT = `Tu es un assistant pédagogique spécialisé dans l'analyse de contenu de cours islamiques.
Analyse le texte fourni et extrais les éléments pédagogiques suivants au format JSON EXACT:
{
  "objectives": ["objectif 1", "objectif 2", "objectif 3"],
  "concepts": [{"term": "terme", "definition": "définition"}],
  "takeaways": ["point 1", "point 2"],
  "practicalApplications": ["application 1", "application 2"]
}
Règles:
- Renvoie UNIQUEMENT le JSON, sans texte avant ou après
- objectives: 3 à 5 verbes d'action (comprendre, savoir, appliquer, etc.)
- concepts: 3 à 7 termes clés avec définition courte en français
- takeaways: 3 à 5 points essentiels à retenir
- practicalApplications: 2 à 4 applications concrètes dans la vie quotidienne
- Si le texte est trop court pour analyser, renvoie {"objectives":[],"concepts":[],"takeaways":[],"practicalApplications":[]}
- Le texte peut contenir de l'arabe. Analyse les concepts arabiques aussi.

Texte à analyser:
"""{CONTENT}"""`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          {
            role: 'user',
            content: ENRICHMENT_PROMPT.replace('{CONTENT}', content),
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const b = await response.json();
        msg = b.error?.message || b.message || msg;
      } catch {
        // ignore JSON parse errors
      }
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    let jsonStr = raw.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse JSON response from Claude' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
      practicalApplications: Array.isArray(parsed.practicalApplications)
        ? parsed.practicalApplications
        : [],
    });
  } catch (err) {
    console.error('[enrich API]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
