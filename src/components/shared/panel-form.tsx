"use client";

import type { FormEvent, ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-[44px] w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-[16px] text-ink outline-none placeholder:font-normal focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_3px_var(--green-soft)]";

export function PanelHead({ title, onClose }: { title: string; onClose?: () => void }) {
  const { t } = useI18n();
  const desktop = useIsDesktop();
  return (
    <div
      className={cn(
        "flex min-h-9 items-center justify-between gap-3",
        !desktop && "sticky top-0 z-10 -mx-4 -mt-4 box-content bg-card px-4 pt-4 pb-1",
      )}
    >
      <span className="text-[16px] font-extrabold tracking-[-0.01em]">{title}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={t.member.cancel}
          title={t.member.cancel}
          className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-ink"
        >
          <CloseIcon size={17} />
        </button>
      ) : null}
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
