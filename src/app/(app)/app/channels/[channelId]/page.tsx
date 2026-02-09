"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatRelativeTime } from "@/lib/utils";
import type { Channel, PostWithAuthor } from "@/types/database";
import { Plus, Pin, MessageCircle, ArrowLeft } from "lucide-react";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const { user, membership } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const loadChannel = useCallback(async () => {
    const { data: channelData } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .single();
    if (channelData) setChannel(channelData);

    const { data: postsData } = await supabase
      .from("posts")
      .select("*, profiles(*)")
      .eq("channel_id", channelId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (postsData) setPosts(postsData as unknown as PostWithAuthor[]);
  }, [channelId, supabase]);

  useEffect(() => {
    loadChannel();

    // Subscribe to new posts
    const subscription = supabase
      .channel(`posts:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          loadChannel();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId, supabase, loadChannel]);

  async function handleCreatePost() {
    if (!newContent.trim() || !membership || !user) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("posts") as any).insert({
      channel_id: channelId,
      community_id: membership.community_id,
      author_id: user.id,
      title: newTitle || null,
      content: newContent,
      content_type: "text",
    });

    if (!error) {
      setNewTitle("");
      setNewContent("");
      setDialogOpen(false);
      await loadChannel();
    }
    setLoading(false);
  }

  if (channel?.type === "chat") {
    router.replace(`/app/channels/${channelId}/chat`);
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/app" className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold">#{channel?.name}</h1>
          </div>
          {channel?.description && (
            <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              글쓰기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 게시글</DialogTitle>
              <DialogDescription>#{channel?.name} 채널에 새 글을 작성합니다</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-title">제목 (선택)</Label>
                <Input
                  id="post-title"
                  placeholder="게시글 제목"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-content">내용 *</Label>
                <Textarea
                  id="post-content"
                  placeholder="내용을 입력하세요..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreatePost} disabled={loading || !newContent.trim()}>
                {loading ? "게시 중..." : "게시하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">아직 게시글이 없습니다</p>
              <p className="text-sm text-muted-foreground/60">첫 번째 글을 작성해 보세요</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/app/channels/${channelId}/post/${post.id}`}
            >
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={post.profiles.avatar_url || undefined} />
                      <AvatarFallback>
                        {post.profiles.display_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {post.profiles.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(post.created_at)}
                        </span>
                        {post.pinned && (
                          <Badge variant="secondary" className="text-xs">
                            <Pin className="mr-1 h-3 w-3" />
                            고정
                          </Badge>
                        )}
                      </div>
                      {post.title && (
                        <h3 className="font-semibold mb-1">{post.title}</h3>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
