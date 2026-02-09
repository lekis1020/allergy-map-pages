"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Profile, CommunityMember, PostWithAuthor } from "@/types/database";
import { ArrowLeft, Building, Briefcase, Calendar } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberInfo, setMemberInfo] = useState<CommunityMember | null>(null);
  const [recentPosts, setRecentPosts] = useState<PostWithAuthor[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", memberId)
        .single();
      if (profileData) setProfile(profileData);

      const { data: memberData } = await supabase
        .from("community_members")
        .select("*")
        .eq("user_id", memberId)
        .eq("status", "active")
        .limit(1)
        .single();
      if (memberData) setMemberInfo(memberData);

      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("author_id", memberId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (postsData) setRecentPosts(postsData as unknown as PostWithAuthor[]);
    }
    loadProfile();
  }, [memberId, supabase]);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/app/members"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        멤버 목록
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {profile.display_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                {memberInfo && (
                  <Badge variant="secondary">
                    {memberInfo.role === "owner" ? "운영자" : memberInfo.role === "admin" ? "부운영자" : "멤버"}
                  </Badge>
                )}
              </div>
              {profile.bio && (
                <p className="mt-2 text-muted-foreground">{profile.bio}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground justify-center sm:justify-start">
                {profile.company && (
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" /> {profile.company}
                  </span>
                )}
                {profile.role_title && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" /> {profile.role_title}
                  </span>
                )}
                {memberInfo && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {formatDate(memberInfo.joined_at)} 가입
                  </span>
                )}
              </div>
              {profile.expertise && profile.expertise.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 justify-center sm:justify-start">
                  {profile.expertise.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">최근 작성글</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/app/channels/${post.channel_id}/post/${post.id}`}
                  className="block rounded-md p-3 transition-colors hover:bg-accent"
                >
                  <p className="font-medium">{post.title || post.content.slice(0, 60)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(post.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
