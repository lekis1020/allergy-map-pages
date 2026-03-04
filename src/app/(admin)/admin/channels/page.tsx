"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Channel } from "@/types/database";
import { Hash, Plus, ArrowLeft, Trash2, MessageSquare, FolderOpen, FileText } from "lucide-react";

const channelTypeLabels: Record<string, string> = {
  discussion: "토론",
  chat: "채팅",
  resource: "자료",
  collaboration: "협업",
};

const channelTypeIcons: Record<string, typeof Hash> = {
  discussion: Hash,
  chat: MessageSquare,
  resource: FolderOpen,
  collaboration: FileText,
};

export default function AdminChannelsPage() {
  const { membership } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<Channel["type"]>("discussion");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadChannels();
  }, [membership]);

  async function loadChannels() {
    if (!membership) return;
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("community_id", membership.community_id)
      .order("sort_order");
    if (data) setChannels(data);
  }

  async function handleCreateChannel() {
    if (!newName.trim() || !membership) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("channels") as any).insert({
      community_id: membership.community_id,
      name: newName,
      description: newDescription || null,
      type: newType,
      sort_order: channels.length,
    });

    setNewName("");
    setNewDescription("");
    setNewType("discussion");
    setDialogOpen(false);
    setLoading(false);
    await loadChannels();
  }

  async function handleDeleteChannel(id: string) {
    if (!confirm("이 채널과 모든 게시글/메시지가 삭제됩니다. 계속하시겠습니까?")) return;
    await supabase.from("channels").delete().eq("id", id);
    await loadChannels();
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2 sm:text-2xl">
            <Hash className="h-5 w-5 sm:h-6 sm:w-6" />
            채널 관리
          </h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              채널 만들기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 채널</DialogTitle>
              <DialogDescription>KAAACI_JR에 새 채널을 추가합니다</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">채널 이름</Label>
                <Input
                  id="channel-name"
                  placeholder="일반-토론"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel-desc">설명 (선택)</Label>
                <Textarea
                  id="channel-desc"
                  placeholder="이 채널에 대한 설명"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>채널 유형</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["discussion", "chat", "resource", "collaboration"] as const).map((type) => {
                    const Icon = channelTypeIcons[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewType(type)}
                        className={`flex items-center gap-2 rounded-md border p-3 text-sm transition-colors ${
                          newType === type
                            ? "border-primary bg-primary/5"
                            : "border-input hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {channelTypeLabels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateChannel} disabled={loading || !newName.trim()}>
                {loading ? "생성 중..." : "생성"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {channels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Hash className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">아직 채널이 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          channels.map((channel) => {
            const Icon = channelTypeIcons[channel.type] || Hash;
            return (
              <Card key={channel.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{channel.name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {channelTypeLabels[channel.type]}
                        </Badge>
                        {channel.is_default && (
                          <Badge variant="outline" className="text-xs">기본</Badge>
                        )}
                      </div>
                      {channel.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {channel.description}
                        </p>
                      )}
                    </div>
                    {!channel.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
