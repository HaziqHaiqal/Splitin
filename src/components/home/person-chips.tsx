"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
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
      {people.map((p) => (
        <ChoiceChip key={p.id} person={p} on={value === p.id} onClick={() => onChange(p.id)} />
      ))}
      {children}
    </div>
  );
}

export function ChoiceChip({
  person,
  on,
  onClick,
  tall = false,
}: {
  person: Person;
  on: boolean;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border pr-3 pl-1 font-bold transition-colors",
        tall ? "h-[38px] text-[14px]" : "h-[34px] text-[13px]",
        on ? "border-green bg-green text-white" : "border-border bg-card text-ink",
      )}
    >
      {on ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-white text-green-ink",
            tall ? "size-7" : "size-[26px]",
          )}
        >
          <CheckIcon size={14} />
        </span>
      ) : (
        <Avatar name={person.name} color={person.color} size={tall ? 28 : 26} />
      )}
      {person.name}
    </button>
  );
}
