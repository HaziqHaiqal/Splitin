"use client";

import { useEffect, useState, type RefObject } from "react";

function scrollsInside(from: EventTarget, root: HTMLElement) {
  for (let el = from instanceof Element ? from : null; el && root.contains(el); el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true;
  }
  return false;
}

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 150);
    };
    const focusIn = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement)) return settle();
      clearTimeout(timer);
      update();
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", settle);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", settle);
      clearTimeout(timer);
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
        if (sideways || scrollsInside(e.target, panel)) return;
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
