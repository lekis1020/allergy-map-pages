"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import type { PostWithAuthor } from "@/types/database";
import { FolderOpen, Upload, FileText, Image, File, Search, Download, X } from "lucide-react";

const fileTypeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  image: Image,
  default: File,
};

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return Image;
  if (ext === "pdf") return FileText;
  return File;
}

function isImageFile(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
}

export default function ResourcesPage() {
  const { user, membership } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadResources() {
      if (!membership) return;

      // Load posts from resource channels that have attachments
      const { data: resourceChannels } = await supabase
        .from("channels")
        .select("id")
        .eq("community_id", membership.community_id)
        .eq("type", "resource");

      if (!resourceChannels?.length) {
        // Also load any posts with attachments from any channel
        const { data } = await supabase
          .from("posts")
          .select("*, profiles(*)")
          .eq("community_id", membership.community_id)
          .not("attachments", "eq", "[]")
          .order("created_at", { ascending: false })
          .limit(50);

        if (data) setPosts(data as unknown as PostWithAuthor[]);
        return;
      }

      const channelIds = resourceChannels.map((c) => c.id);
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setPosts(data as unknown as PostWithAuthor[]);
    }
    loadResources();
  }, [membership, supabase]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    if (!user || !membership) {
      alert("로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setUploading(true);

    try {
      const attachments: Array<{ url: string; filename: string; size: number; type: string }> = [];

      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          alert(`${file.name}의 크기가 50MB를 초과합니다.`);
          continue;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
        const path = `${membership.community_id}/${user.id}/${Date.now()}-${safeName}`;
        const { data, error } = await supabase.storage
          .from("attachments")
          .upload(path, file);

        if (error) {
          console.error("Storage upload error:", error);
          alert(`파일 업로드 실패: ${file.name}\n${error.message}`);
          continue;
        }

        if (data) {
          const { data: urlData } = supabase.storage
            .from("attachments")
            .getPublicUrl(data.path);

          attachments.push({
            url: urlData.publicUrl,
            filename: file.name,
            size: file.size,
            type: file.type,
          });
        }
      }

      if (attachments.length > 0) {
        // Find or use first resource channel
        const { data: channels } = await supabase
          .from("channels")
          .select("id")
          .eq("community_id", membership.community_id)
          .eq("type", "resource")
          .limit(1);

        const channelId = channels?.[0]?.id;
        if (!channelId) {
          alert("자료 공유 채널이 없습니다. 관리자에게 문의하세요.");
          setUploading(false);
          return;
        }

        const { error: postError } = await supabase.from("posts").insert({
          channel_id: channelId,
          community_id: membership.community_id,
          author_id: user.id,
          content: `파일 공유: ${attachments.map((a) => a.filename).join(", ")}`,
          content_type: "text",
          attachments: JSON.parse(JSON.stringify(attachments)),
        });

        if (postError) {
          console.error("Post creation error:", postError);
          alert(`게시글 생성 실패: ${postError.message}`);
        } else {
          // Reload resources
          const { data: resourceChannels } = await supabase
            .from("channels")
            .select("id")
            .eq("community_id", membership.community_id)
            .eq("type", "resource");

          if (resourceChannels?.length) {
            const channelIds = resourceChannels.map((c) => c.id);
            const { data: newPosts } = await supabase
              .from("posts")
              .select("*, profiles(*)")
              .in("channel_id", channelIds)
              .order("created_at", { ascending: false })
              .limit(50);

            if (newPosts) setPosts(newPosts as unknown as PostWithAuthor[]);
          }
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("파일 업로드 중 오류가 발생했습니다.");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filteredPosts = posts.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      p.profiles.display_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="h-6 w-6" />
          자료실
        </h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "업로드 중..." : "파일 업로드"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="자료 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">아직 공유된 자료가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => {
            const attachments = (post.attachments as Array<{ url: string; filename: string; size: number; type: string }>) || [];
            return (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={post.profiles.avatar_url || undefined} />
                      <AvatarFallback>{post.profiles.display_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">{post.profiles.display_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(post.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mb-3">{post.content}</p>
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          {/* Image previews */}
                          {attachments.filter((att) => isImageFile(att.filename)).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {attachments
                                .filter((att) => isImageFile(att.filename))
                                .map((att, i) => (
                                  <button
                                    key={`img-${i}`}
                                    onClick={() => setLightboxUrl(att.url)}
                                    className="relative aspect-square rounded-md overflow-hidden border hover:opacity-80 transition-opacity cursor-pointer bg-muted"
                                  >
                                    <img
                                      src={att.url}
                                      alt={att.filename}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  </button>
                                ))}
                            </div>
                          )}
                          {/* Non-image files */}
                          {attachments
                            .filter((att) => !isImageFile(att.filename))
                            .map((att, i) => {
                              const Icon = getFileIcon(att.filename);
                              return (
                                <a
                                  key={`file-${i}`}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent transition-colors"
                                >
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="flex-1 truncate">{att.filename}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {(att.size / 1024).toFixed(0)}KB
                                  </span>
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </a>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="미리보기"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white hover:bg-black/70 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            원본 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
