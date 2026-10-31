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

  const typing = viewport !== null;

  useEffect(() => {
    if (!typing) return;
    let startX = 0;
    let startY = 0;
    const start = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length > 1 || !e.cancelable) return;
      const panel = container.current;
      if (panel && e.target instanceof Node && panel.contains(e.target)) {
        const sideways = Math.abs(e.touches[0].clientX - startX) > Math.abs(e.touches[0].clientY - startY);
        if (sideways || panel.scrollHeight > panel.clientHeight) return;
      }
      e.preventDefault();
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
    };
  }, [typing, container]);

  return viewport;
}
