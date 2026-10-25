// MapLibre 6 的背景 worker 要能用網址載入，打包後找不到，所以複製到 public/ 讓 Next.js 直接提供
// 每次 npm install 後自動執行（package.json 的 postinstall），確保版本跟安裝的套件一致
import { copyFileSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`${from}/${file}`, `${to}/${file}`);
}
console.log("已複製 MapLibre worker 到 public/maplibre/");
