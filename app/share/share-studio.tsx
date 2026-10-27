"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StoredPhoto from "../components/stored-photo";
import { chip, inputClass, primaryButton, secondaryButton, StepLabel, Tag } from "../components/trail-ui";
import { aiFetch, useAiSettings } from "../lib/ai-settings";
import { tripStops } from "../lib/trip-stops";
import { useDiary, type Photo, type Trip } from "../lib/trips-db";
import { useCollection, type Creature } from "../my-farm/collection";
import { fmtDates } from "./render/canvas";
import { renderLongImage } from "./render/long-image";
import { renderLandmarkVideo } from "./render/landmark-video";
import { renderVideo } from "./render/video";
import { caughtDuring, defaultText, photoLabel, shrinkPhoto, type ShareInput } from "./share-input";
import {
  DEFAULT_FINALE,
  DEFAULT_POINT,
  MAX_SCENES,
  photoLocation,
  shortDate,
  type Finale,
  type Point,
  type Pop,
  type Scene,
  type SceneSetup,
} from "./storyboard";
import StoryboardEditor from "./storyboard-editor";

type Kind = "video" | "long" | "landmark";
type Job = { status: "running" | "done" | "error"; progress: number; note: string; blob?: Blob; url?: string };
type Text = { tripId: string; title: string; subtitle: string; caption: string; hashtags: string };
// 3D 地標短片的分鏡設定（每趟旅程一份）；guideId 是 undefined 時用第一位選到的夥伴帶路
type Board = { tripId: string; scenes: Record<string, SceneSetup>; finale: Finale; guideId?: string | null };

const MAX_PHOTOS = 8;
const MAX_BUDDIES = 6;

const OUTPUTS: { kind: Kind; emoji: string; title: string; desc: string; ai?: boolean }[] = [
  { kind: "video", emoji: "🎬", title: "15 秒路線短片", desc: "3D 地圖沿著紅線飛一圈，接著照片和夥伴登場。MP4 直式影片，可以直接發 Reels／限動。" },
  { kind: "long", emoji: "📜", title: "IG 打卡長圖", desc: "標題、路線地圖、每一站、拍立得照片牆、收服的夥伴和文案，排成一張長圖。" },
  {
    kind: "landmark",
    emoji: "📌",
    title: "3D 地標打卡短片",
    desc: "每一站：圖釘插進地圖、地標或主角從地圖長出來、鏡頭鑽進照片；站與站之間在地圖上走過去，最後來個結尾特效。可以無限循環播放。",
    ai: true,
  },
];

const TONES = [
  { id: "warm", label: "🌤️ 溫暖" },
  { id: "funny", label: "😆 幽默" },
  { id: "poetic", label: "🍃 文青" },
];

export default function ShareStudio({ handFont }: { handFont: string }) {
  const diary = useDiary();
  const creatures = useCollection();
  const ai = useAiSettings();

  const [chosenTrip, setChosenTrip] = useState<string | null>(null);
  const trip = diary.trips.find((t) => t.id === chosenTrip) ?? diary.trips[0] ?? null;
  const stops = useMemo(() => (trip ? tripStops(trip, diary.photos) : []), [trip, diary.photos]);
  const tripPhotos = useMemo(
    () =>
      (trip?.photoIds ?? [])
        .map((id) => diary.photos.get(id))
        .filter((p): p is Photo => !!p)
        .sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? "")),
    [trip, diary.photos],
  );
  const matched = useMemo(() => (trip ? creatures.filter((c) => caughtDuring(trip, c)) : []), [trip, creatures]);
  const others = creatures.filter((c) => !matched.includes(c));

  // 每一趟旅程有自己的選擇和文案；還沒動過時用預設值
  const [picks, setPicks] = useState<{ tripId: string; photos: string[]; buddies: string[] } | null>(null);
  const current =
    trip && picks?.tripId === trip.id
      ? picks
      : { tripId: trip?.id ?? "", photos: tripPhotos.slice(0, 6).map((p) => p.id), buddies: matched.slice(0, MAX_BUDDIES).map((c) => c.id) };
  const [text, setText] = useState<Text | null>(null);
  const currentText: Text | null =
    trip && text?.tripId === trip.id
      ? text
      : trip
        ? (() => {
            const d = defaultText(trip, stops, current.buddies.map((id) => creatures.find((c) => c.id === id)?.name ?? ""));
            return { tripId: trip.id, ...d, subtitle: fmtDates(trip.startDate, trip.endDate), hashtags: d.hashtags.join(" ") };
          })()
        : null;

  const [tone, setTone] = useState("warm");
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Partial<Record<Kind, Job>>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [arranging, setArranging] = useState(false);
  const [arrangeError, setArrangeError] = useState<string | null>(null);
  const busy = Object.values(jobs).some((j) => j?.status === "running");

  if (!diary.ready) return <p className="trail-card p-6 text-muted">讀取遊記中⋯</p>;
  if (!trip || !currentText)
    return (
      <div className="trail-card flex flex-col items-start gap-3 p-6">
        <p className="text-muted">還沒有任何遊記。先新增一趟旅程，再回來一鍵生成分享素材！</p>
        <Link href="/new-trip" className={`${primaryButton} inline-flex items-center`}>
          📝 新增遊記
        </Link>
      </div>
    );

  function chooseTrip(t: Trip) {
    if (busy) return;
    Object.values(jobs).forEach((j) => j?.url && URL.revokeObjectURL(j.url));
    setJobs({});
    setAiError(null);
    setArrangeError(null);
    setChosenTrip(t.id);
  }

  function toggle(list: "photos" | "buddies", id: string) {
    const max = list === "photos" ? MAX_PHOTOS : MAX_BUDDIES;
    const ids = current[list];
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < max ? [...ids, id] : ids;
    setPicks({ ...current, [list]: next });
  }

  const editText = (patch: Partial<Text>) => setText({ ...currentText!, ...patch });
  const hashtags = currentText.hashtags.split(/[\s,，#]+/).filter(Boolean);
  const shareText = `${currentText.caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
  const selectedPhotos = current.photos.map((id) => diary.photos.get(id)).filter((p): p is Photo => !!p);
  const selectedBuddies = current.buddies.map((id) => creatures.find((c) => c.id === id)).filter((c): c is Creature => !!c);

  // ---------- 3D 地標短片的分鏡 ----------
  const canAiModel = !!ai?.imageModel;
  const currentBoard: Board = board?.tripId === trip.id ? board : { tripId: trip.id, scenes: {}, finale: DEFAULT_FINALE };
  const located = selectedPhotos.flatMap((p) => {
    const loc = photoLocation(p, stops, trip);
    return loc ? [{ photo: p, ...loc }] : [];
  });
  // 站名：照片的地名；所有站都查到同一個地名（例如同一座島都是「安平區」）就改用旅程名稱
  const autoLabels = located.slice(0, MAX_SCENES).map(({ photo }) => photoLabel(photo, stops, trip));
  const sameLabel = autoLabels.length > 1 && new Set(autoLabels).size === 1;
  const scenes: Scene[] = located.slice(0, MAX_SCENES).map(({ photo, lat, lon }, i) => {
    const setup = currentBoard.scenes[photo.id];
    const pop: Pop = setup?.pop ?? (canAiModel ? "landmark" : "subject");
    return {
      photoId: photo.id,
      blob: photo.blob,
      lat,
      lon,
      label: setup?.label?.trim() || (sameLabel ? trip.place : autoLabels[i]),
      date: shortDate(photo.takenAt),
      // 沒金鑰時，地標模型改用人或主角
      pop: pop === "landmark" && !canAiModel ? "subject" : pop,
      point: setup?.point ?? DEFAULT_POINT,
    };
  });
  const guideId = currentBoard.guideId === undefined ? (selectedBuddies[0]?.id ?? null) : currentBoard.guideId;
  const guideBuddy = selectedBuddies.find((c) => c.id === guideId) ?? null;

  const editScene = (photoId: string, patch: Partial<SceneSetup>) => {
    const prev = currentBoard.scenes[photoId] ?? { pop: scenes.find((x) => x.photoId === photoId)?.pop ?? "subject", point: DEFAULT_POINT };
    setBoard({ ...currentBoard, scenes: { ...currentBoard.scenes, [photoId]: { ...prev, ...patch } } });
  };

  async function arrange() {
    if (!ai) return;
    setArranging(true);
    setArrangeError(null);
    try {
      const photos = await Promise.all(scenes.map(async (sc) => (await shrinkPhoto(sc.blob, 512)).toDataURL("image/jpeg", 0.75)));
      const res = await aiFetch("/api/ai/storyboard", ai.key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ai.textModel, photos, labels: scenes.map((sc) => sc.label) }),
      });
      const r: { scenes: { pop: Pop; point: Point; name: string }[]; finale: Finale } = await res.json();
      const next: Record<string, SceneSetup> = { ...currentBoard.scenes };
      // 站名：使用者自己改過的保留，沒改過的用 AI 取的
      scenes.forEach((sc, i) => {
        const got = r.scenes[i];
        if (got) next[sc.photoId] = { ...next[sc.photoId], pop: got.pop, point: got.point, label: next[sc.photoId]?.label || got.name || undefined };
      });
      setBoard({ ...currentBoard, scenes: next, finale: r.finale });
    } catch (error) {
      setArrangeError(error instanceof Error ? error.message : "AI 排分鏡失敗");
    }
    setArranging(false);
  }

  function buildInput(): ShareInput {
    return {
      trip: trip!,
      title: currentText!.title.trim() || trip!.place,
      subtitle: currentText!.subtitle.trim(),
      caption: currentText!.caption.trim(),
      hashtags,
      stops,
      photos: selectedPhotos.map((p) => ({ blob: p.blob, label: photoLabel(p, stops, trip!), date: p.takenAt })),
      buddies: selectedBuddies.map((c) => ({ name: c.name, image: c.cutout ?? c.photo, cutout: !!c.cutout })),
      story: {
        scenes,
        finale: currentBoard.finale,
        guide: guideBuddy ? { image: guideBuddy.cutout ?? guideBuddy.photo, facing: guideBuddy.facing ?? "left" } : null,
      },
      handFont,
    };
  }

  async function writeCaption() {
    if (!ai) return;
    setWriting(true);
    setAiError(null);
    try {
      const photos = await Promise.all(selectedPhotos.slice(0, 3).map(async (p) => (await shrinkPhoto(p.blob, 512)).toDataURL("image/jpeg", 0.75)));
      const res = await aiFetch("/api/ai/caption", ai.key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ai.textModel,
          place: trip!.place,
          dates: fmtDates(trip!.startDate, trip!.endDate),
          stops: stops.map((s) => s.name).filter(Boolean),
          creatures: selectedBuddies.map((c) => c.name),
          photos,
          tone,
        }),
      });
      const r: { title: string; subtitle: string; caption: string; hashtags: string[] } = await res.json();
      editText({ title: r.title, subtitle: r.subtitle, caption: r.caption, hashtags: r.hashtags.join(" ") });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 文案產生失敗");
    }
    setWriting(false);
  }

  async function generate(kind: Kind) {
    if (busy) return;
    const old = jobs[kind]?.url;
    const update = (job: Job) => setJobs((j) => ({ ...j, [kind]: job }));
    const onProgress = (progress: number, note: string) => update({ status: "running", progress, note });
    onProgress(0, "準備中⋯");
    try {
      const input = buildInput();
      const blob =
        kind === "video"
          ? await renderVideo(input, onProgress)
          : kind === "long"
            ? await renderLongImage(input, onProgress)
            : await renderLandmarkVideo(input, ai?.imageModel ? { key: ai.key, model: ai.imageModel } : null, onProgress);
      if (old) URL.revokeObjectURL(old);
      update({ status: "done", progress: 1, note: "完成！", blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      update({ status: "error", progress: 0, note: error instanceof Error ? error.message : "產生失敗，請再試一次" });
    }
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(shareText);
      flash("文案已複製！");
    } catch {
      flash("沒辦法自動複製，請手動選取文案");
    }
  }

  async function share(kind: Kind, blob: Blob) {
    const file = new File([blob], fileName(kind), { type: blob.type });
    // IG 分享時會忽略文字，所以先把文案複製起來，發文時直接貼上
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // 複製失敗就算了
    }
    try {
      await navigator.share({ files: [file], text: shareText });
    } catch (error) {
      if ((error as Error).name !== "AbortError") flash("這個瀏覽器不能直接分享，請先下載再上傳到 IG");
    }
  }

  const fileName = (kind: Kind) =>
    `${trip!.place.replace(/[\\/:*?"<>|]/g, "")}-${kind === "video" ? "路線短片.mp4" : kind === "long" ? "打卡長圖.jpg" : "3D地標短片.mp4"}`;
  const canShareFiles = typeof navigator !== "undefined" && "canShare" in navigator;

  return (
    <div className="flex flex-col gap-6">
      {/* STEP 1：選旅程 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={1}>選一趟旅程</StepLabel>
        <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {diary.trips.map((t) => {
            const cover = diary.photos.get(t.photoIds[0]);
            const active = t.id === trip.id;
            return (
              <li key={t.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => chooseTrip(t)}
                  disabled={busy && !active}
                  className={`flex w-40 flex-col overflow-hidden rounded-2xl border-2 text-left transition-colors disabled:opacity-50 ${
                    active ? "border-forest bg-moss" : "border-line bg-sand hover:border-forest"
                  }`}
                >
                  <span className="block aspect-4/3 w-full bg-line">
                    {cover && <StoredPhoto blob={cover.blob} alt={t.place} className="h-full w-full object-cover" />}
                  </span>
                  <span className="truncate px-3 pt-2 text-sm font-semibold text-ink">{t.place}</span>
                  <span className="px-3 pb-2 text-xs text-muted">{t.startDate}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag tone={stops.length ? "good" : "warn"}>{stops.length ? `📍 ${stops.length} 站路線` : "📍 沒有地點，短片會跳過地圖"}</Tag>
          <Tag>📷 {tripPhotos.length} 張照片</Tag>
          <Tag tone={matched.length ? "good" : "neutral"}>🐾 這趟期間收服 {matched.length} 位</Tag>
        </div>
      </section>

      {/* STEP 2：挑素材 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={2}>挑選照片和夥伴</StepLabel>
        <p className="mb-2 text-sm text-muted">
          精選照片（{current.photos.length}/{MAX_PHOTOS}，依點選順序出場）
        </p>
        {tripPhotos.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-sm text-muted">這趟旅程沒有照片。</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {tripPhotos.map((p) => {
              const order = current.photos.indexOf(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle("photos", p.id)}
                    aria-pressed={order >= 0}
                    className={`relative block aspect-square w-full overflow-hidden rounded-xl border-2 ${order >= 0 ? "border-forest" : "border-transparent opacity-60"}`}
                  >
                    <StoredPhoto blob={p.blob} alt={photoLabel(p, stops, trip)} className="h-full w-full object-cover" />
                    {order >= 0 && (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-on-accent">
                        {order + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mb-2 mt-5 text-sm text-muted">
          收服的夥伴（{current.buddies.length}/{MAX_BUDDIES}）・旅程日期之間收服的會自動選好
        </p>
        {creatures.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-sm text-muted">
            還沒有夥伴。到 <Link href="/my-farm" className="text-forest underline">我的神奇寶貝世界</Link> 上傳旅途中拍到的動植物收服牠們吧！
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[...matched, ...others].map((c) => {
              const on = current.buddies.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle("buddies", c.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm ${on ? "border-forest bg-moss" : "border-line bg-sand opacity-70"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 去背圖或縮圖是 data URL */}
                    <img src={c.cutout ?? c.photo} alt="" className={`h-9 w-9 rounded-full bg-card ${c.cutout ? "object-contain" : "object-cover"}`} />
                    <span className="font-medium text-ink">{c.name}</span>
                    {matched.includes(c) && <span className="text-xs text-forest">這趟</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* STEP 3：文案 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={3}>標題和文案</StepLabel>
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-sand p-4">
          {ai ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">✨ 讓 AI 看照片幫你寫：</span>
                {TONES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTone(t.id)} className={chip(tone === t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={writeCaption} disabled={writing} className={`${primaryButton} self-start`}>
                {writing ? "AI 寫作中⋯" : "✨ AI 幫我寫文案"}
              </button>
              {aiError && <p className="rounded-xl bg-wood-soft p-3 text-sm text-wood-deep">{aiError}</p>}
            </>
          ) : (
            <p className="text-sm text-muted">
              想讓 AI 看照片幫你寫文案？到 <Link href="/settings" className="font-medium text-forest underline">⚙️ 設定</Link>{" "}
              輸入自己的 OpenAI API 金鑰就能使用。也可以直接在下面自己寫。
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            標題
            <input value={currentText.title} onChange={(e) => editText({ title: e.target.value })} maxLength={30} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            副標題
            <input value={currentText.subtitle} onChange={(e) => editText({ subtitle: e.target.value })} maxLength={50} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink sm:col-span-2">
            貼文文案
            <textarea value={currentText.caption} onChange={(e) => editText({ caption: e.target.value })} rows={5} maxLength={600} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink sm:col-span-2">
            Hashtag（用空白隔開）
            <input value={currentText.hashtags} onChange={(e) => editText({ hashtags: e.target.value })} className={inputClass} />
          </label>
        </div>
      </section>

      {/* STEP 4：3D 地標短片分鏡 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={4}>📌 3D 地標打卡短片的分鏡</StepLabel>
        <StoryboardEditor
          scenes={scenes}
          skipped={selectedPhotos.length - scenes.length}
          finale={currentBoard.finale}
          buddies={selectedBuddies}
          guideId={guideId}
          canAiModel={canAiModel}
          canAiArrange={!!ai?.textModel}
          arranging={arranging}
          arrangeError={arrangeError}
          onArrange={arrange}
          onScene={editScene}
          onFinale={(patch) => setBoard({ ...currentBoard, finale: { ...currentBoard.finale, ...patch } })}
          onGuide={(id) => setBoard({ ...currentBoard, guideId: id })}
        />
      </section>

      {/* STEP 5：生成 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={5}>一鍵生成</StepLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {OUTPUTS.map((o) => {
            const job = jobs[o.kind];
            const withAi = !!ai?.imageModel;
            return (
              <div key={o.kind} className="flex flex-col gap-3 rounded-2xl border border-line bg-sand p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-ink">
                    {o.emoji} {o.title}
                  </h3>
                  {!o.ai ? <Tag tone="good">免費</Tag> : withAi ? <Tag tone="info">AI 3D 模型</Tag> : <Tag tone="warn">免費版</Tag>}
                </div>
                <p className="flex-1 text-sm text-muted">{o.desc}</p>
                {o.ai && (
                  <p className="rounded-xl bg-card p-3 text-xs text-muted">
                    {withAi ? (
                      "用你的 OpenAI 金鑰：選「地標模型」的站，AI 會把地標做成 3D 迷你模型（每站畫一張圖），影片沒有浮水印。"
                    ) : (
                      <>
                        免費版：照片裡的人或主角去背後從地圖跳出來，影片會有浮水印。到{" "}
                        <Link href="/settings" className="font-medium text-forest underline">
                          ⚙️ 設定
                        </Link>{" "}
                        輸入 OpenAI 金鑰，就能讓 AI 做成 3D 迷你模型、去掉浮水印。
                      </>
                    )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => generate(o.kind)}
                  disabled={busy || (o.kind === "landmark" && scenes.length === 0)}
                  className={primaryButton}
                >
                  {job?.status === "running" ? "生成中⋯" : job?.status === "done" ? "重新生成" : "生成"}
                </button>
                {job?.status === "running" && (
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{job.note}</p>
                  </div>
                )}
                {job?.status === "error" && <p className="rounded-xl bg-wood-soft p-3 text-sm text-wood-deep">{job.note}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          ※ 影片和長圖都在你的瀏覽器裡合成。只有使用 AI 時，每一站的照片會縮小後經由我們的伺服器轉給 OpenAI 做 3D 模型，不會被保存。生成時請不要切換分頁。
        </p>
      </section>

      {/* 成品 */}
      {OUTPUTS.some((o) => jobs[o.kind]?.status === "done") && (
        <section className="trail-card p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-ink">🎉 完成了！</h2>
            <button type="button" onClick={copyCaption} className={secondaryButton}>
              📋 複製文案
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {OUTPUTS.map((o) => {
              const job = jobs[o.kind];
              if (job?.status !== "done" || !job.url || !job.blob) return null;
              const blob = job.blob;
              return (
                <div key={o.kind} className="flex flex-col gap-3">
                  <p className="font-semibold text-ink">
                    {o.emoji} {o.title}
                  </p>
                  <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-ink/5">
                    {o.kind !== "long" ? (
                      <video src={job.url} controls playsInline loop muted autoPlay className="w-full" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- 剛合成的本機圖片
                      <img src={job.url} alt={o.title} className="w-full" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={job.url} download={fileName(o.kind)} className={`${primaryButton} inline-flex items-center`}>
                      ⬇️ 下載
                    </a>
                    {canShareFiles && (
                      <button type="button" onClick={() => share(o.kind, blob)} className={secondaryButton}>
                        📤 分享
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted">
            發到 IG：手機按「分享」選 Instagram（文案會先自動複製，貼上就好）；電腦請下載後再上傳。短片沒有配樂，可以在 IG 裡加上喜歡的音樂。
          </p>
        </section>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[7000] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm text-on-accent shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
