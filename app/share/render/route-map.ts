import type { Map as MapLibreMap } from "maplibre-gl";
import { localizeMap, STYLE_URL } from "../../lib/map-style";

// 在畫面外開一張看不到的 MapLibre 地圖，給短片和長圖「拍照」用
// 每移動一次鏡頭就等圖磚載完（idle）再把畫面複製出來，所以不會有沒載好的空白格子

export type Camera = {
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  padding?: { top: number; bottom: number; left: number; right: number }; // 讓中心點偏離畫面正中央
};

export type RouteMap = {
  canvas: HTMLCanvasElement;
  // 經緯度 → 畫布上的像素位置（已乘上 pixelRatio）
  project: (lon: number, lat: number) => { x: number; y: number };
  show: (camera: Camera) => Promise<void>;
  fit: (points: [number, number][], padding: number, maxZoom: number) => Camera;
  destroy: () => void;
};

function waitFor(m: MapLibreMap, event: "load" | "idle", ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    m.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// 等這一格畫好：地圖說「閒置了」，或是畫完一次時圖磚已經全部載好，就算完成
// （只等「閒置」不保險：地圖一直有東西在動時，可能永遠等不到，每一格都要白等到逾時）
function settle(m: MapLibreMap, ms: number) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      m.off("idle", finish);
      m.off("render", check);
      resolve();
    };
    const check = () => m.areTilesLoaded() && finish();
    const timer = setTimeout(finish, ms);
    m.on("idle", finish);
    m.on("render", check);
  });
}

export async function createRouteMap(width: number, height: number, ratio: number): Promise<RouteMap> {
  const ml = await import("maplibre-gl");
  ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = `position:fixed;left:-${width + 1000}px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  document.body.appendChild(box);

  const m = new ml.Map({
    container: box,
    style: STYLE_URL,
    center: [121, 23.7],
    zoom: 6,
    interactive: false,
    attributionControl: false, // 版權文字由我們畫在影片和圖片上
    pixelRatio: ratio,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
  });
  // 地圖樣式裡缺的小圖示（放很大時才會出現的柵欄、閘門等）補一張透明圖，
  // 不然地圖會一直等那張圖，永遠不會「畫完」
  m.on("styleimagemissing", (e) => {
    if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  const loaded = waitFor(m, "load", 20000);
  let failed = false;
  m.on("error", () => {
    if (!m.isStyleLoaded()) failed = true;
  });
  await loaded;
  if (failed || !m.isStyleLoaded()) {
    m.remove();
    box.remove();
    throw new Error("地圖載入失敗，請確認網路連線");
  }
  localizeMap(m);
  await waitFor(m, "idle", 8000);

  let last = "";
  return {
    canvas: m.getCanvas(),
    project(lon, lat) {
      const p = m.project([lon, lat]);
      return { x: p.x * ratio, y: p.y * ratio };
    },
    async show(camera) {
      const sig = JSON.stringify(camera);
      if (sig === last) return;
      last = sig;
      const ready = settle(m, 4000);
      m.jumpTo(camera);
      m.triggerRepaint();
      await ready;
    },
    fit(points, padding, maxZoom) {
      if (points.length === 1) return { center: points[0], zoom: Math.min(maxZoom, 11) };
      const lons = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      const cam = m.cameraForBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding, maxZoom },
      );
      const c = cam?.center ? ml.LngLat.convert(cam.center) : null;
      return { center: c ? [c.lng, c.lat] : points[0], zoom: cam?.zoom ?? 5 };
    },
    destroy() {
      m.remove();
      box.remove();
    },
  };
}
