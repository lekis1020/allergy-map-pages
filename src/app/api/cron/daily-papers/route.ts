import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
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

// IMRAD label map for structured PubMed abstracts
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

// ── Step 1: Fetch PubMed articles ─────────────────────────────────
async function fetchPubMedArticles() {
  const today = todayStr();
  const query = SEARCH_TERMS.map((t) => `"${t}"`).join(" OR ");
  const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=(${encodeURIComponent(query)})&datetype=pdat&mindate=${today}&maxdate=${today}&retmode=json&retmax=100&sort=date`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error("PubMed search failed");
  const searchData = await searchRes.json();

  const ids: string[] = searchData.esearchresult?.idlist || [];
  const totalCount = parseInt(searchData.esearchresult?.count || "0", 10);

  if (ids.length === 0) return { articles: [], totalCount: 0 };

  const summaryUrl = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const summaryRes = await fetch(summaryUrl);
  if (!summaryRes.ok) throw new Error("PubMed summary failed");
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
    "Asthma and rhinitis",
    "Urticaria and atopic dermatitis",
    "Drug allergy",
    "Eosinophilic and immunologic disorders",
    "Others",
  ];

  const systemPrompt = `You are a biomedical article classifier specializing in allergy and immunology.

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
- Return ONLY a JSON array: [{"uid":"...","categories":["..."]}]
- Output valid JSON only, no markdown fences`;

  const input = articles.map((a) => ({ uid: a.uid, title: a.title }));
  const rawText = await callGemini(systemPrompt, JSON.stringify(input));
  const results: { uid: string; categories: string[] }[] = JSON.parse(rawText);

  const categoryMap: Record<string, string[]> = {};
  for (const r of results) {
    const valid = r.categories.filter((c) => CATEGORIES.includes(c));
    categoryMap[r.uid] = valid.length > 0 ? valid : ["Others"];
  }

  return categoryMap;
}

// ── Step 3: Fetch & parse all abstracts ───────────────────────────
async function fetchAllAbstracts(
  ids: string[],
): Promise<Record<string, AbstractSection[]>> {
  if (ids.length === 0) return {};

  // Fetch all abstracts in one XML call (PubMed supports comma-separated ids)
  const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("PubMed efetch failed");
  const xmlText = await res.text();

  // Parse XML - use regex-based extraction for server environment
  const abstracts: Record<string, AbstractSection[]> = {};
  const unstructured: { pmid: string; text: string }[] = [];

  // Split by <PubmedArticle> blocks
  const articleBlocks = xmlText.split(/<PubmedArticle>/);
  for (const block of articleBlocks) {
    // Extract PMID
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];

    // Check for AbstractText elements
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
      // Structured abstract
      const sections: AbstractSection[] = abstractTextMatches
        .map((m) => {
          const rawLabel = m[1] || "";
          const label = IMRAD_LABELS[rawLabel.toUpperCase()] || rawLabel;
          const text = m[2].replace(/<[^>]+>/g, "").trim();
          return { label, text };
        })
        .filter((s) => s.text.length > 0);
      abstracts[pmid] = sections;
    } else {
      // Unstructured → queue for Gemini
      const fullText = abstractTextMatches
        .map((m) => m[2].replace(/<[^>]+>/g, "").trim())
        .join(" ");
      unstructured.push({ pmid, text: fullText });
    }
  }

  // ── Batch LLM call for unstructured abstracts ──
  if (unstructured.length > 0) {
    const systemPrompt = `You are a biomedical abstract parser. Given a JSON array of objects with "pmid" and "abstract" fields, split each abstract into IMRAD sections.

Return a JSON array of objects: [{"pmid":"...","sections":[{"label":"...","text":"..."}]}]

Allowed labels: "Background", "Objective", "Methods", "Results", "Conclusion", "Discussion"

Rules:
- Every sentence must belong to exactly one section
- Keep original text verbatim — do not paraphrase or omit anything
- Use at minimum: Background, Methods, Results, Conclusion
- Output valid JSON only, no markdown fences`;

    // Process in batches of 10 to stay within token limits
    const BATCH_SIZE = 10;
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
        // Fallback: store as plain text
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
export async function GET(request: NextRequest) {
  // Auth check: require CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 500 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log("[daily-papers] Starting daily paper collection...");

    // 1) Fetch PubMed articles
    const { articles, totalCount } = await fetchPubMedArticles();
    console.log(`[daily-papers] Found ${articles.length} articles`);

    if (articles.length === 0) {
      // Upsert empty record for today
      await supabase.from("daily_papers").upsert(
        {
          date: todayISO(),
          articles: [],
          abstracts: {},
          category_map: {},
          total_count: 0,
        },
        { onConflict: "date" },
      );

      return NextResponse.json({
        success: true,
        date: todayISO(),
        count: 0,
      });
    }

    // 2) Categorise via Gemini
    console.log("[daily-papers] Categorizing articles...");
    const categoryMap = await categorizeArticles(articles);

    // 3) Fetch & parse all abstracts (structured + Gemini for unstructured)
    console.log("[daily-papers] Fetching & parsing abstracts...");
    const pmids = articles.map(
      (a: { uid: string }) => a.uid,
    );
    const abstractsMap = await fetchAllAbstracts(pmids);

    // 4) Save to Supabase
    console.log("[daily-papers] Saving to Supabase...");
    const { error } = await supabase.from("daily_papers").upsert(
      {
        date: todayISO(),
        articles,
        abstracts: abstractsMap,
        category_map: categoryMap,
        total_count: totalCount,
      },
      { onConflict: "date" },
    );

    if (error) throw error;

    console.log("[daily-papers] Done!");
    return NextResponse.json({
      success: true,
      date: todayISO(),
      count: articles.length,
      categorized: Object.keys(categoryMap).length,
      abstracts_parsed: Object.keys(abstractsMap).length,
    });
  } catch (err) {
    console.error("[daily-papers] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
