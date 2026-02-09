import { create } from "zustand";
import type { Channel, Community } from "@/types/database";

interface CommunityState {
  community: Community | null;
  channels: Channel[];
  activeChannelId: string | null;
  setCommunity: (community: Community | null) => void;
  setChannels: (channels: Channel[]) => void;
  setActiveChannelId: (id: string | null) => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  community: null,
  channels: [],
  activeChannelId: null,
  setCommunity: (community) => set({ community }),
  setChannels: (channels) => set({ channels }),
  setActiveChannelId: (activeChannelId) => set({ activeChannelId }),
}));
