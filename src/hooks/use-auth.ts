"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const { user, membership, isLoading, setUser, setMembership, setLoading, reset } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double-initialization in strict mode
    if (initialized.current && !isLoading) return;
    initialized.current = true;

    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          reset();
          return;
        }

        // Load profile - may not exist yet if trigger hasn't fired
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          setUser(profile);
        } else {
          // Profile doesn't exist yet - set a minimal user object
          // This can happen with Google OAuth if the trigger hasn't completed
          setUser({
            id: authUser.id,
            display_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "사용자",
            email: authUser.email || null,
            auth_provider: "google",
            company: null,
            role_title: null,
            expertise: [],
            avatar_url: authUser.user_metadata?.avatar_url || null,
            bio: null,
            created_at: new Date().toISOString(),
          });
        }

        // Load membership - may not exist for new users
        const { data: member } = await supabase
          .from("community_members")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (member) {
          setMembership(member);
        }
      } catch {
        reset();
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        reset();
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, setUser, setMembership, setLoading, reset, isLoading]);

  async function signOut() {
    await supabase.auth.signOut();
    reset();
    router.push("/login");
  }

  return { user, membership, isLoading, signOut };
}
