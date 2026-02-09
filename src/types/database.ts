export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          auth_provider: string | null;
          company: string | null;
          role_title: string | null;
          expertise: string[] | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          auth_provider?: string | null;
          company?: string | null;
          role_title?: string | null;
          expertise?: string[] | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string | null;
          auth_provider?: string | null;
          company?: string | null;
          role_title?: string | null;
          expertise?: string[] | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
      };
      communities: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string | null;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id?: string | null;
          settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string | null;
          settings?: Json;
          created_at?: string;
        };
      };
      community_members: {
        Row: {
          community_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          status: "active" | "pending" | "suspended";
          joined_at: string;
        };
        Insert: {
          community_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          status?: "active" | "pending" | "suspended";
          joined_at?: string;
        };
        Update: {
          community_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          status?: "active" | "pending" | "suspended";
          joined_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          community_id: string;
          code: string;
          invited_by: string | null;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          code: string;
          invited_by?: string | null;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          code?: string;
          invited_by?: string | null;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
      };
      channels: {
        Row: {
          id: string;
          community_id: string;
          name: string;
          description: string | null;
          type: "discussion" | "chat" | "resource" | "collaboration";
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          name: string;
          description?: string | null;
          type?: "discussion" | "chat" | "resource" | "collaboration";
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          name?: string;
          description?: string | null;
          type?: "discussion" | "chat" | "resource" | "collaboration";
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          channel_id: string;
          community_id: string;
          author_id: string;
          title: string | null;
          content: string;
          content_type: "text" | "markdown" | "link";
          pinned: boolean;
          attachments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          community_id: string;
          author_id: string;
          title?: string | null;
          content: string;
          content_type?: "text" | "markdown" | "link";
          pinned?: boolean;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          community_id?: string;
          author_id?: string;
          title?: string | null;
          content?: string;
          content_type?: "text" | "markdown" | "link";
          pinned?: boolean;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          parent_id?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          channel_id: string;
          sender_id: string;
          content: string;
          attachments: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          sender_id: string;
          content: string;
          attachments?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel_id?: string;
          sender_id?: string;
          content?: string;
          attachments?: Json;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          community_id: string;
          title: string;
          content: string | null;
          author_id: string;
          last_edited_by: string | null;
          is_shared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          title: string;
          content?: string | null;
          author_id: string;
          last_edited_by?: string | null;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          title?: string;
          content?: string | null;
          author_id?: string;
          last_edited_by?: string | null;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type CommunityMember = Database["public"]["Tables"]["community_members"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// Extended types with joins
export type PostWithAuthor = Post & {
  profiles: Profile;
  comment_count?: number;
};

export type CommentWithAuthor = Comment & {
  profiles: Profile;
};

export type MessageWithSender = Message & {
  profiles: Profile;
};

export type MemberWithProfile = CommunityMember & {
  profiles: Profile;
};
