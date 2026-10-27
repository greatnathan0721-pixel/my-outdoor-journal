"use client";

import { useEffect, useState } from "react";
import StoredPhoto from "../components/stored-photo";
import { chip, inputClass, primaryButton, Tag } from "../components/trail-ui";
import type { Creature } from "../my-farm/collection";
import {
  ACTIONS,
  fmtDist,
  IMPACTS,
  km,
  MAX_SCENES,
  PARTICLES,
  POPS,
  TRAVEL_LABEL,
  travelFor,
  type Finale,
  type Point,
  type Scene,
  type SceneSetup,
} from "./storyboard";
import { sceneModel, subjectOf } from "./render/landmark-model";

type Props = {
  scenes: Scene[];
  skipped: number; // 沒有地點或超過上限而沒用到的照片
  finale: Finale;
  buddies: Creature[];
  guideId: string | null; // null＝只有腳印
  canAiModel: boolean;
  canAiArrange: boolean;
  arranging: boolean;
  arrangeError: string | null;
  onArrange: () => void;
  onScene: (photoId: string, patch: Partial<SceneSetup>) => void;
  onFinale: (patch: Partial<Finale>) => void;
  onGuide: (id: string | null) => void;
};

// 3D 地標打卡短片的分鏡編輯：每一站從地圖長出什麼、誰帶路、結尾特效積木
export default function StoryboardEditor(p: Props) {
  const last = p.scenes[p.scenes.length - 1];
  const freeze = p.finale.action === "freeze";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-2xl bg-sand p-4">
        {p.canAiArrange ? (
          <>
            <p className="text-sm text-muted">讓 AI 看每一站的照片，幫你決定從地圖長出什麼、結尾特效怎麼組（之後都可以再改）。</p>
            <button type="button" onClick={p.onArrange} disabled={p.arranging || p.scenes.length === 0} className={`${primaryButton} self-start`}>
              {p.arranging ? "AI 排分鏡中⋯" : "✨ AI 幫我排分鏡"}
            </button>
            {p.arrangeError && <p className="rounded-xl bg-wood-soft p-3 text-sm text-wood-deep">{p.arrangeError}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">沒有設定金鑰時請自己挑選；設定 OpenAI 金鑰後，AI 可以看照片幫你排好分鏡。</p>
        )}
      </div>

      {/* 每一站 */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">
          每一站（依 STEP 2 點選照片的順序，最多 {MAX_SCENES} 站）
        </p>
        {p.scenes.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-sm text-muted">選的照片都沒有地點。到「新增遊記」幫這趟旅程補上地點，或改選有定位的照片。</p>
        ) : (
          <ol className="flex flex-col">
            {p.scenes.map((s, i) => {
              const next = p.scenes[i + 1];
              const dist = next ? km(s, next) : 0;
              const mode = next ? travelFor(dist) : null;
              return (
                <li key={s.photoId}>
                  <div className="flex gap-3 rounded-2xl border border-line bg-sand p-3">
                    <PointPicker
                      blob={s.blob}
                      point={s.point}
                      active={s.pop === "subject"}
                      onPick={(point) => p.onScene(s.photoId, { point, pop: "subject" })}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-md bg-wood px-1.5 py-0.5 text-xs font-semibold text-on-accent">{i + 1}</span>
                        <input
                          aria-label={`第 ${i + 1} 站的名稱`}
                          value={s.label}
                          maxLength={20}
                          onChange={(e) => p.onScene(s.photoId, { label: e.target.value })}
                          className={`${inputClass} min-w-0 flex-1 py-1.5! font-semibold`}
                        />
                        {s.date && <span className="shrink-0 text-xs text-muted">{s.date}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {POPS.map((o) => {
                          const locked = o.id === "landmark" && !p.canAiModel;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              title={locked ? "設定 OpenAI 金鑰後才能用（沒金鑰時會改用人或主角）" : o.hint}
                              disabled={locked}
                              onClick={() => p.onScene(s.photoId, { pop: o.id })}
                              className={`${chip(s.pop === o.id)} px-3! py-1.5! text-xs! disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                      {s.pop === "subject" && (
                        <div className="flex items-center gap-2">
                          <CutPreview photoId={s.photoId} blob={s.blob} point={s.point} use="scene" />
                          <p className="text-xs text-muted">👆 點左邊照片上的人或東西，選要從地圖跳出來的主角</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {mode && (
                    <p className="py-1.5 pl-10 text-xs font-medium text-wood">
                      ↓ {mode === "stay" ? TRAVEL_LABEL.stay : `${TRAVEL_LABEL[mode]} ${fmtDist(dist)}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {p.skipped > 0 && <p className="mt-2 text-xs text-muted">※ 有 {p.skipped} 張照片沒有地點或超過 {MAX_SCENES} 站，沒有放進影片。</p>}
      </div>

      {/* 帶路 */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">站與站之間誰帶路？</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => p.onGuide(null)} className={chip(p.guideId === null)}>
            👣 只有腳印
          </button>
          {p.buddies.map((c) => (
            <button key={c.id} type="button" onClick={() => p.onGuide(c.id)} className={`${chip(p.guideId === c.id)} flex items-center gap-1.5 py-1! pl-1!`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 去背圖或縮圖是 data URL */}
              <img src={c.cutout ?? c.photo} alt="" className="h-7 w-7 rounded-full bg-card object-contain" />
              {c.name} 帶路
            </button>
          ))}
        </div>
        {p.buddies.length === 0 && <p className="mt-1 text-xs text-muted">在 STEP 2 勾選收服的夥伴，就能讓牠在地圖上帶路。</p>}
      </div>

      {/* 結尾特效 */}
      {last && (
        <div className="rounded-2xl border border-line bg-sand p-4">
          <p className="mb-1 font-semibold text-ink">🎬 結尾特效</p>
          <p className="mb-3 text-xs text-muted">最後一站的主角衝出照片，跟片尾標題來一下互動。片尾畫面也是影片的第一格，IG 循環播放時會無縫接回開頭。</p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-col items-center gap-1">
              <PointPicker blob={last.blob} point={p.finale.point} active={!freeze} onPick={(point) => p.onFinale({ point, action: freeze ? "dash" : p.finale.action, impact: freeze ? "smash" : p.finale.impact })} />
              <span className="text-xs text-muted">{freeze ? "點主角來啟用" : "👆 點照片換主角"}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <Row label="動作">
                {ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => p.onFinale({ action: a.id, impact: a.id === "freeze" ? "stamp" : freeze ? "smash" : p.finale.impact })}
                    className={`${chip(p.finale.action === a.id)} px-3! py-1.5! text-xs!`}
                  >
                    {a.label}
                  </button>
                ))}
              </Row>
              <Row label="粒子">
                {PARTICLES.map((e) => (
                  <button key={e} type="button" onClick={() => p.onFinale({ particle: e })} className={`${chip(p.finale.particle === e)} px-2.5! py-1! text-lg!`}>
                    {e}
                  </button>
                ))}
                <input
                  aria-label="自訂 emoji"
                  placeholder="自訂"
                  value={PARTICLES.includes(p.finale.particle) ? "" : p.finale.particle}
                  onChange={(e) => {
                    const v = [...e.target.value].slice(0, 2).join("");
                    if (v) p.onFinale({ particle: v });
                  }}
                  className={`${inputClass} w-20! py-1.5! text-center`}
                />
              </Row>
              <Row label="跟標題">
                {IMPACTS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={freeze && m.id !== "stamp"}
                    onClick={() => p.onFinale({ impact: m.id })}
                    className={`${chip(p.finale.impact === m.id)} px-3! py-1.5! text-xs! disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {m.label}
                  </button>
                ))}
              </Row>
              <p className="text-sm text-ink">
                <Tag tone="info">預覽</Tag>{" "}
                {freeze
                  ? `📸 照片定格成拍立得 → ${p.finale.particle} 飄落 → 🔖 標題蓋章`
                  : `${p.finale.subject ? `「${p.finale.subject}」` : "點選的主角"} → ${ACTIONS.find((a) => a.id === p.finale.action)?.label} → ${p.finale.particle} → ${IMPACTS.find((m) => m.id === p.finale.impact)?.label}`}
              </p>
              {!freeze && (
                <div className="flex items-center gap-2">
                  <CutPreview photoId={last.photoId} blob={last.blob} point={p.finale.point} use="finale" />
                  <p className="text-xs text-muted">左邊是會衝出去的主角。切不出完整主角（例如只拍到半身）時，會自動改用「定格拍立得」。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

// 切出來的主角長什麼樣子（跟影片用同一套去背，結果也會留著給影片直接用）
function CutPreview({ photoId, blob, point, use }: { photoId: string; blob: Blob; point: Point; use: "scene" | "finale" }) {
  const key = `${use}:${photoId}:${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const job =
      use === "finale"
        ? subjectOf({ id: photoId, blob }, point).then((s) => s?.image.toDataURL() ?? null)
        : sceneModel({ id: photoId, blob }, "subject", point, "", null)!.then((m) => (m.kind === "card" ? null : m.image.toDataURL()));
    job
      .catch(() => null)
      .then((url) => alive && setResult({ key, url }));
    return () => {
      alive = false;
    };
  }, [key, use, photoId, blob, point]);
  const ready = result?.key === key;
  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-[conic-gradient(#e7e1d4_25%,#fff_0_50%,#e7e1d4_0_75%,#fff_0)] bg-size-[14px_14px] text-center text-[10px] leading-tight text-muted"
      title="切出來的樣子"
    >
      {!ready ? (
        "去背中⋯"
      ) : result.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- 剛切好的去背圖
        <img src={result.url} alt="切出來的主角" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="px-1 text-wood-deep">切不出完整主角{use === "finale" ? "，會用定格拍立得" : "，會用照片卡"}</span>
      )}
    </div>
  );
}

// 點照片選主角的位置（顯示整張照片，點的位置才會對應到原照片）
function PointPicker({ blob, point, active, onPick }: { blob: Blob; point: Point; active: boolean; onPick: (p: Point) => void }) {
  return (
    <button
      type="button"
      aria-label="點選主角位置"
      onClick={(e) => {
        const img = e.currentTarget.querySelector("img");
        if (!img) return;
        const r = img.getBoundingClientRect();
        onPick({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
      }}
      className="relative w-24 shrink-0 cursor-crosshair self-start overflow-hidden rounded-xl border border-line bg-line"
    >
      <StoredPhoto blob={blob} alt="" className="block h-auto w-full" />
      {active && (
        <span
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-hit/70 shadow-md"
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
        />
      )}
    </button>
  );
}
