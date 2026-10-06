"use client";

import { useSyncExternalStore } from "react";

/** The width where the app switches to its desktop layout. */
const DESKTOP = "(min-width: 768px)";

/** True on desktop-width screens. Always false on the server and during the first render. */
export function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}
