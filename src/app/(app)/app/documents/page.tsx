"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { Document, Profile } from "@/types/database";
import { FileText, Plus, Search } from "lucide-react";

type DocumentWithAuthor = Document & { profiles: Profile };

export default function DocumentsPage() {
  const { user, membership } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithAuthor[]>([]);
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadDocuments() {
      if (!membership) return;
      const { data } = await supabase
        .from("documents")
        .select("*, profiles:author_id(*)")
        .eq("community_id", membership.community_id)
        .order("updated_at", { ascending: false });

      if (data) setDocuments(data as unknown as DocumentWithAuthor[]);
    }
    loadDocuments();
  }, [membership, supabase]);

  async function handleCreateDocument() {
    if (!newTitle.trim()) return;
    if (!user || !membership) {
      alert("로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("documents")
      .insert({
        community_id: membership.community_id,
        title: newTitle,
        content: "",
        author_id: user.id,
        last_edited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Document creation error:", error);
      alert(`문서 생성 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    if (data) {
      setNewTitle("");
      setDialogOpen(false);
      window.location.href = `/app/documents/${data.id}`;
    }
    setLoading(false);
  }

  const filteredDocs = documents.filter((d) => {
    if (!search) return true;
    return d.title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold flex items-center gap-2 sm:text-2xl">
          <FileText className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          공유 문서
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              새 문서
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 문서 만들기</DialogTitle>
              <DialogDescription>공유 문서를 생성합니다</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-title">문서 제목</Label>
                <Input
                  id="doc-title"
                  placeholder="문서 제목을 입력하세요"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateDocument} disabled={loading || !newTitle.trim()}>
                {loading ? "생성 중..." : "생성"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="문서 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filteredDocs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">아직 문서가 없습니다</p>
              <p className="text-sm text-muted-foreground/60">새 문서를 만들어 보세요</p>
            </CardContent>
          </Card>
        ) : (
          filteredDocs.map((doc) => (
            <Link key={doc.id} href={`/app/documents/${doc.id}`}>
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={doc.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {doc.profiles.display_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {doc.profiles.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {formatRelativeTime(doc.updated_at)}
                        </span>
                      </div>
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
