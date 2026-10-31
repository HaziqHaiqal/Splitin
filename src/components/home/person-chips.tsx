"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import type { Person } from "@/lib/bill";
import { cn } from "@/lib/utils";

export function PersonChips({
  people,
  value,
  onChange,
  bare,
  children,
}: {
  people: readonly Person[];
  value: string;
  onChange: (id: string) => void;
  bare: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex gap-1.5", bare ? "-mx-4 [scrollbar-width:none] overflow-x-auto px-4" : "flex-wrap")}>
      {people.map((p) => {
        const on = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p.id)}
            className={cn(
              "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full pr-3 pl-1 text-[13px] font-bold",
              on ? "bg-green text-white" : "bg-chip text-ink",
            )}
          >
            <Avatar name={p.name} color={p.color} size={26} />
            {p.name}
          </button>
        );
      })}
      {children}
    </div>
  );
}
