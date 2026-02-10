"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface PubMedArticle {
  uid: string;
  title: string;
  authors: { name: string }[];
  source: string;
  pubdate: string;
  epubdate: string;
  fulljournalname: string;
  volume: string;
  issue: string;
  pages: string;
  elocationid: string;
  pubtype: string[];
  sortfirstauthor: string;
}

interface AbstractSection {
  label: string;
  text: string;
}

// ── Category definitions ──────────────────────────────────────────
const CATEGORIES = [
  {
    id: "asthma-rhinitis",
    label: "Asthma and rhinitis",
    terms: [
      "asthma",
      "allergic rhinitis",
      "rhinitis",
      "rhinosinusitis",
      "bronchial hyperresponsiveness",
      "wheezing",
    ],
    color:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    activeColor: "bg-blue-600 text-white border-blue-600",
  },
  {
    id: "urticaria-ad",
    label: "Urticaria and atopic dermatitis",
    terms: [
      "urticaria",
      "atopic dermatitis",
      "eczema",
      "angioedema",
      "dermatitis",
      "pruritus",
    ],
    color:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    activeColor: "bg-purple-600 text-white border-purple-600",
  },
  {
    id: "drug-allergy",
    label: "Drug allergy",
    terms: [
      "drug allergy",
      "drug hypersensitivity",
      "anaphylaxis",
      "food allergy",
      "drug reaction",
      "adverse drug",
    ],
    color:
      "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    activeColor: "bg-orange-600 text-white border-orange-600",
  },
  {
    id: "eosinophilic-immunologic",
    label: "Eosinophilic and immunologic disorders",
    terms: [
      "eosinophilic",
      "immunotherapy",
      "immunoglobulin",
      "immunologic",
      "immunological",
      "ige",
      "mast cell",
    ],
    color:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    activeColor: "bg-green-600 text-white border-green-600",
  },
] as const;

// Search terms sent to PubMed
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

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// ── IMRAD label normalisation ─────────────────────────────────────
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

// Colour per IMRAD section label
const SECTION_COLORS: Record<string, string> = {
  Background: "text-blue-600 dark:text-blue-400",
  Objective: "text-indigo-600 dark:text-indigo-400",
  Methods: "text-emerald-600 dark:text-emerald-400",
  Results: "text-amber-600 dark:text-amber-400",
  Conclusion: "text-rose-600 dark:text-rose-400",
  Discussion: "text-purple-600 dark:text-purple-400",
  Significance: "text-pink-600 dark:text-pink-400",
  Interpretation: "text-violet-600 dark:text-violet-400",
  Limitations: "text-gray-600 dark:text-gray-400",
  Implications: "text-teal-600 dark:text-teal-400",
  Summary: "text-sky-600 dark:text-sky-400",
  Abstract: "text-foreground",
};

// ── Heuristic sentence classifier (for unstructured abstracts) ────
function classifySentence(sentence: string): string | null {
  const s = sentence.toLowerCase();

  if (
    /\b(in conclusion|conclud|in summary|our (findings|results|study) suggest|these (findings|results|data) suggest|taken together|overall|implication)/i.test(
      s,
    )
  )
    return "Conclusion";

  if (
    /\b(we found|results? show|demonstrated|p\s*[<>=]\s*0|confidence interval|odds ratio|hazard ratio|\bsignificantly\b|prevalence was|incidence|were (higher|lower|greater|similar)|compared (to|with)|statistic)/i.test(
      s,
    )
  )
    return "Results";

  if (
    /\b(method|we (conducted|performed|analyzed|examined|evaluated|recruited|enrolled|included|assessed|investigated|measured|used a)|retrospective|prospective|cross.?sectional|cohort|randomized|double.?blind|placebo|sample size|participants? were|subjects? were|questionnaire|survey|database|inclusion criteria)/i.test(
      s,
    )
  )
    return "Methods";

  if (
    /\b(little is known|remains unclear|not (fully |well )?understood|limited (data|evidence|studies)|previous (studies|research)|growing (concern|evidence)|increasing|burden of|is (a |an )?(common|major|important)|however|although|to date|currently|the (aim|purpose|objective) of)/i.test(
      s,
    )
  )
    return "Background";

  return null;
}

/** Try to split text that has embedded labels like "BACKGROUND: ..." */
function splitByEmbeddedLabels(text: string): AbstractSection[] | null {
  const labelPattern =
    /(?:^|\n)\s*(BACKGROUND|INTRODUCTION|OBJECTIVE|OBJECTIVES|PURPOSE|AIM|METHODS|METHOD|RESULTS|FINDINGS|CONCLUSIONS?|DISCUSSION|SUMMARY)\s*:\s*/gi;
  const matches = [...text.matchAll(labelPattern)];
  if (matches.length < 2) return null;

  const sections: AbstractSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const rawLabel = matches[i][1].toUpperCase();
    const label = IMRAD_LABELS[rawLabel] || rawLabel;
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const sectionText = text.slice(start, end).trim();
    if (sectionText) sections.push({ label, text: sectionText });
  }

  // Include text before the first label if any
  if (matches[0].index! > 0) {
    const pre = text.slice(0, matches[0].index!).trim();
    if (pre) sections.unshift({ label: "Background", text: pre });
  }

  return sections.length >= 2 ? sections : null;
}

/** Use keyword heuristics to infer IMRAD sections */
function parseUnstructuredAbstract(text: string): AbstractSection[] {
  // 1) Try embedded labels first
  const embedded = splitByEmbeddedLabels(text);
  if (embedded) return embedded;

  // 2) Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= 2) {
    return [{ label: "Abstract", text: text.trim() }];
  }

  // 3) Classify each sentence
  const classified = sentences.map((s) => ({
    text: s.trim(),
    label: classifySentence(s),
  }));

  const classifiedCount = classified.filter((c) => c.label !== null).length;

  // If less than 25% classified, fall back to positional split
  if (classifiedCount / classified.length < 0.25) {
    const total = sentences.length;
    const bgEnd = Math.max(1, Math.ceil(total * 0.25));
    const methodEnd = Math.max(bgEnd + 1, Math.ceil(total * 0.5));
    const resultEnd = Math.max(methodEnd + 1, Math.ceil(total * 0.75));
    const sections: AbstractSection[] = [
      { label: "Background", text: sentences.slice(0, bgEnd).join(" ").trim() },
      { label: "Methods", text: sentences.slice(bgEnd, methodEnd).join(" ").trim() },
      { label: "Results", text: sentences.slice(methodEnd, resultEnd).join(" ").trim() },
      { label: "Conclusion", text: sentences.slice(resultEnd).join(" ").trim() },
    ];
    return sections.filter((s) => s.text.length > 0);
  }

  // 4) Group consecutive sentences with same label
  const sections: AbstractSection[] = [];
  let currentLabel = classified[0].label || "Background";
  let currentTexts: string[] = [classified[0].text];

  for (let i = 1; i < classified.length; i++) {
    const label = classified[i].label || currentLabel;
    if (label !== currentLabel) {
      sections.push({ label: currentLabel, text: currentTexts.join(" ").trim() });
      currentLabel = label;
      currentTexts = [classified[i].text];
    } else {
      currentTexts.push(classified[i].text);
    }
  }
  sections.push({ label: currentLabel, text: currentTexts.join(" ").trim() });

  return sections;
}

// ── Category matching ─────────────────────────────────────────────
function getArticleCategories(article: PubMedArticle): string[] {
  const titleLower = article.title.toLowerCase();
  const categories: string[] = [];

  for (const cat of CATEGORIES) {
    if (cat.terms.some((term) => titleLower.includes(term.toLowerCase()))) {
      categories.push(cat.id);
    }
  }

  // General allergy / immunology catch-all
  if (categories.length === 0) {
    if (/\b(allerg|immun|hypersensitiv|ige)\b/i.test(titleLower)) {
      categories.push("eosinophilic-immunologic");
    }
  }

  return categories;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return dateStr;
}

// ══════════════════════════════════════════════════════════════════
//  Component
// ══════════════════════════════════════════════════════════════════
export default function TodayPapersPage() {
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [abstracts, setAbstracts] = useState<Record<string, AbstractSection[]>>(
    {},
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(),
  );
  const [totalCount, setTotalCount] = useState(0);

  // ── Fetch articles (today only) ─────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const todayStr = format(today, "yyyy/MM/dd");

      const query = SEARCH_TERMS.map((t) => `"${t}"`).join(" OR ");
      const searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=(${encodeURIComponent(query)})&datetype=pdat&mindate=${todayStr}&maxdate=${todayStr}&retmode=json&retmax=100&sort=date`;

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) throw new Error("PubMed 검색에 실패했습니다");
      const searchData = await searchRes.json();

      const ids: string[] = searchData.esearchresult?.idlist || [];
      setTotalCount(parseInt(searchData.esearchresult?.count || "0", 10));

      if (ids.length === 0) {
        setArticles([]);
        setLoading(false);
        return;
      }

      const summaryUrl = `${BASE_URL}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok)
        throw new Error("논문 정보를 가져오는데 실패했습니다");
      const summaryData = await summaryRes.json();

      const result = summaryData.result;
      const articleList: PubMedArticle[] = ids
        .map((id) => result[id])
        .filter(Boolean);

      setArticles(articleList);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // ── Fetch & parse abstract (structured → IMRAD) ────────────────
  const fetchAbstract = async (pmid: string) => {
    if (abstracts[pmid]) return;

    try {
      const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
      const res = await fetch(url);
      const text = await res.text();

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const abstractTexts = xml.querySelectorAll("AbstractText");

      if (abstractTexts.length === 0) {
        setAbstracts((prev) => ({
          ...prev,
          [pmid]: [{ label: "", text: "초록이 제공되지 않습니다." }],
        }));
        return;
      }

      const firstLabel = abstractTexts[0].getAttribute("Label");

      if (firstLabel && abstractTexts.length > 1) {
        // ── Structured abstract (PubMed provides labels) ──
        const sections: AbstractSection[] = [];
        abstractTexts.forEach((el) => {
          const rawLabel = el.getAttribute("Label") || "";
          const normalizedLabel =
            IMRAD_LABELS[rawLabel.toUpperCase()] || rawLabel;
          const sectionText = el.textContent || "";
          if (sectionText.trim()) {
            sections.push({
              label: normalizedLabel,
              text: sectionText.trim(),
            });
          }
        });
        setAbstracts((prev) => ({ ...prev, [pmid]: sections }));
      } else {
        // ── Unstructured abstract → infer IMRAD sections ──
        const fullText = Array.from(abstractTexts)
          .map((el) => el.textContent || "")
          .join(" ")
          .trim();
        const sections = parseUnstructuredAbstract(fullText);
        setAbstracts((prev) => ({ ...prev, [pmid]: sections }));
      }
    } catch {
      setAbstracts((prev) => ({
        ...prev,
        [pmid]: [{ label: "", text: "초록을 불러오는데 실패했습니다." }],
      }));
    }
  };

  const toggleExpand = (pmid: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) {
        next.delete(pmid);
      } else {
        next.add(pmid);
        fetchAbstract(pmid);
      }
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  // ── Filtering (text + category) ─────────────────────────────────
  const filteredArticles = articles.filter((a) => {
    if (searchFilter) {
      const s = searchFilter.toLowerCase();
      const authorStr = a.authors?.map((au) => au.name).join(" ") || "";
      const textMatch =
        a.title.toLowerCase().includes(s) ||
        authorStr.toLowerCase().includes(s) ||
        a.fulljournalname?.toLowerCase().includes(s) ||
        a.source?.toLowerCase().includes(s);
      if (!textMatch) return false;
    }

    if (activeCategories.size > 0) {
      const articleCats = getArticleCategories(a);
      if (!articleCats.some((c) => activeCategories.has(c))) return false;
    }

    return true;
  });

  const today = new Date();

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold sm:text-2xl flex items-center gap-2">
            <Newspaper className="h-5 w-5 sm:h-6 sm:w-6" />
            오늘의 논문
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            PubMed 알레르기 관련 최신 논문 ·{" "}
            {format(today, "yyyy년 M월 d일 (EEE)", { locale: ko })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchArticles()}
          disabled={loading}
          className="shrink-0 self-start"
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="제목, 저자, 저널명 검색..."
          className="pl-8 h-8 text-sm"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      {/* Search terms */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">검색 키워드:</span>
        {SEARCH_TERMS.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] py-0">
            {t}
          </Badge>
        ))}
      </div>

      {/* ── Category filter tags ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">
          분야 필터:
        </span>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? cat.activeColor : cat.color
              }`}
            >
              {cat.label}
              {isActive && <X className="h-3 w-3 ml-1.5 -mr-0.5" />}
            </button>
          );
        })}
        {activeCategories.size > 0 && (
          <button
            onClick={() => setActiveCategories(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            전체 해제
          </button>
        )}
      </div>

      {/* Result count */}
      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          총 {totalCount}건 중 {filteredArticles.length}건 표시
          {totalCount > 100 && " (최근 100건)"}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            PubMed에서 논문을 검색 중...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchArticles()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && filteredArticles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchFilter || activeCategories.size > 0
                ? "검색 결과가 없습니다. 필터를 변경해보세요."
                : "오늘 발행된 알레르기 관련 논문이 없습니다."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Article list ──────────────────────────────────────────── */}
      {!loading &&
        !error &&
        filteredArticles.map((article) => {
          const isExpanded = expandedIds.has(article.uid);
          const authorList =
            article.authors?.map((a) => a.name).join(", ") ||
            "저자 정보 없음";
          const journalInfo = [
            article.fulljournalname || article.source,
            article.volume && `Vol.${article.volume}`,
            article.issue && `(${article.issue})`,
            article.pages && `:${article.pages}`,
          ]
            .filter(Boolean)
            .join(" ");
          const articleCats = getArticleCategories(article);

          return (
            <Card key={article.uid} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                {/* Category badges on article */}
                {articleCats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {articleCats.map((catId) => {
                      const cat = CATEGORIES.find((c) => c.id === catId);
                      return cat ? (
                        <span
                          key={catId}
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cat.color}`}
                        >
                          {cat.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Title */}
                <button
                  onClick={() => toggleExpand(article.uid)}
                  className="w-full text-left group"
                >
                  <h3 className="text-sm font-semibold leading-snug sm:text-base group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                </button>

                {/* Meta */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {authorList}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-medium text-primary/80">
                      {journalInfo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(article.pubdate)}
                    </span>
                  </div>
                  {article.pubtype && article.pubtype.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {article.pubtype.slice(0, 3).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[10px] py-0"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => toggleExpand(article.uid)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 mr-1" />
                        초록 접기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 mr-1" />
                        초록 보기
                      </>
                    )}
                  </Button>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    PubMed
                  </a>
                  {article.elocationid && (
                    <a
                      href={`https://doi.org/${article.elocationid.replace("doi: ", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      DOI
                    </a>
                  )}
                </div>

                {/* ── Abstract (IMRAD formatted) ──────────────────── */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {abstracts[article.uid] ? (
                      <div className="space-y-3">
                        {abstracts[article.uid].map((section, idx) => (
                          <div key={idx}>
                            {section.label && (
                              <p
                                className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                                  SECTION_COLORS[section.label] ||
                                  "text-foreground"
                                }`}
                              >
                                {section.label}
                              </p>
                            )}
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {section.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs text-muted-foreground">
                          초록을 불러오는 중...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
