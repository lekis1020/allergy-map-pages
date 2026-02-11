"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity } from "@/hooks/use-community";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Hash,
  MessageSquare,
  FileText,
  FolderOpen,
  Users,
  Bell,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Menu,
  X,
  MapPin,
  Newspaper,
} from "lucide-react";
import { useState } from "react";

const channelTypeIcons: Record<string, typeof Hash> = {
  discussion: Hash,
  chat: MessageSquare,
  resource: FolderOpen,
  collaboration: FileText,
};

interface AppSidebarProps {
  unreadNotifications?: number;
}

export function AppSidebar({ unreadNotifications = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, membership, signOut } = useAuth();
  const { community, channels } = useCommunity();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = membership?.role === "owner" || membership?.role === "admin";

  const navItems = [
    { href: "/app", label: "홈", icon: Home },
    { href: "/app/members", label: "멤버", icon: Users },
    { href: "/app/resources", label: "자료실", icon: FolderOpen },
    { href: "/app/documents", label: "문서", icon: FileText },
    { href: "/app/today-papers", label: "오늘의 논문", icon: Newspaper },
    { href: "/app/allergy-map", label: "알레르기지도", icon: MapPin },
    {
      href: "/app/notifications",
      label: "알림",
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
  ];

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        {/* Community Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h2 className="text-lg font-semibold truncate">
            {community?.name || "KAACI_JR"}
          </h2>
          <ThemeToggle />
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {/* Navigation */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] px-1 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>

          <Separator className="my-4" />

          {/* Channels */}
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-semibold uppercase text-sidebar-foreground/50">
              채널
            </span>
          </div>
          <div className="space-y-1">
            {channels.map((channel) => {
              const Icon = channelTypeIcons[channel.type] || Hash;
              const channelHref = channel.type === "chat"
                ? `/app/channels/${channel.id}/chat`
                : `/app/channels/${channel.id}`;
              const isActive = pathname.startsWith(`/app/channels/${channel.id}`);
              return (
                <Link
                  key={channel.id}
                  href={channelHref}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{channel.name}</span>
                  {channel.type === "chat" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
                      실시간
                    </Badge>
                  )}
                </Link>
              );
            })}
            {channels.length === 0 && (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/40">
                아직 채널이 없습니다
              </p>
            )}
          </div>

          {/* Admin */}
          {isAdmin && (
            <>
              <Separator className="my-4" />
              <div className="mb-2 px-3">
                <span className="text-xs font-semibold uppercase text-sidebar-foreground/50">
                  관리
                </span>
              </div>
              <div className="space-y-1">
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  <span>운영자 대시보드</span>
                </Link>
              </div>
            </>
          )}
        </ScrollArea>

        {/* User */}
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || undefined} />
                  <AvatarFallback>
                    {user?.display_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium leading-none truncate">
                    {user?.display_name || "사용자"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.role_title || user?.email}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/app/settings" onClick={() => setMobileOpen(false)}>
                  <Settings className="mr-2 h-4 w-4" />
                  설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile toggle - respects safe area for notched phones */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-2 z-50 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm border md:hidden"
        style={{ top: "max(0.5rem, env(safe-area-inset-top, 0.5rem))" }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-dvh w-64 flex-shrink-0 flex-col border-r bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar - safe area aware */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-sidebar shadow-xl transition-transform duration-200 md:hidden safe-top safe-bottom",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
