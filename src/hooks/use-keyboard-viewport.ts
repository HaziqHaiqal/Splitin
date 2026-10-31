"use client";

import { useEffect, useState, type RefObject } from "react";

export function useKeyboardViewport(container: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState<{ bottom: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement && Boolean(container.current?.contains(active));
      setViewport(typing && vv.scale === 1 ? { bottom: vv.offsetTop + vv.height, height: vv.height } : null);
    };
    const settle = () => requestAnimationFrame(update);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", settle);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", settle);
    };
  }, [container]);

  return viewport;
}
