import { ImageResponse } from "next/og";
import { summarize } from "@/lib/bill";
import { getBill } from "@/lib/data/bill";

export const alt = "Splitin receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await getBill(id);
  const s = bill ? summarize(bill.doc, bill.payments) : null;
  const rm = (minor: number) => `RM ${(minor / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f6f7f5", padding: 64, gap: 56, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 360, background: "#fffdf6", padding: 32, gap: 10, boxShadow: "0 12px 30px rgba(0,0,0,0.12)", transform: "rotate(-3deg)" }}>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 30, fontWeight: 700, letterSpacing: 10, color: "#26231f" }}>SPLITIN</div>
          <div style={{ display: "flex", borderTop: "3px dashed #26231f", margin: "6px 0" }} />
          {(bill?.doc.items ?? []).slice(0, 4).map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#26231f" }}>
              <span>{item.name.toUpperCase().slice(0, 14)}</span>
              <span>{(item.amountMinor / 100).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: "flex", borderTop: "3px dashed #26231f", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700, color: "#26231f" }}>
            <span>TOTAL</span>
            <span>{s ? rm(s.total) : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#1c1f1d" }}>
            split<span style={{ color: "#169545" }}>in</span>
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#1c1f1d", lineHeight: 1.05 }}>{bill?.doc.title ?? "Splitin"}</div>
          {s && bill ? (
            <div style={{ display: "flex", fontSize: 32, color: "#667069" }}>
              {rm(s.total)} · {bill.doc.people.length} people · {s.remaining.length} to settle
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
