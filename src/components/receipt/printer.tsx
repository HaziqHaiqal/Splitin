"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Header } from "@/components/header";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { cn } from "@/lib/utils";
import { BigStamp, Zigzag } from "./receipt";

const INK = "#37352f";
const MUTED = "#6b6a65";

/**
 * The little receipt printer: a dark slot with the paper coming out of it. The paper's top edge tucks under the
 * slot, so its torn top only shows in the shared picture.
 */
export function Printer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div aria-hidden className="relative z-10 h-3.5 rounded-lg bg-slot shadow-[inset_0_-3px_0_var(--slot-edge)]" />
      <div className="relative -mt-2 px-2.5">{children}</div>
    </div>
  );
}

/** The blank stub the printer shows before anyone is added. */
export function PaperStub({ text }: { text: string }) {
  return (
    <div style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.10))" }}>
      <div className="flex flex-col items-center gap-2 bg-white px-5 pt-7 pb-5 font-mono" style={{ color: INK }}>
        <div className="text-[19px] font-bold tracking-[0.32em]" style={{ paddingLeft: "0.32em" }}>
          SPLITIN
        </div>
        <div className="w-full" style={{ borderTop: `1.5px dashed ${INK}` }} />
        <div className="py-1 text-center font-sans text-[12.5px] font-semibold" style={{ color: MUTED }}>
          {text}
        </div>
      </div>
      <Zigzag edge="bottom" />
    </div>
  );
}

/** What the printer gives for a link that leads nowhere: a short error slip with a big 404. */
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

/** A receipt with its details gone (an expired link): grey bars instead of text, under a big stamp. */
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

/**
 * The page frame shared by every screen of the app.
 * Desktop: the page's own content on the left, the printer in a tray down the right, full height.
 * Phone: the printer tray fills the screen (or the page's content does, with `phoneSide`), with an optional
 * panel or row of buttons pinned to the bottom.
 */
export function PrinterPage({
  side,
  paper,
  below,
  phoneTop,
  phoneBelow,
  panel,
  dock,
  phoneSide = false,
  phoneCenter = false,
  follow,
  header,
}: {
  /** Desktop left column; on phones too when `phoneSide` is set. */
  side: ReactNode;
  /** What comes out of the printer. */
  paper: ReactNode;
  /** Desktop: under the paper in the tray (a Share button). */
  below?: ReactNode;
  /** Phone: a slim row above the printer (the title). */
  phoneTop?: ReactNode;
  /** Phone: content under the paper, scrolling with it (a message that doesn't need a panel). */
  phoneBelow?: ReactNode;
  /** Phone: centre the printer and what's below it in the space under the header (pages with no panel). */
  phoneCenter?: boolean;
  /** Phone: a white panel pinned to the bottom (a form). */
  panel?: ReactNode;
  /** Phone: buttons pinned to the bottom. */
  dock?: ReactNode;
  phoneSide?: boolean;
  /** Phone: when this changes, scroll so the newest printed line is in view above the panel. */
  follow?: string;
  /** Replaces the usual logo header (the owner receipt view has a back bar). */
  header?: ReactNode;
}) {
  const desktop = useIsDesktop();
  const pinned = useRef<HTMLDivElement>(null);
  const [pinnedHeight, setPinnedHeight] = useState(0);

  useEffect(() => {
    const el = pinned.current;
    if (!el) return setPinnedHeight(0);
    const observer = new ResizeObserver(() => setPinnedHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [desktop, panel, dock]);

  useEffect(() => {
    if (desktop || follow === undefined) return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, [desktop, follow, pinnedHeight]);

  if (desktop) {
    return (
      <div className="min-h-dvh bg-bg text-ink">
        {/* exactly the header's height: the header leaves a little gap under itself for normal pages, which here
            would show as a strip of page colour above the printer tray */}
        <div className="h-16 overflow-hidden bg-bg px-6">{header ?? <Header />}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_400px] lg:grid-cols-[minmax(0,1fr)_460px]">
          <main className="min-w-0 px-8 pt-8 pb-16 lg:px-12">
            <div className="mx-auto flex max-w-[620px] flex-col gap-6">{side}</div>
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
    // overflow-x-clip: a big stamp slams in oversized; letting it poke past the edge would widen the page for good
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
      {phoneCenter ? null : <div aria-hidden style={{ height: pinnedHeight + 24 }} />}
      {panel ? (
        <div
          ref={pinned}
          className="fixed inset-x-0 bottom-0 z-20 max-h-[74dvh] overflow-y-auto overscroll-contain rounded-t-[22px] border-t border-border bg-card px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(55,53,47,0.08)]"
        >
          {panel}
        </div>
      ) : dock ? (
        <div
          ref={pinned}
          className="fixed inset-x-0 bottom-0 z-20 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          {dock}
        </div>
      ) : null}
    </div>
  );
}
