"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { Drawer } from "vaul";
import { BackIcon, CloseIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  onBack?: () => void;
};

export function SheetHead({
  title,
  sub,
  onBack,
  onClose,
  Title = "h2",
}: {
  title: ReactNode;
  sub?: ReactNode;
  onBack?: (() => void) | null;
  onClose?: () => void;
  Title?: ElementType;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-10 items-center gap-1">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t.page.back}
          className="-my-2 -ml-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-chip"
        >
          <BackIcon size={19} strokeWidth={2.4} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <Title className="m-0 text-[18px] leading-[1.25] font-extrabold tracking-[-0.015em] text-ink">{title}</Title>
        {sub ? <p className="m-0 mt-0.5 text-[12.5px] leading-[1.4] font-medium text-muted">{sub}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          title={t.common.close}
          className="group -my-2 -mr-1.5 inline-flex size-11 shrink-0 items-center justify-center"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-chip text-muted transition-colors group-hover:text-ink">
            <CloseIcon size={16} />
          </span>
        </button>
      ) : null}
    </div>
  );
}

export function Sheet(props: SheetProps) {
  const desktop = useIsDesktop();
  return desktop ? <Modal {...props} /> : <BottomSheet {...props} />;
}

export function SheetOption({
  title,
  desc,
  disabled,
  onClick,
}: {
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex shrink-0 flex-col gap-0.5 rounded-xl bg-chip px-3.5 py-3 text-left disabled:opacity-60"
    >
      <span className="text-[15px] font-bold text-ink">{title}</span>
      <span className="text-[12.5px] leading-[1.4] text-muted">{desc}</span>
    </button>
  );
}

function BottomSheet({ open, onOpenChange, title, children, onBack }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] w-full max-w-[430px] flex-col rounded-t-[24px] border-t border-sheet-edge bg-sheet text-ink outline-none">
          <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-[3px] bg-handle" />
          <div className="shrink-0 px-5 pt-3 pb-2">
            <SheetHead title={title} onBack={onBack} onClose={() => onOpenChange(false)} Title={Drawer.Title} />
          </div>
          <Drawer.Description className="sr-only">{typeof title === "string" ? title : ""}</Drawer.Description>
          <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-5 pt-1.5 pb-[max(24px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Modal({ open, onOpenChange, title, children, wide, onBack }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (document.activeElement instanceof HTMLButtonElement) dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        "m-auto w-full rounded-[24px] border border-sheet-edge bg-sheet p-0 text-ink shadow-[0_24px_60px_rgba(0,0,0,0.25)] outline-none backdrop:bg-overlay",
        wide ? "max-w-[min(860px,calc(100vw-48px))]" : "max-w-[460px]",
      )}
    >
      {open ? (
        <div className="flex max-h-[88dvh] flex-col">
          <div className={cn("shrink-0", wide ? "px-7 pt-6 pb-2" : "px-6 pt-5 pb-2")}>
            <SheetHead title={title} onBack={onBack} onClose={() => onOpenChange(false)} />
          </div>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto",
              wide ? "gap-5 p-7 pt-3" : "gap-[14px] p-6 pt-1.5",
            )}
          >
            {children}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
