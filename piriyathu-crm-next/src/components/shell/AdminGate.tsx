"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppCard } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type MeResponse = {
  id: string;
  roles: string[];
};

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch<MeResponse>("/auth/me")
      .then((me) => {
        if (!mounted) return;
        const isAdmin = me.roles.includes("BUSINESS_ADMIN");
        setAllowed(isAdmin);
        setLoading(false);
        if (!isAdmin) {
          router.replace("/forbidden");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setAllowed(false);
        setLoading(false);
        router.replace("/login");
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <AppCard className="text-base-content/70">Checking admin access...</AppCard>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
