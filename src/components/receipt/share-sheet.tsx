"use client";

import { createContext, destroyContext, domToCanvas } from "modern-screenshot";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { DownloadIcon, LinkIcon, ShareIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { summarize, type BillDoc, type Payment } from "@/lib/bill";
import { isCode } from "@/lib/utils";

const BACKDROP = "#0e131b";
const MARGIN = 28;
const SCALE = 2;
const REDRAWS = 3;
const SIZES = ["width", "height", "inline-size", "block-size"];

function fitText(node: Node) {
  if (node instanceof HTMLElement && node.textContent?.trim()) {
    for (const size of SIZES) node.style.removeProperty(size);
  }
}

async function receiptPicture(node: HTMLElement): Promise<Blob | null> {
  const context = await createContext(node, {
    scale: SCALE,
    backgroundColor: null,
    style: { filter: "none" },
    onCloneEachNode: fitText,
    onCreateForeignObjectSvg: (svg) => svg.style.setProperty("color-scheme", "only light"),
  });
  context.drawImageCount = REDRAWS;
  const paper = await domToCanvas(context).finally(() => destroyContext(context));
  const pad = MARGIN * SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = paper.width + pad * 2;
  canvas.height = paper.height + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(paper, pad, pad);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function receiptFileName(createdAt: string, billId: string | null) {
  const d = new Date(createdAt);
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  return `Receipt_${stamp}${billId ? `_${billId}` : ""}.png`;
}

export function ShareSheet({
  open,
  onOpenChange,
  billId,
  doc,
  payments = [],
  receiptRef,
  onBack,
  ask,
  waiting = false,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string | null;
  doc: BillDoc;
  payments?: Payment[];
  receiptRef: RefObject<HTMLDivElement | null>;
  onBack?: () => void;
  ask?: ReactNode;
  waiting?: boolean;
  onPublish?: () => void;
}) {
  const { t, money } = useI18n();
  const toast = useToast();
  const [image, setImage] = useState<{ blob: Blob; url: string } | "failed" | null>(null);

  const { title, createdAt } = doc;
  const url = billId && typeof window !== "undefined" ? `${window.location.origin}/bill/${billId}` : "";
  const code = billId && isCode(billId) ? billId : null;
  const details = fmt(t.share.details, { total: money(summarize(doc).total), count: doc.people.length });
  const message = `${title}\n${details}${code ? `\n${t.share.code}: ${code}` : ""}\n\n${t.share.message}\n${url}`;
  const content = JSON.stringify([doc, payments, billId]);

  useEffect(() => {
    if (!open || !receiptRef.current) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const node = receiptRef.current;
    void (async () => {
      try {
        await document.fonts?.ready;
        const blob = await receiptPicture(node);
        if (cancelled) return;
        if (!blob) return setImage("failed");
        objectUrl = URL.createObjectURL(blob);
        setImage({ blob, url: objectUrl });
      } catch (error) {
        console.warn("[share] receipt image failed", error);
        if (!cancelled) setImage("failed");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImage(null);
    };
  }, [open, receiptRef, content]);

  const picture = image && image !== "failed" ? image : null;
  const fileName = receiptFileName(createdAt, billId);
  const busy = waiting || (Boolean(billId) && image === null);

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: done });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const copyLink = () => copy(url, t.share.linkCopied);

  const send = async () => {
    if (!navigator.share) return copyLink();
    const file = picture ? new File([picture.blob], fileName, { type: "image/png" }) : null;
    const text = { title, text: message };
    try {
      await navigator.share(
        file && navigator.canShare?.({ ...text, files: [file] }) ? { ...text, files: [file] } : text,
      );
    } catch (error) {
      if ((error as Error).name === "AbortError" || !file) return;
      try {
        await navigator.share(text);
      } catch {}
    }
  };

  const saveImage = () => {
    if (!picture) return;
    const a = document.createElement("a");
    a.href = picture.url;
    a.download = fileName;
    a.click();
  };

  const tile =
    "flex h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] bg-field text-[13px] font-bold text-ink disabled:opacity-50";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.share.title} onBack={onBack}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-[14px] rounded-2xl bg-field p-3">
          <div className="flex h-[118px] w-[82px] shrink-0 -rotate-3 items-start justify-center overflow-hidden bg-[#0e131b] shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picture.url} alt="" className="w-full" />
            ) : (
              <span className="mt-12 text-[10px] text-[#8a96a8]">{image === "failed" ? "" : t.share.preparing}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold">{t.share.previewTitle}</div>
            <div className="mt-1 text-[13px] leading-[1.45] text-muted">{t.share.previewDesc}</div>
          </div>
        </div>
        {ask}
        <button
          type="button"
          onClick={billId ? send : onPublish}
          disabled={busy || (!billId && !onPublish)}
          className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-green text-[16px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
        >
          <ShareIcon />
          {busy ? t.share.preparing : t.share.send}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={saveImage} disabled={!billId || !picture} className={tile}>
            <DownloadIcon />
            {t.share.saveImage}
          </button>
          <button type="button" onClick={copyLink} disabled={!billId} className={tile}>
            <LinkIcon />
            {t.share.copyLink}
          </button>
        </div>
        {code ? (
          <button
            type="button"
            onClick={() => copy(code, t.share.codeCopied)}
            className="flex h-[52px] items-center gap-3 rounded-[14px] bg-field px-4 text-left"
          >
            <span className="text-[13px] font-bold text-muted">{t.share.code}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[16px] font-bold tracking-[0.08em] text-ink">
              {code}
            </span>
            <span className="text-[13px] font-bold text-green-ink">{t.common.copy}</span>
          </button>
        ) : null}
        <div className="text-center text-[12px] text-muted">{t.share.note}</div>
      </div>
    </Sheet>
  );
}
