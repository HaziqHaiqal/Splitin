"use client";

import { domToCanvas } from "modern-screenshot";
import { useEffect, useState, type RefObject } from "react";
import { DownloadIcon, LinkIcon, MoreIcon, SendIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";

/** The app's dark background. The cream paper and its torn top and bottom edges stand out on it. */
const BACKDROP = "#0e131b";
const MARGIN = 28;
const SCALE = 2;

/**
 * The receipt as a PNG: captured on a transparent background, so the gaps between the torn-edge
 * teeth stay empty, then laid on a dark backdrop with a margin all round.
 */
async function receiptPicture(node: HTMLElement): Promise<Blob | null> {
  const paper = await domToCanvas(node, { scale: SCALE, backgroundColor: null, style: { filter: "none" } });
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

/**
 * "Receipt_20261006-0148_GagYTBLfty.png": the date and time printed on the receipt (local time),
 * then the link id. No colons or spaces, so it is a safe file name everywhere.
 */
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
  title,
  createdAt,
  receiptRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string | null;
  title: string;
  /** When the bill was made; the saved picture is named after it. */
  createdAt: string;
  receiptRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [pasteHint, setPasteHint] = useState(false);

  const url = billId && typeof window !== "undefined" ? `${window.location.origin}/bill/${billId}` : "";
  const message = `${fmt(t.share.message, { title })} ${url}`;

  useEffect(() => {
    if (!open || !receiptRef.current) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const node = receiptRef.current;
    void (async () => {
      try {
        await document.fonts?.ready;
        const blob = await receiptPicture(node);
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ blob, url: objectUrl });
      } catch (error) {
        console.warn("[share] receipt image failed", error);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImage(null);
      setPasteHint(false);
    };
  }, [open, receiptRef]);

  const fileName = receiptFileName(createdAt, billId);
  const file = image ? new File([image.blob], fileName, { type: "image/png" }) : null;

  const copyPicture = () => {
    if (!image) return null;
    try {
      return navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
    } catch {
      return null; // browser can't put pictures on the clipboard; Save image still works
    }
  };

  const sendWhatsApp = async () => {
    // Phones: the phone's own share menu is the only way a web page can attach the picture,
    // and WhatsApp is in that menu. Computers have no WhatsApp there, so they skip it.
    const phone = window.matchMedia("(pointer: coarse)").matches;
    if (phone && file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    // Open WhatsApp itself with the message and link, and leave the picture on the clipboard
    // to paste into the chat. Both start inside the click so the browser blocks neither.
    const copying = copyPicture();
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    try {
      if (copying) {
        await copying;
        setPasteHint(true);
      }
    } catch {
      // not copied; the message and link still went through
    }
  };

  const saveImage = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = fileName;
    a.click();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: t.share.linkCopied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const more = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: fmt(t.share.message, { title }), url });
      } catch {
        // dismissed
      }
    } else {
      await copyLink();
    }
  };

  const tile = "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[14px] bg-field text-[13px] font-bold text-ink disabled:opacity-50";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.share.title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-[14px] rounded-2xl bg-field p-3">
          <div className="flex h-[118px] w-[82px] shrink-0 -rotate-3 items-start justify-center overflow-hidden bg-[#0e131b] shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt="" className="w-full" />
            ) : (
              <span className="mt-12 text-[10px] text-[#8a96a8]">{t.share.preparing}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold">{t.share.previewTitle}</div>
            <div className="mt-1 text-[13px] leading-[1.45] text-muted">{t.share.previewDesc}</div>
          </div>
        </div>
        <button type="button" onClick={sendWhatsApp} className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-green text-[16px] font-bold text-white">
          <SendIcon />
          {t.share.whatsapp}
        </button>
        {pasteHint ? (
          <div role="status" className="-mt-1.5 rounded-xl bg-green-soft px-3 py-2 text-center text-[13px] font-semibold text-green-soft-ink">
            {t.share.pictureCopied}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={saveImage} disabled={!image} className={tile}>
            <DownloadIcon />
            {t.share.saveImage}
          </button>
          <button type="button" onClick={copyLink} className={tile}>
            <LinkIcon />
            {t.share.copyLink}
          </button>
          <button type="button" onClick={more} className={tile}>
            <MoreIcon />
            {t.share.more}
          </button>
        </div>
        <div className="text-center text-[12px] text-muted">{t.share.note}</div>
      </div>
    </Sheet>
  );
}
