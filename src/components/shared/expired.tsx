import { FadedPaper, PrinterPage } from "@/components/receipt/printer";
import type { Dictionary } from "@/i18n";
import { StartOverButton, StartOverMessage } from "./start-over";

export function Expired({ t }: { t: Dictionary }) {
  return (
    <PrinterPage
      side={
        <>
          <h1 className="m-0 mt-12 text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em]">{t.expired.title}</h1>
          <p className="m-0 max-w-[44ch] text-[15px] leading-[1.5] text-muted">{t.expired.desc}</p>
          <StartOverButton t={t} className="md:self-start" />
        </>
      }
      paper={<FadedPaper stamp={t.expired.stamp} />}
      phoneBelow={<StartOverMessage t={t} title={t.expired.title} desc={t.expired.desc} />}
      phoneCenter
    />
  );
}
