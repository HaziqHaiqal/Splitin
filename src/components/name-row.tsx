"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

function Row({
  icon,
  quiet,
  onClick,
  children,
}: {
  icon: ReactNode;
  quiet?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group -mx-2 flex shrink-0 items-center gap-3 rounded-xl px-2 text-left text-[16px] font-semibold transition-colors hover:bg-chip active:bg-chip",
        quiet ? "text-muted" : "text-ink",
      )}
    >
      {icon}
      <span className="flex h-14 min-w-0 flex-1 items-center border-b border-line group-last:border-b-0">
        <span className="truncate">{children}</span>
      </span>
    </button>
  );
}

export function NameRow({ name, color, onClick }: { name: string; color: number; onClick: () => void }) {
  return (
    <Row icon={<Avatar name={name} color={color} size={34} />} onClick={onClick}>
      {name}
    </Row>
  );
}

export function NotListedRow({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Row
      quiet
      icon={
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full border border-border">
          <PlusIcon size={16} />
        </span>
      }
      onClick={onClick}
    >
      {t.friend.notListed}
    </Row>
  );
}
