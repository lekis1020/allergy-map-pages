import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const CATEGORIES = [
  "Asthma and rhinitis",
  "Urticaria and atopic dermatitis",
  "Drug allergy",
  "Eosinophilic and immunologic disorders",
  "Others",
];

const SYSTEM_PROMPT = `You are a biomedical article classifier specializing in allergy and immunology.

Given a list of article objects (each with "uid" and "title"), classify each into one or more categories.

Categories:
1. "Asthma and rhinitis" — asthma, allergic rhinitis, rhinosinusitis, bronchial hyperresponsiveness, wheezing, nasal allergy
2. "Urticaria and atopic dermatitis" — urticaria, atopic dermatitis, eczema, angioedema, chronic spontaneous urticaria, contact dermatitis
3. "Drug allergy" — drug allergy, drug hypersensitivity, anaphylaxis, food allergy, adverse drug reactions, drug-induced reactions
4. "Eosinophilic and immunologic disorders" — eosinophilic esophagitis/gastritis, allergen immunotherapy, immunoglobulin E, immune dysregulation, mast cell disorders, EGPA, HES
5. "Others" — articles that do not clearly fit into categories 1-4

Rules:
- An article can belong to multiple categories (except Others)
- Only use "Others" if the article does not fit ANY of categories 1-4
- Base classification on the medical/scientific content of the title
- Return ONLY a JSON array of objects: [{"uid": "...", "categories": ["..."]}]
- Output valid JSON only, no markdown fences`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const { articles } = await request.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: "articles array is required" },
        { status: 400 },
      );
    }

    // Send only uid + title to minimise tokens
    const input = articles.map((a: { uid: string; title: string }) => ({
      uid: a.uid,
      title: a.title,
    }));

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error (categorize):", errText);
      return NextResponse.json(
        { error: "Gemini API request failed" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    const results: { uid: string; categories: string[] }[] =
      JSON.parse(rawText);

    // Validate categories
    const validResults = results.map((r) => ({
      uid: r.uid,
      categories: r.categories.filter((c: string) => CATEGORIES.includes(c)),
    }));

    // Build uid → categories map
    const categoryMap: Record<string, string[]> = {};
    for (const r of validResults) {
      categoryMap[r.uid] =
        r.categories.length > 0 ? r.categories : ["Others"];
    }

    return NextResponse.json({ categoryMap });
  } catch (err) {
    console.error("categorize-articles error:", err);
    return NextResponse.json(
      { error: "Failed to categorize articles" },
      { status: 500 },
    );
  }
}
