"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { generateInviteCode, formatDate } from "@/lib/utils";
import type { Invitation } from "@/types/database";
import { Ticket, Plus, Copy, Check, ArrowLeft, Trash2 } from "lucide-react";

export default function AdminInvitationsPage() {
  const { user, membership } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadInvitations();
  }, [membership]);

  async function loadInvitations() {
    if (!membership) return;
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("community_id", membership.community_id)
      .order("created_at", { ascending: false });
    if (data) setInvitations(data);
  }

  async function handleCreateInvitation() {
    if (!user || !membership) return;
    setLoading(true);

    const code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invitations") as any).insert({
      community_id: membership.community_id,
      code,
      invited_by: user.id,
      max_uses: parseInt(maxUses),
      expires_at: expiresAt.toISOString(),
    });

    setDialogOpen(false);
    setLoading(false);
    await loadInvitations();
  }

  async function handleDelete(id: string) {
    await supabase.from("invitations").delete().eq("id", id);
    await loadInvitations();
  }

  function copyInviteLink(code: string, id: string) {
    const url = `${window.location.origin}/signup?invite=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function isExpired(invitation: Invitation) {
    if (!invitation.expires_at) return false;
    return new Date(invitation.expires_at) < new Date();
  }

  function isUsedUp(invitation: Invitation) {
    return invitation.used_count >= invitation.max_uses;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            초대 관리
          </h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              초대 코드 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 초대 코드</DialogTitle>
              <DialogDescription>초대 코드를 생성하여 새 멤버를 초대합니다</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-uses">최대 사용 횟수</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  max="20"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires">만료 기간 (일)</Label>
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  max="30"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateInvitation} disabled={loading}>
                {loading ? "생성 중..." : "생성"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {invitations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">아직 초대 코드가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          invitations.map((invitation) => {
            const expired = isExpired(invitation);
            const usedUp = isUsedUp(invitation);
            const active = !expired && !usedUp;

            return (
              <Card key={invitation.id} className={!active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-lg font-mono font-bold tracking-widest">
                          {invitation.code}
                        </code>
                        {active && <Badge>활성</Badge>}
                        {expired && <Badge variant="secondary">만료됨</Badge>}
                        {usedUp && <Badge variant="secondary">소진됨</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        사용: {invitation.used_count}/{invitation.max_uses}
                        {invitation.expires_at && ` · 만료: ${formatDate(invitation.expires_at)}`}
                        {` · 생성: ${formatDate(invitation.created_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.code, invitation.id)}
                        >
                          {copiedId === invitation.id ? (
                            <><Check className="mr-2 h-4 w-4" /> 복사됨</>
                          ) : (
                            <><Copy className="mr-2 h-4 w-4" /> 링크 복사</>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(invitation.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
