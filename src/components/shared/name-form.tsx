"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fieldClass, PanelForm, SubmitButton } from "./panel-form";

export function NameForm({
  bare,
  autoFocus,
  pending,
  onSave,
  onCancel,
}: {
  bare: boolean;
  autoFocus: boolean;
  pending: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <PanelForm
      title={t.member.nameTitle}
      bare={bare}
      onCancel={onCancel}
      onSubmit={() => {
        if (trimmed) onSave(trimmed);
      }}
    >
      <p className="m-0 text-[12.5px] text-muted">{t.member.nameDesc}</p>
      <input
        type="text"
        value={name}
        autoFocus={autoFocus}
        maxLength={30}
        autoCapitalize="words"
        autoComplete="off"
        aria-label={t.home.personPlaceholder}
        placeholder={t.home.personPlaceholder}
        onChange={(e) => setName(e.target.value)}
        className={`${fieldClass} font-semibold`}
      />
      <SubmitButton disabled={pending || !trimmed}>{t.common.add}</SubmitButton>
    </PanelForm>
  );
}
