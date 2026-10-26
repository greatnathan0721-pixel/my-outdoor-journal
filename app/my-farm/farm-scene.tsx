"use client";

import { useEffect, useRef, useState } from "react";
import { pickPlan, pose, profileOf, ZONES, zoneOf, type Action, type Profile, type Zone } from "./behavior";
import type { Creature } from "./collection";

type Mode = "world" | "dive";

// 農場世界寬 300（森林 0–100、草原 100–200、湖畔 200–300），高度 0–100 是畫面高度的百分比
const WORLD = 300;
const GROUND_TOP = 62;
const LAKE = { cx: 258, cy: 81, rx: 32, ry: 12 };
const SPACING = 9;

// 每一區、每一類同時出場的上限，夥伴多了也不會擠成一團；其他的可以「換一批」
const LIMIT = (mode: Mode, zone: Zone, category: Creature["category"]) => {
  if (mode === "dive") return category === "water" ? 9 : category === "waterplant" ? 7 : 0;
  if (category === "waterplant") return 0; // 水草要潛水才看得到
  if (category === "sky") return zone === "lake" ? 2 : 4;
  if (category === "plant") return zone === "lake" ? 2 : 5;
  if (category === "water") return 5;
  return zone === "lake" ? 3 : 6;
};

type Agent = {
  id: string;
  creature: Creature;
  profile: Profile;
  zone: Zone;
  kind: "sky" | "land" | "water" | "plant";
  x: number;
  y: number;
  tx: number;
  ty: number;
  action: Action;
  actionLeft: number; // 這個動作還要做幾秒
  speed: number;
  dir: 1 | -1; // 目前往右（1）或往左（-1）
  phase: number;
};

type Point = { x: number; y: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function inLake(x: number, y: number, shrink = 1) {
  return ((x - LAKE.cx) / (LAKE.rx * shrink)) ** 2 + ((y - LAKE.cy) / (LAKE.ry * shrink)) ** 2 < 1;
}

// 每個夥伴可以活動的範圍
function regionPoint(a: Pick<Agent, "kind" | "zone" | "profile">, mode: Mode): Point {
  if (mode === "dive") return a.kind === "plant" ? { x: rand(6, 94), y: 93 } : { x: rand(6, 94), y: rand(14, 84) };
  const z = ZONES[a.zone];
  if (a.kind === "water") {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.72;
    return { x: LAKE.cx + Math.cos(ang) * LAKE.rx * r, y: LAKE.cy + Math.sin(ang) * LAKE.ry * r };
  }
  if (a.kind === "sky") {
    if (a.profile === "flutter") return { x: rand(z.from + 5, z.to - 5), y: rand(52, 74) };
    return { x: rand(z.from - 10, z.to + 10), y: rand(8, 38) };
  }
  for (;;) {
    const p = { x: rand(z.from + 4, z.to - 4), y: rand(GROUND_TOP + 6, 95) };
    if (!inLake(p.x, p.y, 1.25) && !(a.zone === "meadow" && p.x < 118 && p.y < 74)) return p; // 避開湖和小屋
  }
}

// 鳥類停下來休息的地方：森林的樹梢或草原的圍欄
function perchPoint(zone: Zone): Point {
  if (zone === "forest") return { x: rand(8, 92), y: rand(40, 50) };
  if (zone === "meadow") return { x: rand(122, 196), y: GROUND_TOP - 4 };
  return { x: rand(205, 222), y: 74 }; // 湖邊棧道的欄杆
}

// 試幾個候選點，挑離其他夥伴最遠的，讓大家分散開來
function spreadPoint(make: () => Point, others: Point[]): Point {
  let best = make();
  let bestScore = -1;
  for (let i = 0; i < 10; i++) {
    const p = i === 0 ? best : make();
    const score = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - p.x, (o.y - p.y) * 1.6))) : 100;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

// 依「這一批」的編號穩定地打亂順序，再取前幾名出場
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lineup(creatures: Creature[], mode: Mode, batch: number) {
  const groups = new Map<string, Creature[]>();
  for (const c of creatures) {
    const zone = zoneOf(c);
    const key = `${zone}|${c.category}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const shown: Creature[] = [];
  let eligible = 0;
  for (const [key, group] of groups) {
    const [zone, category] = key.split("|") as [Zone, Creature["category"]];
    const limit = LIMIT(mode, zone, category);
    if (limit === 0) continue;
    eligible += group.length;
    shown.push(...[...group].sort((a, b) => hash(`${a.id}:${batch}`) - hash(`${b.id}:${batch}`)).slice(0, limit));
  }
  return { shown, eligible };
}

function kindOf(c: Creature, profile: Profile, mode: Mode): Agent["kind"] {
  if (profile === "plant") return "plant";
  if (c.category === "water") return "water";
  if (mode === "world" && c.category === "sky" && profile !== "pecker") return "sky";
  return "land";
}

function buildAgents(creatures: Creature[], mode: Mode, player: Point): Agent[] {
  const agents: Agent[] = [];
  // 在玩家周圍放幾個「佔位點」，一開始就不會有夥伴擠在玩家身邊
  const taken: Point[] = [player, { x: player.x - 8, y: player.y }, { x: player.x + 8, y: player.y }];
  for (const c of creatures) {
    const profile = profileOf(c);
    const zone = zoneOf(c);
    const kind = kindOf(c, profile, mode);
    const a = { kind, zone, profile };
    const p = spreadPoint(() => regionPoint(a, mode), taken);
    taken.push(p);
    const plan = pickPlan(profile);
    agents.push({
      id: c.id,
      creature: c,
      ...a,
      ...p,
      tx: p.x,
      ty: p.y,
      action: plan.action,
      actionLeft: rand(...plan.secs) * Math.random(),
      speed: plan.speed,
      dir: Math.random() < 0.5 ? 1 : -1,
      phase: rand(0, 6),
    });
  }
  return agents;
}

export default function FarmScene({ creatures }: { creatures: Creature[] }) {
  const [mode, setMode] = useState<Mode>("world");
  const [active, setActive] = useState(false);
  const [toast, setToast] = useState("");
  const [batch, setBatch] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerSprite = useRef<HTMLSpanElement>(null);
  const zoneBtns = useRef(new Map<Zone, HTMLButtonElement>());
  const els = useRef(new Map<string, HTMLDivElement>());
  const keys = useRef(new Set<string>());
  const player = useRef({ x: 140, y: 82, facing: -1 as 1 | -1 });

  const { shown, eligible } = lineup(creatures, mode, batch);
  const shownKey = shown.map((c) => `${c.id}${c.cutout ? "c" : ""}${c.facing ?? ""}`).join(",");

  // 收服新夥伴、切換場景或換一批時，重新安排每位夥伴的位置
  useEffect(() => {
    const next = buildAgents(lineup(creatures, mode, batch).shown, mode, player.current);
    const id = requestAnimationFrame(() => setAgents(next));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shownKey 已涵蓋出場名單的變化
  }, [shownKey, mode]);

  // 鍵盤操作：點一下場景後才接管方向鍵，避免影響頁面捲動
  useEffect(() => {
    if (!active) return;
    const map: Record<string, string> = {
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
    };
    const down = (e: KeyboardEvent) => {
      if (!map[e.key]) return;
      e.preventDefault();
      keys.current.add(map[e.key]);
    };
    const up = (e: KeyboardEvent) => map[e.key] && keys.current.delete(map[e.key]);
    const outside = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setActive(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerdown", outside);
    const held = keys.current;
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerdown", outside);
      held.clear();
    };
  }, [active]);

  // 主迴圈：移動玩家、鏡頭與所有夥伴，直接改 DOM 樣式，不觸發 React 重新渲染
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let switching = false;
    const width = mode === "world" ? WORLD : 100;

    const place = (el: HTMLElement | null | undefined, x: number, y: number, z?: number) => {
      if (!el) return;
      el.style.left = `${(x / width) * 100}%`;
      el.style.top = `${y}%`;
      el.style.zIndex = String(z ?? Math.round(y * 10));
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const p = player.current;

      // 玩家移動
      const k = keys.current;
      const dx = (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0);
      const dy = (k.has("down") ? 1 : 0) - (k.has("up") ? 1 : 0);
      const speed = mode === "world" ? 26 : 18;
      p.x = Math.min(width - 2, Math.max(2, p.x + dx * speed * dt));
      p.y = p.y + dy * 18 * dt;
      if (dx !== 0) p.facing = dx > 0 ? 1 : -1;

      if (mode === "world") {
        p.y = Math.min(97, Math.max(GROUND_TOP + 2, p.y));
        if (!switching && inLake(p.x, p.y, 0.8)) {
          switching = true;
          p.x = 50;
          p.y = 24;
          setMode("dive");
          setToast("🤿 撲通！潛進湖裡了，往上游可以回到岸上");
        }
      } else {
        p.y = Math.min(90, p.y);
        if (!switching && p.y < 3) {
          switching = true;
          p.x = LAKE.cx - LAKE.rx - 5;
          p.y = LAKE.cy;
          setMode("world");
          setToast("🌤️ 浮出水面，回到湖畔了");
        }
        p.y = Math.max(2, p.y);
      }

      // 鏡頭跟著玩家左右移動（手機畫面比較窄，一次看得到的範圍小一點）
      const view = viewRef.current;
      if (mode === "world" && view && worldRef.current) {
        const vw = view.clientWidth < 640 ? 62 : 100;
        const cam = Math.min(WORLD - vw, Math.max(0, p.x - vw / 2));
        const px = view.clientWidth / vw;
        worldRef.current.style.width = `${(WORLD / vw) * 100}%`;
        worldRef.current.style.transform = `translateX(${-cam * px}px)`;
        if (farRef.current) farRef.current.style.transform = `translateX(${-cam * px * 0.35}px)`; // 遠山移動得比較慢，有景深感
        const zone = (Object.keys(ZONES) as Zone[]).find((z) => p.x >= ZONES[z].from && p.x < ZONES[z].to) ?? "meadow";
        zoneBtns.current.forEach((btn, z) => (btn.dataset.active = z === zone ? "1" : "0"));
      }
      place(playerRef.current, p.x, p.y, 1500);
      if (playerSprite.current) playerSprite.current.style.transform = `scaleX(${p.facing === 1 ? -1 : 1})`;

      // 只有離玩家最近、而且夠近的那一位會停下來打招呼
      let nearest: Agent | null = null;
      let nearestDist = mode === "dive" ? 14 : 10;
      for (const a of agents) {
        const d = Math.hypot(a.x - p.x, (a.y - p.y) * 0.7);
        if (d < nearestDist && a.kind !== "sky") {
          nearest = a;
          nearestDist = d;
        }
      }

      for (const a of agents) {
        const el = els.current.get(a.id);
        if (!el) continue;
        const greeting = a === nearest;

        // 換下一個動作
        a.actionLeft -= dt;
        if (a.actionLeft <= 0 && !greeting) {
          const plan = pickPlan(a.profile);
          a.action = plan.action;
          a.actionLeft = rand(...plan.secs);
          a.speed = plan.speed;
          const others = agents.filter((o) => o !== a).map((o) => ({ x: o.tx, y: o.ty }));
          const q = a.action === "perch" ? perchPoint(a.zone) : spreadPoint(() => regionPoint(a, mode), others);
          a.tx = q.x;
          a.ty = q.y;
          if (a.action === "look") a.dir = a.dir === 1 ? -1 : 1; // 東張西望
        }
        if (greeting) {
          a.dir = p.x > a.x ? 1 : -1; // 轉頭看你
        }

        // 往目標移動
        let moving = false;
        const travel = a.action === "perch" && Math.hypot(a.tx - a.x, a.ty - a.y) > 1 ? 10 : a.speed;
        if (!greeting && travel > 0) {
          const mx = a.tx - a.x;
          const my = a.ty - a.y;
          const len = Math.hypot(mx, my);
          if (len > 0.3) {
            const step = Math.min(len, travel * dt);
            a.x += (mx / len) * step;
            a.y += (my / len) * step;
            if (Math.abs(mx) > 0.2 && a.profile !== "scuttler") a.dir = mx > 0 ? 1 : -1;
            moving = true;
          } else if (a.action !== "perch") {
            // 到了就在附近再找下一個點
            const q = regionPoint(a, mode);
            a.tx = q.x;
            a.ty = q.y;
          }
        }

        // 太靠近別人時輕輕推開，避免疊在一起
        if (a.kind === "land" || a.kind === "water") {
          for (const o of agents) {
            if (o === a || o.kind !== a.kind) continue;
            const ox = a.x - o.x;
            const oy = (a.y - o.y) * 1.6;
            const d = Math.hypot(ox, oy);
            if (d > 0 && d < SPACING) {
              a.x += (ox / d) * (SPACING - d) * dt * 2;
              a.y += ((oy / d) * (SPACING - d) * dt * 2) / 1.6;
            }
          }
        }
        // 不要跑出自己的區域
        if (mode === "world" && a.kind === "land") {
          const z = ZONES[a.zone];
          a.x = Math.min(z.to - 3, Math.max(z.from + 3, a.x));
          a.y = Math.max(GROUND_TOP + 4, Math.min(96, a.y));
          if (inLake(a.x, a.y, 1.12)) a.x = a.x < LAKE.cx ? LAKE.cx - LAKE.rx * 1.15 : LAKE.cx + LAKE.rx * 1.15;
        }
        if (mode === "world" && a.kind === "water" && !inLake(a.x, a.y, 0.85)) {
          const q = regionPoint(a, mode);
          a.tx = q.x;
          a.ty = q.y;
        }

        const action: Action = greeting ? "look" : a.action;
        const ps = pose(action, t * (action === "fly" ? 1 : 1), a.phase, moving);
        const hop = greeting ? -Math.abs(Math.sin(t * 7)) * 7 : 0;
        place(el, a.x, a.y);
        el.dataset.near = greeting ? "1" : "0";
        el.dataset.action = action;
        const sprite = el.firstElementChild as HTMLElement | null;
        if (sprite && a.kind !== "plant") {
          // 姿勢以「面向右」計算，再依照片裡原本的方向和現在的行進方向翻轉
          const base = a.creature.facing === "right" ? 1 : -1;
          sprite.style.transform = `translateY(${ps.y + hop}px) scaleX(${a.dir}) rotate(${ps.rot}deg) scale(${ps.sx}, ${ps.sy}) scaleX(${base})`;
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [agents, mode]);

  // 提示訊息幾秒後自動消失
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const press = (dir: string, on: boolean) => {
    if (on) keys.current.add(dir);
    else keys.current.delete(dir);
  };

  function travelTo(zone: Zone) {
    if (mode !== "world") return;
    // 湖畔：站在湖的下方岸邊，整座湖剛好在畫面裡
    player.current.x = zone === "lake" ? 245 : (ZONES[zone].from + ZONES[zone].to) / 2;
    player.current.y = zone === "lake" ? 95 : 84;
    setActive(true);
  }

  const dpad = (size: string) => (
    <div className="grid grid-cols-3 gap-1">
      {[
        ["", ""],
        ["up", "▲"],
        ["", ""],
        ["left", "◀"],
        ["", ""],
        ["right", "▶"],
        ["", ""],
        ["down", "▼"],
        ["", ""],
      ].map(([dir, label], i) =>
        dir ? (
          <button
            key={i}
            type="button"
            aria-label={`往${{ up: "上", down: "下", left: "左", right: "右" }[dir]}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setActive(true);
              press(dir, true);
            }}
            onPointerUp={() => press(dir, false)}
            onPointerCancel={() => press(dir, false)}
            className={`flex items-center justify-center rounded-xl border border-line bg-card/85 text-ink shadow active:bg-forest active:text-on-accent ${size}`}
          >
            {label}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );

  const layer = (
    <>
      {agents.map((a) => (
        <div
          key={`${mode}-${a.id}`}
          ref={(el) => {
            if (el) els.current.set(a.id, el);
            else els.current.delete(a.id);
          }}
          className={`group absolute -translate-x-1/2 ${a.kind === "land" || a.kind === "plant" ? "-translate-y-full" : "-translate-y-1/2"}`}
          style={{ left: `${(a.x / (mode === "world" ? WORLD : 100)) * 100}%`, top: `${a.y}%` }}
        >
          <Sprite creature={a.creature} kind={a.kind} mode={mode} />
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-card/95 px-2 py-0.5 text-xs font-medium text-ink opacity-0 shadow transition-opacity group-hover:opacity-100 group-data-[near=1]:opacity-100">
            {a.kind !== "plant" && <span className="mr-0.5">❤️</span>}
            {a.creature.name}
          </span>
        </div>
      ))}

      {/* 玩家 */}
      <div ref={playerRef} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "46%", top: "82%" }}>
        <span ref={playerSprite} className={`block leading-none drop-shadow-lg ${mode === "world" ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"}`}>
          {mode === "world" ? "🧑‍🌾" : "🏊"}
        </span>
        {mode === "dive" && (
          <span className="pointer-events-none absolute -top-2 left-1/2 flex flex-col items-center gap-1">
            <i className="block h-2 w-2 animate-[bubble_1.6s_ease-in_infinite] rounded-full border border-white/80" />
            <i className="block h-1.5 w-1.5 animate-[bubble_1.6s_ease-in_0.5s_infinite] rounded-full border border-white/80" />
          </span>
        )}
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-wood px-1.5 text-[10px] font-bold text-on-accent">你</span>
      </div>
    </>
  );

  return (
    <div ref={wrapRef} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex gap-1 rounded-full border border-line bg-sand p-1">
          {(Object.keys(ZONES) as Zone[]).map((z) => (
            <button
              key={z}
              type="button"
              ref={(el) => {
                if (el) zoneBtns.current.set(z, el);
              }}
              disabled={mode !== "world"}
              onClick={() => travelTo(z)}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink transition-colors disabled:opacity-50 data-[active=1]:bg-forest data-[active=1]:text-on-accent"
            >
              {ZONES[z].emoji} {ZONES[z].label}
            </button>
          ))}
        </div>
        {eligible > shown.length && (
          <button
            type="button"
            onClick={() => setBatch((b) => b + 1)}
            className="rounded-full border border-line bg-sand px-3 py-1.5 text-xs font-medium text-ink hover:border-forest hover:text-forest"
          >
            🔄 換一批（{shown.length}/{eligible} 位出來玩）
          </button>
        )}
      </div>

      <div
        ref={viewRef}
        onPointerDown={() => setActive(true)}
        className={`relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-3xl border-4 sm:aspect-[16/9] ${
          active ? "border-forest" : "border-wood"
        }`}
      >
        {mode === "world" ? (
          <>
            <Sky />
            <div ref={farRef} className="absolute inset-y-0 left-0 w-[400%] will-change-transform">
              <FarMountains />
            </div>
            <div ref={worldRef} className="absolute inset-y-0 left-0 w-[300%] will-change-transform">
              <WorldGround />
              {layer}
            </div>
          </>
        ) : (
          <>
            <UnderwaterBackdrop />
            {layer}
          </>
        )}

        {toast && (
          <div className="absolute left-1/2 top-3 z-[2000] -translate-x-1/2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium text-ink shadow-lg">
            {toast}
          </div>
        )}
        {!active && !toast && (
          <div className="absolute left-3 top-3 z-[2000] max-w-[70%] rounded-full bg-card/90 px-3 py-1.5 text-xs text-ink shadow">
            👆 點一下場景開始操作
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-[2000] hidden opacity-60 transition-opacity hover:opacity-100 sm:block">{dpad("h-9 w-9")}</div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <p className="text-xs text-muted">按住方向鍵移動，往左右走可以到森林和湖畔，走進湖裡就能潛水 🤿</p>
        {dpad("h-10 w-10")}
      </div>
      <p className="hidden text-xs text-muted sm:block">
        點一下場景後，用方向鍵／WASD 或右下角按鈕移動；往左走是森林、往右走是湖畔，走進湖裡就能潛水 🤿 靠近夥伴牠會停下來跟你打招呼。
      </p>
    </div>
  );
}

// 有去背圖就用去背圖（最像牠真實的樣子），沒有的話用照片做成圓形貼紙
function Sprite({ creature, kind, mode }: { creature: Creature; kind: Agent["kind"]; mode: Mode }) {
  const height =
    mode === "dive"
      ? kind === "plant"
        ? "h-16 sm:h-24"
        : "h-16 sm:h-24"
      : kind === "water"
        ? "h-8 sm:h-11"
        : kind === "sky"
          ? "h-10 sm:h-14"
          : kind === "plant"
            ? "h-14 sm:h-20"
            : "h-14 sm:h-20";
  const sway = kind === "plant" ? "origin-bottom animate-[sway_3s_ease-in-out_infinite]" : "";
  const origin = kind === "land" || kind === "plant" ? "origin-bottom" : "origin-center";

  if (creature.cutout) {
    return (
      <span className={`relative block ${origin} ${sway}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 去背圖是 data URL */}
        <img
          src={creature.cutout}
          alt={creature.name}
          draggable={false}
          className={`block w-auto max-w-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)] ${height}`}
        />
        {(kind === "land" || kind === "plant") && mode === "world" && (
          <span className="absolute -bottom-1 left-1/2 -z-10 h-2.5 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/25 blur-[2px]" />
        )}
      </span>
    );
  }

  const size = height.replace(/h-(\S+)/g, "h-$1 w-$1");
  return (
    <span className={`relative block ${origin} ${sway}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 照片是 data URL */}
      <img
        src={creature.photo}
        alt={creature.name}
        draggable={false}
        className={`block border-[3px] border-white object-cover shadow-[0_6px_14px_rgba(0,0,0,0.3)] ${kind === "plant" ? "rounded-2xl" : "rounded-full"} ${size}`}
      />
      {(kind === "land" || kind === "plant") && mode === "world" && (
        <span className="absolute -bottom-1.5 left-1/2 -z-10 h-2 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/20 blur-[1px]" />
      )}
    </span>
  );
}

function Sky() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-linear-to-b from-[#9fd3ea] via-[#cfe9f3] to-[#f6ecd2]" />
      <div className="absolute right-[8%] top-[7%] aspect-square h-[12%] rounded-full bg-[#ffd76a] shadow-[0_0_60px_20px_rgba(255,215,106,0.6)]" />
      <div className="absolute left-0 top-[10%] w-full animate-[drift_70s_linear_infinite] text-4xl opacity-90">☁️</div>
      <div className="absolute left-0 top-[22%] w-full animate-[drift_100s_linear_-40s_infinite] text-3xl opacity-80">☁️</div>
    </div>
  );
}

// 遠山（視差捲動）
function FarMountains() {
  return (
    <svg className="absolute bottom-[36%] left-0 h-[30%] w-full" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 30 L0 16 L20 6 L38 15 L60 3 L82 14 L100 8 L124 17 L150 4 L172 15 L196 7 L220 16 L246 5 L270 14 L292 8 L318 17 L344 4 L366 14 L386 9 L400 12 L400 30 Z"
        fill="#8fb3a0"
        opacity="0.75"
      />
      <path d="M0 30 L0 22 Q50 12 100 21 Q150 13 200 22 Q250 14 300 21 Q350 13 400 20 L400 30 Z" fill="#6d9c6f" opacity="0.85" />
    </svg>
  );
}

// 地面：森林、農場草原、湖畔
function WorldGround() {
  const x = (v: number) => `${(v / WORLD) * 100}%`;
  return (
    <div className="absolute inset-0">
      {/* 草地，森林區比較深 */}
      <div className="absolute inset-x-0 bottom-0 top-[60%] bg-linear-to-r from-[#3f7a3c] via-[#6aa851] via-40% to-[#7fb65d]" />
      <div className="absolute inset-x-0 bottom-0 top-[60%] bg-linear-to-b from-white/10 to-black/10" />

      {/* 森林：後排樹木 */}
      {[3, 10, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 96].map((v, i) => (
        <span
          key={`tb${v}`}
          className="absolute -translate-x-1/2 -translate-y-full leading-none"
          style={{ left: x(v), top: `${61 + (i % 3)}%`, fontSize: `clamp(2.5rem, ${7 + (i % 3)}vw, ${5 + (i % 3)}rem)` }}
        >
          {i % 3 === 1 ? "🌳" : "🌲"}
        </span>
      ))}
      {/* 森林：前排幾棵樹與香菇 */}
      {[6, 30, 62, 88].map((v, i) => (
        <span key={`tf${v}`} className="absolute -translate-x-1/2 -translate-y-full text-[clamp(2rem,6vw,4rem)] leading-none" style={{ left: x(v), top: `${86 + (i % 2) * 6}%`, zIndex: 900 }}>
          🌲
        </span>
      ))}
      {[14, 47, 78].map((v) => (
        <span key={`m${v}`} className="absolute text-xl" style={{ left: x(v), top: "90%" }}>
          🍄
        </span>
      ))}

      {/* 草原：小屋、圍欄、乾草 */}
      <div className="absolute leading-none" style={{ left: x(103), top: "44%", fontSize: "clamp(3rem,9vw,6rem)" }}>
        🏡
      </div>
      <div className="absolute h-[6%]" style={{ left: x(118), width: x(80), top: "57%" }}>
        <div className="absolute inset-x-0 top-[25%] h-[18%] bg-[#b8562b]" />
        <div className="absolute inset-x-0 top-[65%] h-[18%] bg-[#a04a24]" />
        <div className="absolute inset-0 flex justify-between">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="h-full w-[1.4%] rounded-t-sm bg-[#8c3f1e]" />
          ))}
        </div>
      </div>
      {[126, 168, 190].map((v) => (
        <span key={`h${v}`} className="absolute text-2xl" style={{ left: x(v), top: "88%" }}>
          🌾
        </span>
      ))}
      <span className="absolute text-xl" style={{ left: x(150), top: "93%" }}>
        🌼
      </span>

      {/* 湖畔：湖、木棧道、蘆葦 */}
      <div
        className="absolute rounded-[50%] border-[6px] border-[#d9c79b] bg-radial from-[#7cc8dc] to-[#2f7f99] shadow-inner"
        style={{ left: x(LAKE.cx - LAKE.rx), width: x(LAKE.rx * 2), top: `${LAKE.cy - LAKE.ry}%`, height: `${LAKE.ry * 2}%` }}
      >
        <div className="absolute inset-[18%] animate-pulse rounded-[50%] border-2 border-white/30" />
      </div>
      <div className="absolute h-[3%] rounded-sm bg-[#a8703f] shadow" style={{ left: x(206), width: x(26), top: "76%" }}>
        <div className="absolute inset-0 flex justify-between px-[2%]">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-full w-px bg-[#7a4a22]" />
          ))}
        </div>
      </div>
      {[224, 287, 292].map((v, i) => (
        <span key={`r${v}`} className="absolute text-2xl" style={{ left: x(v), top: `${70 + i * 4}%` }}>
          🌾
        </span>
      ))}
      <span className="absolute text-2xl" style={{ left: x(268), top: "70%" }}>
        🪷
      </span>

      {/* 區域路牌 */}
      {[
        [99, "🌲 森林 ｜ 🏡 草原"],
        [201, "🏡 草原 ｜ 🌊 湖畔"],
      ].map(([v, label]) => (
        <div key={v} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: x(v as number), top: "72%", zIndex: 700 }}>
          <div className="whitespace-nowrap rounded-md border-2 border-[#7a4a22] bg-[#c98a4b] px-2 py-0.5 text-[11px] font-bold text-white shadow">{label}</div>
          <div className="mx-auto h-6 w-1.5 bg-[#7a4a22]" />
        </div>
      ))}
      <span
        className="absolute -translate-x-1/2 rounded-full bg-card/85 px-2 py-0.5 text-[11px] text-ink"
        style={{ left: x(LAKE.cx), top: `${LAKE.cy - LAKE.ry - 5}%` }}
      >
        走進湖裡就能潛水
      </span>
    </div>
  );
}

function UnderwaterBackdrop() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-linear-to-b from-[#4fb3cf] via-[#1f7895] to-[#0d3f57]" />
      {/* 水面與光束 */}
      <div className="absolute inset-x-0 top-0 h-[4%] bg-white/30" />
      {[12, 34, 58, 80].map((x, i) => (
        <div
          key={x}
          className="absolute top-0 h-[75%] w-[10%] origin-top animate-[sway_6s_ease-in-out_infinite] bg-linear-to-b from-white/25 to-transparent"
          style={{ left: `${x}%`, animationDelay: `${i * -1.5}s`, transform: "skewX(-12deg)" }}
        />
      ))}
      {/* 氣泡 */}
      {[8, 22, 41, 63, 77, 91].map((x, i) => (
        <i
          key={x}
          className="absolute bottom-[10%] block h-2 w-2 animate-[rise_6s_linear_infinite] rounded-full border border-white/60"
          style={{ left: `${x}%`, animationDelay: `${i * -1.1}s` }}
        />
      ))}
      {/* 沙地與裝飾 */}
      <div className="absolute inset-x-0 bottom-0 h-[10%] rounded-t-[40%] bg-linear-to-b from-[#e8d6a8] to-[#c9b07a]" />
      {[4, 18, 47, 71, 93].map((x, i) => (
        <span
          key={x}
          className="absolute bottom-[6%] origin-bottom animate-[sway_4s_ease-in-out_infinite] text-3xl opacity-80"
          style={{ left: `${x}%`, animationDelay: `${i * -0.7}s` }}
        >
          {i % 2 ? "🪨" : "🌱"}
        </span>
      ))}
      <span className="absolute left-1/2 top-[5%] -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-xs text-white">
        ⬆ 往上游回到岸上
      </span>
    </div>
  );
}
