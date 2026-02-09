"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity } from "@/hooks/use-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Save, ArrowLeft } from "lucide-react";

export default function AdminSettingsPage() {
  const { membership } = useAuth();
  const { community } = useCommunity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (community) {
      setName(community.name);
      setDescription(community.description || "");
    }
  }, [community]);

  async function handleSave() {
    if (!membership || !name.trim()) return;
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("communities") as any)
      .update({ name, description })
      .eq("id", membership.community_id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          커뮤니티 설정
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 설정</CardTitle>
          <CardDescription>커뮤니티의 기본 정보를 수정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community-name">커뮤니티 이름</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="community-desc">설명</Label>
            <Textarea
              id="community-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "저장 중..." : saved ? "저장됨" : "저장"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
