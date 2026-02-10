"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Hash, Ticket, Settings } from "lucide-react";

export default function AdminDashboardPage() {
  const { membership } = useAuth();
  const [stats, setStats] = useState({
    members: 0,
    pendingMembers: 0,
    channels: 0,
    activeInvites: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      if (!membership) return;
      const communityId = membership.community_id;

      const { count: memberCount } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active");

      const { count: pendingCount } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "pending");

      const { count: channelCount } = await supabase
        .from("channels")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);

      const { count: inviteCount } = await supabase
        .from("invitations")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .gt("expires_at", new Date().toISOString());

      setStats({
        members: memberCount || 0,
        pendingMembers: pendingCount || 0,
        channels: channelCount || 0,
        activeInvites: inviteCount || 0,
      });
    }
    loadStats();
  }, [membership, supabase]);

  const adminLinks = [
    {
      href: "/admin/members",
      icon: Users,
      label: "멤버 관리",
      description: "멤버 초대, 승인, 역할 변경",
      stat: `${stats.members}명 활동 중${stats.pendingMembers > 0 ? ` · ${stats.pendingMembers}명 대기` : ""}`,
    },
    {
      href: "/admin/invitations",
      icon: Ticket,
      label: "초대 관리",
      description: "초대 코드 생성 및 관리",
      stat: `${stats.activeInvites}개 활성`,
    },
    {
      href: "/admin/channels",
      icon: Hash,
      label: "채널 관리",
      description: "채널 생성, 수정, 삭제",
      stat: `${stats.channels}개 채널`,
    },
    {
      href: "/admin/settings",
      icon: Settings,
      label: "KAACI_JR 설정",
      description: "KAACI_JR 이름, 설명 등",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <h1 className="text-lg font-bold flex items-center gap-2 sm:text-2xl">
        <Shield className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
        운영자 대시보드
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {adminLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                      {item.stat && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.stat}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
