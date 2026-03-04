import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Config ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SEARCH_TERMS = [
  "allergy",
  "allergic",
  "asthma",
  "atopic dermatitis",
  "anaphylaxis",
  "urticaria",
  "allergic rhinitis",
  "food allergy",
  "drug allergy",
  "immunotherapy",
  "eosinophilic",
];

const IMRAD_LABELS: Record<string, string> = {
  BACKGROUND: "Background",
  INTRODUCTION: "Background",
  CONTEXT: "Background",
  PURPOSE: "Objective",
  OBJECTIVE: "Objective",
  OBJECTIVES: "Objective",
  AIM: "Objective",
  AIMS: "Objective",
  RATIONALE: "Background",
  METHODS: "Methods",
  METHOD: "Methods",
  "MATERIALS AND METHODS": "Methods",
  "STUDY DESIGN": "Methods",
  DESIGN: "Methods",
  "PATIENTS AND METHODS": "Methods",
  SETTING: "Methods",
  PARTICIPANTS: "Methods",
  MEASUREMENTS: "Methods",
  "MAIN OUTCOME MEASURES": "Methods",
  RESULTS: "Results",
  FINDINGS: "Results",
  CONCLUSIONS: "Conclusion",
  CONCLUSION: "Conclusion",
  DISCUSSION: "Discussion",
  SIGNIFICANCE: "Significance",
  INTERPRETATION: "Interpretation",
  LIMITATIONS: "Limitations",
  IMPLICATIONS: "Implications",
  SUMMARY: "Summary",
};

interface AbstractSection {
  label: string;
  text: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Current date in KST (Asia/Seoul, UTC+9) as YYYY/MM/DD for PubMed */
function todayKSTStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).replace(/-/g, "/");
}

/** Current date in KST as YYYY-MM-DD for Supabase */
function todayKSTISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

async function callGemini(systemPrompt: string, userContent: string) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

// ── Step 1: Fetch PubMed articles ─────────────────────────────────
async function fetchPubMedArticles() {
  const today = todayKSTStr();
  const query = SEARCH_TERMS.map((t) => `"${t}"`).join(" OR ");
  const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=(${encodeURIComponent(query)})&datetype=pdat&mindate=${today}&maxdate=${today}&retmode=json&retmax=50&sort=date`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`PubMed search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  const ids: string[] = searchData.esearchresult?.idlist || [];
  const totalCount = parseInt(searchData.esearchresult?.count || "0", 10);

  if (ids.length === 0) return { articles: [], totalCount: 0 };

  const summaryUrl = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const summaryRes = await fetch(summaryUrl);
  if (!summaryRes.ok) throw new Error(`PubMed summary failed: ${summaryRes.status}`);
  const summaryData = await summaryRes.json();

  const result = summaryData.result;
  const articles = ids.map((id) => result[id]).filter(Boolean);

  return { articles, totalCount };
}

// ── Step 2: Categorise via Gemini ─────────────────────────────────
async function categorizeArticles(
  articles: { uid: string; title: string }[],
): Promise<Record<string, string[]>> {
  if (articles.length === 0) return {};

  const CATEGORIES = [
    "Asthma and Rhinitis",
    "Urticaria and Atopic Dermatitis",
    "Food Allergy",
    "Drug Allergy",
    "Anaphylaxis",
    "Eosinophilic Disorders",
    "Immunology and Immunotherapy",
    "Others",
  ];

  const systemPrompt = `You are a biomedical article classifier specializing in allergy and immunology.

Given a list of article objects (each with "uid" and "title"), classify each into one or more categories.

Categories:
1. "Asthma and Rhinitis" — asthma, allergic rhinitis, rhinosinusitis, bronchial hyperresponsiveness, wheezing, nasal allergy, COPD-asthma overlap
2. "Urticaria and Atopic Dermatitis" — urticaria, chronic spontaneous urticaria, atopic dermatitis, eczema, angioedema, contact dermatitis
3. "Food Allergy" — food allergy, food hypersensitivity, oral food challenge, oral immunotherapy (OIT) for food, FPIES, alpha-gal syndrome
4. "Drug Allergy" — drug allergy, drug hypersensitivity, adverse drug reactions, drug desensitization, drug-induced skin reactions, DRESS, SJS/TEN
5. "Anaphylaxis" — anaphylaxis (regardless of cause: food, drug, insect, exercise, idiopathic), epinephrine auto-injector, biphasic reactions
6. "Eosinophilic Disorders" — eosinophilic esophagitis, eosinophilic gastritis/enteritis, EGPA, hypereosinophilic syndrome (HES), mast cell disorders, mastocytosis
7. "Immunology and Immunotherapy" — allergen immunotherapy (SCIT/SLIT), immunoglobulin E, immune dysregulation, innate/adaptive immunity, cytokines, T cells, B cells, immune signaling, immunological tolerance, autoimmunity, immunodeficiency, biologics (omalizumab, dupilumab, mepolizumab, etc.), clinical immunology
8. "Others" — articles that do not clearly fit into categories 1-7

Rules:
- An article can belong to multiple categories (except Others)
- Only use "Others" if the article does not fit ANY of categories 1-7
- If an article involves anaphylaxis AND a specific trigger (e.g., drug or food), assign BOTH "Anaphylaxis" and the trigger category
- Biologics studies should go to "Immunology and Immunotherapy" AND the relevant disease category (e.g., dupilumab for atopic dermatitis → both categories)
- Return ONLY a JSON array: [{"uid":"...","categories":["..."]}]
- Output valid JSON only, no markdown fences`;

  const input = articles.map((a) => ({ uid: a.uid, title: a.title }));
  const rawText = await callGemini(systemPrompt, JSON.stringify(input));
  const results: { uid: string; categories: string[] }[] = JSON.parse(rawText);

  const categoryMap: Record<string, string[]> = {};
  for (const r of results) {
    const valid = r.categories.filter((c: string) => CATEGORIES.includes(c));
    categoryMap[r.uid] = valid.length > 0 ? valid : ["Others"];
  }

  return categoryMap;
}

// ── Step 3: Fetch & parse abstracts (structured only, skip Gemini to save time) ──
async function fetchAllAbstracts(
  ids: string[],
): Promise<Record<string, AbstractSection[]>> {
  if (ids.length === 0) return {};

  const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed efetch failed: ${res.status}`);
  const xmlText = await res.text();

  const abstracts: Record<string, AbstractSection[]> = {};
  const unstructured: { pmid: string; text: string }[] = [];

  const articleBlocks = xmlText.split(/<PubmedArticle>/);
  for (const block of articleBlocks) {
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];

    const abstractTextMatches = [
      ...block.matchAll(
        /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g,
      ),
    ];

    if (abstractTextMatches.length === 0) {
      abstracts[pmid] = [{ label: "", text: "초록이 제공되지 않습니다." }];
      continue;
    }

    const hasLabels =
      abstractTextMatches.length > 1 &&
      abstractTextMatches[0][1] !== undefined;

    if (hasLabels) {
      const rawSections = abstractTextMatches
        .map((m) => {
          const rawLabel = m[1] || "";
          const label = IMRAD_LABELS[rawLabel.toUpperCase()] || rawLabel;
          const text = m[2].replace(/<[^>]+>/g, "").trim();
          return { label, text };
        })
        .filter((s) => s.text.length > 0);

      // Merge sections that mapped to the same IMRAD label (preserving order)
      const merged: AbstractSection[] = [];
      for (const sec of rawSections) {
        const existing = merged.find((m) => m.label === sec.label);
        if (existing) {
          existing.text += " " + sec.text;
        } else {
          merged.push({ ...sec });
        }
      }
      abstracts[pmid] = merged;
    } else {
      const fullText = abstractTextMatches
        .map((m) => m[2].replace(/<[^>]+>/g, "").trim())
        .join(" ");
      unstructured.push({ pmid, text: fullText });
    }
  }

  // Batch LLM call for unstructured abstracts (single batch to save time)
  if (unstructured.length > 0) {
    const systemPrompt = `You are a biomedical abstract parser. Given a JSON array of objects with "pmid" and "abstract" fields, split each abstract into IMRAD sections.

Return a JSON array of objects: [{"pmid":"...","sections":[{"label":"...","text":"..."}]}]

Allowed labels: "Background", "Objective", "Methods", "Results", "Conclusion", "Discussion"

Rules:
- CRITICAL: Each sentence must appear in EXACTLY ONE section — never duplicate a sentence across multiple sections
- Keep original text verbatim — do not paraphrase or omit anything
- Assign each sentence to the single most appropriate section
- "Background" = context, rationale, what is already known
- "Objective" = specific aim or purpose of THIS study (usually 1-2 sentences)
- "Methods" = study design, participants, procedures, measurements, statistical analysis
- "Results" = findings, data, numbers, outcomes
- "Conclusion" = interpretation, implications, summary of findings
- Use at minimum: Background, Methods, Results, Conclusion
- Output valid JSON only, no markdown fences`;

    // Process in batches of 15
    const BATCH_SIZE = 15;
    for (let i = 0; i < unstructured.length; i += BATCH_SIZE) {
      const batch = unstructured.slice(i, i + BATCH_SIZE);
      const input = batch.map((b) => ({
        pmid: b.pmid,
        abstract: b.text,
      }));

      try {
        const rawText = await callGemini(systemPrompt, JSON.stringify(input));
        const results: { pmid: string; sections: AbstractSection[] }[] =
          JSON.parse(rawText);

        for (const r of results) {
          if (Array.isArray(r.sections) && r.sections.length > 0) {
            abstracts[r.pmid] = r.sections;
          } else {
            const orig = batch.find((b) => b.pmid === r.pmid);
            abstracts[r.pmid] = [
              { label: "Abstract", text: orig?.text || "" },
            ];
          }
        }
      } catch (err) {
        console.error(`Gemini batch error (batch ${i}):`, err);
        for (const b of batch) {
          if (!abstracts[b.pmid]) {
            abstracts[b.pmid] = [{ label: "Abstract", text: b.text }];
          }
        }
      }
    }
  }

  return abstracts;
}

// ── Main handler ──────────────────────────────────────────────────
export async function GET(_request: NextRequest) {
  // TODO: re-enable auth check later
  // const secret = _request.nextUrl.searchParams.get("secret");
  // if (CRON_SECRET && secret !== CRON_SECRET) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // Config check
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing env vars: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const dateISO = todayKSTISO();

  try {
    // 1) Fetch PubMed articles
    const { articles, totalCount } = await fetchPubMedArticles();

    if (articles.length === 0) {
      const { error: upsertErr } = await supabase.from("daily_papers").upsert(
        {
          date: dateISO,
          articles: [],
          abstracts: {},
          category_map: {},
          total_count: 0,
        },
        { onConflict: "date" },
      );
      if (upsertErr) throw new Error(`Supabase upsert error: ${JSON.stringify(upsertErr)}`);

      return NextResponse.json({ success: true, date: dateISO, count: 0 });
    }

    // 2) Categorise via Gemini
    let categoryMap: Record<string, string[]> = {};
    try {
      categoryMap = await categorizeArticles(articles);
    } catch (err) {
      console.error("Categorization failed, continuing:", err);
    }

    // 3) Fetch & parse all abstracts
    let abstractsMap: Record<string, AbstractSection[]> = {};
    try {
      const pmids = articles.map((a: { uid: string }) => a.uid);
      abstractsMap = await fetchAllAbstracts(pmids);
    } catch (err) {
      console.error("Abstract parsing failed, continuing:", err);
    }

    // 4) Filter out articles without abstracts before saving
    const hasRealAbstract = (pmid: string): boolean => {
      const sections = abstractsMap[pmid];
      if (!sections || sections.length === 0) return false;
      if (sections.length === 1 && sections[0].text === "초록이 제공되지 않습니다.") return false;
      return true;
    };

    const filteredArticles = articles.filter((a: { uid: string }) => hasRealAbstract(a.uid));
    const filteredAbstracts: Record<string, AbstractSection[]> = {};
    const filteredCategoryMap: Record<string, string[]> = {};
    for (const a of filteredArticles) {
      const uid = (a as { uid: string }).uid;
      if (abstractsMap[uid]) filteredAbstracts[uid] = abstractsMap[uid];
      if (categoryMap[uid]) filteredCategoryMap[uid] = categoryMap[uid];
    }

    // 5) Save to Supabase
    const { error: upsertErr } = await supabase.from("daily_papers").upsert(
      {
        date: dateISO,
        articles: filteredArticles,
        abstracts: filteredAbstracts,
        category_map: filteredCategoryMap,
        total_count: totalCount,
      },
      { onConflict: "date" },
    );

    if (upsertErr) {
      throw new Error(`Supabase upsert error: ${JSON.stringify(upsertErr)}`);
    }

    return NextResponse.json({
      success: true,
      date: dateISO,
      total_found: totalCount,
      with_abstract: filteredArticles.length,
      categorized: Object.keys(filteredCategoryMap).length,
      abstracts_parsed: Object.keys(filteredAbstracts).length,
    });
  } catch (err) {
    console.error("[daily-papers] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
