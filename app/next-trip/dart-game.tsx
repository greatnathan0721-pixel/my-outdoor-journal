"use client";

import { geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { getWorldMap } from "./maps";
import TaiwanPlanner from "./taiwan-planner";
import { chip, primaryButton, secondaryButton, StepLabel } from "../components/trail-ui";
import { purposes, type Purpose } from "./world-data";
import WorldPicks from "./world-picks";

type Mode = "world" | "taiwan";

const tabs: { mode: Mode; label: string; hint: string }[] = [
  { mode: "world", label: "🌏 全世界版", hint: "射飛鏢決定出國地點" },
  { mode: "taiwan", label: "🇹🇼 台灣版", hint: "依偏好推薦國內景點" },
];

export default function DartGame() {
  const [mode, setMode] = useState<Mode>("world");

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="trail-card flex gap-1 self-start p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => setMode(tab.mode)}
            className={`flex flex-col items-start rounded-[1.1rem] px-5 py-2 text-left transition-colors ${
              mode === tab.mode ? "bg-forest text-on-accent" : "text-ink hover:bg-sand"
            }`}
          >
            <span className="font-semibold">{tab.label}</span>
            <span className={`text-xs ${mode === tab.mode ? "opacity-85" : "text-muted"}`}>{tab.hint}</span>
          </button>
        ))}
      </div>

      {mode === "world" ? <WorldGame /> : <TaiwanPlanner />}
    </div>
  );
}

type Phase = "aiming" | "flying" | "landed";
type Point = { x: number; y: number };
type Result = { index: number; nearest?: { at: Point; km: number } } | null;

function WorldGame() {
  const map = getWorldMap();
  const [selected, setSelected] = useState<Purpose[]>([]);
  const [phase, setPhase] = useState<Phase>("aiming");
  const [target, setTarget] = useState<Point | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [nudge, setNudge] = useState(false);

  const aimRef = useRef<Point>({ x: 0, y: 0 });
  const crosshairRef = useRef<SVGGElement>(null);
  const dartRef = useRef<SVGGElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const paths = useMemo(() => {
    const path = geoPath(map.projection);
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      features: map.features.map((f) => path(f) ?? ""),
    };
  }, [map]);

  // 瞄準中：準心在地圖上晃來晃去
  useEffect(() => {
    if (phase !== "aiming") return;
    const [[x0, y0], [x1, y1]] = map.range;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) / 2;
    const start = performance.now() - Math.random() * 10000;
    let frame = 0;

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const x = cx + rx * Math.sin(t * 1.9);
      const y = cy + ry * Math.sin(t * 2.7 + 1);
      aimRef.current = { x, y };
      crosshairRef.current?.setAttribute("transform", `translate(${x} ${y})`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, map]);

  // 飛行中：飛鏢從畫面下方飛到目標
  useEffect(() => {
    if (phase !== "flying" || !target) return;
    const duration = 450;
    const startY = map.height + 60;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      const y = startY + (target.y - startY) * ease;
      const scale = 2.5 - 1.5 * ease;
      dartRef.current?.setAttribute("transform", `translate(${target.x} ${y}) scale(${scale})`);

      if (p < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const lonLat = map.projection.invert?.([target.x, target.y]);
      const found = lonLat ? map.locate(lonLat) : null;
      const nearestXY = found?.nearest && map.projection(found.nearest.point as [number, number]);
      setResult(
        found && {
          index: found.index,
          nearest: found.nearest && nearestXY ? { at: { x: nearestXY[0], y: nearestXY[1] }, km: found.nearest.km } : undefined,
        },
      );
      setPhase("landed");
      // 等推薦區塊出現後捲過去
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, target, map]);

  function togglePurpose(id: Purpose) {
    setNudge(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function throwDart() {
    if (phase !== "aiming") return;
    if (selected.length === 0) {
      setNudge(true);
      return;
    }
    // 手會抖，加一點隨機偏移
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 8;
    setTarget({
      x: aimRef.current.x + Math.cos(angle) * r,
      y: aimRef.current.y + Math.sin(angle) * r,
    });
    setResult(null);
    setPhase("flying");
  }

  function reset() {
    setTarget(null);
    setResult(null);
    setPhase("aiming");
  }

  const hitName = result ? map.nameOf(result.index) : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={1}>這趟旅行想做什麼？（可複選）</StepLabel>
        <div className="flex flex-wrap gap-2">
          {purposes.map((p) => (
            <button key={p.id} type="button" onClick={() => togglePurpose(p.id)} className={chip(selected.includes(p.id))}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
        {nudge && <p className="mt-3 text-sm font-medium text-wood">先選至少一個旅行目的，才能射飛鏢喔！</p>}

        <div className="mt-8">
          <StepLabel step={2}>看準時機，射出飛鏢！</StepLabel>
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            onClick={throwDart}
            className={`h-auto w-full select-none ${phase === "aiming" ? "cursor-crosshair" : ""}`}
            role="img"
            aria-label="世界地圖"
          >
            <path d={paths.sphere} className="fill-ocean" />

            {paths.features.map((d, i) => (
              <path
                key={i}
                d={d}
                className={i === result?.index ? "fill-hit stroke-card" : "fill-land stroke-card"}
                strokeWidth={0.6}
              />
            ))}

            {phase === "aiming" && (
              <g
                ref={crosshairRef}
                transform={`translate(${map.width / 2} ${map.height / 2})`}
                className="pointer-events-none stroke-wood"
                fill="none"
                strokeWidth={2.5}
              >
                <circle r={14} />
                <circle r={3} className="fill-wood" />
                <line x1={-22} x2={-8} />
                <line x1={8} x2={22} />
                <line y1={-22} y2={-8} />
                <line y1={8} y2={22} />
              </g>
            )}

            {/* 掉進海裡時，從落點畫一條虛線到最近的陸地 */}
            {phase === "landed" && target && result?.nearest && (
              <g className="pointer-events-none stroke-wood-deep">
                <line
                  x1={target.x}
                  y1={target.y}
                  x2={result.nearest.at.x}
                  y2={result.nearest.at.y}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <circle cx={result.nearest.at.x} cy={result.nearest.at.y} r={4} className="fill-wood-deep" />
              </g>
            )}

            {phase !== "aiming" && target && (
              <g
                ref={dartRef}
                className="pointer-events-none"
                transform={`translate(${target.x} ${phase === "landed" ? target.y : map.height + 60})`}
              >
                {phase === "landed" && <circle r={6} className="fill-wood/30 stroke-wood" strokeWidth={1.5} />}
                <line x1={0} y1={0} x2={22} y2={-22} className="stroke-ink" strokeWidth={2.5} />
                <polygon points="0,0 7,-3 3,-7" className="fill-ink" />
                <polygon points="16,-20 24,-30 30,-26 22,-22" className="fill-wood" />
                <polygon points="20,-16 30,-24 26,-30 22,-22" className="fill-wood-deep" />
              </g>
            )}
          </svg>

          <div className="mt-4 flex min-h-20 flex-col items-center justify-center gap-3 text-center">
            {phase === "aiming" && (
              <>
                <p className="text-muted">準心會一直移動，點地圖或按下按鈕發射！</p>
                <button onClick={throwDart} className={primaryButton}>
                  🎯 射飛鏢！
                </button>
              </>
            )}

            {phase === "flying" && <p className="text-muted">咻——</p>}

            {phase === "landed" && (
              <>
                {hitName && !result?.nearest && (
                  <p className="text-lg text-ink">
                    🎯 射中了 <span className="text-2xl font-bold text-wood">{hitName}</span>！
                  </p>
                )}
                {hitName && result?.nearest && (
                  <p className="text-lg text-ink">
                    🌊 飛鏢掉進海裡了！離落點最近的是 <span className="text-2xl font-bold text-wood">{hitName}</span>
                    （約 {Math.round(result.nearest.km).toLocaleString()} 公里）
                  </p>
                )}
                {!hitName && <p className="text-lg text-ink">飛鏢飛出地圖外了⋯⋯再射一次吧！</p>}
                <button onClick={reset} className={secondaryButton}>
                  再射一次
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {phase === "landed" && result && hitName && (
        <div ref={resultRef} className="scroll-mt-6">
          <WorldPicks
            key={result.index}
            code={map.codeOf(result.index)}
            countryName={hitName}
            selected={selected}
          />
        </div>
      )}
    </div>
  );
}
