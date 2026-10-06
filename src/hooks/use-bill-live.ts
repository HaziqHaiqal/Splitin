"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { browserClient } from "@/lib/supabase/browser";

export function useBillLive(billId: string) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const client = browserClient();
    const channel = client?.channel(`bill:${billId}`).on("broadcast", { event: "changed" }, refresh).subscribe();

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [billId, router]);
}
