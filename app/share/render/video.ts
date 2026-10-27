import type { ShareInput } from "../share-input";
import {
  bitmapFrom,
  C,
  clamp,
  drawContain,
  drawCover,
  drawLabel,
  drawLogo,
  drawPin,
  easeBack,
  easeInOut,
  easeOut,
  fitFont,
  lerp,
  loadFont,
  roundRect,
  SANS,
  wrapText,
} from "./canvas";
import { encodeVideo, H, W } from "./encode";
import { createRouteMap, type Camera, type RouteMap } from "./route-map";
import { MAP_CREDIT } from "../../lib/map-style";

// 15 秒直式短片（1080×1920，IG Reels／限動尺寸）
// 片頭 → 3D 路線動畫 → 照片 → 這趟收服的夥伴 → 片尾

const TOTAL = 15;
const FADE = 0.35;

type Segment = { kind: "intro" | "route" | "photos" | "buddies" | "outro"; start: number; end: number };

function plan(input: ShareInput): Segment[] {
  const parts: [Segment["kind"], number][] = [["intro", 2]];
  const hasRoute = input.stops.length > 0;
  const hasPhotos = input.photos.length > 0;
  if (hasRoute) parts.push(["route", hasPhotos ? 5.6 : 9]);
  if (input.buddies.length > 0) parts.push(["buddies", 2.4]);
  parts.push(["outro", 2]);
  const used = parts.reduce((s, p) => s + p[1], 0);
  if (hasPhotos) parts.splice(hasRoute ? 2 : 1, 0, ["photos", Math.max(2, TOTAL - used)]);
  // 剩下的時間（沒有照片時）加給片頭
  const scale = TOTAL / parts.reduce((s, p) => s + p[1], 0);
  let t = 0;
  return parts.map(([kind, d]) => {
    const seg = { kind, start: t, end: t + d * scale };
    t = seg.end;
    return seg;
  });
}

// 沿著路線走：回傳走到 f（0～1）時的位置
function along(points: [number, number][], f: number): [number, number] {
  if (points.length === 1) return points[0];
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = f * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? clamp(d / lens[i]) : 1;
      return [lerp(points[i][0], points[i + 1][0], t), lerp(points[i][1], points[i + 1][1], t)];
    }
    d -= lens[i];
  }
  return points[points.length - 1];
}

// 每一站在路線上的位置（0～1），走到那裡時圖釘才會落下
function stopFractions(points: [number, number][]) {
  if (points.length === 1) return [0];
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return [0, ...lens.map((l) => (acc += l) / total)];
}

export async function renderVideo(input: ShareInput, onProgress: (p: number, note: string) => void): Promise<Blob> {
  let canvas!: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;
  const hand = input.handFont;

  onProgress(0, "準備素材⋯");
  await loadFont(hand, input.title + input.subtitle + input.buddies.map((b) => b.name).join("") + "這趟收服的夥伴路線站");
  const photos = await Promise.all(input.photos.slice(0, 6).map((p) => bitmapFrom(p.blob)));
  const buddies = await Promise.all(input.buddies.slice(0, 6).map((b) => bitmapFrom(b.image)));
  // 照片的模糊背景：縮到很小再放大，就是便宜又漂亮的模糊
  const blurred = photos.map((img) => {
    const tiny = document.createElement("canvas");
    tiny.width = 27;
    tiny.height = 48;
    drawCover(tiny.getContext("2d")!, img, 0, 0, 27, 48);
    return tiny;
  });

  const points = input.stops.map((s) => [s.lon, s.lat] as [number, number]);
  const fractions = stopFractions(points);
  let map: RouteMap | null = null;
  let overview: Camera | null = null;
  if (points.length > 0) {
    onProgress(0.02, "載入地圖⋯");
    map = await createRouteMap(W / 2, H / 2, 2);
    overview = map.fit(points, 140, 14);
  }

  const segments = plan(input);
  const prev = document.createElement("canvas"); // 上一段的最後一格，用來做轉場淡出
  const ending = document.createElement("canvas"); // 路線全景，給片尾當背景
  ending.width = W / 2;
  ending.height = H / 2;
  let hasEnding = false;

  // ---------- 每一段怎麼畫 ----------

  function drawIntro(t: number, seg: Segment) {
    const p = (t - seg.start) / (seg.end - seg.start);
    if (photos[0]) drawCover(ctx, photos[0], 0, 0, W, H, lerp(1.18, 1.04, easeOut(p)));
    else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#a7d3df");
      g.addColorStop(1, C.forest);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    const a = easeOut(clamp((t - seg.start - 0.2) / 0.7));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 60);
    drawLogo(ctx, 80, 1370, 72);
    ctx.fillStyle = "#fff";
    ctx.font = `700 34px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.fillText("我的旅遊遊記 · TRAVEL JOURNAL", 172, 1406);
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    const size = fitFont(ctx, input.title, hand, 700, 130, W - 160);
    ctx.textBaseline = "alphabetic";
    ctx.fillText(input.title, 80, 1500 + size * 0.75);
    ctx.font = `500 44px ${SANS}`;
    ctx.fillText(input.subtitle, 80, 1500 + size * 0.75 + 90);
    ctx.restore();
  }

  async function drawRoute(t: number, seg: Segment) {
    if (!map || !overview) return;
    const p = (t - seg.start) / (seg.end - seg.start);
    let camera: Camera;
    let head: [number, number];
    let travelled: number;
    if (points.length === 1) {
      // 只有一站：從高空俯衝下來、繞著圖釘轉
      head = points[0];
      travelled = 1;
      const e = easeInOut(clamp(p / 0.85));
      camera = { center: head, zoom: lerp(overview.zoom - 5, overview.zoom + 1.5, e), pitch: lerp(0, 60, e), bearing: lerp(-50, 20, p) };
    } else {
      // 多站：鏡頭跟著紅線一站一站走，最後拉遠看全貌
      const followEnd = 0.78;
      travelled = easeInOut(clamp(p / followEnd));
      head = along(points, travelled);
      const follow: Camera = { center: head, zoom: Math.min(overview.zoom + 1.6, 14), pitch: 58, bearing: lerp(-28, 18, p) };
      const back = easeInOut(clamp((p - followEnd) / (1 - followEnd)));
      camera = {
        center: [lerp(follow.center[0], overview.center[0], back), lerp(follow.center[1], overview.center[1], back)],
        zoom: lerp(follow.zoom, overview.zoom, back),
        pitch: lerp(58, 35, back),
        bearing: lerp(follow.bearing!, 0, back),
      };
    }
    await map.show(camera);
    ctx.drawImage(map.canvas, 0, 0, W, H);

    // 走過的紅線：白邊＋紅線
    const done = points.filter((_, i) => fractions[i] <= travelled).map(([lon, lat]) => map!.project(lon, lat));
    const h = map.project(head[0], head[1]);
    if (points.length > 1) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      [...done, h].forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 20;
      ctx.stroke();
      ctx.strokeStyle = C.pin;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();
    }

    // 走到的站，圖釘彈出來，旁邊掛地名
    const segSecs = seg.end - seg.start;
    input.stops.forEach((s, i) => {
      const reachedAt = points.length === 1 ? 0.15 : fractions[i] * 0.78;
      const since = (p - reachedAt) * segSecs;
      if (since < 0) return;
      const q = map!.project(s.lon, s.lat);
      const pop = easeBack(clamp(since / 0.45));
      drawPin(ctx, q.x, q.y, 54, String(i + 1), pop);
      if (s.name) drawLabel(ctx, s.name.slice(0, 12), q.x, q.y - 150, 34, clamp(since / 0.4));
    });
    // 前進中的小紅點
    if (points.length > 1 && travelled < 1) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 16 + Math.sin(t * 10) * 4, 0, Math.PI * 2);
      ctx.fillStyle = C.pin;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }

    // 上方標題列
    const top = ctx.createLinearGradient(0, 0, 0, 320);
    top.addColorStop(0, "rgba(0,0,0,0.45)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 320);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 64px ${hand}`;
    ctx.fillText(input.title.slice(0, 14), 70, 150);
    ctx.font = `600 36px ${SANS}`;
    ctx.fillText(`📍 ${input.stops.length} 站路線`, 70, 215);
    ctx.font = `400 22px ${SANS}`;
    ctx.fillStyle = "rgba(31,42,36,0.75)";
    ctx.textAlign = "right";
    ctx.fillText(MAP_CREDIT, W - 24, H - 24);
    ctx.textAlign = "left";

    // 記住目前這格（最後留下的就是路線全景），片尾用
    ending.getContext("2d")!.drawImage(canvas, 0, 0, ending.width, ending.height);
    hasEnding = true;
  }

  function drawPhotos(t: number, seg: Segment) {
    const n = photos.length;
    const each = (seg.end - seg.start) / n;
    const local = t - seg.start;
    const i = Math.min(n - 1, Math.floor(local / each));
    const draw = (j: number, alpha: number) => {
      const img = photos[j];
      const q = clamp((local - j * each) / each, -0.5, 1.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(blurred[j], 0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, W, H);
      const portrait = img.height / img.width >= 1.2;
      const zoom = lerp(1, 1.12, q);
      const label = input.photos[j].label;
      if (portrait) {
        drawCover(ctx, img, 0, 0, W, H, zoom, j % 2 ? 0.4 : 0.6, 0.5);
        const g = ctx.createLinearGradient(0, H - 420, 0, H);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.6)");
        ctx.fillStyle = g;
        ctx.fillRect(0, H - 420, W, 420);
        if (label) {
          ctx.fillStyle = "#fff";
          ctx.font = `700 60px ${hand}`;
          ctx.fillText(`📍 ${label}`.slice(0, 16), 70, H - 150);
        }
      } else {
        // 橫的照片做成拍立得，稍微歪一點比較有手作感
        const pw = 940;
        const ph = Math.min(1100, (pw - 48) * (img.height / img.width));
        const cx = W / 2;
        const cy = H / 2 - 40;
        ctx.translate(cx, cy);
        ctx.rotate(((j % 2 ? 1 : -1) * 2.2 * Math.PI) / 180);
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 16;
        ctx.fillStyle = C.card;
        ctx.fillRect(-pw / 2, -ph / 2 - 24, pw, ph + 190);
        ctx.shadowColor = "transparent";
        ctx.save();
        ctx.beginPath();
        ctx.rect(-pw / 2 + 24, -ph / 2, pw - 48, ph);
        ctx.clip();
        drawCover(ctx, img, -pw / 2 + 24, -ph / 2, pw - 48, ph, zoom, j % 2 ? 0.35 : 0.65, 0.5);
        ctx.restore();
        ctx.fillStyle = C.ink;
        ctx.font = `700 56px ${hand}`;
        ctx.textAlign = "center";
        ctx.fillText(label ?? input.title, 0, ph / 2 + 110, pw - 80);
      }
      ctx.restore();
    };
    draw(i, 1);
    // 下一張淡入
    const intoNext = local - (i + 1) * each + FADE;
    if (i + 1 < n && intoNext > 0) draw(i + 1, clamp(intoNext / FADE));
    // 頁數小圓點
    for (let d = 0; d < n; d++) {
      ctx.beginPath();
      ctx.arc(W / 2 + (d - (n - 1) / 2) * 34, H - 70, d === i ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = d === i ? "#fff" : "rgba(255,255,255,0.5)";
      ctx.fill();
    }
  }

  function drawBuddies(t: number, seg: Segment) {
    const local = t - seg.start;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#cfe8f0");
    sky.addColorStop(0.62, "#eef5e4");
    sky.addColorStop(0.62, "#b9d29a");
    sky.addColorStop(1, "#8fbf6f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 遠山
    ctx.fillStyle = "#a9c98f";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, H * 0.62 - 90 - Math.sin(x / 140) * 50);
    ctx.lineTo(W, H * 0.62);
    ctx.fill();

    ctx.fillStyle = C.forest;
    ctx.textAlign = "center";
    ctx.font = `700 92px ${hand}`;
    const a = easeOut(clamp(local / 0.5));
    ctx.globalAlpha = a;
    ctx.fillText("這趟收服的夥伴", W / 2, 330 - (1 - a) * 40);
    ctx.font = `600 44px ${SANS}`;
    ctx.fillStyle = C.wood;
    ctx.fillText(`🐾 × ${buddies.length}`, W / 2, 420);
    ctx.globalAlpha = 1;

    const n = buddies.length;
    const rows = n > 3 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const size = n === 1 ? 560 : n === 2 ? 440 : 300;
    buddies.forEach((img, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, n - row * perRow);
      const cx = W / 2 + (col - (inRow - 1) / 2) * (W / Math.max(inRow, 2.4));
      const groundY = rows === 1 ? H * 0.74 : H * (0.6 + row * 0.22);
      const since = local - 0.3 - i * 0.18;
      if (since < 0) return;
      const pop = easeBack(clamp(since / 0.5));
      const hop = Math.abs(Math.sin(t * 5 + i * 1.3)) * 22;
      ctx.save();
      ctx.translate(cx, groundY);
      // 影子
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(0, 6, size * 0.32, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -hop);
      ctx.scale(pop, pop);
      if (input.buddies[i].cutout) {
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 16;
        drawContain(ctx, img, -size / 2, -size, size, size);
      } else {
        // 沒去背的：圓形貼紙
        const r = size * 0.4;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, -r - 10, r, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -r - 10, r - 10, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, img, -r, -2 * r - 10, 2 * r, 2 * r);
        ctx.restore();
      }
      ctx.restore();
      drawLabel(ctx, input.buddies[i].name.slice(0, 8), cx, groundY + 90, 34, clamp(since / 0.4));
    });
    ctx.textAlign = "left";
  }

  function drawOutro(t: number, seg: Segment) {
    const p = (t - seg.start) / (seg.end - seg.start);
    if (hasEnding) ctx.drawImage(ending, 0, 0, W, H);
    else if (photos[0]) drawCover(ctx, photos[0], 0, 0, W, H, 1.04);
    else {
      ctx.fillStyle = C.forest;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = "rgba(20,30,24,0.55)";
    ctx.fillRect(0, 0, W, H);

    const a = easeOut(clamp(p / 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    const cardY = 520;
    roundRect(ctx, 70, cardY, W - 140, 880, 48);
    ctx.fillStyle = "rgba(255,252,246,0.95)";
    ctx.fill();
    drawLogo(ctx, W / 2 - 60, cardY + 70, 120);
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    const size = fitFont(ctx, input.title, hand, 700, 92, W - 260);
    ctx.fillText(input.title, W / 2, cardY + 270 + size * 0.3);
    ctx.fillStyle = C.muted;
    ctx.font = `500 38px ${SANS}`;
    ctx.fillText(input.subtitle, W / 2, cardY + 370);
    ctx.fillStyle = C.ink;
    ctx.font = `500 36px ${SANS}`;
    wrapText(ctx, input.caption.replace(/\n+/g, " "), W - 280)
      .slice(0, 5)
      .forEach((line, i) => ctx.fillText(line, W / 2, cardY + 460 + i * 56));
    ctx.fillStyle = C.forest;
    ctx.font = `600 32px ${SANS}`;
    ctx.fillText(input.hashtags.slice(0, 4).map((h) => `#${h}`).join(" "), W / 2, cardY + 820, W - 220);
    ctx.fillStyle = "#fff";
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText("我的旅遊遊記 · my-outdoor-journal.vercel.app", W / 2, H - 200);
    ctx.restore();
    ctx.textAlign = "left";
    // 最後 0.4 秒淡出成黑
    if (p > 0.8) {
      ctx.fillStyle = `rgba(0,0,0,${(p - 0.8) / 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- 一格一格畫 ----------

  let segIndex = -1;
  try {
    const blob = await encodeVideo(
      TOTAL,
      async (t, _f, stage) => {
        ({ canvas, ctx } = stage);
        const i = Math.max(0, segments.findIndex((s) => t < s.end));
        const seg = segments[i] ?? segments[segments.length - 1];
        if (i !== segIndex) {
          // 換段之前，把上一段最後一格存起來做淡出
          if (segIndex >= 0) {
            prev.width = canvas.width;
            prev.height = canvas.height;
            prev.getContext("2d")!.drawImage(canvas, 0, 0);
          }
          segIndex = i;
        }
        if (seg.kind === "intro") drawIntro(t, seg);
        else if (seg.kind === "route") await drawRoute(t, seg);
        else if (seg.kind === "photos") drawPhotos(t, seg);
        else if (seg.kind === "buddies") drawBuddies(t, seg);
        else drawOutro(t, seg);
        const into = t - seg.start;
        if (i > 0 && into < FADE) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1 - into / FADE;
          ctx.drawImage(prev, 0, 0);
          ctx.restore();
        }
      },
      (p) => onProgress(0.05 + p * 0.93, segments[Math.max(0, segIndex)]?.kind === "route" ? "畫路線動畫⋯" : "合成影片⋯"),
    );
    onProgress(1, "完成！");
    return blob;
  } finally {
    map?.destroy();
    photos.forEach((p) => p.close());
    buddies.forEach((b) => b.close());
  }
}
