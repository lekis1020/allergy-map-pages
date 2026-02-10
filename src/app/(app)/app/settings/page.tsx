"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Save, Upload } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setCompany(user.company || "");
      setRoleTitle(user.role_title || "");
      setExpertise(user.expertise?.join(", ") || "");
      setBio(user.bio || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const expertiseArray = expertise
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        company,
        role_title: roleTitle,
        expertise: expertiseArray,
        bio,
      })
      .eq("id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지 크기는 2MB 이하여야 합니다.");
      return;
    }

    const path = `${user.id}/${Date.now()}-avatar`;
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(data.path);

      setAvatarUrl(urlData.publicUrl);

      await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold flex items-center gap-2 sm:text-2xl">
        <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
        설정
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            프로필
          </CardTitle>
          <CardDescription>프로필 정보를 수정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-xl">
                {displayName?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    사진 변경
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-1">2MB 이하 이미지</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">이름</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">소속 / 회사</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-title">직함</Label>
              <Input
                id="role-title"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expertise">전문분야</Label>
              <Input
                id="expertise"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                placeholder="콤마로 구분"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">자기소개</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "저장 중..." : saved ? "저장됨" : "프로필 저장"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
