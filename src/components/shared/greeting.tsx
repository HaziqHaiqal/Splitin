"use client";

import { ChevronDownIcon } from "@/components/icons";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc } from "@/lib/bill";
import { cn } from "@/lib/utils";

const words = "text-[17px] font-extrabold tracking-[-0.01em]";

export function Greeting({
  name,
  text,
  onChange,
  className,
}: {
  name?: string;
  text?: string;
  onChange?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const hi = text ?? fmt(t.member.hi, { name: name ?? "" });
  return (
    <div className={cn("flex min-h-9 items-center", className)}>
      {onChange ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onChange}
          className={cn(words, "flex h-9 min-w-0 items-center gap-1")}
        >
          <span className="min-w-0 truncate">{hi}</span>
          <ChevronDownIcon className="shrink-0 text-muted" />
        </button>
      ) : (
        <b className={cn(words, "min-w-0 truncate")}>{hi}</b>
      )}
    </div>
  );
}

export function OwnerGreeting({ doc, className }: { doc: BillDoc; className?: string }) {
  const name = doc.people.find((p) => p.id === doc.ownerId)?.name;
  return name ? <Greeting name={name} className={className} /> : null;
}
