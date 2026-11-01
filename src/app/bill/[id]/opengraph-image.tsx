import { ImageResponse } from "next/og";
import { getBill } from "@/lib/data/bill";

export const alt = "Splitin receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bar = (width: string, height = 16) => <div style={{ display: "flex", width, height, background: "#ecebe7" }} />;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await getBill(id);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#fbfbfa",
        padding: 64,
        gap: 56,
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 360,
          background: "#ffffff",
          padding: 32,
          gap: 16,
          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
          transform: "rotate(-3deg)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 10,
            color: "#37352f",
          }}
        >
          SPLITIN
        </div>
        <div style={{ display: "flex", borderTop: "3px dashed #37352f" }} />
        {bar("78%")}
        {bar("56%")}
        {bar("68%")}
        <div style={{ display: "flex", borderTop: "3px dashed #37352f" }} />
        {bar("100%", 22)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#37352f" }}>
          split<span style={{ color: "#2f7552" }}>in</span>
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#37352f", lineHeight: 1.05 }}>
          {bill?.doc.title ?? "Splitin"}
        </div>
      </div>
    </div>,
    size,
  );
}
