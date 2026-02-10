"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { MemberWithProfile } from "@/types/database";
import { Users, Search } from "lucide-react";

export default function MembersPage() {
  const { membership } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function loadMembers() {
      if (!membership) return;
      const { data } = await supabase
        .from("community_members")
        .select("*, profiles(*)")
        .eq("community_id", membership.community_id)
        .eq("status", "active")
        .order("joined_at", { ascending: true });

      if (data) setMembers(data as unknown as MemberWithProfile[]);
    }
    loadMembers();
  }, [membership, supabase]);

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.profiles.display_name.toLowerCase().includes(q) ||
      m.profiles.company?.toLowerCase().includes(q) ||
      m.profiles.role_title?.toLowerCase().includes(q) ||
      m.profiles.expertise?.some((e) => e.toLowerCase().includes(q))
    );
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return "운영자";
      case "admin": return "부운영자";
      default: return "멤버";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2 sm:text-2xl">
          <Users className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          멤버 ({members.length})
        </h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="이름, 소속, 전문분야로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filteredMembers.map((member) => (
          <Link key={member.user_id} href={`/app/members/${member.user_id}`}>
            <Card className="transition-colors hover:bg-accent/50 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profiles.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.profiles.display_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{member.profiles.display_name}</p>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {roleLabel(member.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {[member.profiles.company, member.profiles.role_title]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {member.profiles.expertise && member.profiles.expertise.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {member.profiles.expertise.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
