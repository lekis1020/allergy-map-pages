"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth() {
  const { user, membership, isLoading, setUser, setMembership, setLoading, reset } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          reset();
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          setUser(profile);
        }

        const { data: member } = await supabase
          .from("community_members")
          .select("*")
          .eq("user_id", authUser.id)
          .eq("status", "active")
          .limit(1)
          .single();

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
  }, [supabase, router, setUser, setMembership, setLoading, reset]);

  async function signOut() {
    await supabase.auth.signOut();
    reset();
    router.push("/login");
  }

  return { user, membership, isLoading, signOut };
}
