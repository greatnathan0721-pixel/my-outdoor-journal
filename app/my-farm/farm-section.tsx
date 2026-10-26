"use client";

import { useState } from "react";
import { StepLabel, Tag } from "../components/trail-ui";
import { ZONES, zoneOf } from "./behavior";
import Catcher from "./catcher";
import { removeCreature, updateCreature, useCollection, type Creature } from "./collection";
import { makeCutout } from "./cutout";
import FarmScene from "./farm-scene";
import { categories } from "./species";

export default function FarmSection() {
  const creatures = useCollection();
  const counts = categories.map((c) => ({ ...c, count: creatures.filter((x) => x.category === c.id).length }));

  return (
    <div className="flex flex-col gap-6">
      <section id="farm" className="trail-card scroll-mt-6 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-wood">🌻 我的農場</p>
            <h2 className="text-2xl font-bold text-ink">夥伴們的快樂生活</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {counts.map((c) => (
              <Tag key={c.id} tone={c.count > 0 ? "good" : "neutral"}>
                {c.emoji} {c.count}
              </Tag>
            ))}
          </div>
        </div>
        <FarmScene creatures={creatures} />
        {creatures.length === 0 && (
          <p className="mt-3 text-center text-sm text-muted">農場還空空的，在下面上傳照片收服你的第一位夥伴吧！</p>
        )}
      </section>

      <Catcher />

      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={3}>我的圖鑑（{creatures.length}）</StepLabel>
        {creatures.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-muted">還沒有收服任何動植物。</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...creatures].reverse().map((c) => (
              <CreatureCard key={c.id} creature={c} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          ※ 圖鑑存在這台裝置的瀏覽器裡，清除瀏覽器資料或換裝置就看不到了（記得到首頁下載備份）。照片只在你的瀏覽器裡辨識和去背，不會上傳到任何伺服器。
        </p>
      </section>
    </div>
  );
}

// 圖鑑卡片：可以補去背、調整方向、放生
function CreatureCard({ creature: c }: { creature: Creature }) {
  const [working, setWorking] = useState(false);
  const zone = ZONES[zoneOf(c)];
  const movable = c.category !== "plant" && c.category !== "waterplant";

  // 以前收服、還沒去背的夥伴：用存下來的縮圖去背（縮圖比較小，效果會比新拍的差一點）
  async function cut() {
    setWorking(true);
    try {
      const img = new Image();
      img.src = c.photo;
      await img.decode();
      const result = await makeCutout(img, { x: 0.5, y: 0.5 }, 240);
      if (result) await updateCreature({ ...c, cutout: result.dataUrl });
      else alert("沒有切出東西，可能主體不在照片中央。");
    } catch {
      alert("去背失敗，請稍後再試。");
    }
    setWorking(false);
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-sand">
      <div className="relative flex aspect-square items-center justify-center bg-moss/60">
        {/* eslint-disable-next-line @next/next/no-img-element -- 去背圖或縮圖是 data URL */}
        <img
          src={c.cutout ?? c.photo}
          alt={c.name}
          className={c.cutout ? "max-h-[85%] max-w-[85%] object-contain drop-shadow-md" : "h-full w-full object-cover"}
        />
        {/* 名字跟 AI 判斷一致時 emoji 才準，自己取的名字就不顯示 */}
        {c.emoji && c.aiGuess === c.name && (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-card/90 px-1.5 text-xl">{c.emoji}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-semibold text-ink">{c.name}</p>
        <p className="text-xs text-muted">
          {categories.find((x) => x.id === c.category)?.label}・住在{zone.emoji}{zone.label}
        </p>
        {c.aiGuess && c.aiGuess !== c.name && <p className="text-xs text-muted">AI 原本猜：{c.aiGuess}</p>}
        <p className="text-xs text-muted">{new Date(c.caughtAt).toLocaleDateString("zh-TW")} 收服</p>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
          {!c.cutout && (
            <button type="button" onClick={cut} disabled={working} className="font-semibold text-forest hover:underline disabled:opacity-50">
              {working ? "去背中⋯" : "✂️ 幫牠去背"}
            </button>
          )}
          {movable && (
            <button
              type="button"
              onClick={() => updateCreature({ ...c, facing: c.facing === "right" ? "left" : "right" })}
              className="text-ink hover:underline"
              title="走路方向反了的話按這裡"
            >
              ⇄ 換方向
            </button>
          )}
          <button
            type="button"
            onClick={() => confirm(`確定要讓「${c.name}」離開農場嗎？`) && removeCreature(c.id)}
            className="text-wood hover:underline"
          >
            放生
          </button>
        </div>
      </div>
    </li>
  );
}
