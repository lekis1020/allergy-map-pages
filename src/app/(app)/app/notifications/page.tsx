"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Notification } from "@/types/database";
import { Bell, Check, CheckCheck, MessageCircle, UserPlus, FileText, AtSign } from "lucide-react";

const notifIcons: Record<string, typeof Bell> = {
  mention: AtSign,
  reply: MessageCircle,
  new_post: FileText,
  invite: UserPlus,
  default: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadNotifications() {
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setNotifications(data);
    }
    loadNotifications();

    // Subscribe to new notifications
    const subscription = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, supabase]);

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2 sm:text-2xl">
          <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
          알림
          {unreadCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({unreadCount}개 읽지 않음)
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            모두 읽음
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">알림이 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notif) => {
            const Icon = notifIcons[notif.type] || notifIcons.default;
            return (
              <Card
                key={notif.id}
                className={cn(
                  "transition-colors",
                  !notif.is_read && "bg-primary/5 border-primary/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 rounded-full p-2",
                      !notif.is_read ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {notif.link ? (
                        <Link
                          href={notif.link}
                          onClick={() => !notif.is_read && markAsRead(notif.id)}
                          className="block"
                        >
                          <p className={cn("text-sm", !notif.is_read && "font-medium")}>
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {notif.body}
                            </p>
                          )}
                        </Link>
                      ) : (
                        <div>
                          <p className={cn("text-sm", !notif.is_read && "font-medium")}>
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {notif.body}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => markAsRead(notif.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
