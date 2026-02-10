"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { PostWithAuthor, CommentWithAuthor } from "@/types/database";
import { ArrowLeft, Pin, Send, MessageCircle, Trash2 } from "lucide-react";

export default function PostDetailPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const postId = params.postId as string;
  const { user } = useAuth();
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const loadPost = useCallback(async () => {
    const { data: postData } = await supabase
      .from("posts")
      .select("*, profiles(*)")
      .eq("id", postId)
      .single();
    if (postData) setPost(postData as unknown as PostWithAuthor);

    const { data: commentsData } = await supabase
      .from("comments")
      .select("*, profiles(*)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (commentsData) setComments(commentsData as unknown as CommentWithAuthor[]);
  }, [postId, supabase]);

  useEffect(() => {
    loadPost();

    const subscription = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          loadPost();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [postId, supabase, loadPost]);

  async function handleAddComment() {
    if (!newComment.trim() || !user) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("comments") as any).insert({
      post_id: postId,
      author_id: user.id,
      content: newComment,
      parent_id: replyTo,
    });

    if (!error) {
      setNewComment("");
      setReplyTo(null);
      await loadPost();
    }
    setLoading(false);
  }

  async function handleDeleteComment(commentId: string) {
    await supabase.from("comments").delete().eq("id", commentId);
    await loadPost();
  }

  // Organize comments into threads
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesMap = comments.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {} as Record<string, CommentWithAuthor[]>);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <Link
        href={`/app/channels/${channelId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        채널로 돌아가기
      </Link>

      {post && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                <AvatarImage src={post.profiles.avatar_url || undefined} />
                <AvatarFallback>{post.profiles.display_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{post.profiles.display_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatRelativeTime(post.created_at)}
                  </span>
                  {post.pinned && (
                    <Badge variant="secondary">
                      <Pin className="mr-1 h-3 w-3" />
                      고정됨
                    </Badge>
                  )}
                </div>
                {post.title && <h1 className="text-xl font-bold mb-3">{post.title}</h1>}
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{post.content}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Comments */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          댓글 {comments.length > 0 && `(${comments.length})`}
        </h2>

        <div className="space-y-4">
          {topLevelComments.map((comment) => (
            <div key={comment.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profiles.avatar_url || undefined} />
                  <AvatarFallback>{comment.profiles.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.profiles.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyTo(comment.id)}
                    >
                      답글
                    </button>
                    {user?.id === comment.author_id && (
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Replies */}
              {repliesMap[comment.id]?.map((reply) => (
                <div key={reply.id} className="ml-8 sm:ml-11 flex items-start gap-3">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={reply.profiles.avatar_url || undefined} />
                    <AvatarFallback>{reply.profiles.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{reply.profiles.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(reply.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                    {user?.id === reply.author_id && (
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive mt-1"
                        onClick={() => handleDeleteComment(reply.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Comment Input */}
        <div className="mt-6">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>답글 작성 중...</span>
              <button
                className="text-xs hover:text-foreground"
                onClick={() => setReplyTo(null)}
              >
                취소
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="댓글을 입력하세요..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAddComment();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={loading || !newComment.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ctrl+Enter로 댓글 작성
          </p>
        </div>
      </div>
    </div>
  );
}
