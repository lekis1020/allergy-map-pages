"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeTime } from "@/lib/utils";
import type { Channel, MessageWithSender } from "@/types/database";
import { ArrowLeft, Send, Paperclip } from "lucide-react";

export default function ChatPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = useCallback(async () => {
    const { data: channelData } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .single();
    if (channelData) setChannel(channelData);

    const { data: messagesData } = await supabase
      .from("messages")
      .select("*, profiles(*)")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesData) {
      setMessages(messagesData as unknown as MessageWithSender[]);
    }
  }, [channelId, supabase]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch the new message with profile
          const { data } = await supabase
            .from("messages")
            .select("*, profiles(*)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data as unknown as MessageWithSender]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId, supabase]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    if (!user) {
      alert("로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      sender_id: user.id,
      content: newMessage,
    });

    if (error) {
      console.error("Message send error:", error);
      alert(`메시지 전송 실패: ${error.message}`);
    } else {
      setNewMessage("");
    }
    setSending(false);
  }

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col md:h-[calc(100dvh-3rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3">
        <Link href="/app" className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">#{channel?.name}</h1>
        {channel?.description && (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            — {channel.description}
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-muted-foreground">채팅을 시작해 보세요</p>
            </div>
          )}
          {messages.map((message) => {
            const messageDate = new Date(message.created_at).toLocaleDateString("ko-KR");
            const showDate = messageDate !== lastDate;
            lastDate = messageDate;
            const isOwn = message.sender_id === user?.id;

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground">{messageDate}</span>
                    <div className="flex-1 border-t" />
                  </div>
                )}
                <div className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.profiles.avatar_url || undefined} />
                    <AvatarFallback>
                      {message.profiles.display_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-medium">
                        {message.profiles.display_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={`inline-block rounded-lg px-3 py-2 text-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2 border-t pt-3">
        <Button type="button" variant="ghost" size="icon" className="shrink-0">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          placeholder="메시지를 입력하세요..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
