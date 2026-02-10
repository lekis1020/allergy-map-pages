"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MemberWithProfile } from "@/types/database";
import { Users, MoreVertical, Shield, ShieldOff, UserX, UserCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function AdminMembersPage() {
  const { membership } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<MemberWithProfile[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadMembers();
  }, [membership]);

  async function loadMembers() {
    if (!membership) return;
    const communityId = membership.community_id;

    const { data: activeData } = await supabase
      .from("community_members")
      .select("*, profiles(*)")
      .eq("community_id", communityId)
      .eq("status", "active")
      .order("joined_at");
    if (activeData) setMembers(activeData as unknown as MemberWithProfile[]);

    const { data: pendingData } = await supabase
      .from("community_members")
      .select("*, profiles(*)")
      .eq("community_id", communityId)
      .eq("status", "pending")
      .order("joined_at");
    if (pendingData) setPendingMembers(pendingData as unknown as MemberWithProfile[]);
  }

  async function updateMemberRole(userId: string, role: "admin" | "member") {
    if (!membership) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("community_members") as any)
      .update({ role })
      .eq("community_id", membership.community_id)
      .eq("user_id", userId);
    await loadMembers();
  }

  async function updateMemberStatus(userId: string, status: "active" | "suspended") {
    if (!membership) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("community_members") as any)
      .update({ status })
      .eq("community_id", membership.community_id)
      .eq("user_id", userId);
    await loadMembers();
  }

  async function approveMember(userId: string) {
    if (!membership) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("community_members") as any)
      .update({ status: "active" })
      .eq("community_id", membership.community_id)
      .eq("user_id", userId);
    await loadMembers();
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return "운영자";
      case "admin": return "부운영자";
      default: return "멤버";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2 sm:text-2xl">
          <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          멤버 관리
        </h1>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            활동 멤버 ({members.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            승인 대기 ({pendingMembers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profiles.avatar_url || undefined} />
                    <AvatarFallback>{member.profiles.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.profiles.display_name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {roleLabel(member.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.profiles.email} · 가입: {formatDate(member.joined_at)}
                    </p>
                  </div>
                  {member.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === "member" ? (
                          <DropdownMenuItem onClick={() => updateMemberRole(member.user_id, "admin")}>
                            <Shield className="mr-2 h-4 w-4" />
                            부운영자로 변경
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateMemberRole(member.user_id, "member")}>
                            <ShieldOff className="mr-2 h-4 w-4" />
                            일반 멤버로 변경
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => updateMemberStatus(member.user_id, "suspended")}
                          className="text-destructive"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          정지
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingMembers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <p className="text-muted-foreground">승인 대기 중인 멤버가 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            pendingMembers.map((member) => (
              <Card key={member.user_id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profiles.avatar_url || undefined} />
                      <AvatarFallback>{member.profiles.display_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{member.profiles.display_name}</p>
                      <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                    </div>
                    <Button size="sm" onClick={() => approveMember(member.user_id)}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      승인
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
