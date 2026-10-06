import { Header } from "@/components/header";
import { ErrorSlip, Printer } from "@/components/receipt/printer";
import type { Dictionary } from "@/i18n";
import { StartOverMessage } from "./start-over";

/**
 * A link that never led to a receipt (mistyped, cut short) or any unknown page: one column on the printer tray,
 * the same on every screen size, centred in the space under the header. The printer's error slip on top, then the
 * message and a way to start over.
 */
export function NotFound({ t }: { t: Dictionary }) {
  return (
    <div className="min-h-dvh bg-tray text-ink">
      <div className="h-14 overflow-hidden bg-tray px-4 md:h-16 md:px-6">
        <Header />
      </div>
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-[440px] flex-col items-center justify-center px-3 py-8 text-center md:min-h-[calc(100dvh-4rem)] md:px-4">
        <Printer>
          <ErrorSlip title={t.notFound.slipTitle} hint={t.notFound.slipHint} />
        </Printer>
        <StartOverMessage t={t} title={t.notFound.title} desc={t.notFound.desc} />
      </main>
    </div>
  );
}
