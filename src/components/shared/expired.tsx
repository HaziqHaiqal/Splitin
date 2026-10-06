import Link from "next/link";
import { Header } from "@/components/header";
import { Zigzag } from "@/components/receipt/receipt";
import type { Dictionary } from "@/i18n";

export function Expired({ t }: { t: Dictionary }) {
  return (
    <div
      data-paper
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[18px] bg-paper-bg px-5 pb-[22px] text-ink md:max-w-[900px] md:px-6"
    >
      <Header theme={false} />
      {/* phone: receipt, text, button stacked · desktop: text + button left, receipt right */}
      <div className="flex flex-1 flex-col gap-[18px] md:grid md:flex-none md:grid-cols-[minmax(0,1fr)_350px] md:gap-x-12 md:gap-y-8 md:pt-20">
        <div className="relative mt-[30px] md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:self-center">
          <div className="bg-[#fffdf6] p-5 font-mono text-[13px] leading-[1.8] text-[#b5afa4]">
            <div className="text-center font-bold tracking-[0.3em]">SPLITIN</div>
            <div className="my-2 border-t-[1.5px] border-dashed border-[#cfc9be]" />
            <div className="my-2 h-2.5 w-4/5 bg-[#ece7dc]" />
            <div className="my-2 h-2.5 w-3/5 bg-[#ece7dc]" />
            <div className="my-2 h-2.5 w-[70%] bg-[#ece7dc]" />
            <div className="my-2 border-t-[1.5px] border-dashed border-[#cfc9be]" />
            <div className="my-2 h-3 w-full bg-[#e2ddd1]" />
          </div>
          <Zigzag edge="bottom" />
          <div
            className="absolute top-[60px] left-1/2 border-[5px] border-[#c2412b] px-[18px] font-mono text-[42px] font-bold tracking-[0.16em] text-[#c2412b]"
            style={{ transform: "translateX(-50%) rotate(-12deg)" }}
          >
            {t.expired.stamp}
          </div>
        </div>
        <div className="md:col-start-1 md:row-start-1 md:self-end">
          <div className="text-[24px] font-extrabold tracking-[-0.02em] md:text-[44px] md:leading-[1.05]">
            {t.expired.title}
          </div>
          <div className="mt-2 text-[15px] leading-[1.5] text-muted md:mt-4 md:text-[17px]">{t.expired.desc}</div>
        </div>
        <div className="mt-auto md:col-start-1 md:row-start-2 md:mt-0 md:self-start">
          <Link
            href="/"
            className="flex h-14 items-center justify-center rounded-2xl bg-green px-8 text-[16px] font-bold text-white no-underline md:inline-flex"
          >
            {t.expired.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
