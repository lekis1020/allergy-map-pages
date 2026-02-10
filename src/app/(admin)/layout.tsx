"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, membership } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Block non-admin users
  if (membership && membership.role !== "owner" && membership.role !== "admin") {
    router.replace("/app");
    return null;
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto px-4 pt-16 pb-4 md:px-6 md:pt-6 md:pb-6 safe-bottom">
          {children}
        </div>
      </main>
    </div>
  );
}
