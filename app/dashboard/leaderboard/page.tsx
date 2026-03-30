"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";
import { hasAppAccess } from "@/lib/firebase/firestore";

export default function LeaderboardPage() {
  const { loading, user, profile } = useAuth();
  const router = useRouter();
  const hasUrbexAccess = hasAppAccess(profile, "urbex-db");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !hasUrbexAccess) {
      router.replace("/dashboard");
      return;
    }

    if (!loading && user && hasUrbexAccess) {
      router.replace("/dashboard/urbex-db#leaderboard");
    }
  }, [hasUrbexAccess, loading, router, user]);

  return (
    <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
      Redirecting to the Urbex DB leaderboard...
    </main>
  );
}
