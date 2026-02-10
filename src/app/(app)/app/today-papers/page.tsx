"use client";

import { useEffect, useState, useCallback } from "react";
import { format, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface PubMedArticle {
  uid: string;
  title: string;
  authors: { name: string }[];
  source: string; // journal
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
];

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  // PubMed dates: "2026 Feb 10" or "2026 Feb"
  return dateStr;
}

export default function TodayPapersPage() {
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [abstracts, setAbstracts] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [dateRange, setDateRange] = useState(7); // days to look back
  const [totalCount, setTotalCount] = useState(0);

  const fetchArticles = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const fromDate = subDays(today, days);
      const minDate = format(fromDate, "yyyy/MM/dd");
      const maxDate = format(today, "yyyy/MM/dd");

      const query = SEARCH_TERMS.map((t) => `"${t}"`).join(" OR ");
      const searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=(${encodeURIComponent(query)})&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}&retmode=json&retmax=50&sort=date`;

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
      if (!summaryRes.ok) throw new Error("논문 정보를 가져오는데 실패했습니다");
      const summaryData = await summaryRes.json();

      const result = summaryData.result;
      const articleList: PubMedArticle[] = ids
        .map((id) => result[id])
        .filter(Boolean);

      setArticles(articleList);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(dateRange);
  }, [fetchArticles, dateRange]);

  const fetchAbstract = async (pmid: string) => {
    if (abstracts[pmid]) return;

    try {
      const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
      const res = await fetch(url);
      const text = await res.text();

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const abstractEl = xml.querySelector("AbstractText");
      const abstractText = abstractEl?.textContent || "초록이 제공되지 않습니다.";

      setAbstracts((prev) => ({ ...prev, [pmid]: abstractText }));
    } catch {
      setAbstracts((prev) => ({
        ...prev,
        [pmid]: "초록을 불러오는데 실패했습니다.",
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

  const filteredArticles = articles.filter((a) => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    const authorStr = a.authors?.map((au) => au.name).join(" ") || "";
    return (
      a.title.toLowerCase().includes(s) ||
      authorStr.toLowerCase().includes(s) ||
      a.fulljournalname?.toLowerCase().includes(s) ||
      a.source?.toLowerCase().includes(s)
    );
  });

  const today = new Date();

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
          onClick={() => fetchArticles(dateRange)}
          disabled={loading}
          className="shrink-0 self-start"
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Date range selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1">
            {[1, 3, 7, 14, 30].map((d) => (
              <Button
                key={d}
                variant={dateRange === d ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setDateRange(d)}
              >
                {d === 1 ? "오늘" : `${d}일`}
              </Button>
            ))}
          </div>
        </div>

        {/* Search filter */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="제목, 저자, 저널명 검색..."
            className="pl-8 h-8 text-sm"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Search terms info */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">검색 키워드:</span>
        {SEARCH_TERMS.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] py-0">
            {t}
          </Badge>
        ))}
      </div>

      {/* Result count */}
      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          총 {totalCount}건 중 {filteredArticles.length}건 표시
          {totalCount > 50 && " (최근 50건)"}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchArticles(dateRange)}
            >
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
              {searchFilter
                ? "검색 결과가 없습니다."
                : `최근 ${dateRange}일 내 알레르기 관련 논문이 없습니다.`}
            </p>
            {dateRange < 30 && !searchFilter && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => setDateRange(30)}
              >
                기간을 30일로 늘려보기
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Article list */}
      {!loading &&
        !error &&
        filteredArticles.map((article) => {
          const isExpanded = expandedIds.has(article.uid);
          const authorList =
            article.authors?.map((a) => a.name).join(", ") || "저자 정보 없음";
          const journalInfo = [
            article.fulljournalname || article.source,
            article.volume && `Vol.${article.volume}`,
            article.issue && `(${article.issue})`,
            article.pages && `:${article.pages}`,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Card key={article.uid} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
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

                {/* Abstract */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t">
                    {abstracts[article.uid] ? (
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {abstracts[article.uid]}
                      </p>
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
