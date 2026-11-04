"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function NameChip({ name, color, onClick }: { name: string; color: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 max-w-full min-w-0 items-center gap-2 rounded-full bg-chip pr-4 pl-1.5 text-[15px] font-bold text-ink transition-transform active:scale-95"
    >
      <Avatar name={name} color={color} size={32} />
      <span className="min-w-0 truncate">{name}</span>
    </button>
  );
}

export function NotListedChip({ active = false, onClick }: { active?: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[15px] font-semibold whitespace-nowrap text-green-ink transition-[transform,border-color] hover:border-green active:scale-95",
        active ? "border-green" : "border-dashed border-dash",
      )}
    >
      <PlusIcon size={14} />
      {t.member.notListed}
    </button>
  );
}

export function PickOrType({
  people,
  button,
  pending,
  onPick,
  onName,
}: {
  people: readonly { id: string; name: string; color: number }[];
  button: string;
  pending: boolean;
  onPick: (id: string) => void;
  onName: (name: string) => void;
}) {
  const { t } = useI18n();
  const [typing, setTyping] = useState(people.length === 0);
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <NameChip key={p.id} name={p.name} color={p.color} onClick={() => onPick(p.id)} />
        ))}
        <NotListedChip active={typing} onClick={() => setTyping((v) => !v)} />
      </div>
      {typing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onName(trimmed);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={name}
            autoFocus
            maxLength={30}
            autoCapitalize="words"
            autoComplete="off"
            aria-label={t.home.personPlaceholder}
            placeholder={t.home.personPlaceholder}
            onChange={(e) => setName(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-transparent bg-chip px-3 text-[16px] font-semibold text-ink outline-none focus:border-green focus:bg-card focus:shadow-[0_0_0_3px_var(--green-soft)]"
          />
          <button
            type="submit"
            disabled={pending || !trimmed}
            className="h-11 shrink-0 rounded-xl bg-green px-5 text-[15px] font-bold text-white disabled:opacity-60"
          >
            {button}
          </button>
        </form>
      ) : null}
    </>
  );
}
