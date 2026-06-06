"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      }),
    [],
  );

  useEffect(() => {
    function invalidateAll() {
      void queryClient.invalidateQueries();
    }

    function invalidateAuth() {
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    }

    window.addEventListener("app:data-changed", invalidateAll);
    window.addEventListener("bookings:changed", invalidateAll);
    window.addEventListener("auth:changed", invalidateAuth);

    return () => {
      window.removeEventListener("app:data-changed", invalidateAll);
      window.removeEventListener("bookings:changed", invalidateAll);
      window.removeEventListener("auth:changed", invalidateAuth);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
