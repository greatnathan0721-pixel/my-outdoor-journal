import type { Map as MapLibreMap } from "maplibre-gl";

// 首頁地圖和分享短片共用的地圖樣式（OpenFreeMap，免費、不用金鑰）
export const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_CREDIT = "© OpenFreeMap © OpenStreetMap";

// 地名優先顯示繁體中文，沒有的話用中文、再用當地名稱；湖海換成比較柔和的藍
export function localizeMap(m: MapLibreMap) {
  for (const layer of m.getStyle().layers) {
    if (layer.type === "symbol" && /^(label_|water_name|waterway_line_label|poi|airport)/.test(layer.id)) {
      m.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:zh-Hant"], ["get", "name:zh"], ["get", "name"]]);
    }
  }
  if (m.getLayer("water")) m.setPaintProperty("water", "fill-color", "#a7d3df");
}
