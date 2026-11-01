"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

function useQrPicture(code: string) {
  const [made, setMade] = useState<{ code: string; url: string } | null>(null);

  useEffect(() => {
    let live = true;
    void import("qrcode")
      .then(({ toDataURL }) => toDataURL(code, { width: 1024, margin: 4 }))
      .then((url) => {
        if (live) setMade({ code, url });
      });
    return () => {
      live = false;
    };
  }, [code]);

  return made?.code === code ? made.url : null;
}

function QrFrame({ url, className }: { url: string | null; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-xl border border-border bg-white", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={t.person.qrAlt} className="block size-full" />
      ) : null}
    </div>
  );
}

export function QrImage({ code, className }: { code: string; className?: string }) {
  return <QrFrame url={useQrPicture(code)} className={className} />;
}

export function PayQr({ code, name }: { code: string; name: string }) {
  const { t } = useI18n();
  const url = useQrPicture(code);

  const save = async () => {
    if (!url) return;
    const fileName = `splitin-qr-${name.replace(/[^\p{L}\p{N}-]+/gu, "-")}.png`;
    const bytes = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
    const file = new File([bytes], fileName, { type: "image/png" });
    if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <QrFrame url={url} className="size-[176px]" />
      <button
        type="button"
        disabled={!url}
        onClick={save}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink disabled:opacity-60"
      >
        <DownloadIcon size={15} />
        {t.person.saveQr}
      </button>
    </div>
  );
}
