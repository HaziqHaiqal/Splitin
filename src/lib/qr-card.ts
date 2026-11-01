export type QrModules = { size: number; get: (row: number, column: number) => number };
export type QrCardText = { name: string | null; bank: string | null; kind: string | null };

const WIDTH = 300;
const SCALE = 3.6;
const EDGE = 30;
const QR_TOP = 40;
const QR_SIZE = 196;
const INK = "#37352f";
const WORD = "Splitin ";
const WORD_TOP = 46;
const WORD_TALL = 60;
const LINES = [
  { key: "name", size: 15, weight: 800, color: INK, gap: 19 },
  { key: "bank", size: 12.5, weight: 600, color: INK, gap: 18 },
  { key: "kind", size: 11, weight: 700, color: "#2f7552", gap: 17 },
] as const;

const plateBottom = (text: QrCardText) =>
  LINES.reduce((y, line) => (text[line.key] ? y + line.gap : y), QR_TOP + QR_SIZE) + 14;

export const qrCardSize = (text: QrCardText) => ({
  width: Math.round(WIDTH * SCALE),
  height: Math.round((plateBottom(text) + EDGE) * SCALE),
});

function drawQrPlate(modules: QrModules, text: QrCardText, family: string) {
  const plate = document.createElement("canvas");
  Object.assign(plate, qrCardSize(text));
  const ctx = plate.getContext("2d");
  if (!ctx) return plate;

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.save();
  ctx.shadowColor = "rgba(4, 51, 26, 0.4)";
  ctx.shadowBlur = 14 * SCALE;
  ctx.shadowOffsetY = 5 * SCALE;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(EDGE, EDGE, WIDTH - EDGE * 2, plateBottom(text) - EDGE, 10);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";
  let y = QR_TOP + QR_SIZE;
  for (const line of LINES) {
    const words = text[line.key];
    if (!words) continue;
    y += line.gap;
    const room = WIDTH - EDGE * 2 - 16;
    ctx.font = `${line.weight} ${line.size}px ${family}`;
    const wide = ctx.measureText(words).width;
    if (wide > room) ctx.font = `${line.weight} ${(line.size * room) / wide}px ${family}`;
    ctx.fillStyle = line.color;
    ctx.fillText(words, WIDTH / 2, y);
  }

  const box = QR_SIZE * SCALE;
  const cell = Math.floor(box / (modules.size + 4));
  const left = Math.round((plate.width - cell * modules.size) / 2);
  const top = Math.round(QR_TOP * SCALE + (box - cell * modules.size) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  for (let row = 0; row < modules.size; row++)
    for (let column = 0; column < modules.size; column++)
      if (modules.get(row, column)) ctx.fillRect(left + column * cell, top + row * cell, cell, cell);
  return plate;
}

function drawQrWord(family: string) {
  const word = document.createElement("canvas");
  const ctx = word.getContext("2d");
  if (!ctx) return word;
  const setUp = () => {
    ctx.font = `800 ${44 * SCALE}px ${family}`;
    ctx.letterSpacing = `${-1.3 * SCALE}px`;
    ctx.fillStyle = "#3fc377";
  };
  setUp();
  word.width = Math.ceil(ctx.measureText(WORD).width);
  word.height = Math.ceil(WORD_TALL * SCALE);
  setUp();
  ctx.fillText(WORD, 0, WORD_TOP * SCALE);
  return word;
}

export async function loadQrCard(canvas: HTMLCanvasElement, code: string, text: QrCardText) {
  const { create } = await import("qrcode");
  const family = getComputedStyle(canvas).fontFamily;
  await Promise.allSettled([600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px ${family}`)));
  return { plate: drawQrPlate(create(code).modules, text, family), word: drawQrWord(family) };
}

export function drawQrCard(
  canvas: HTMLCanvasElement,
  plate: HTMLCanvasElement,
  word: HTMLCanvasElement,
  progress: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const height = canvas.height / SCALE;
  const slide = progress >= 1 ? 0 : 90 * 2 ** (-10 * progress);

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, WIDTH, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, WIDTH, height, 20);
  ctx.clip();
  ctx.fillStyle = "#168a43";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.translate(WIDTH / 2, height / 2);
  ctx.rotate((-14 * Math.PI) / 180);
  ctx.translate(-WIDTH / 2, -height / 2);
  const step = word.width / SCALE;
  for (let row = 0; row < 12; row++)
    for (let x = row % 2 ? -250 + slide : -190 - slide; x < WIDTH + 60; x += step)
      ctx.drawImage(word, x, -90 + row * 46 - WORD_TOP, step, word.height / SCALE);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(plate, 0, 0);
}
