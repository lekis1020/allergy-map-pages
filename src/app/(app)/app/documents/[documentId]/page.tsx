"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { Document } from "@/types/database";
import { ArrowLeft, Save, Check } from "lucide-react";

export default function DocumentEditorPage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { user } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const loadDocument = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (data) {
      setDoc(data);
      setTitle(data.title);
      setContent(data.content || "");
    }
  }, [documentId, supabase]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const saveDocument = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("documents")
      .update({
        title,
        content,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [title, content, documentId, user, supabase]);

  // Auto-save with debounce
  useEffect(() => {
    if (!doc) return;
    if (title === doc.title && content === (doc.content || "")) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveDocument();
    }, 2000);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [title, content, doc, saveDocument]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/app/documents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          문서 목록
        </Link>
        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              저장됨
            </Badge>
          )}
          {doc && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              마지막 수정: {formatRelativeTime(doc.updated_at)}
            </span>
          )}
          <Button size="sm" onClick={saveDocument} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xl font-bold border-none shadow-none focus-visible:ring-0 px-0"
        placeholder="문서 제목"
      />

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[calc(100dvh-250px)] resize-none border-none shadow-none focus-visible:ring-0 px-0 text-base leading-relaxed"
        placeholder="여기에 내용을 작성하세요... (Markdown 지원)"
      />
    </div>
  );
}
