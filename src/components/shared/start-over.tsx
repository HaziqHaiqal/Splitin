import Link from "next/link";
import type { Dictionary } from "@/i18n";
import { cn } from "@/lib/utils";

/** "Make a new split": back to the home screen from a link with nothing to show. */
export function StartOverButton({ t, className }: { t: Dictionary; className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-xl bg-green px-6 text-[15px] font-bold text-white no-underline",
        className,
      )}
    >
      {t.expired.cta}
    </Link>
  );
}

/** Under the paper when a link has nothing to show: what happened and a way to start over, centred. */
export function StartOverMessage({ t, title, desc }: { t: Dictionary; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center px-5 text-center md:px-1">
      <h1 className="m-0 mt-10 text-[28px] leading-[1.12] font-extrabold tracking-[-0.03em] md:text-[34px]">{title}</h1>
      <p className="m-0 mt-3 max-w-[40ch] text-[15px] leading-[1.5] text-muted">{desc}</p>
      <StartOverButton t={t} className="mt-6 w-full md:w-auto" />
    </div>
  );
}
