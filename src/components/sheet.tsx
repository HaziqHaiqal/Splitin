"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

const DESKTOP = "(min-width: 768px)";

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

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Desktop only: a wider pop-up for side-by-side content. */
  wide?: boolean;
};

/** Phone: bottom sheet as designed. Desktop: a centred dialog with the same contents. */
export function Sheet(props: SheetProps) {
  const desktop = useIsDesktop();
  return desktop ? <Modal {...props} /> : <BottomSheet {...props} />;
}

function BottomSheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] w-full max-w-[430px] flex-col rounded-t-[24px] bg-sheet text-ink outline-none">
          <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-[3px] bg-handle" />
          <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
            <Drawer.Title className="text-[22px] font-extrabold tracking-[-0.02em]">{title}</Drawer.Title>
            <Drawer.Description className="sr-only">{typeof title === "string" ? title : ""}</Drawer.Description>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Modal({ open, onOpenChange, title, children, wide }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false);
      }}
      className={cn("m-auto w-full rounded-[24px] bg-sheet p-0 text-ink shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop:bg-overlay", wide ? "max-w-[min(860px,calc(100vw-48px))]" : "max-w-[460px]")}
    >
      {open ? (
        <div className={cn("flex max-h-[88dvh] flex-col gap-[14px] overflow-y-auto p-6", wide && "gap-5 p-7")}>
          <h2 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">{title}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
