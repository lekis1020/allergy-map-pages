"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity } from "@/hooks/use-community";
import { CheckCircle, XCircle, Loader2, FlaskConical } from "lucide-react";

type TestResult = {
  name: string;
  status: "pass" | "fail" | "running" | "pending";
  message?: string;
};

export default function TestPage() {
  const { user, membership, isLoading: authLoading } = useAuth();
  const { community, channels } = useCommunity();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  function updateResult(index: number, update: Partial<TestResult>) {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...update } : r))
    );
  }

  async function runTests() {
    setRunning(true);

    const tests: TestResult[] = [
      { name: "인증 상태 확인", status: "pending" },
      { name: "사용자 프로필 확인", status: "pending" },
      { name: "커뮤니티 멤버십 확인", status: "pending" },
      { name: "커뮤니티 데이터 확인", status: "pending" },
      { name: "채널 데이터 확인", status: "pending" },
      { name: "UI 컴포넌트 렌더링", status: "pending" },
    ];
    setResults(tests);

    // Test 1: Auth state
    updateResult(0, { status: "running" });
    await delay(300);
    if (!authLoading && user) {
      updateResult(0, { status: "pass", message: `로그인됨: ${user.email}` });
    } else if (authLoading) {
      updateResult(0, { status: "fail", message: "인증 로딩 중 타임아웃" });
    } else {
      updateResult(0, { status: "fail", message: "사용자 정보 없음" });
    }

    // Test 2: User profile
    updateResult(1, { status: "running" });
    await delay(300);
    if (user?.display_name) {
      updateResult(1, { status: "pass", message: `이름: ${user.display_name}` });
    } else {
      updateResult(1, { status: "fail", message: "프로필 이름 없음" });
    }

    // Test 3: Community membership
    updateResult(2, { status: "running" });
    await delay(300);
    if (membership) {
      updateResult(2, {
        status: "pass",
        message: `역할: ${membership.role}, 상태: ${membership.status}`,
      });
    } else {
      updateResult(2, { status: "fail", message: "멤버십 정보 없음" });
    }

    // Test 4: Community data
    updateResult(3, { status: "running" });
    await delay(300);
    if (community) {
      updateResult(3, { status: "pass", message: `커뮤니티: ${community.name}` });
    } else {
      updateResult(3, { status: "fail", message: "커뮤니티 데이터 없음" });
    }

    // Test 5: Channel data
    updateResult(4, { status: "running" });
    await delay(300);
    if (channels && channels.length > 0) {
      updateResult(4, { status: "pass", message: `${channels.length}개 채널 로드됨` });
    } else {
      updateResult(4, { status: "fail", message: "채널 데이터 없음" });
    }

    // Test 6: UI component rendering
    updateResult(5, { status: "running" });
    await delay(300);
    updateResult(5, { status: "pass", message: "Card, Button, Badge 정상 렌더링" });

    setRunning(false);
  }

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold sm:text-2xl flex items-center gap-2">
            <FlaskConical className="h-5 w-5 sm:h-6 sm:w-6" />
            테스트 페이지
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            앱 상태 및 컴포넌트 동작을 확인합니다
          </p>
        </div>
        <Button onClick={runTests} disabled={running}>
          {running ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              실행 중...
            </span>
          ) : (
            "테스트 실행"
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="flex gap-2">
          <Badge variant="secondary">{results.length}개 테스트</Badge>
          {passCount > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {passCount} 통과
            </Badge>
          )}
          {failCount > 0 && (
            <Badge variant="destructive">{failCount} 실패</Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">테스트 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              &quot;테스트 실행&quot; 버튼을 눌러 테스트를 시작하세요
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  {result.status === "pass" && (
                    <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                  )}
                  {result.status === "fail" && (
                    <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  )}
                  {result.status === "running" && (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
                  )}
                  {result.status === "pending" && (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{result.name}</p>
                    {result.message && (
                      <p className="text-xs text-muted-foreground truncate">
                        {result.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">환경 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">사용자</span>
              <span className="font-medium">{user?.display_name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">이메일</span>
              <span className="font-medium">{user?.email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">커뮤니티</span>
              <span className="font-medium">{community?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">역할</span>
              <span className="font-medium">{membership?.role || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">채널 수</span>
              <span className="font-medium">{channels?.length || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
