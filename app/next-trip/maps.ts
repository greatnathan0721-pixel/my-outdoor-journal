import { geoContains, geoDistance, geoNaturalEarth1, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { numericToAlpha2 } from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";

type Country = Feature<Geometry, { name: string }>;

export type WorldMap = {
  width: number;
  height: number;
  projection: GeoProjection;
  features: Country[];
  nameOf: (index: number) => string;
  codeOf: (index: number) => string | undefined; // ISO 二碼國碼
  // 準心可以移動的範圍（SVG 座標）
  range: [[number, number], [number, number]];
  locate: (lonLat: [number, number]) => { index: number; nearest?: { point: Position; km: number } } | null;
};

// world-atlas 裡沒有 ISO 代碼的地區
const extraNames: Record<string, string> = {
  "N. Cyprus": "北賽普勒斯",
  Somaliland: "索馬利蘭",
  Kosovo: "科索沃",
};

// 把一個國家所有邊界點攤平成一個陣列，用來找最近的陸地
function boundaryPoints(geometry: Geometry): Position[] {
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function build(): WorldMap {
  const width = 960;
  const height = 500;
  const t = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const features = (feature(t, t.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;
  const points = features.map((f) => boundaryPoints(f.geometry));
  const projection = geoNaturalEarth1().fitExtent(
    [
      [8, 8],
      [width - 8, height - 8],
    ],
    { type: "Sphere" },
  );
  const codeOf = (index: number) => {
    const id = features[index].id;
    if (features[index].properties.name === "Kosovo") return "XK";
    return id ? numericToAlpha2(String(id)) : undefined;
  };
  const regionNames = new Intl.DisplayNames(["zh-Hant-TW"], { type: "region" });

  return {
    width,
    height,
    projection,
    features,
    nameOf: (index) => {
      const f = features[index];
      const alpha2 = codeOf(index);
      if (alpha2) return regionNames.of(alpha2) ?? f.properties.name;
      return extraNames[f.properties.name] ?? f.properties.name;
    },
    codeOf,
    range: [
      [40, 40],
      [width - 40, height - 60],
    ],
    locate: (lonLat) => {
      const hit = features.findIndex((f) => geoContains(f, lonLat));
      if (hit >= 0) return { index: hit };

      // 掉進海裡：找離落點最近的國家邊界
      let best = { index: -1, point: [0, 0] as Position, distance: Infinity };
      points.forEach((list, index) => {
        for (const p of list) {
          const distance = geoDistance(lonLat, p as [number, number]);
          if (distance < best.distance) best = { index, point: p, distance };
        }
      });
      if (best.index < 0) return null;
      return { index: best.index, nearest: { point: best.point, km: best.distance * 6371 } };
    },
  };
}

let cache: WorldMap | undefined;

export function getWorldMap() {
  cache ??= build();
  return cache;
}
