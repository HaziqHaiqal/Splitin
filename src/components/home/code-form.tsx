"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent, type SyntheticEvent } from "react";
import { findBill } from "@/app/actions";
import { PanelBack, PanelHead } from "@/components/shared/panel-form";
import { useI18n } from "@/i18n/client";
import { cn, CODE_LENGTH, codeFromInput } from "@/lib/utils";

export function HomeIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <h1 className="m-0 text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] whitespace-pre-line md:text-[40px]">
        {title}
      </h1>
      <p className="m-0 mt-2 text-[14.5px] leading-[1.5] text-muted md:mt-3">{desc}</p>
    </>
  );
}

export function CodeForm({ backLabel, onBack }: { backLabel?: string; onBack: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const latest = useRef("");
  const current = Math.min(code.length, CODE_LENGTH - 1);

  const open = (value: string) =>
    start(async () => {
      const result = await findBill(value);
      if (latest.current !== value) return;
      if (result.ok) return router.push(`/bill/${result.data.id}`);
      if (result.error === "expired") setError(t.expired.title);
      else setError(result.error === "not_found" ? t.home.codeNotFound : t.common.generic);
    });

  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const next = codeFromInput(e.target.value).slice(0, CODE_LENGTH);
    if (next === code) return;
    latest.current = next;
    setCode(next);
    setError("");
    if (next.length === CODE_LENGTH) open(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === CODE_LENGTH && !pending) open(code);
  };

  const toEnd = (e: SyntheticEvent<HTMLInputElement>) => e.currentTarget.setSelectionRange(code.length, code.length);

  return (
    <div className="flex flex-col md:max-w-[430px]">
      {backLabel ? (
        <HomeIntro title={t.home.codeTitle} desc={t.home.codeDesc} />
      ) : (
        <PanelBack.Provider value={onBack}>
          <PanelHead title={t.home.codeTitle} />
          <p className="m-0 mt-1 text-[14px] leading-[1.5] text-muted">{t.home.codeDesc}</p>
        </PanelBack.Provider>
      )}
      <form onSubmit={submit} className="group relative mt-[18px] flex gap-[5px] md:mt-7 md:gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "flex h-[52px] min-w-0 flex-[0_1_46px] items-center justify-center rounded-xl bg-chip font-mono text-[18px] font-bold text-ink uppercase md:h-14 md:text-[20px]",
              i === 3 && "mr-[5px] md:mr-2",
              i === current &&
                "group-focus-within:bg-card group-focus-within:shadow-[inset_0_0_0_1.5px_var(--green),0_0_0_3px_var(--green-soft)]",
            )}
          >
            {code[i]}
          </span>
        ))}
        <input
          type="text"
          value={code}
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-label={t.home.codeTitle}
          aria-invalid={Boolean(error)}
          onChange={change}
          onFocus={toEnd}
          onClick={toEnd}
          className="absolute inset-0 w-full bg-transparent text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </form>
      <p
        aria-live="polite"
        className={cn("m-0 mt-3 min-h-5 text-[13px] font-semibold", error ? "text-owe" : "text-muted")}
      >
        {pending ? t.home.codeOpening : error}
      </p>
      {backLabel ? (
        <button type="button" onClick={onBack} className="mt-1 h-9 self-start text-[13.5px] font-bold text-green-ink">
          {backLabel}
        </button>
      ) : null}
    </div>
  );
}
