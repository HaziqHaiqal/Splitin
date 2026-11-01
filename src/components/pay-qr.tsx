"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { drawQrCard, drawQrPlate, qrCardSize, type QrCardText } from "@/lib/qr-card";
import { cn } from "@/lib/utils";

const OPENING_MS = 1400;

export function QrImage({ code, className }: { code: string; className?: string }) {
  const { t } = useI18n();
  const [made, setMade] = useState<{ code: string; url: string } | null>(null);

  useEffect(() => {
    let live = true;
    void import("qrcode")
      .then(({ toDataURL }) => toDataURL(code, { width: 256, margin: 4 }))
      .then((url) => {
        if (live) setMade({ code, url });
      });
    return () => {
      live = false;
    };
  }, [code]);

  return (
    <div className={cn("shrink-0 overflow-hidden rounded-xl border border-border bg-white", className)}>
      {made?.code === code ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={made.url} alt={t.person.qrAlt} className="block size-full" />
      ) : null}
    </div>
  );
}

export function PayQr({
  code,
  fileName,
  card,
  account,
  onCopy,
}: {
  code: string;
  fileName: string;
  card: QrCardText;
  account: string | null;
  onCopy: () => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const { name, bank, kind } = card;
  const key = [code, name, bank, kind, fileName].join("|");
  const [made, setMade] = useState<{ key: string; file: File } | null>(null);
  const file = made?.key === key ? made.file : null;

  useEffect(() => {
    const shown = canvas.current;
    if (!shown) return;
    let live = true;
    let frame = 0;

    void (async () => {
      const { create } = await import("qrcode");
      const family = getComputedStyle(shown).fontFamily;
      await Promise.allSettled([600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px ${family}`)));
      if (!live) return;

      const text = { name, bank, kind };
      const plate = drawQrPlate(create(code).modules, text, family);

      const still = document.createElement("canvas");
      Object.assign(still, qrCardSize(text));
      drawQrCard(still, plate, family, 1);
      const paper = still.getContext("2d");
      if (paper) {
        paper.globalCompositeOperation = "destination-over";
        paper.fillStyle = "#fff";
        paper.fillRect(0, 0, still.width, still.height);
      }
      still.toBlob((blob) => {
        if (live && blob) setMade({ key, file: new File([blob], fileName, { type: "image/png" }) });
      }, "image/png");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        drawQrCard(shown, plate, family, 1);
        return;
      }
      const started = performance.now();
      const paint = (now: number) => {
        if (!live) return;
        const progress = Math.min((now - started) / OPENING_MS, 1);
        drawQrCard(shown, plate, family, progress);
        if (progress < 1) frame = requestAnimationFrame(paint);
      };
      paint(started);
    })();

    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [key, code, name, bank, kind, fileName]);

  const save = async () => {
    if (!file) return;
    if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const action =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink disabled:opacity-60";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <canvas
        ref={canvas}
        {...qrCardSize(card)}
        role="img"
        aria-label={[t.person.qrAlt, name, bank, kind].filter(Boolean).join(", ")}
        className="block h-auto w-full max-w-[300px]"
      />
      <div className="flex flex-wrap justify-center gap-2">
        {account ? (
          <button type="button" onClick={onCopy} className={action}>
            {t.person.copyAccount}
          </button>
        ) : null}
        <button type="button" disabled={!file} onClick={save} className={action}>
          <DownloadIcon size={15} />
          {t.person.saveQr}
        </button>
      </div>
    </div>
  );
}
