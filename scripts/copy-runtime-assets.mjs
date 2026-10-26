// 把幾個套件在瀏覽器執行時需要「用網址載入」的檔案複製到 public/，讓 Next.js 直接提供
// 每次 npm install 後自動執行（package.json 的 postinstall），確保版本跟安裝的套件一致
//   - MapLibre 6 的背景 worker（首頁足跡地圖）
//   - MediaPipe 的 WebAssembly 檔（神奇寶貝世界的去背）
import { copyFileSync, mkdirSync } from "node:fs";

const copies = [
  {
    from: "node_modules/maplibre-gl/dist",
    to: "public/maplibre",
    files: ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"],
  },
  {
    from: "node_modules/@mediapipe/tasks-vision/wasm",
    to: "public/mediapipe",
    files: [
      "vision_wasm_internal.js",
      "vision_wasm_internal.wasm",
      "vision_wasm_nosimd_internal.js",
      "vision_wasm_nosimd_internal.wasm",
    ],
  },
];

for (const { from, to, files } of copies) {
  mkdirSync(to, { recursive: true });
  for (const file of files) copyFileSync(`${from}/${file}`, `${to}/${file}`);
  console.log(`已複製 ${files.length} 個檔案到 ${to}/`);
}
