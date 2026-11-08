"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Header } from "@/components/header";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { cn } from "@/lib/utils";
import { BigStamp, Zigzag } from "./receipt";

const INK = "#37352f";
const MUTED = "#6b6a65";

export const dockButton = "h-12 rounded-xl border border-raised-edge bg-raised text-[15px] font-bold text-ink";

export function Printer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div aria-hidden className="relative z-10 h-3.5 rounded-lg bg-slot shadow-[inset_0_-3px_0_var(--slot-edge)]" />
      <div className="relative -mt-2 px-2.5">{children}</div>
    </div>
  );
}

export function ErrorSlip({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.10))" }}>
      <div className="flex flex-col items-center gap-2.5 bg-white px-5 pt-7 pb-5 font-mono" style={{ color: INK }}>
        <div className="text-[19px] font-bold tracking-[0.32em]" style={{ paddingLeft: "0.32em" }}>
          SPLITIN
        </div>
        <div className="w-full" style={{ borderTop: `1.5px dashed ${INK}` }} />
        <div className="pt-2 text-[52px] leading-none font-bold tracking-[0.14em]" style={{ paddingLeft: "0.14em" }}>
          404
        </div>
        <div className="pb-1 text-center text-[13px] font-bold tracking-[0.06em]">{title}</div>
        <div className="w-full" style={{ borderTop: `1.5px dashed ${INK}` }} />
        <div className="text-center text-[12px]" style={{ color: MUTED }}>
          {hint}
        </div>
      </div>
      <Zigzag edge="bottom" />
    </div>
  );
}

export function FadedPaper({ stamp }: { stamp: string }) {
  const bar = (width: string, height = 9) => <div style={{ width, height, background: "#ecebe7" }} />;
  return (
    <div className="relative" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.10))" }}>
      <div className="flex flex-col gap-2.5 bg-white px-5 pt-7 pb-6 font-mono" style={{ color: "#c8c7c3" }}>
        <div className="text-center text-[19px] font-bold tracking-[0.32em]" style={{ paddingLeft: "0.32em" }}>
          SPLITIN
        </div>
        <div style={{ borderTop: "1.5px dashed #dcdbd8" }} />
        {bar("78%")}
        {bar("56%")}
        {bar("68%")}
        <div style={{ borderTop: "1.5px dashed #dcdbd8" }} />
        {bar("100%", 12)}
        {bar("62%")}
        {bar("74%")}
      </div>
      <Zigzag edge="bottom" />
      <BigStamp>{stamp}</BigStamp>
    </div>
  );
}

export function PrinterPage({
  side,
  paper,
  below,
  phoneTop,
  phoneBelow,
  panel,
  onPanelClose,
  dim = false,
  dock,
  fab,
  phoneSide = false,
  phoneCenter = false,
  follow,
  header,
}: {
  side: ReactNode;
  paper: ReactNode;
  below?: ReactNode;
  phoneTop?: ReactNode;
  phoneBelow?: ReactNode;
  phoneCenter?: boolean;
  panel?: ReactNode;
  onPanelClose?: () => void;
  dim?: boolean;
  dock?: ReactNode;
  fab?: ReactNode;
  phoneSide?: boolean;
  follow?: string;
  header?: ReactNode;
}) {
  const desktop = useIsDesktop();
  const pinned = useRef<HTMLDivElement>(null);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const keyboard = useKeyboardViewport(pinned);
  const typing = keyboard !== null;
  const [held, setHeld] = useState<ReactNode>(panel ?? null);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; at: number; dy: number } | null>(null);
  if (panel && held !== panel) setHeld(panel);
  const leaving = !panel && held !== null;
  const sheet = panel ?? held;
  const shown = Boolean(sheet);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setHeld(null);
      setPull(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (desktop || !panel || !onPanelClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target === document.body || (e.target instanceof Node && pinned.current?.contains(e.target)))
        onPanelClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [desktop, panel, onPanelClose]);

  useEffect(() => {
    const el = pinned.current;
    if (!el) return setPinnedHeight(0);
    const observer = new ResizeObserver(() => setPinnedHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [desktop, shown, dock]);

  const grab = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (!onPanelClose || leaving || !target.closest("[data-grab]") || target.closest("button, input, a, textarea"))
      return;
    drag.current = { y: e.clientY, at: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dy = e.clientY - d.y;
    setPull(d.dy > 0 ? d.dy : d.dy / 6);
  };
  const letGo = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    const fast = d.dy > 24 && d.dy / Math.max(1, performance.now() - d.at) > 0.5;
    if (onPanelClose && (fast || d.dy > e.currentTarget.offsetHeight * 0.3)) onPanelClose();
    else setPull(0);
  };

  useEffect(() => {
    if (desktop || follow === undefined || typing) return;
    const total = document.querySelector("main [data-receipt-total]");
    if (total) total.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, [desktop, follow, pinnedHeight, typing]);

  if (desktop) {
    return (
      <div className="min-h-dvh bg-bg text-ink">
        <div className="h-16 overflow-hidden bg-bg px-6">{header ?? <Header />}</div>
        <div className="grid grid-cols-[minmax(340px,1fr)_minmax(400px,1fr)]">
          <main className="min-w-0 px-8 pt-7 pb-16">
            <div className="mx-auto flex w-full max-w-[460px] flex-col gap-5">{side}</div>
          </main>
          <aside className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col gap-6 overflow-x-hidden overflow-y-auto bg-tray px-6 pt-6 pb-10 lg:px-10">
            <Printer>{paper}</Printer>
            {below ? <div className="flex justify-center">{below}</div> : null}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-dvh overflow-x-clip text-ink", phoneSide ? "bg-bg" : "bg-tray")}>
      <div className="h-14 overflow-hidden bg-bg px-4">{header ?? <Header />}</div>
      {phoneSide ? (
        <main className="flex flex-col gap-4 px-4 pt-2">{side}</main>
      ) : (
        <main
          className={cn(
            "flex flex-col gap-3 px-3",
            phoneCenter ? "min-h-[calc(100dvh-3.5rem)] justify-center py-8" : "pt-3",
          )}
        >
          {phoneTop}
          <Printer>{paper}</Printer>
          {phoneBelow}
        </main>
      )}
      {phoneCenter ? null : <div aria-hidden style={{ height: pinnedHeight + (fab && !panel ? 76 : 24) }} />}
      {sheet && dim ? (
        <div
          aria-hidden
          onClick={leaving ? undefined : onPanelClose}
          className={cn("fixed inset-0 z-30 bg-overlay", leaving ? "animate-unfade" : "animate-fade")}
        />
      ) : null}
      {sheet ? (
        <div
          ref={pinned}
          inert={leaving}
          aria-hidden={leaving || undefined}
          onPointerDown={grab}
          onPointerMove={move}
          onPointerUp={letGo}
          onPointerCancel={letGo}
          style={{
            ...(keyboard
              ? { top: keyboard.bottom, bottom: "auto", maxHeight: keyboard.height, transform: "translateY(-100%)" }
              : undefined),
            translate: pull ? `0 ${pull}px` : undefined,
            transition: dragging ? "none" : "translate 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex max-h-[66dvh] flex-col rounded-t-[22px] border-t border-sheet-edge bg-card shadow-[0_-8px_24px_var(--sheet-shadow)]",
            leaving ? "animate-sheet-out" : "animate-sheet-in",
          )}
        >
          {onPanelClose ? (
            <div data-grab aria-hidden className="flex shrink-0 cursor-grab touch-none justify-center pt-2">
              <i className="h-[5px] w-10 rounded-[3px] bg-handle" />
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">{sheet}</div>
          </div>
        </div>
      ) : null}
      {panel ? null : dock ? (
        sheet ? null : (
          <div
            ref={pinned}
            className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
          >
            {dock}
          </div>
        )
      ) : (
        fab
      )}
    </div>
  );
}
