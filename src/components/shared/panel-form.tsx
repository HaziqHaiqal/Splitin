"use client";

import { createContext, useContext, type FormEvent, type ReactNode } from "react";
import { SheetHead } from "@/components/sheet";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-[44px] w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-[16px] text-ink outline-none placeholder:font-normal focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_3px_var(--green-soft)]";

export const PanelBack = createContext<(() => void) | null>(null);
export const InMenuCard = createContext(false);

export function PanelHead({ title, sub, onClose }: { title: ReactNode; sub?: ReactNode; onClose?: () => void }) {
  const desktop = useIsDesktop();
  const back = useContext(PanelBack);
  const inCard = useContext(InMenuCard);
  return (
    <div
      className={cn(
        desktop
          ? "sticky top-16 z-10 -mt-3 bg-bg pt-3 pb-1"
          : cn("sticky z-10 -mx-4 -mt-4 box-content bg-card px-4 pt-3 pb-1", inCard ? "-top-2" : "top-0"),
      )}
    >
      <SheetHead title={title} sub={sub} onBack={back} onClose={inCard ? undefined : onClose} />
    </div>
  );
}

export function PanelForm({
  title,
  bare,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  bare: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn("flex flex-col", bare ? "gap-2.5" : "gap-3 rounded-2xl border border-border bg-card p-4")}
    >
      <PanelHead title={title} onClose={onCancel} />
      {children}
    </form>
  );
}

export function SubmitButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="h-[44px] w-full rounded-xl bg-green px-5 text-[15px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
    >
      {children}
    </button>
  );
}
