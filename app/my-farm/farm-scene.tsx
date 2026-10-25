"use client";

import { useEffect, useRef, useState } from "react";
import type { Creature } from "./collection";

type Mode = "farm" | "dive";

// 所有座標都是場景寬高的百分比
const POND = { cx: 76, cy: 81, rx: 18, ry: 12 };
const GROUND_TOP = 64;

type Agent = {
  id: string;
  creature?: Creature;
  kind: "sky" | "land" | "water" | "plant";
  x: number;
  y: number;
  tx: number; // 目標點
  ty: number;
  speed: number;
  wait: number; // 停下來發呆的秒數
  phase: number; // 上下擺動用
  facing: 1 | -1;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function inPond(x: number, y: number, shrink = 1) {
  return ((x - POND.cx) / (POND.rx * shrink)) ** 2 + ((y - POND.cy) / (POND.ry * shrink)) ** 2 < 1;
}

function pondPoint() {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * 0.7;
  return { x: POND.cx + Math.cos(a) * POND.rx * r, y: POND.cy + Math.sin(a) * POND.ry * r };
}

function landPoint() {
  // 在水池左邊的草地上找一個點
  return { x: rand(16, 54), y: rand(GROUND_TOP + 4, 95) };
}

function buildAgents(creatures: Creature[], mode: Mode): Agent[] {
  const agents: Agent[] = [];
  let plantSlot = 0;
  let waterPlantSlot = 0;
  for (const c of creatures) {
    const base = { id: c.id, creature: c, speed: rand(4, 8), wait: rand(0, 2), phase: rand(0, 6), facing: 1 as const };
    if (mode === "farm") {
      if (c.category === "sky") {
        const y = rand(6, 36);
        agents.push({ ...base, kind: "sky", x: rand(0, 100), y, tx: 0, ty: y, speed: rand(6, 12) * (Math.random() < 0.5 ? -1 : 1) });
      } else if (c.category === "land") {
        const p = landPoint();
        agents.push({ ...base, kind: "land", ...p, tx: p.x, ty: p.y });
      } else if (c.category === "water") {
        const p = pondPoint();
        agents.push({ ...base, kind: "water", ...p, tx: p.x, ty: p.y, speed: rand(2, 4) });
      } else if (c.category === "plant") {
        const i = plantSlot++;
        const x = 18 + ((i * 17) % 36);
        const y = GROUND_TOP + 6 + ((i * 11) % 26);
        agents.push({ ...base, kind: "plant", x, y, tx: x, ty: y, speed: 0 });
      }
      // 水中植物在農場畫面看不到，要潛水才看得到
    } else {
      if (c.category === "water") {
        // 一潛進來，水裡的夥伴就游過來打招呼
        const p = { x: rand(8, 92), y: rand(30, 85) };
        agents.push({ ...base, kind: "water", ...p, tx: rand(40, 60), ty: rand(22, 38), speed: rand(8, 12) });
      } else if (c.category === "waterplant") {
        const i = waterPlantSlot++;
        const x = 8 + ((i * 23) % 84);
        agents.push({ ...base, kind: "plant", x, y: 93, tx: x, ty: 93, speed: 0 });
      }
    }
  }
  return agents;
}

export default function FarmScene({ creatures }: { creatures: Creature[] }) {
  const [mode, setMode] = useState<Mode>("farm");
  const [active, setActive] = useState(false);
  const [toast, setToast] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);

  const sceneRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playerSprite = useRef<HTMLSpanElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const keys = useRef(new Set<string>());
  const player = useRef({ x: 30, y: 82, facing: -1 as 1 | -1 });

  // 收服新夥伴或切換場景時，重新安排每隻動物的位置
  useEffect(() => {
    const next = buildAgents(creatures, mode);
    // 用 requestAnimationFrame 包起來，避免在 effect 中同步更新 state
    const id = requestAnimationFrame(() => setAgents(next));
    return () => cancelAnimationFrame(id);
  }, [creatures, mode]);

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
      if (!sceneRef.current?.contains(e.target as Node)) setActive(false);
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

  // 主迴圈：移動玩家與所有動物，直接改 DOM 樣式，不觸發 React 重新渲染
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let switching = false;

    const place = (el: HTMLElement | null | undefined, x: number, y: number) => {
      if (!el) return;
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.zIndex = String(Math.round(y * 10));
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
      const speed = mode === "farm" ? 22 : 18;
      p.x = Math.min(97, Math.max(3, p.x + dx * speed * dt));
      p.y = p.y + dy * speed * 0.8 * dt;
      if (dx !== 0) p.facing = dx > 0 ? 1 : -1;

      if (mode === "farm") {
        p.y = Math.min(97, Math.max(GROUND_TOP + 2, p.y));
        if (!switching && inPond(p.x, p.y, 0.8)) {
          switching = true;
          p.x = 50;
          p.y = 24;
          setMode("dive");
          setToast("🤿 撲通！潛進水池裡了，往上游可以回到岸上");
        }
      } else {
        p.y = Math.min(90, p.y);
        if (!switching && p.y < 3) {
          switching = true;
          p.x = POND.cx - POND.rx - 4;
          p.y = POND.cy;
          setMode("farm");
          setToast("🌤️ 浮出水面，回到農場了");
        }
        p.y = Math.max(2, p.y);
      }
      place(playerRef.current, p.x, p.y);
      if (playerSprite.current) {
        // emoji 預設大多面向左邊，往右走時水平翻轉
        playerSprite.current.style.transform = `scaleX(${p.facing === 1 ? -1 : 1})`;
      }

      // 動物移動
      for (const a of agents) {
        const el = els.current.get(a.id);
        if (!el) continue;
        const dist = Math.hypot(a.x - p.x, (a.y - p.y) * 0.6);
        const near = dist < (mode === "dive" ? 16 : 12);

        if (a.kind === "sky") {
          a.x += a.speed * dt;
          if (a.x > 108) a.x = -8;
          if (a.x < -8) a.x = 108;
          a.facing = a.speed > 0 ? 1 : -1;
          place(el, a.x, a.y + Math.sin(t * 2 + a.phase) * 2);
        } else if (a.kind === "plant") {
          place(el, a.x, a.y);
        } else {
          if (near) {
            // 靠近玩家時繞著玩家轉圈或跟著走
            const angle = t * 1.5 + a.phase;
            a.tx = p.x + Math.cos(angle) * (mode === "dive" ? 9 : 7);
            a.ty = p.y + Math.sin(angle) * (mode === "dive" ? 7 : 3);
            a.wait = 0;
          } else if (a.wait > 0) {
            a.wait -= dt;
          } else if (Math.hypot(a.tx - a.x, a.ty - a.y) < 1) {
            const q =
              mode === "dive" ? { x: rand(8, 92), y: rand(12, 82) } : a.kind === "water" ? pondPoint() : landPoint();
            a.tx = q.x;
            a.ty = q.y;
            a.wait = rand(0.5, 3);
          }
          const mx = a.tx - a.x;
          const my = a.ty - a.y;
          const len = Math.hypot(mx, my);
          if (len > 0.2 && a.wait <= 0) {
            const step = Math.min(len, a.speed * (near ? 1.6 : 1) * dt);
            a.x += (mx / len) * step;
            a.y += (my / len) * step;
            if (Math.abs(mx) > 0.3) a.facing = mx > 0 ? 1 : -1;
          }
          // 陸地動物不能走進水池；水池裡的生物不能跑出來
          if (mode === "farm" && a.kind === "land") {
            a.y = Math.max(GROUND_TOP + 3, Math.min(96, a.y));
            if (inPond(a.x, a.y, 1.05)) a.x = POND.cx - POND.rx * 1.1;
          }
          const bob = a.kind === "water" ? Math.sin(t * 3 + a.phase) * (mode === "dive" ? 1.2 : 0.4) : 0;
          place(el, a.x, a.y + bob);
        }

        el.dataset.near = near ? "1" : "0";
        const sprite = el.firstElementChild as HTMLElement | null;
        if (sprite && a.kind !== "plant") sprite.style.transform = `scaleX(${a.facing === 1 ? -1 : 1})`;
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

  return (
    <div
      ref={sceneRef}
      onPointerDown={() => setActive(true)}
      className={`relative aspect-[4/5] w-full touch-none select-none overflow-hidden rounded-3xl border-4 sm:aspect-[16/9] ${
        active ? "border-forest" : "border-wood"
      }`}
    >
      {mode === "farm" ? <FarmBackdrop /> : <UnderwaterBackdrop />}

      {agents.map((a) => (
        <div
          key={`${mode}-${a.id}`}
          ref={(el) => {
            if (el) els.current.set(a.id, el);
            else els.current.delete(a.id);
          }}
          className={`group absolute ${a.kind === "plant" ? "-translate-x-1/2 -translate-y-full" : "-translate-x-1/2 -translate-y-1/2"}`}
          style={{ left: `${a.x}%`, top: `${a.y}%` }}
        >
          <Sprite creature={a.creature!} kind={a.kind} mode={mode} />
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium text-ink opacity-0 shadow transition-opacity group-hover:opacity-100 group-data-[near=1]:opacity-100">
            {a.kind !== "plant" && <span className="mr-0.5 inline-block animate-bounce">❤️</span>}
            {a.creature!.name}
          </span>
        </div>
      ))}

      {/* 玩家 */}
      <div ref={playerRef} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "30%", top: "82%" }}>
        <span
          ref={playerSprite}
          className={`block leading-none drop-shadow-lg ${mode === "farm" ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"}`}
        >
          {mode === "farm" ? "🧑‍🌾" : "🏊"}
        </span>
        {mode === "dive" && (
          <span className="pointer-events-none absolute -top-2 left-1/2 flex flex-col items-center gap-1">
            <i className="block h-2 w-2 animate-[bubble_1.6s_ease-in_infinite] rounded-full border border-white/80" />
            <i className="block h-1.5 w-1.5 animate-[bubble_1.6s_ease-in_0.5s_infinite] rounded-full border border-white/80" />
          </span>
        )}
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-wood px-1.5 text-[10px] font-bold text-on-accent">
          你
        </span>
      </div>

      {/* 提示 */}
      {toast && (
        <div className="absolute left-1/2 top-3 z-[2000] -translate-x-1/2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium text-ink shadow-lg">
          {toast}
        </div>
      )}
      {!active && (
        <div className="absolute bottom-3 left-3 z-[2000] rounded-full bg-card/90 px-3 py-1.5 text-xs text-ink shadow">
          👆 點一下場景，就能用方向鍵／WASD 或右下角按鈕移動
        </div>
      )}

      {/* 手機用的方向鍵 */}
      <div className="absolute bottom-3 right-3 z-[2000] grid grid-cols-3 gap-1">
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
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/85 text-ink shadow active:bg-forest active:text-on-accent"
            >
              {label}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}

function Sprite({ creature, kind, mode }: { creature: Creature; kind: Agent["kind"]; mode: Mode }) {
  const size =
    mode === "dive"
      ? "text-4xl sm:text-5xl"
      : kind === "water"
        ? "text-xl sm:text-2xl"
        : kind === "sky"
          ? "text-2xl sm:text-3xl"
          : "text-3xl sm:text-4xl";
  const sway = kind === "plant" ? "origin-bottom animate-[sway_3s_ease-in-out_infinite]" : "";

  if (creature.emoji) {
    return <span className={`block leading-none drop-shadow ${size} ${sway}`}>{creature.emoji}</span>;
  }
  // 沒有對應的 emoji，就用使用者拍的照片當角色
  const box = mode === "dive" ? "h-12 w-12 sm:h-14 sm:w-14" : kind === "water" ? "h-7 w-7" : "h-9 w-9 sm:h-11 sm:w-11";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 照片是 data URL，不需要 next/image 最佳化
    <img src={creature.photo} alt={creature.name} className={`block rounded-full border-2 border-white object-cover shadow ${box} ${sway}`} />
  );
}

function FarmBackdrop() {
  return (
    <div className="absolute inset-0">
      {/* 天空 */}
      <div className="absolute inset-0 bg-linear-to-b from-[#9fd3ea] via-[#cfe9f3] to-[#f6ecd2]" />
      <div className="absolute right-[8%] top-[7%] h-[12%] w-auto aspect-square rounded-full bg-[#ffd76a] shadow-[0_0_60px_20px_rgba(255,215,106,0.6)]" />
      <div className="absolute left-0 top-[10%] w-full animate-[drift_60s_linear_infinite] text-4xl opacity-90">☁️</div>
      <div className="absolute left-0 top-[22%] w-full animate-[drift_90s_linear_-30s_infinite] text-3xl opacity-80">☁️</div>

      {/* 遠山 */}
      <svg className="absolute bottom-[34%] left-0 h-[24%] w-full" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0 30 L0 18 Q12 4 25 16 Q36 6 50 15 Q64 2 78 14 Q90 6 100 12 L100 30 Z" fill="#7fae72" opacity="0.7" />
        <path d="M0 30 L0 22 Q18 12 34 22 Q52 14 70 22 Q86 16 100 20 L100 30 Z" fill="#5e9a5a" opacity="0.8" />
      </svg>

      {/* 草地 */}
      <div className="absolute inset-x-0 bottom-0 top-[60%] bg-linear-to-b from-[#8cc56a] to-[#5f9e48]" />

      {/* 木頭圍欄，致敬步道的木欄杆 */}
      <div className="absolute inset-x-0 top-[57%] h-[6%]">
        <div className="absolute inset-x-0 top-[25%] h-[18%] bg-[#b8562b]" />
        <div className="absolute inset-x-0 top-[65%] h-[18%] bg-[#a04a24]" />
        <div className="absolute inset-0 flex justify-between px-[2%]">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-full w-[1.2%] rounded-t-sm bg-[#8c3f1e]" />
          ))}
        </div>
      </div>

      {/* 小屋 */}
      <div className="absolute left-[2%] top-[44%] text-[clamp(3rem,9vw,6rem)] leading-none">🏡</div>
      <div className="absolute left-[12%] top-[86%] text-2xl">🌾</div>

      {/* 水池 */}
      <div
        className="absolute rounded-[50%] border-[6px] border-[#d9c79b] bg-radial from-[#7cc8dc] to-[#3d8fa6] shadow-inner"
        style={{
          left: `${POND.cx - POND.rx}%`,
          top: `${POND.cy - POND.ry}%`,
          width: `${POND.rx * 2}%`,
          height: `${POND.ry * 2}%`,
        }}
      >
        <div className="absolute inset-[18%] animate-pulse rounded-[50%] border-2 border-white/30" />
      </div>
      <span className="absolute text-2xl" style={{ left: `${POND.cx - POND.rx - 2}%`, top: `${POND.cy - 6}%` }}>
        🌾
      </span>
      <span className="absolute text-2xl" style={{ left: `${POND.cx + POND.rx - 2}%`, top: `${POND.cy - POND.ry - 4}%` }}>
        🪷
      </span>
      <span
        className="absolute rounded-full bg-card/80 px-2 py-0.5 text-[11px] text-ink"
        style={{ left: `${POND.cx - 7}%`, top: `${POND.cy + POND.ry + 1}%` }}
      >
        走進水池就能潛水
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
