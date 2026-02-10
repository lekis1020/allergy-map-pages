import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are a biomedical abstract parser. Given a scientific abstract, split it into IMRAD sections.

Return ONLY a JSON array of objects with "label" and "text" fields.
Allowed labels: "Background", "Objective", "Methods", "Results", "Conclusion", "Discussion"

Rules:
- Every sentence must belong to exactly one section
- Keep the original text verbatim — do not paraphrase, summarize, or omit anything
- If a section is not present in the abstract, omit it
- Use at minimum: Background, Methods, Results, Conclusion
- Output valid JSON only, no markdown fences`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const { abstract } = await request.json();

    if (!abstract || typeof abstract !== "string") {
      return NextResponse.json(
        { error: "abstract field is required" },
        { status: 400 },
      );
    }

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: abstract }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error (parse-abstract):", errText);
      return NextResponse.json(
        { error: "Gemini API request failed" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rawText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    const sections = JSON.parse(rawText);

    return NextResponse.json({ sections });
  } catch (err) {
    console.error("parse-abstract error:", err);
    return NextResponse.json(
      { error: "Failed to parse abstract" },
      { status: 500 },
    );
  }
}
