"use client";

import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc } from "@/lib/bill";
import { cn } from "@/lib/utils";

export function Greeting({
  name,
  action,
  className,
}: {
  name?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3", className)}>
      {name ? (
        <b className="min-w-0 truncate text-[17px] font-extrabold tracking-[-0.01em]">{fmt(t.friend.hi, { name })}</b>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-auto h-9 max-w-[55%] shrink-0 truncate text-[13.5px] font-bold text-muted"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function OwnerGreeting({ doc, className }: { doc: BillDoc; className?: string }) {
  const name = doc.people.find((p) => p.id === doc.ownerId)?.name;
  return name ? <Greeting name={name} className={className} /> : null;
}
