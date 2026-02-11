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
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

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
    id: "Asthma and rhinitis",
    label: "Asthma and rhinitis",
    color:
      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    activeColor: "bg-blue-600 text-white border-blue-600",
  },
  {
    id: "Urticaria and atopic dermatitis",
    label: "Urticaria and atopic dermatitis",
    color:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    activeColor: "bg-purple-600 text-white border-purple-600",
  },
  {
    id: "Drug allergy",
    label: "Drug allergy",
    color:
      "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    activeColor: "bg-orange-600 text-white border-orange-600",
  },
  {
    id: "Eosinophilic and immunologic disorders",
    label: "Eosinophilic and immunologic disorders",
    color:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    activeColor: "bg-green-600 text-white border-green-600",
  },
  {
    id: "Others",
    label: "Others",
    color:
      "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600",
    activeColor: "bg-gray-600 text-white border-gray-600",
  },
] as const;

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
  const [searchFilter, setSearchFilter] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(),
  );
  const [totalCount, setTotalCount] = useState(0);

  // Pre-computed from cron job
  const [abstracts, setAbstracts] = useState<Record<string, AbstractSection[]>>(
    {},
  );
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});
  const [dataDate, setDataDate] = useState<string | null>(null);

  // ── Load from Supabase ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const today = new Date();
      const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const { data, error: dbError } = await supabase
        .from("daily_papers")
        .select("*")
        .eq("date", todayISO)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        // No data for today yet
        setArticles([]);
        setAbstracts({});
        setCategoryMap({});
        setTotalCount(0);
        setDataDate(null);
        return;
      }

      setArticles((data.articles as PubMedArticle[]) || []);
      setAbstracts(
        (data.abstracts as Record<string, AbstractSection[]>) || {},
      );
      setCategoryMap(
        (data.category_map as Record<string, string[]>) || {},
      );
      setTotalCount(data.total_count || 0);
      setDataDate(data.date);
    } catch (err) {
      console.error("Load error:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (pmid: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) {
        next.delete(pmid);
      } else {
        next.add(pmid);
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

  // ── Get categories for an article ───────────────────────────────
  const getArticleCategories = (article: PubMedArticle): string[] => {
    return categoryMap[article.uid] || [];
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
      if (articleCats.length === 0) return false;
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
          onClick={() => loadData()}
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

      {/* ── Category filter tags ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          분야 필터:
        </span>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
          const count = articles.filter((a) =>
            (categoryMap[a.uid] || []).includes(cat.id),
          ).length;
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? cat.activeColor : cat.color
              }`}
            >
              {cat.label}
              {count > 0 && (
                <span className="ml-1.5 opacity-70">({count})</span>
              )}
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
            논문 데이터를 불러오는 중...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadData()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && articles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {dataDate
                ? "오늘 발행된 알레르기 관련 논문이 없습니다."
                : "아직 오늘의 논문 데이터가 준비되지 않았습니다. 자정에 자동 수집됩니다."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* No filter results */}
      {!loading &&
        !error &&
        articles.length > 0 &&
        filteredArticles.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                검색 결과가 없습니다. 필터를 변경해보세요.
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
          const articleAbstract = abstracts[article.uid];

          return (
            <Card key={article.uid} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                {/* Category badges */}
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

                {/* ── Abstract (IMRAD formatted, pre-computed) ─────── */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {articleAbstract && articleAbstract.length > 0 ? (
                      <div className="space-y-3">
                        {articleAbstract.map((section, idx) => (
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
                      <p className="text-sm text-muted-foreground">
                        초록이 제공되지 않습니다.
                      </p>
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
