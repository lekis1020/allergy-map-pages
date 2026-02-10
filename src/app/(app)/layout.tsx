"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, LogIn } from "lucide-react";

function JoinCommunityForm() {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("로그인 정보를 확인할 수 없습니다.");
        setLoading(false);
        return;
      }

      const code = inviteCode.trim().toUpperCase();

      // Strategy 1: use_invite_code RPC (handles everything atomically)
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc("use_invite_code", { invite_code: code, for_user_id: user.id });

      if (!rpcError && rpcResult === true) {
        window.location.reload();
        return;
      }

      // If use_invite_code returned false (code invalid/expired), show error
      if (!rpcError && rpcResult === false) {
        setError("유효하지 않은 초대 코드입니다. 코드를 다시 확인해 주세요.");
        setLoading(false);
        return;
      }

      // Strategy 2: validate_invite_code RPC + direct membership insert
      const { data: validateResult, error: validateError } = await supabase
        .rpc("validate_invite_code", { invite_code: code });

      if (!validateError && validateResult && validateResult.length > 0) {
        if (!validateResult[0].is_valid) {
          setError("초대 코드가 만료되었거나 사용 횟수를 초과했습니다.");
          setLoading(false);
          return;
        }

        const { error: memberError } = await supabase
          .from("community_members")
          .upsert({
            community_id: validateResult[0].community_id,
            user_id: user.id,
            role: "member",
            status: "active",
          });

        if (memberError) {
          setError("커뮤니티 참여에 실패했습니다: " + memberError.message);
          setLoading(false);
          return;
        }

        window.location.reload();
        return;
      }

      // Strategy 3: Direct table query (before any security patch)
      const { data: invitation } = await supabase
        .from("invitations")
        .select("*")
        .eq("code", code)
        .single();

      if (!invitation) {
        setError("유효하지 않은 초대 코드입니다. 코드를 다시 확인해 주세요.");
        setLoading(false);
        return;
      }

      if (invitation.used_count >= invitation.max_uses) {
        setError("이 초대 코드는 사용 횟수를 초과했습니다.");
        setLoading(false);
        return;
      }

      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        setError("만료된 초대 코드입니다.");
        setLoading(false);
        return;
      }

      const { error: memberError } = await supabase
        .from("community_members")
        .upsert({
          community_id: invitation.community_id,
          user_id: user.id,
          role: "member",
          status: "active",
        });

      if (memberError) {
        setError("커뮤니티 참여에 실패했습니다: " + memberError.message);
        setLoading(false);
        return;
      }

      await supabase
        .from("invitations")
        .update({ used_count: invitation.used_count + 1 })
        .eq("id", invitation.id);

      window.location.reload();
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Ticket className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">커뮤니티 참여</CardTitle>
          <CardDescription>
            초대 코드를 입력하여 커뮤니티에 참여하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join-invite-code">초대 코드</Label>
              <Input
                id="join-invite-code"
                placeholder="초대 코드를 입력하세요"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !inviteCode.trim()}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  참여 처리 중...
                </span>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  커뮤니티 참여하기
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              다른 계정으로 로그인
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!membership) {
    return <JoinCommunityForm />;
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto px-4 pt-16 pb-4 md:px-6 md:pt-6 md:pb-6 safe-bottom">
          {children}
        </div>
      </main>
    </div>
  );
}
