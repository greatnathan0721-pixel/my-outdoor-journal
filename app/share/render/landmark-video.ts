import { MAP_CREDIT } from "../../lib/map-style";
import type { ShareInput } from "../share-input";
import { fmtDist, km, travelFor, TRAVEL_LABEL, zoomForDistance, type Scene, type Travel } from "../storyboard";
import { bitmapFrom, C, clamp, drawCover, drawLogo, easeBack, easeInOut, easeOut, fitFont, lerp, loadFont, roundRect, SANS } from "./canvas";
import { encodeVideo, FPS, H, W } from "./encode";
import { sceneModel, subjectOf, type LandmarkModel } from "./landmark-model";
import { createRouteMap, type Camera } from "./route-map";

// 3D 地標打卡短片（參考 IG 上流行的「地圖插釘 → 地標從地圖長出來 → 鑽進照片」）
//
// 片頭（被結尾特效「砸過」的標題，一秒內抓住目光）
// → 每一站：圖釘落下 → 地圖傾斜、地標模型／主角從地圖長出來 → 鏡頭鑽進去變成照片
// → 站與站之間：在真實地圖上用腳印（或夥伴帶路、開車、飛機）走到下一站
// → 結尾：最後一張照片的主角衝出來跟標題互動，停在片尾畫面（＝片頭），IG 循環播放時無縫接回開頭
//
// IG 會用帳號名稱和按鈕蓋住畫面最上面約 250px、最下面約 400px，文字都放在中間的安全區

const OPEN = 0.8;
const FINALE = 2.8;
const SAFE_TOP = 270;
const SAFE_BOTTOM = H - 430;
const TITLE_Y = 860; // 片尾標題的中心
const MAP_PAD = { top: 380, bottom: 0, left: 0, right: 0 };
const MAX_ZOOM = 17.6;
const MIN_GAP_KM = 0.045; // 相鄰兩站在影片裡至少相隔 45 公尺

function spreadApart(list: Scene[]): Scene[] {
  const out = list.map((s) => ({ ...s }));
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1];
    const b = out[i];
    const d = km(a, b);
    if (d >= MIN_GAP_KM) continue;
    // 有一點點距離就沿著原本的方向拉開；完全同一點就換個角度（黃金角，才不會都往同一邊）
    const ang = d > 0.002 ? Math.atan2(b.lat - a.lat, (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180)) : i * 2.39996 + 0.6;
    b.lat = a.lat + (MIN_GAP_KM * Math.sin(ang)) / 111.32;
    b.lon = a.lon + (MIN_GAP_KM * Math.cos(ang)) / (111.32 * Math.cos((a.lat * Math.PI) / 180));
  }
  return out;
}

// 站數越多，每段越短，總長度盡量在 15～22 秒
function pace(n: number) {
  if (n <= 3) return { scene: 2.8, move: 1.4 };
  if (n <= 4) return { scene: 2.5, move: 1.2 };
  return { scene: 2.2, move: 1.0 };
}

type Part = { kind: "open" | "scene" | "move" | "finale"; i: number; start: number; end: number };

// 固定種子的亂數，每次生成的粒子位置都一樣（片頭和片尾才會一模一樣）
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function renderLandmarkVideo(
  input: ShareInput,
  ai: { key: string; model: string } | null,
  onProgress: (p: number, note: string) => void,
): Promise<Blob> {
  const { finale, guide } = input.story;
  // 照片 GPS 幾乎一樣（同一個點連拍）的站，在影片裡錯開一點，腳印才能從 A 走到 B，而不是原地打轉
  const scenes = spreadApart(input.story.scenes);
  if (scenes.length === 0) throw new Error("沒有可以用的照片：至少要選一張有地點的照片");
  const hand = input.handFont;
  const watermark = !ai;
  const n = scenes.length;
  const { scene: S, move: M } = pace(n);

  // ---------- 先準備好每一站的模型、照片、結尾主角 ----------
  onProgress(0.01, "準備素材⋯");
  await loadFont(hand, input.title + input.subtitle + scenes.map((s) => s.label).join("") + "第站用的做");
  const needAi = scenes.filter((s) => s.pop === "landmark" && ai).length;
  const models: (LandmarkModel | null)[] = [];
  for (let i = 0; i < n; i++) {
    const s = scenes[i];
    const usesAi = s.pop === "landmark" && !!ai;
    if (s.pop !== "photo")
      onProgress(0.02 + (i / n) * (needAi ? 0.55 : 0.2), usesAi ? `AI 正在做第 ${i + 1} 站的 3D 模型（每站約 30～60 秒）⋯` : `第 ${i + 1} 站的主角去背⋯`);
    models.push(await (sceneModel({ id: s.photoId, blob: s.blob }, s.pop, s.point, s.label, ai) ?? Promise.resolve(null)));
  }
  const photos = await Promise.all(scenes.map((s) => bitmapFrom(s.blob)));
  const last = n - 1;
  const hero = finale.action === "freeze" ? null : await subjectOf({ id: scenes[last].photoId, blob: scenes[last].blob }, finale.point);
  const action = hero ? finale.action : "freeze";
  const impact = hero ? finale.impact : "stamp";
  const guideImg = guide ? await bitmapFrom(guide.image) : null;
  const base = needAi ? 0.6 : 0.25;

  onProgress(base, "載入地圖⋯");
  const map = await createRouteMap(W / 2, H / 2, 2);

  // 每一站的地圖放大程度：跟隔壁站很近（例如同一座島）就放大，讓兩站在畫面上拉開、看得出是從 A 走到 B
  // 最多放大到 17.6，再大地圖上就只剩一片空白
  const zooms = scenes.map((s, i) => {
    const near = Math.min(...[scenes[i - 1], scenes[i + 1]].filter(Boolean).map((o) => km(s, o!)), Infinity);
    return near < 1.5 ? Math.min(MAX_ZOOM, Math.max(15.4, zoomForDistance(near, s.lat, 280))) : 15.4;
  });
  const travels: { mode: Travel; dist: number; midZoom: number }[] = scenes.slice(0, -1).map((s, i) => {
    const b = scenes[i + 1];
    const dist = km(s, b);
    const mode = travelFor(dist);
    // 移動時拉遠到 A、B 都在畫面裡（約佔畫面寬度的一半）
    const fit = Math.min(MAX_ZOOM, zoomForDistance(dist, (s.lat + b.lat) / 2, 270));
    return { mode, dist, midZoom: Math.min(fit, zooms[i], zooms[i + 1]) };
  });

  // 時間軸
  const parts: Part[] = [];
  let at = 0;
  const push = (kind: Part["kind"], i: number, d: number) => {
    parts.push({ kind, i, start: at, end: at + d });
    at += d;
  };
  push("open", 0, OPEN);
  scenes.forEach((_, i) => {
    push("scene", i, S);
    if (i < last) push("move", i, M);
  });
  push("finale", last, FINALE);
  const total = at;

  // 一站之內的時間點（以 2.8 秒為準按比例縮放；「直接進照片」的站提早鑽進去）
  const k = S / 2.8;
  const timing = (pop: Scene["pop"]) =>
    pop === "photo"
      ? { pinStart: 0.05 * k, pinLand: 0.35 * k, tiltStart: 0.4 * k, growStart: 9, growEnd: 9, diveStart: 0.7 * k, photoStart: 0.9 * k, diveEnd: 1.2 * k }
      : { pinStart: 0.05 * k, pinLand: 0.35 * k, tiltStart: 0.45 * k, growStart: 0.55 * k, growEnd: 1.15 * k, diveStart: 1.2 * k, photoStart: 1.45 * k, diveEnd: 1.75 * k };

  // ---------- 小元件 ----------

  function pill(ctx: CanvasRenderingContext2D, text: string, y: number, a = 1) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `700 40px ${SANS}`;
    const tw = Math.min(ctx.measureText(text).width, W - 160);
    roundRect(ctx, W / 2 - tw / 2 - 36, y - 38, tw + 72, 76, 38);
    ctx.fillStyle = "rgba(255,252,246,0.95)";
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, y + 2, W - 160);
    ctx.restore();
  }

  function emoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number, rot = 0, flip = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  // 紅色大頭圖釘：針尖在 (x, y)，lift 是離地高度
  function drawPushpin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, lift: number, squash: number) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - Math.min(1, lift / 500))})`;
    ctx.beginPath();
    ctx.ellipse(x + 18 + lift * 0.15, y + 4, size * 0.35 + lift * 0.05, size * 0.12 + lift * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y - lift);
    ctx.scale(1 + squash * 0.12, 1 - squash * 0.12);
    const needle = ctx.createLinearGradient(-6, 0, 6, 0);
    needle.addColorStop(0, "#7d8389");
    needle.addColorStop(0.5, "#f1f3f5");
    needle.addColorStop(1, "#5c6166");
    ctx.strokeStyle = needle;
    ctx.lineWidth = size * 0.06;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.22, -size * 0.85);
    ctx.stroke();
    const hx = -size * 0.3;
    const hy = -size * 1.12;
    const r = size * 0.36;
    const g = ctx.createRadialGradient(hx - r * 0.35, hy - r * 0.4, r * 0.1, hx, hy, r);
    g.addColorStop(0, "#ff8a7a");
    g.addColorStop(0.35, "#e2261c");
    g.addColorStop(1, "#7a0d0a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(hx + r * 0.25, hy + r * 0.75, r * 0.55, r * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(hx - r * 0.38, hy - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 從地圖上長出來的模型，底部中間對齊 (x, y)
  function drawModel(ctx: CanvasRenderingContext2D, m: LandmarkModel, x: number, y: number, grow: number, t: number) {
    const img = m.image;
    const s = Math.min((m.kind === "card" ? 560 : 760) / img.width, (m.kind === "card" ? 640 : 860) / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.22 * clamp(grow)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.42 * clamp(grow), 34 * clamp(grow), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2.2) * 0.012);
    ctx.scale(lerp(0.7, 1, clamp(grow)), Math.max(0.001, grow));
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    if (m.kind === "card") {
      roundRect(ctx, -w / 2 - 16, -h - 16, w + 32, h + 32, 18);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.drawImage(img, -w / 2, -h, w, h);
    } else ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  // 一隻腳印，朝 angle 方向
  function footprint(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, left: boolean, a: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.translate(left ? -13 : 13, 0);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(92,58,36,0.85)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.arc(-8 + j * 5.5, -17 + Math.abs(j - 1.5) * 1.6, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 片尾畫面（＝片頭）：最後一張照片變暗、標題，加上結尾特效留下的痕跡
  const crack = (() => {
    const r = rng(7);
    return Array.from({ length: 8 }, (_, i) => {
      const ang = (i / 8) * Math.PI * 2 + r() * 0.5;
      const pts: [number, number][] = [[0, 0]];
      let d = 0;
      while (d < 420) {
        d += 40 + r() * 60;
        const a2 = ang + (r() - 0.5) * 0.5;
        pts.push([Math.cos(a2) * d, Math.sin(a2) * d * 0.7]);
      }
      return pts;
    });
  })();
  const stuck = (() => {
    const r = rng(11);
    return Array.from({ length: 14 }, () => ({ x: 120 + r() * (W - 240), y: TITLE_Y - 330 + r() * 600, s: 50 + r() * 50, rot: (r() - 0.5) * 1.2 }));
  })();

  function drawEndCard(ctx: CanvasRenderingContext2D, remnant: number, titleScale = 1, shake = 0) {
    // 背景跟結尾主角飛走時一樣：模糊、變暗，標題比較清楚
    ctx.save();
    ctx.filter = "blur(14px)";
    drawCover(ctx, photos[last], 0, 0, W, H, 1.08);
    ctx.restore();
    ctx.filter = "none";
    ctx.fillStyle = "rgba(10,14,12,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.sin(shake * 40) * shake * 30, Math.cos(shake * 33) * shake * 18);
    if (remnant > 0 && impact === "smash") {
      ctx.save();
      ctx.globalAlpha = remnant * 0.85;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.translate(W / 2, TITLE_Y);
      for (const line of crack) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
    }
    if (remnant > 0 && impact === "splash")
      stuck.forEach((p) => {
        ctx.globalAlpha = remnant;
        emoji(ctx, finale.particle, p.x, p.y, p.s, p.rot);
      });
    ctx.globalAlpha = 1;
    ctx.translate(W / 2, TITLE_Y);
    ctx.rotate(impact === "smash" ? -0.035 * remnant : impact === "stamp" ? -0.06 * remnant : 0);
    ctx.scale(titleScale, titleScale);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 24;
    const size = fitFont(ctx, input.title, hand, 700, 132, W - 200);
    ctx.fillText(input.title, 0, size * 0.35);
    ctx.shadowBlur = 12;
    ctx.font = `500 42px ${SANS}`;
    ctx.fillText(input.subtitle, 0, 120);
    if (remnant > 0 && impact === "stamp") {
      // 印章框
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = remnant;
      ctx.strokeStyle = "#ff5a4a";
      ctx.lineWidth = 10;
      ctx.font = `700 ${size}px ${hand}`;
      const tw = Math.max(ctx.measureText(input.title).width, 420);
      roundRect(ctx, -tw / 2 - 50, -size * 0.85, tw + 100, size + 200, 22);
      ctx.stroke();
    }
    ctx.restore();
    // 小小的出處，朋友看到才知道怎麼做的
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 30px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("📍 用「我的旅遊遊記」做的 · my-outdoor-journal.vercel.app", W / 2, SAFE_BOTTOM - 20, W - 100);
    ctx.restore();
  }

  function drawWatermark(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = `700 30px ${SANS}`;
    const text = "我的旅遊遊記 · 免費版";
    const tw = ctx.measureText(text).width;
    const x = W - 50 - tw - 74;
    const y = SAFE_BOTTOM - 140;
    roundRect(ctx, x, y, tw + 74 + 28, 64, 32);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fill();
    drawLogo(ctx, x + 12, y + 10, 44);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 68, y + 33);
    ctx.restore();
  }

  function mapCredit(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = `400 22px ${SANS}`;
    ctx.fillStyle = "rgba(31,42,36,0.7)";
    ctx.textAlign = "right";
    ctx.fillText(MAP_CREDIT, W - 24, H - 24);
    ctx.restore();
  }

  // 照片：從模糊放大慢慢對焦
  function drawPhoto(ctx: CanvasRenderingContext2D, i: number, a: number, zoom: number) {
    ctx.save();
    ctx.globalAlpha = a;
    if (a < 1) ctx.filter = `blur(${((1 - a) * 12).toFixed(1)}px)`;
    drawCover(ctx, photos[i], 0, 0, W, H, zoom);
    ctx.restore();
    ctx.filter = "none";
  }

  function photoLabel(ctx: CanvasRenderingContext2D, i: number, la: number) {
    if (la <= 0) return;
    const g = ctx.createLinearGradient(0, SAFE_BOTTOM - 420, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${0.6 * la})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, SAFE_BOTTOM - 420, W, H);
    ctx.save();
    ctx.globalAlpha = la;
    ctx.translate(0, (1 - la) * 30);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 16;
    ctx.font = `700 32px ${SANS}`;
    ctx.fillText(`📍 第 ${i + 1} 站${scenes[i].date ? ` · ${scenes[i].date}` : ""}`, 70, SAFE_BOTTOM - 150);
    const size = fitFont(ctx, scenes[i].label, hand, 700, 88, W - 140);
    ctx.fillText(scenes[i].label, 70, SAFE_BOTTOM - 150 + size + 16);
    ctx.restore();
  }

  // 照片縮放時，照片上的點 (nx, ny) 在畫面上的位置
  function photoToScreen(i: number, nx: number, ny: number, zoom: number) {
    const img = photos[i];
    const s = Math.max(W / img.width, H / img.height) * zoom;
    const dw = img.width * s;
    const dh = img.height * s;
    return { x: (W - dw) / 2 + nx * dw, y: (H - dh) / 2 + ny * dh, scale: s };
  }

  // ---------- 每一站 ----------

  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const layerCtx = layer.getContext("2d")!;

  async function drawScene(ctx: CanvasRenderingContext2D, i: number, u: number, t: number) {
    const s = scenes[i];
    const T = timing(s.pop);
    const model = models[i];
    if (u < T.diveEnd) {
      const tilt = easeInOut(clamp((u - T.tiltStart) / (T.diveStart - T.tiltStart)));
      const camera: Camera = {
        center: [s.lon, s.lat],
        zoom: zooms[i] + 0.6 * easeOut(clamp(u / T.diveStart)),
        pitch: tilt * (model ? 55 : 35),
        bearing: tilt * -18,
        padding: MAP_PAD,
      };
      await map.show(camera);
      const anchor = map.project(s.lon, s.lat);
      const dive = easeInOut(clamp((u - T.diveStart) / (T.diveEnd - T.diveStart)));
      const grow = easeBack(clamp((u - T.growStart) / (T.growEnd - T.growStart)));
      const focusY = model ? anchor.y - 380 : anchor.y - 120;
      // 鑽進去時整個畫面要模糊：先把地圖、軌跡、圖釘、模型畫在同一層，再整層模糊一次
      // （直接在模糊狀態下畫，每個腳印、圖釘都會各模糊一次，站數一多就慢到卡住）
      const g = dive > 0 ? layerCtx : ctx;
      if (dive > 0) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, H);
      }
      g.save();
      g.drawImage(map.canvas, 0, 0, W, H);
      drawTrail(g, i, i);
      if (u >= T.pinStart) {
        const fall = clamp((u - T.pinStart) / (T.pinLand - T.pinStart));
        const since = u - T.pinLand;
        const squash = since > 0 ? Math.max(0, Math.sin(since * 18) * Math.exp(-since * 9)) : 0;
        if (since > 0 && since < 0.6) {
          g.strokeStyle = `rgba(226,38,28,${0.6 * (1 - since / 0.6)})`;
          g.lineWidth = 6;
          g.beginPath();
          g.ellipse(anchor.x, anchor.y, 40 + since * 300, (40 + since * 300) * lerp(0.9, 0.45, tilt), 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.globalAlpha = model ? 1 - clamp((u - T.growStart - 0.15) / 0.3) : 1;
        if (g.globalAlpha > 0) drawPushpin(g, anchor.x, anchor.y, 170, (1 - fall * fall) * 700, squash);
        g.globalAlpha = 1;
      }
      if (model && u >= T.growStart) drawModel(g, model, anchor.x, anchor.y, grow, t);
      g.restore();
      if (dive > 0) {
        const z = lerp(1, 3.4, dive);
        ctx.save();
        ctx.translate(anchor.x, focusY);
        ctx.scale(z, z);
        ctx.translate(-anchor.x, -focusY);
        ctx.filter = `blur(${(dive * 10).toFixed(1)}px)`;
        ctx.drawImage(layer, 0, 0, W, H);
        ctx.restore();
        ctx.filter = "none";
      }
      if (u > T.pinLand && dive < 0.5) pill(ctx, scenes[i].label, SAFE_TOP + 40, clamp((u - T.pinLand) / 0.3) * (1 - dive * 2));
      mapCredit(ctx);
    }
    if (u >= T.photoStart) {
      const a = clamp((u - T.photoStart) / (T.diveEnd - T.photoStart));
      drawPhoto(ctx, i, a, lerp(1.3, 1.04, easeOut(clamp((u - T.photoStart) / (S - T.photoStart)))));
      photoLabel(ctx, i, clamp((u - T.diveEnd) / 0.35));
    }
  }

  // ---------- 站與站之間：在地圖上走過去 ----------

  // 第 j 段路（第 j 站 → 第 j+1 站）在畫面上的路徑，0～1 取點
  function legPath(j: number) {
    const a = map.project(scenes[j].lon, scenes[j].lat);
    const b = map.project(scenes[j + 1].lon, scenes[j + 1].lat);
    if (travels[j].mode === "plane") {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.35;
      return (f: number) => ({ x: (1 - f) ** 2 * a.x + 2 * (1 - f) * f * cx + f * f * b.x, y: (1 - f) ** 2 * a.y + 2 * (1 - f) * f * cy + f * f * b.y });
    }
    return (f: number) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) });
  }

  // 畫第 j 段走過的部分（到 upTo 為止）：步行是腳印（距離短就少走幾步），開車是紅色虛線，飛機是白色點線
  function drawLeg(ctx: CanvasRenderingContext2D, j: number, upTo: number, alpha: number) {
    const path = legPath(j);
    const mode = travels[j].mode;
    if (mode === "walk" || mode === "stay") {
      const p0 = path(0);
      const p1 = path(1);
      const steps = Math.round(Math.min(22, Math.max(3, Math.hypot(p1.x - p0.x, p1.y - p0.y) / 46)));
      for (let k = 1; k <= steps; k++) {
        const f = k / (steps + 1);
        if (f > upTo) break;
        const p = path(f);
        const q = path(Math.min(1, f + 0.01));
        footprint(ctx, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), k % 2 === 0, 0.9 * alpha);
      }
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash(mode === "plane" ? [4, 18] : [26, 16]);
    ctx.lineCap = "round";
    ctx.strokeStyle = mode === "plane" ? "#fff" : C.pin;
    ctx.lineWidth = mode === "plane" ? 10 : 9;
    ctx.beginPath();
    for (let f = 0; f <= upTo + 1e-6; f += 0.02) {
      const p = path(Math.min(f, upTo));
      if (f === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 從第一站到現在走過的完整軌跡：之前每一段路＋每一站的小圖釘（stops：已經到過的站數）
  function drawTrail(ctx: CanvasRenderingContext2D, legs: number, stops: number) {
    for (let j = 0; j < legs; j++) drawLeg(ctx, j, 1, 0.8);
    for (let j = 0; j < stops; j++) {
      const q = map.project(scenes[j].lon, scenes[j].lat);
      drawPushpin(ctx, q.x, q.y, 80, 0, 0);
    }
  }

  async function drawMove(ctx: CanvasRenderingContext2D, i: number, m: number, t: number) {
    const a = scenes[i];
    const b = scenes[i + 1];
    const { mode, dist, midZoom } = travels[i];
    const go = easeInOut(clamp((m - 0.15) / 0.7)); // 移動進度
    const center: [number, number] = [lerp(a.lon, b.lon, go), lerp(a.lat, b.lat, go)];
    const zoom = m < 0.5 ? lerp(zooms[i], midZoom, easeInOut(m / 0.5)) : lerp(midZoom, zooms[i + 1], easeInOut((m - 0.5) / 0.5));
    await map.show({ center, zoom, pitch: 0, bearing: 0, padding: MAP_PAD });
    ctx.drawImage(map.canvas, 0, 0, W, H);
    const A = map.project(a.lon, a.lat);
    const B = map.project(b.lon, b.lat);
    const path = legPath(i);
    const head = path(go);
    const ahead = path(Math.min(1, go + 0.02));
    const back = path(Math.max(0, go - 0.02));
    const angle = go >= 0.98 ? Math.atan2(head.y - back.y, head.x - back.x) : Math.atan2(ahead.y - head.y, ahead.x - head.x);

    // 之前走過的路和到過的站都留著，再畫這一段
    drawTrail(ctx, i, i + 1);
    drawPushpin(ctx, B.x, B.y, 80, 0, 0);
    drawLeg(ctx, i, go, 1);

    // 移動中的主角：夥伴帶路、車子或飛機
    const right = Math.cos(angle) >= 0;
    if (mode === "plane") emoji(ctx, "✈️", head.x, head.y, 120, angle + Math.PI / 4);
    else if (mode === "car") {
      emoji(ctx, "🚗", head.x, head.y - 20, 110, 0, right);
      if (guideImg) drawGuide(ctx, head.x, head.y - 95, 120, right, t, false);
    } else if (guideImg) drawGuide(ctx, head.x, head.y, 200, right, t, true);
    else if (go < 1) {
      ctx.beginPath();
      ctx.arc(head.x, head.y, 16 + Math.sin(t * 10) * 4, 0, Math.PI * 2);
      ctx.fillStyle = C.pin;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }

    const label = mode === "stay" ? TRAVEL_LABEL.stay : `${TRAVEL_LABEL[mode]} ${fmtDist(dist)}`;
    pill(ctx, `${label} → ${b.label}`, SAFE_TOP + 40, clamp(m / 0.2) * clamp((1 - m) / 0.15));
    mapCredit(ctx);

    // 一開始：上一站的照片縮小飛回圖釘
    if (m < 0.2) {
      const p = clamp(m / 0.2);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      const z = lerp(1, 0.25, easeInOut(p));
      ctx.translate(lerp(W / 2, A.x, p), lerp(H / 2, A.y, p));
      ctx.scale(z, z);
      drawCover(ctx, photos[i], -W / 2, -H / 2, W, H, 1.04);
      ctx.restore();
    }
  }

  // 帶路的夥伴：邊走邊上下跳
  function drawGuide(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, right: boolean, t: number, walking: boolean) {
    if (!guideImg || !guide) return;
    const s = Math.min(size / guideImg.width, size / guideImg.height);
    const w = guideImg.width * s;
    const h = guideImg.height * s;
    const bob = walking ? Math.abs(Math.sin(t * 12)) * 16 : Math.abs(Math.sin(t * 20)) * 4;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, w * 0.35, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y - bob);
    if ((guide.facing === "right") !== right) ctx.scale(-1, 1);
    ctx.rotate(walking ? Math.sin(t * 12) * 0.06 : 0);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 12;
    ctx.drawImage(guideImg, -w / 2, -h, w, h);
    ctx.restore();
  }

  // ---------- 結尾特效 ----------

  function burst(ctx: CanvasRenderingContext2D, dt: number, count: number, seed: number, power: number, size: number) {
    if (dt < 0 || dt > 1.4) return;
    const r = rng(seed);
    for (let j = 0; j < count; j++) {
      const ang = r() * Math.PI * 2;
      const v = power * (0.4 + r() * 0.8);
      const x = W / 2 + Math.cos(ang) * v * dt;
      const y = TITLE_Y + Math.sin(ang) * v * dt * 0.8 + 900 * dt * dt;
      ctx.globalAlpha = clamp(1 - dt / 1.4);
      emoji(ctx, finale.particle, x, y, size * (0.6 + r() * 0.8), ang + dt * 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawTitleText(ctx: CanvasRenderingContext2D, x: number, a: number) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 24;
    const size = fitFont(ctx, input.title, hand, 700, 132, W - 200);
    ctx.fillText(input.title, x, TITLE_Y + size * 0.35);
    ctx.restore();
  }

  function drawFinale(ctx: CanvasRenderingContext2D, u: number) {
    const hit = 1.2;
    const settle = 2.0;
    if (action === "freeze" || !hero) {
      // 萬用結尾：快門一閃，照片縮成拍立得，標題像印章蓋下來
      const shrink = easeInOut(clamp((u - 0.1) / 0.8));
      const fade = clamp((u - settle) / 0.6);
      const stampAt = 0.95;
      const stamp = clamp((u - stampAt) / 0.25);
      drawEndCard(ctx, easeOut(stamp), stamp > 0 ? lerp(1.8, 1, easeOut(stamp)) : 0.001, u > stampAt + 0.25 && u < stampAt + 0.6 ? 0.6 - (u - stampAt - 0.25) : 0);
      if (fade < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - fade;
        ctx.translate(W / 2, lerp(H / 2, 700, shrink));
        ctx.rotate(lerp(0, -0.07, shrink));
        const z = lerp(1, 0.6, shrink);
        ctx.scale(z, z);
        const pad = lerp(0, 40, shrink);
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 40 * shrink;
        ctx.fillStyle = C.card;
        ctx.fillRect(-W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2 + 160 * shrink);
        ctx.shadowColor = "transparent";
        drawCover(ctx, photos[last], -W / 2, -H / 2, W, H, lerp(1.04, 1, shrink));
        ctx.restore();
        // 標題蓋在拍立得上面
        if (stamp > 0) {
          ctx.save();
          ctx.globalAlpha = (1 - fade) * stamp;
          ctx.translate(W / 2, TITLE_Y + 45);
          ctx.rotate(-0.06);
          const z2 = lerp(1.8, 1, easeOut(stamp));
          ctx.scale(z2, z2);
          ctx.translate(-W / 2, -TITLE_Y - 45);
          drawTitleText(ctx, W / 2, 1);
          ctx.restore();
        }
      }
      if (u > stampAt + 0.2 && u < settle + 0.4) {
        // 粒子慢慢飄下來
        const r = rng(3);
        const a = clamp((settle + 0.4 - u) / 0.4);
        for (let j = 0; j < 12; j++) {
          const x0 = r() * W;
          const sp = 300 + r() * 300;
          const y = -80 + (u - stampAt - 0.2) * sp + r() * 200;
          ctx.globalAlpha = a;
          emoji(ctx, finale.particle, x0 + Math.sin(u * 3 + j) * 30, y, 50 + r() * 40, Math.sin(u * 2 + j) * 0.5);
        }
        ctx.globalAlpha = 1;
      }
      if (u < 0.12) {
        ctx.fillStyle = `rgba(255,255,255,${1 - u / 0.12})`;
        ctx.fillRect(0, 0, W, H);
      }
      return;
    }

    // 主角衝出照片、跟標題互動
    const origin = photoToScreen(last, hero.box.x + hero.box.w / 2, hero.box.y + hero.box.h / 2, 1.04);
    const startScale = (hero.box.w * photos[last].width * origin.scale) / hero.image.width;
    const targetScale = Math.min(460 / hero.image.height, 520 / hero.image.width);
    const after = u - hit;

    if (u < hit) {
      // 主角被「剝」下來後，背景照片變模糊、變暗，原位的主角跟著淡掉，才不會像有分身
      const away = clamp(u / 0.45);
      ctx.save();
      if (away > 0) ctx.filter = `blur(${(away * 14).toFixed(1)}px)`;
      drawCover(ctx, photos[last], 0, 0, W, H, lerp(1.04, 1.08, clamp(u / hit)));
      ctx.restore();
      ctx.filter = "none";
      ctx.fillStyle = `rgba(10,14,12,${0.62 * away})`;
      ctx.fillRect(0, 0, W, H);
      // 被打到之前，標題先淡淡出現（「推進來」的標題跟著主角進場）
      if (impact !== "push" && u > 0.8) drawTitleText(ctx, W / 2, clamp((u - 0.8) / 0.4) * 0.9);
    } else {
      const shake = impact === "smash" || impact === "stamp" ? clamp(1 - after / 0.5) : 0;
      const pop = impact === "splash" ? lerp(1.15, 1, easeOut(clamp(after / 0.4))) : impact === "stamp" ? lerp(1.6, 1, easeOut(clamp(after / 0.25))) : 1;
      drawEndCard(ctx, clamp(after / 0.25), pop, shake);
      if (impact === "smash" && after < 0.12) {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - after / 0.12)})`;
        ctx.fillRect(0, 0, W, H);
      }
      burst(ctx, after, impact === "splash" ? 46 : 22, 5, impact === "splash" ? 1400 : 900, impact === "splash" ? 110 : 80);
    }

    // 主角的動作：0.3～1.2 秒從原位飛到標題
    const lift = clamp(u / 0.3);
    const p = clamp((u - 0.3) / (hit - 0.3));
    const tx = impact === "push" ? W / 2 - 380 : W / 2;
    const arc = (f: number) => (action === "jump" ? Math.sin(f * Math.PI) * 520 : 0);
    let x = origin.x;
    let y = origin.y;
    let rot = 0;
    let sc = startScale * lerp(1, 1.08, lift);
    if (u >= 0.3) {
      const e = action === "dash" ? p * p : easeInOut(p);
      x = lerp(origin.x, tx, e);
      y = lerp(origin.y, TITLE_Y, e) - arc(p);
      sc = lerp(startScale * 1.08, targetScale, e);
      if (action === "spin") rot = p * Math.PI * 4;
      if (action === "dash") rot = Math.sin(p * Math.PI) * 0.25;
      if (action === "zoom") sc = lerp(startScale * 1.08, targetScale * 3.2, p * p);
    }
    if (impact === "push") {
      // 主角把標題從畫面外推到中間，之後自己跑走
      if (u < hit && u > 0.5) drawTitleText(ctx, lerp(W + 520, W / 2, easeOut(clamp((u - 0.5) / (hit - 0.5)))), 1);
      if (after > 0) x = lerp(tx, -600, easeInOut(clamp(after / 0.6)));
    }
    const gone = impact === "push" ? after > 0.6 : after > 0;
    if (!gone) {
      // 一路灑下的粒子
      if (u > 0.4 && after <= 0) {
        for (let j = 1; j <= 6; j++) {
          const f = clamp(p - j * 0.07);
          const e = action === "dash" ? f * f : easeInOut(f);
          ctx.globalAlpha = 0.75 * (1 - j / 7);
          emoji(ctx, finale.particle, lerp(origin.x, tx, e) + Math.sin(j * 2.3) * 40, lerp(origin.y, TITLE_Y, e) - arc(f) + Math.cos(j * 1.7) * 40, 64);
        }
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      // 白色外光：看起來像從照片「剝」下來
      ctx.shadowColor = "rgba(255,255,255,0.95)";
      ctx.shadowBlur = 24 * lift;
      ctx.drawImage(hero.image, -hero.image.width / 2, -hero.image.height / 2);
      ctx.restore();
    }
  }

  // ---------- 一格一格畫 ----------
  const prev = document.createElement("canvas");
  try {
    const blob = await encodeVideo(
      total,
      async (t, _f, { canvas, ctx }) => {
        const part = parts.find((p) => t < p.end) ?? parts[parts.length - 1];
        const u = t - part.start;
        if (part.kind === "open") {
          // 片頭：先停在片尾畫面（被砸過的標題），再「衝」進第一站
          await drawScene(ctx, 0, 0, t);
          const p = clamp((u - 0.4) / (OPEN - 0.4));
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.translate(W / 2, H / 2);
          ctx.scale(1 + p * 0.8, 1 + p * 0.8);
          ctx.translate(-W / 2, -H / 2);
          drawEndCard(ctx, 1);
          ctx.restore();
        } else if (part.kind === "scene") await drawScene(ctx, part.i, u, t);
        else if (part.kind === "move") await drawMove(ctx, part.i, u / (part.end - part.start), t);
        else drawFinale(ctx, u);

        // 最後一站的照片接到結尾時，上一格淡出一下
        if (part.kind === "finale" && u < 0.12) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1 - u / 0.12;
          ctx.drawImage(prev, 0, 0);
          ctx.restore();
        }
        if (part.end - t <= 1 / FPS + 1e-6) {
          prev.width = canvas.width;
          prev.height = canvas.height;
          prev.getContext("2d")!.drawImage(canvas, 0, 0);
        }
        if (watermark) drawWatermark(ctx);
      },
      (p) => onProgress(base + p * (0.99 - base), "合成影片⋯"),
    );
    onProgress(1, "完成！");
    return blob;
  } finally {
    map.destroy();
    photos.forEach((p) => p.close());
    guideImg?.close();
  }
}
