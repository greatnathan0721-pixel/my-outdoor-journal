"use client";

import { useRef, useState } from "react";
import { chip, inputClass, primaryButton, secondaryButton, StepLabel } from "../components/trail-ui";
import { identify, makeThumbnail, type Guess } from "./classifier";
import { addCreature } from "./collection";
import { categories, guessEmoji, type Category } from "./species";

type Status = "idle" | "loading" | "ready" | "error";

export default function Catcher() {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [caught, setCaught] = useState<{ name: string; emoji: string | null; photo: string; where: string } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setGuesses([]);
    setName("");
    setCategory(null);
    setStatus("loading");
  }

  // 圖片載入完成後才開始辨識
  async function handleImageLoad() {
    if (!imgRef.current) return;
    try {
      const result = await identify(imgRef.current);
      setGuesses(result);
      if (result[0]) {
        setName(result[0].name);
        setCategory(result[0].category);
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  function chooseGuess(g: Guess) {
    setName(g.name);
    setCategory(g.category);
  }

  function capture() {
    if (!imgRef.current || !name.trim() || !category) return;
    const finalName = name.trim();
    // 以使用者輸入的為準：跟 AI 猜的一樣就用 AI 的 emoji，不一樣就用名稱猜 emoji
    const matched = guesses.find((g) => g.name === finalName);
    const emoji = matched?.emoji ?? guessEmoji(finalName);
    const photo = makeThumbnail(imgRef.current);
    addCreature({
      id: crypto.randomUUID(),
      name: finalName,
      emoji,
      category,
      photo,
      aiGuess: guesses[0]?.name ?? null,
      caughtAt: new Date().toISOString(),
    });
    setCaught({ name: finalName, emoji, photo, where: categories.find((c) => c.id === category)!.where });
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStatus("idle");
    setGuesses([]);
    setName("");
    setCategory(null);
    setCaught(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const userChanged = guesses[0] && name.trim() && name.trim() !== guesses[0].name;

  return (
    <section className="trail-card p-5 sm:p-7">
      <StepLabel step={1}>上傳你看到的動植物照片</StepLabel>

      {!preview ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-sand px-4 py-10 text-center transition-colors hover:border-forest">
          <span className="text-4xl">📷</span>
          <span className="font-semibold text-ink">拍照或選擇照片</span>
          <span className="text-sm text-muted">鳥、昆蟲、狗貓、魚、螃蟹、花、菇⋯⋯都可以試試</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,240px)_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element -- 使用者剛選的本機照片 */}
            <img ref={imgRef} src={preview} alt="你上傳的照片" onLoad={handleImageLoad} className="aspect-square w-full object-cover" />
            {status === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-center text-sm text-white">
                <span className="animate-spin text-3xl">🔍</span>
                AI 辨識中⋯⋯
                <span className="text-xs opacity-80">第一次要下載模型，約需 10–30 秒</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {status === "error" && (
              <p className="rounded-2xl bg-wood-soft p-4 text-sm text-ink">
                AI 模型載入失敗（可能是網路問題）。你還是可以自己輸入名稱和類別來收服牠。
              </p>
            )}

            {status === "ready" && (
              <div>
                <StepLabel step={2}>AI 覺得牠是⋯⋯</StepLabel>
                {guesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {guesses.map((g) => (
                      <button key={g.name} type="button" onClick={() => chooseGuess(g)} className={chip(name === g.name)}>
                        {g.emoji} {g.name}
                        <span className="ml-1 opacity-70">{Math.round(g.probability * 100)}%</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-sand p-4 text-sm text-ink">
                    AI 認不出來 🤔（模型認得的植物不多，也可能照片太遠）。請直接輸入牠的名字吧！
                  </p>
                )}
              </div>
            )}

            {status !== "loading" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm text-muted">
                  牠的名字（不對的話直接改，以你輸入的為準）
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：白頭翁、台灣藍鵲、布袋蓮"
                    className={inputClass}
                  />
                </label>
                {userChanged && (
                  <p className="text-sm text-wood">
                    ✏️ 你把 AI 判斷的「{guesses[0].name}」改成了「{name.trim()}」，會以你的判斷為準。
                  </p>
                )}
                <div>
                  <p className="mb-2 text-sm text-muted">牠要住在農場的哪裡？</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={capture} disabled={!name.trim() || !category} className={primaryButton}>
                    ⚡ 收服！
                  </button>
                  <button onClick={reset} className={secondaryButton}>
                    換一張照片
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 收服成功的慶祝畫面 */}
      {caught && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/55 p-4" onClick={reset}>
          <div
            className="trail-card flex w-full max-w-sm animate-[pop-in_0.6s_ease-out] flex-col items-center gap-3 p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- 縮圖是 data URL */}
              <img src={caught.photo} alt={caught.name} className="h-28 w-28 rounded-full border-4 border-wood object-cover" />
              {caught.emoji && <span className="absolute -bottom-2 -right-2 text-4xl">{caught.emoji}</span>}
            </div>
            <p className="text-3xl">🎉✨🎉</p>
            <p className="text-xl font-bold text-ink">恭喜你成功收服了</p>
            <p className="text-3xl font-bold text-wood">{caught.name}</p>
            <p className="text-muted">牠已經{caught.where}，快去農場看看牠吧！</p>
            <button
              onClick={() => {
                reset();
                document.getElementById("farm")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={primaryButton}
            >
              去農場看看
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
