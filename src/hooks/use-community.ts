"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCommunityStore } from "@/stores/community-store";
import { useAuthStore } from "@/stores/auth-store";

export function useCommunity() {
  const { community, channels, setCommunity, setChannels } = useCommunityStore();
  const { membership } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadCommunity() {
      if (!membership) return;

      const { data: communityData } = await supabase
        .from("communities")
        .select("*")
        .eq("id", membership.community_id)
        .single();

      if (communityData) {
        setCommunity(communityData);
      }

      const { data: channelsData } = await supabase
        .from("channels")
        .select("*")
        .eq("community_id", membership.community_id)
        .order("sort_order", { ascending: true });

      if (channelsData) {
        setChannels(channelsData);
      }
    }

    loadCommunity();
  }, [membership, supabase, setCommunity, setChannels]);

  return { community, channels };
}
