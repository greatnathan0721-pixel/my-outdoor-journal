"use client";

import { useRef, useState } from "react";
import { chip, inputClass, primaryButton, secondaryButton, StepLabel } from "../components/trail-ui";
import { identify, makeThumbnail, type Guess } from "./classifier";
import { addCreature } from "./collection";
import { makeCutout } from "./cutout";
import { categories, guessEmoji, type Category } from "./species";

type Status = "idle" | "loading" | "ready" | "error";
type CutoutState = { status: "idle" | "working" | "done" | "failed"; dataUrl: string | null };

// 透明背景的棋盤格，讓人看得出哪裡被去掉了
const checker = {
  backgroundImage:
    "linear-gradient(45deg,#e5e0d4 25%,transparent 25%),linear-gradient(-45deg,#e5e0d4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e0d4 75%),linear-gradient(-45deg,transparent 75%,#e5e0d4 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

export default function Catcher() {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [cutout, setCutout] = useState<CutoutState>({ status: "idle", dataUrl: null });
  const [useCutout, setUseCutout] = useState(true);
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [caught, setCaught] = useState<{ name: string; image: string; where: string } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setGuesses([]);
    setName("");
    setCategory(null);
    setCutout({ status: "idle", dataUrl: null });
    setUseCutout(true);
    setFacing("left");
    setStatus("loading");
  }

  // 去背：預設點照片中央，使用者也可以在照片上點牠的位置重新去背
  async function runCutout(point = { x: 0.5, y: 0.5 }) {
    if (!imgRef.current) return;
    setCutout((c) => ({ ...c, status: "working" }));
    try {
      const result = await makeCutout(imgRef.current, point);
      setCutout(result ? { status: "done", dataUrl: result.dataUrl } : { status: "failed", dataUrl: null });
    } catch {
      setCutout({ status: "failed", dataUrl: null });
    }
  }

  function handlePhotoClick(e: React.MouseEvent<HTMLImageElement>) {
    if (status === "loading") return;
    const rect = e.currentTarget.getBoundingClientRect();
    runCutout({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }

  // 圖片載入完成後才開始辨識
  async function handleImageLoad() {
    if (!imgRef.current) return;
    runCutout();
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

  async function capture() {
    if (!imgRef.current || !name.trim() || !category) return;
    const finalName = name.trim();
    // 以使用者輸入的為準：跟 AI 猜的一樣就用 AI 的 emoji，不一樣就用名稱猜 emoji
    const matched = guesses.find((g) => g.name === finalName);
    const emoji = matched?.emoji ?? guessEmoji(finalName);
    const photo = makeThumbnail(imgRef.current);
    const finalCutout = useCutout && cutout.status === "done" ? cutout.dataUrl : null;
    await addCreature({
      id: crypto.randomUUID(),
      name: finalName,
      emoji,
      category,
      photo,
      cutout: finalCutout,
      facing,
      aiGuess: guesses[0]?.name ?? null,
      caughtAt: new Date().toISOString(),
    });
    setCaught({ name: finalName, image: finalCutout ?? photo, where: categories.find((c) => c.id === category)!.where });
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStatus("idle");
    setGuesses([]);
    setName("");
    setCategory(null);
    setCutout({ status: "idle", dataUrl: null });
    setCaught(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const userChanged = guesses[0] && name.trim() && name.trim() !== guesses[0].name;

  return (
    <section className="trail-card p-5 sm:p-7">
      <StepLabel step={1}>上傳你看到的動植物照片</StepLabel>

      {!preview ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-line bg-sand px-4 py-8 text-center">
          <span className="text-4xl">🔍</span>
          <span className="font-semibold text-ink">上傳旅途中拍到的動植物</span>
          <span className="text-sm text-muted">鳥、昆蟲、狗貓、魚、螃蟹、花、菇⋯⋯都可以試試</span>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {/* 從相簿選：不加 capture，手機才會開相簿而不是直接開相機 */}
            <label className={`${primaryButton} flex cursor-pointer items-center`}>
              🖼️ 從相簿選照片
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            <label className={`${secondaryButton} flex cursor-pointer items-center`}>
              📷 現在拍一張
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element -- 使用者剛選的本機照片 */}
              <img
                ref={imgRef}
                src={preview}
                alt="你上傳的照片"
                onLoad={handleImageLoad}
                onClick={handlePhotoClick}
                className="block h-auto max-h-80 w-full cursor-crosshair object-contain"
              />
              {status === "loading" && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-center text-sm text-white">
                  <span className="animate-spin text-3xl">🔍</span>
                  AI 辨識中⋯⋯
                  <span className="text-xs opacity-80">第一次要下載模型，約需 10–30 秒</span>
                </div>
              )}
            </div>

            {/* 去背結果 */}
            <div className="rounded-2xl border border-line bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-ink">✂️ 去背結果（農場裡的樣子）</p>
              <div className="flex h-36 items-center justify-center rounded-xl" style={checker}>
                {cutout.status === "working" && <span className="text-sm text-muted">去背中⋯（第一次約需 10 秒）</span>}
                {cutout.status === "failed" && <span className="px-3 text-center text-sm text-muted">沒有切出東西，點一下上面照片裡牠的位置再試一次</span>}
                {cutout.status === "done" && cutout.dataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- 去背圖是 data URL
                  <img
                    src={cutout.dataUrl}
                    alt="去背後的樣子"
                    className="max-h-32 w-auto drop-shadow"
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-muted">切錯了？在上面的照片裡點一下牠身上，就會重新去背。</p>
              {cutout.status === "done" && (
                <label className="mt-2 flex items-center gap-2 text-xs text-ink">
                  <input type="checkbox" checked={!useCutout} onChange={(e) => setUseCutout(!e.target.checked)} className="accent-forest" />
                  不要去背，直接用原照片
                </label>
              )}
            </div>
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
                {category !== "plant" && category !== "waterplant" && (
                  <div>
                    <p className="mb-2 text-sm text-muted">照片裡牠的頭朝哪邊？（讓牠走路時面向正確的方向）</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFacing("left")} className={chip(facing === "left")}>
                        ⬅️ 朝左
                      </button>
                      <button type="button" onClick={() => setFacing("right")} className={chip(facing === "right")}>
                        朝右 ➡️
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button onClick={capture} disabled={!name.trim() || !category || cutout.status === "working"} className={primaryButton}>
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
              <img src={caught.image} alt={caught.name} className="h-32 w-auto max-w-56 object-contain drop-shadow-lg" />
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
