"use client";

import { Avatar } from "@/components/avatar";
import { PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";

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

export function NotListedChip({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-dash px-4 text-[15px] font-semibold whitespace-nowrap text-green-ink transition-[transform,border-color] hover:border-green active:scale-95"
    >
      <PlusIcon size={14} />
      {t.member.notListed}
    </button>
  );
}
