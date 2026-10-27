import { MAP_CREDIT } from "../../lib/map-style";
import type { ShareInput } from "../share-input";
import { bitmapFrom, C, canvasToBlob, drawContain, drawCover, drawLabel, drawLogo, drawPin, fitFont, loadFont, roundRect, SANS, wrapText } from "./canvas";
import { createRouteMap } from "./route-map";

// IG 打卡長圖：標題 → 路線地圖 → 每一站 → 拍立得照片牆 → 收服的夥伴 → 文案
// 寬 1080，高度依內容而定

const W = 1080;
const PAD = 60;
const MAX_H = 12000; // iPhone 的畫布最多約 1,600 萬像素

export async function renderLongImage(input: ShareInput, onProgress: (p: number, note: string) => void): Promise<Blob> {
  const hand = input.handFont;
  onProgress(0.05, "準備素材⋯");
  await loadFont(hand, input.title + input.photos.map((p) => p.label ?? "").join("") + "這趟收服的夥伴路線每一站");
  const photos = await Promise.all(input.photos.slice(0, 8).map((p) => bitmapFrom(p.blob)));
  const buddies = await Promise.all(input.buddies.slice(0, 6).map((b) => bitmapFrom(b.image)));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = MAX_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, 0, W, MAX_H);
  ctx.textBaseline = "alphabetic";

  // ---------- 標題 ----------
  let y = PAD;
  drawLogo(ctx, PAD, y, 64);
  ctx.fillStyle = C.wood;
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText("我的旅遊遊記 · TRAVEL JOURNAL", PAD + 84, y + 42);
  y += 64 + 50;
  ctx.fillStyle = C.ink;
  const size = fitFont(ctx, input.title, hand, 700, 110, W - PAD * 2);
  y += size;
  ctx.fillText(input.title, PAD, y);
  y += 60;
  ctx.fillStyle = C.muted;
  ctx.font = `500 36px ${SANS}`;
  ctx.fillText(input.subtitle, PAD, y);
  y += 40;
  let x = PAD;
  for (const chip of [`📍 ${input.stops.length} 站`, `📷 ${input.photos.length} 張`, `🐾 ${input.buddies.length} 位夥伴`]) {
    ctx.font = `600 28px ${SANS}`;
    const w = ctx.measureText(chip).width + 40;
    roundRect(ctx, x, y, w, 54, 27);
    ctx.fillStyle = C.moss;
    ctx.fill();
    ctx.fillStyle = C.forest;
    ctx.fillText(chip, x + 20, y + 37);
    x += w + 14;
  }
  y += 54 + 50;

  // ---------- 路線地圖 ----------
  if (input.stops.length > 0) {
    onProgress(0.2, "畫路線地圖⋯");
    const size = W - PAD * 2;
    const map = await createRouteMap(size / 2, size / 2, 2);
    try {
      const points = input.stops.map((s) => [s.lon, s.lat] as [number, number]);
      await map.show(map.fit(points, 90, 13));
      ctx.save();
      roundRect(ctx, PAD, y, size, size, 36);
      ctx.clip();
      ctx.drawImage(map.canvas, PAD, y, size, size);
      ctx.translate(PAD, y);
      const pts = points.map(([lon, lat]) => map.project(lon, lat));
      if (pts.length > 1) {
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.setLineDash([22, 14]);
        ctx.strokeStyle = C.pin;
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      pts.forEach((q, i) => drawPin(ctx, q.x, q.y, 40, String(i + 1)));
      if (pts.length <= 4) input.stops.forEach((s, i) => s.name && drawLabel(ctx, s.name.slice(0, 10), pts[i].x, pts[i].y - 110, 26));
      ctx.font = `400 18px ${SANS}`;
      ctx.fillStyle = "rgba(31,42,36,0.7)";
      ctx.textAlign = "right";
      ctx.fillText(MAP_CREDIT, size - 18, size - 16);
      ctx.textAlign = "left";
      ctx.restore();
    } finally {
      map.destroy();
    }
    y += size + 50;

    // ---------- 每一站 ----------
    const stops = input.stops.slice(0, 12);
    stops.forEach((s, i) => {
      const cy = y + 30;
      if (i < stops.length - 1) {
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(PAD + 28, cy + 28);
        ctx.lineTo(PAD + 28, cy + 82);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(PAD + 28, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = C.pin;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 28px ${SANS}`;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), PAD + 28, cy + 10);
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = `700 36px ${SANS}`;
      ctx.fillText((s.name ?? `第 ${i + 1} 站`).slice(0, 18), PAD + 80, cy + 12);
      if (s.date) {
        ctx.fillStyle = C.muted;
        ctx.font = `400 26px ${SANS}`;
        ctx.textAlign = "right";
        ctx.fillText(s.date.slice(0, 10).replaceAll("-", "."), W - PAD, cy + 10);
        ctx.textAlign = "left";
      }
      y += 84;
    });
    y += 30;
  }

  // ---------- 拍立得照片牆（兩欄，放在比較短的那一欄）----------
  if (photos.length > 0) {
    onProgress(0.6, "排照片⋯");
    const colW = (W - PAD * 2 - 30) / 2;
    const cols = [y, y];
    photos.forEach((img, i) => {
      const c = cols[0] <= cols[1] ? 0 : 1;
      const px = PAD + c * (colW + 30);
      const py = cols[c];
      const ph = Math.max(300, Math.min(620, (colW - 32) * (img.height / img.width)));
      const cardH = ph + 32 + 76;
      ctx.save();
      ctx.translate(px + colW / 2, py + cardH / 2);
      ctx.rotate((((i % 3) - 1) * 1.6 * Math.PI) / 180);
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = C.card;
      ctx.fillRect(-colW / 2, -cardH / 2, colW, cardH);
      ctx.shadowColor = "transparent";
      ctx.save();
      ctx.beginPath();
      ctx.rect(-colW / 2 + 16, -cardH / 2 + 16, colW - 32, ph);
      ctx.clip();
      drawCover(ctx, img, -colW / 2 + 16, -cardH / 2 + 16, colW - 32, ph);
      ctx.restore();
      ctx.fillStyle = C.ink;
      ctx.font = `700 34px ${hand}`;
      ctx.textAlign = "center";
      ctx.fillText(input.photos[i].label ?? input.title, 0, cardH / 2 - 30, colW - 40);
      ctx.restore();
      cols[c] += cardH + 34;
    });
    ctx.textAlign = "left";
    y = Math.max(...cols) + 20;
  }

  // ---------- 這趟收服的夥伴 ----------
  if (buddies.length > 0) {
    ctx.fillStyle = C.forest;
    ctx.font = `700 56px ${hand}`;
    y += 56;
    ctx.fillText("🐾 這趟收服的夥伴", PAD, y);
    y += 36;
    const cardW = (W - PAD * 2 - 2 * 24) / 3;
    const cardH = cardW + 70;
    buddies.forEach((img, i) => {
      const bx = PAD + (i % 3) * (cardW + 24);
      const by = y + Math.floor(i / 3) * (cardH + 24);
      roundRect(ctx, bx, by, cardW, cardH, 28);
      ctx.fillStyle = C.moss;
      ctx.fill();
      ctx.save();
      if (input.buddies[i].cutout) {
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 12;
        drawContain(ctx, img, bx + 20, by + 16, cardW - 40, cardW - 30);
      } else {
        ctx.beginPath();
        ctx.arc(bx + cardW / 2, by + cardW / 2, cardW / 2 - 26, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, img, bx + 26, by + 26, cardW - 52, cardW - 52);
      }
      ctx.restore();
      ctx.fillStyle = C.ink;
      ctx.font = `700 32px ${SANS}`;
      ctx.textAlign = "center";
      ctx.fillText(input.buddies[i].name.slice(0, 8), bx + cardW / 2, by + cardH - 30);
      ctx.textAlign = "left";
    });
    y += Math.ceil(buddies.length / 3) * (cardH + 24) + 30;
  }

  // ---------- 文案 ----------
  ctx.font = `500 34px ${SANS}`;
  const lines = wrapText(ctx, input.caption, W - PAD * 2 - 80);
  const tags = input.hashtags.map((h) => `#${h}`).join(" ");
  ctx.font = `600 30px ${SANS}`;
  const tagLines = tags ? wrapText(ctx, tags, W - PAD * 2 - 80) : [];
  const boxH = 50 + lines.length * 54 + (tagLines.length ? 20 + tagLines.length * 46 : 0) + 30;
  roundRect(ctx, PAD, y, W - PAD * 2, boxH, 32);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.stroke();
  let ty = y + 70;
  ctx.fillStyle = C.ink;
  ctx.font = `500 34px ${SANS}`;
  lines.forEach((l) => {
    ctx.fillText(l, PAD + 40, ty);
    ty += 54;
  });
  ctx.fillStyle = C.forest;
  ctx.font = `600 30px ${SANS}`;
  ty += 10;
  tagLines.forEach((l) => {
    ctx.fillText(l, PAD + 40, ty);
    ty += 46;
  });
  y += boxH + 50;

  // ---------- 頁尾 ----------
  drawLogo(ctx, W / 2 - 150, y, 48);
  ctx.fillStyle = C.muted;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText("my-outdoor-journal.vercel.app", W / 2 - 88, y + 34);
  y += 48 + PAD;

  onProgress(0.9, "輸出圖片⋯");
  const out = document.createElement("canvas");
  out.width = W;
  out.height = Math.min(MAX_H, Math.ceil(y));
  out.getContext("2d")!.drawImage(canvas, 0, 0);
  photos.forEach((p) => p.close());
  buddies.forEach((b) => b.close());
  const blob = await canvasToBlob(out, "image/jpeg", 0.9);
  onProgress(1, "完成！");
  return blob;
}
