import { NextRequest, NextResponse } from 'next/server';

function detectLanguage(text: string): 'ar' | 'fr' | 'en' {
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || [];
  const arabicRatio = arabicChars.length / text.length;

  const frenchWords = ['le', 'la', 'les', 'est', 'sont', 'dans', 'pour', 'avec', 'sur', 'des', 'une', 'que', 'qui', 'par', 'ce', 'et', 'du', 'en', 'pas', 'plus', 'nous', 'vous', 'leur', 'ses', 'mais', 'ou', 'si', 'comme', 'tout', 'cette', 'bien', 'aussi', 'très', 'même', 'peut', 'fait', 'ces', 'lui', 'elle', 'ils', 'elles'];
  const frenchMatches = frenchWords.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(text)).length;

  const englishWords = ['the', 'is', 'are', 'in', 'for', 'with', 'on', 'of', 'to', 'and', 'a', 'that', 'by', 'this', 'it', 'as', 'be', 'or', 'from', 'has', 'have', 'had', 'not', 'but', 'at', 'an', 'will', 'would', 'could', 'should', 'their', 'they', 'you', 'we', 'he', 'she'];
  const englishMatches = englishWords.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(text)).length;

  if (arabicRatio > 0.3) return 'ar';
  if (frenchMatches > englishMatches) return 'fr';
  return 'en';
}

function buildPrompt(lang: 'ar' | 'fr' | 'en', content: string): string {
  const prompts = {
    ar: `أنت مساعد تعليمي متخصص في تحليل محتوى الدورات الإسلامية.
استخرج من النص المقدم العناصر التربوية التالية بتنسيق JSON بالضبط:
{
  "objectives": ["الهدف 1", "الهدف 2", "الهدف 3"],
  "concepts": [{"term": "المصطلح", "definition": "التعريف"}],
  "takeaways": ["النقطة 1", "النقطة 2"],
  "practicalApplications": ["التطبيق 1", "التطبيق 2"]
}
القواعد:
- أرجع JSON فقط، بدون نص قبل أو بعد
- objectives: 3 إلى 5 أفعال (فهم، معرفة، تطبيق، تحليل، تقييم)
- concepts: 3 إلى 7 مصطلحات رئيسية مع تعريف مختصر بالعربية
- takeaways: 3 إلى 5 نقاط أساسية للحفظ
- practicalApplications: 2 إلى 4 تطبيقات عملية في الحياة اليومية
- إذا كان النص قصيراً جداً للتحليل، أرجع {"objectives":[],"concepts":[],"takeaways":[],"practicalApplications":[]}
- النص بالعربية. حلل المفاهيم العربية أيضاً.

النص المراد تحليله:
""${content}"""`,

    fr: `Tu es un assistant pédagogique spécialisé dans l'analyse de contenu de cours islamiques.
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
""${content}"""`,

    en: `You are an educational assistant specialized in analyzing Islamic course content.
Analyze the provided text and extract the following pedagogical elements in exact JSON format:
{
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "concepts": [{"term": "term", "definition": "definition"}],
  "takeaways": ["point 1", "point 2"],
  "practicalApplications": ["application 1", "application 2"]
}
Rules:
- Return ONLY JSON, no text before or after
- objectives: 3 to 5 action verbs (understand, know, apply, analyze, evaluate)
- concepts: 3 to 7 key terms with short definition in English
- takeaways: 3 to 5 essential points to remember
- practicalApplications: 2 to 4 concrete applications in daily life
- If the text is too short to analyze, return {"objectives":[],"concepts":[],"takeaways":[],"practicalApplications":[]}
- The text may contain Arabic. Analyze Arabic concepts as well.

Text to analyze:
""${content}""`
  };
  return prompts[lang];
}

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

    const lang = detectLanguage(content);
    const prompt = buildPrompt(lang, content);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: prompt }],
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
      lang,
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
