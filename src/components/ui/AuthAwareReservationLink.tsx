"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authClient";

type AuthResponse = {
  user?: {
    role?: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
    fullName?: string;
    branchId?: string | null;
  };
};

export function AuthAwareReservationLink({
  href,
  className,
  authenticatedLabel,
  unauthenticatedLabel,
}: {
  href: string;
  className?: string;
  authenticatedLabel: string;
  unauthenticatedLabel: string;
}) {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await authFetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as AuthResponse;
      if (!data.user?.role || !data.user.fullName) {
        return null;
      }

      return {
        role: data.user.role,
        fullName: data.user.fullName,
        branchId: data.user.branchId,
      };
    },
  });

  const authenticated = data?.role === "MEMBER";
  const target = authenticated
    ? href
    : `/login?next=${encodeURIComponent(href)}`;

  return (
    <Link href={target} className={className}>
      {authenticated ? authenticatedLabel : unauthenticatedLabel}
    </Link>
  );
}
