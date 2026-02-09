import { create } from "zustand";
import type { Profile, CommunityMember } from "@/types/database";

interface AuthState {
  user: Profile | null;
  membership: CommunityMember | null;
  isLoading: boolean;
  setUser: (user: Profile | null) => void;
  setMembership: (membership: CommunityMember | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  membership: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setMembership: (membership) => set({ membership }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, membership: null, isLoading: false }),
}));
