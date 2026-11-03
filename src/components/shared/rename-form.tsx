"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { BillDoc } from "@/lib/bill";
import { fieldClass, PanelForm, SubmitButton } from "./panel-form";

export type Names = { title: string; people: Record<string, string> };

export function RenameForm({
  doc,
  bare,
  pending,
  onSave,
  onMore,
  onCancel,
}: {
  doc: BillDoc;
  bare: boolean;
  pending: boolean;
  onSave: (names: Names) => void;
  onMore: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(doc.title);
  const [people, setPeople] = useState(() => Object.fromEntries(doc.people.map((p) => [p.id, p.name])));

  return (
    <PanelForm
      title={t.page.rename}
      bare={bare}
      onCancel={onCancel}
      onSubmit={() => onSave({ title: title.trim(), people })}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted">{t.home.billName}</span>
        <input
          type="text"
          value={title}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
          className={`${fieldClass} font-semibold`}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted">{t.home.people}</span>
        {doc.people.map((p) => (
          <input
            key={p.id}
            type="text"
            value={people[p.id] ?? ""}
            maxLength={30}
            autoCapitalize="words"
            autoComplete="off"
            aria-label={`${t.person.name}: ${p.name}`}
            onChange={(e) => setPeople((all) => ({ ...all, [p.id]: e.target.value }))}
            className={`${fieldClass} font-semibold`}
          />
        ))}
      </div>
      <button type="button" onClick={onMore} className="h-11 text-[14px] font-bold text-green-ink">
        {t.page.moreChanges} ›
      </button>
      <SubmitButton disabled={pending}>{t.common.save}</SubmitButton>
    </PanelForm>
  );
}