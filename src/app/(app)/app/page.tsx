"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity } from "@/hooks/use-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { PostWithAuthor, MemberWithProfile } from "@/types/database";
import { MessageSquare, FileText, Users, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user, membership } = useAuth();
  const { community, channels } = useCommunity();
  const [recentPosts, setRecentPosts] = useState<PostWithAuthor[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [stats, setStats] = useState({ posts: 0, members: 0, channels: 0 });
  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      if (!membership) return;
      const communityId = membership.community_id;

      // Load recent posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (postsData) {
        setRecentPosts(postsData as unknown as PostWithAuthor[]);
      }

      // Load active members
      const { data: membersData } = await supabase
        .from("community_members")
        .select("*, profiles(*)")
        .eq("community_id", communityId)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(5);

      if (membersData) {
        setMembers(membersData as unknown as MemberWithProfile[]);
      }

      // Stats
      const { count: postCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);

      const { count: memberCount } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active");

      setStats({
        posts: postCount || 0,
        members: memberCount || 0,
        channels: channels.length,
      });
    }

    loadDashboard();
  }, [membership, supabase, channels.length]);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {/* Welcome */}
      <div>
        <h1 className="text-lg font-bold sm:text-2xl truncate">
          안녕하세요, {user?.display_name}님
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {community?.name || "KAACI_JR"}에 오신 것을 환영합니다
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="flex flex-col items-center p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="rounded-full bg-primary/10 p-1.5 sm:p-2 mb-1 sm:mb-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold sm:text-2xl">{stats.members}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">멤버</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="rounded-full bg-primary/10 p-1.5 sm:p-2 mb-1 sm:mb-0">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold sm:text-2xl">{stats.posts}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">게시글</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="rounded-full bg-primary/10 p-1.5 sm:p-2 mb-1 sm:mb-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold sm:text-2xl">{stats.channels}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">채널</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              최근 게시글
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 게시글이 없습니다</p>
            ) : (
              recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/app/channels/${post.channel_id}/post/${post.id}`}
                  className="flex items-start gap-2 sm:gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                    <AvatarImage src={post.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {post.profiles.display_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {post.title || post.content.slice(0, 50)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {post.profiles.display_name} · {formatRelativeTime(post.created_at)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              최근 참여 멤버
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 멤버가 없습니다</p>
            ) : (
              members.map((member) => (
                <Link
                  key={member.user_id}
                  href={`/app/members/${member.user_id}`}
                  className="flex items-center gap-2 sm:gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                    <AvatarImage src={member.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.profiles.display_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.profiles.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.profiles.company}
                      {member.profiles.role_title && ` · ${member.profiles.role_title}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                    {member.role === "owner" ? "운영자" : member.role === "admin" ? "부운영자" : "멤버"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
