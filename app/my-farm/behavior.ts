import type { Creature } from "./collection";

// 世界分成三區，座標是世界寬度 0～300
export type Zone = "forest" | "meadow" | "lake";
export const ZONES: Record<Zone, { from: number; to: number; label: string; emoji: string }> = {
  forest: { from: 0, to: 100, label: "森林", emoji: "🌲" },
  meadow: { from: 100, to: 200, label: "農場草原", emoji: "🏡" },
  lake: { from: 200, to: 300, label: "湖畔", emoji: "🌊" },
};

// 每種動物的行為模式：決定牠平常做什麼、做多久、多快
export type Profile =
  | "grazer" // 邊走邊低頭吃草：鹿、山羌、牛、羊
  | "runner" // 會突然奔跑：馬、斑馬
  | "hopper" // 一跳一跳：兔子、猴子、松鼠、青蛙
  | "prowler" // 悄悄走、會趴下休息：貓科、狐狸、狗、獴
  | "slow" // 慢慢爬：烏龜、穿山甲、蝸牛
  | "scuttler" // 橫著走：螃蟹
  | "pecker" // 走一走低頭啄地：雞、鴨、鵝、鷺鷥
  | "flyer" // 在天上飛，偶爾停在樹上或圍欄
  | "flutter" // 忽上忽下地飄：蝴蝶、蜜蜂、蜻蜓
  | "swimmer" // 擺尾游泳：魚
  | "drifter" // 慢慢漂：水母、海龜
  | "plant";

export type Action = "walk" | "run" | "graze" | "rest" | "hop" | "look" | "fly" | "perch" | "swim";

const has = (name: string, words: string) => new RegExp(words).test(name);

export function profileOf(c: Creature): Profile {
  const n = c.name;
  if (c.category === "plant" || c.category === "waterplant") return "plant";
  if (c.category === "water") {
    if (has(n, "蟹")) return "scuttler";
    if (has(n, "水母|龜|海參|海星|螺")) return "drifter";
    return "swimmer";
  }
  if (c.category === "sky") {
    if (has(n, "蝶|蛾|蜂|蜻蜓|豆娘|蠅|蟬|蚊")) return "flutter";
    if (has(n, "鷺|鶴|鸛|鴨|鵝|天鵝|雞|鵪鶉|企鵝|鴕鳥|紅鶴|白冠雞")) return "pecker";
    return "flyer";
  }
  // 陸地動物
  if (has(n, "馬|斑馬|驢")) return "runner";
  if (has(n, "鹿|羌|牛|羊|羚|駝|水牛|山豬|豬")) return "grazer";
  if (has(n, "兔|猴|獼|猿|松鼠|鼠|蛙|袋鼠")) return "hopper";
  if (has(n, "龜|穿山甲|蝸牛|蛞蝓|刺蝟|樹懶")) return "slow";
  if (has(n, "蟹")) return "scuttler";
  if (has(n, "雞|鴨|鵝|鷺|孔雀|鵪鶉")) return "pecker";
  return "prowler";
}

// 依物種決定住哪一區
export function zoneOf(c: Creature): Zone {
  const n = c.name;
  if (c.category === "water" || c.category === "waterplant") return "lake";
  const profile = profileOf(c);
  if (profile === "pecker" && has(n, "鷺|鶴|鸛|鴨|鵝|天鵝|紅鶴|白冠雞")) return "lake";
  if (c.category === "plant") return has(n, "樹|蕨|菇|菌|苔|杉|松|櫸|楓|竹") ? "forest" : "meadow";
  if (c.category === "sky") return has(n, "雞|鵪鶉|孔雀") ? "meadow" : profile === "flutter" ? "meadow" : "forest";
  // 家畜和農場動物住草原，其他野生動物住森林
  if (has(n, "牛|羊|馬|驢|豬|雞|鴨|鵝|兔|狗|犬|貓|天竺鼠|倉鼠|羊駝")) return "meadow";
  return "forest";
}

type Plan = { action: Action; weight: number; secs: [number, number]; speed: number };

// 每種模式會隨機挑一個動作，做一段時間再換
export const PLANS: Record<Profile, Plan[]> = {
  grazer: [
    { action: "graze", weight: 5, secs: [2, 5], speed: 0.6 },
    { action: "walk", weight: 3, secs: [2, 4], speed: 5 },
    { action: "look", weight: 1, secs: [1, 2], speed: 0 },
    { action: "run", weight: 0.6, secs: [1, 2], speed: 16 },
  ],
  runner: [
    { action: "run", weight: 3, secs: [2, 4], speed: 22 },
    { action: "graze", weight: 3, secs: [2, 4], speed: 0.6 },
    { action: "walk", weight: 2, secs: [2, 3], speed: 6 },
    { action: "look", weight: 1, secs: [1, 2], speed: 0 },
  ],
  hopper: [
    { action: "hop", weight: 4, secs: [1.5, 3], speed: 9 },
    { action: "look", weight: 2, secs: [1, 2.5], speed: 0 },
    { action: "graze", weight: 1, secs: [1.5, 3], speed: 0 },
  ],
  prowler: [
    { action: "walk", weight: 4, secs: [2, 5], speed: 4 },
    { action: "rest", weight: 2, secs: [3, 6], speed: 0 },
    { action: "look", weight: 2, secs: [1, 2], speed: 0 },
    { action: "run", weight: 0.8, secs: [0.8, 1.5], speed: 18 },
  ],
  slow: [
    { action: "walk", weight: 4, secs: [3, 6], speed: 1.5 },
    { action: "rest", weight: 2, secs: [2, 5], speed: 0 },
  ],
  scuttler: [
    { action: "walk", weight: 4, secs: [1, 2.5], speed: 7 },
    { action: "look", weight: 2, secs: [1, 2], speed: 0 },
  ],
  pecker: [
    { action: "graze", weight: 4, secs: [1.5, 3], speed: 0.8 },
    { action: "walk", weight: 3, secs: [1.5, 3], speed: 4 },
    { action: "look", weight: 1, secs: [1, 2], speed: 0 },
  ],
  flyer: [
    { action: "fly", weight: 6, secs: [4, 9], speed: 10 },
    { action: "perch", weight: 1.5, secs: [3, 6], speed: 0 },
  ],
  flutter: [{ action: "fly", weight: 1, secs: [3, 6], speed: 5 }],
  swimmer: [
    { action: "swim", weight: 5, secs: [2, 5], speed: 5 },
    { action: "rest", weight: 1, secs: [1, 3], speed: 0.3 },
  ],
  drifter: [{ action: "swim", weight: 1, secs: [4, 8], speed: 1.5 }],
  plant: [{ action: "rest", weight: 1, secs: [10, 20], speed: 0 }],
};

export function pickPlan(profile: Profile): Plan {
  const plans = PLANS[profile];
  let r = Math.random() * plans.reduce((s, p) => s + p.weight, 0);
  for (const p of plans) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return plans[0];
}

// 依目前動作算出角色的姿勢：上下位移、旋轉、縮放
// 角度以「面向右邊」為準：正值是往前（順時針）傾，例如低頭吃草；畫面上會再依實際方向翻轉
export function pose(action: Action, t: number, phase: number, moving: boolean) {
  const s = Math.sin(t + phase);
  switch (action) {
    case "walk":
      return { y: moving ? -Math.abs(Math.sin(t * 8 + phase)) * 3 : 0, rot: moving ? Math.sin(t * 8 + phase) * 2.5 : 0, sx: 1, sy: 1 };
    case "run":
      return { y: -Math.abs(Math.sin(t * 13 + phase)) * 9, rot: 5 + Math.sin(t * 13 + phase) * 4, sx: 1.04, sy: 0.97 };
    case "graze": // 低頭吃草：往前傾，嘴巴一咬一咬
      return { y: 2, rot: 14 + Math.sin(t * 6 + phase) * 3, sx: 1, sy: 0.98 };
    case "hop": {
      const jump = Math.max(0, Math.sin(t * 6 + phase));
      return { y: -jump * 16, rot: -jump * 8, sx: 1 - jump * 0.05, sy: 1 + jump * 0.06 };
    }
    case "rest": // 趴下休息：壓扁一點，慢慢呼吸
      return { y: 4, rot: 0, sx: 1.06, sy: 0.86 + Math.sin(t * 1.5 + phase) * 0.02 };
    case "look":
      return { y: 0, rot: Math.sin(t * 2 + phase) * 5, sx: 1, sy: 1 };
    case "fly": // 拍翅：上下伸縮
      return { y: Math.sin(t * 3 + phase) * 6, rot: Math.sin(t * 1.5 + phase) * 6, sx: 1, sy: 0.88 + Math.abs(Math.sin(t * 14 + phase)) * 0.14 };
    case "perch":
      return { y: 0, rot: s * 3, sx: 1, sy: 1 };
    case "swim": // 擺尾：左右搖擺
      return { y: Math.sin(t * 2 + phase) * 3, rot: Math.sin(t * 7 + phase) * 7, sx: 1 + Math.sin(t * 7 + phase) * 0.03, sy: 1 };
  }
}
