"use client";

import { useRef, useState } from "react";
import { inputClass, primaryButton, secondaryButton, StepLabel, Tag } from "../components/trail-ui";
import { cards, choosePositions, spreads, type Spread, type TarotCard } from "./cards";
import TarotCardView from "./tarot-card";

type Drawn = { card: TarotCard; reversed: boolean };
type Phase = "setup" | "picking" | "revealed";

// 用 crypto 產生亂數，洗牌比 Math.random 更均勻
function random() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

function shuffleDeck(): Drawn[] {
  const deck = cards.map((card) => ({ card, reversed: random() < 0.3 }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 正位用牌本身的能量；逆位能量減半並反轉，再扣一點
const energy = ({ card, reversed }: Drawn) => (reversed ? -card.score / 2 - 0.5 : card.score);

function luck(average: number) {
  if (average >= 1.5) return { level: "大吉", stars: 5, text: "能量非常好，放心出發吧！" };
  if (average >= 0.8) return { level: "吉", stars: 4, text: "整體順利，注意小細節就好。" };
  if (average >= 0.2) return { level: "小吉", stars: 3, text: "有好有壞，做好準備就能玩得開心。" };
  if (average >= -0.5) return { level: "平", stars: 2, text: "需要多一點彈性與備案。" };
  return { level: "需謹慎", stars: 1, text: "突發狀況的機率偏高，建議簡化行程、做足保險。" };
}

export default function TarotReading() {
  const [spreadId, setSpreadId] = useState<Spread["id"]>("trip");
  const [destination, setDestination] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [deck, setDeck] = useState<Drawn[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState("");
  const pickRef = useRef<HTMLDivElement>(null);

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const spread = spreads.find((s) => s.id === spreadId)!;
  const positions = spreadId === "choose" ? choosePositions(filledOptions) : spread.positions;

  function start() {
    if (spreadId === "choose" && filledOptions.length < 2) {
      setError("請至少輸入兩個想去的地方");
      return;
    }
    setError("");
    setDeck(shuffleDeck());
    setPicked([]);
    setPhase("picking");
    setShuffling(true);
    setTimeout(() => setShuffling(false), 700);
    setTimeout(() => pickRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function pick(index: number) {
    if (phase !== "picking" || shuffling || picked.includes(index)) return;
    const next = [...picked, index];
    setPicked(next);
    if (next.length === positions.length) setPhase("revealed");
  }

  function reset() {
    setPhase("setup");
    setPicked([]);
  }

  const drawn = picked.map((i) => deck[i]);

  return (
    <div className="flex flex-col gap-6">
      {/* STEP 1：選牌陣 */}
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={1}>選一個適合你的牌陣</StepLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          {spreads.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={phase !== "setup"}
              onClick={() => setSpreadId(s.id)}
              className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed ${
                spreadId === s.id ? "border-forest bg-moss" : "border-line bg-sand hover:border-forest/60"
              } ${phase !== "setup" && spreadId !== s.id ? "opacity-50" : ""}`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="font-semibold text-ink">{s.name}</span>
              <span className="text-sm text-muted">{s.forWho}</span>
              <span className="mt-1 text-xs font-medium text-wood">
                {s.id === "choose" ? "每個選項 1 張＋最終建議" : `${s.positions.length} 張牌`}
              </span>
            </button>
          ))}
        </div>

        {spreadId === "trip" && (
          <label className="mt-5 flex flex-col gap-1.5 text-sm text-muted">
            要去哪裡？（選填，會寫進解牌結果）
            <input
              value={destination}
              disabled={phase !== "setup"}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="例如：日本北海道、合歡山"
              className={inputClass}
            />
          </label>
        )}

        {spreadId === "choose" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {options.map((o, i) => (
              <label key={i} className="flex flex-col gap-1.5 text-sm text-muted">
                選項 {String.fromCharCode(65 + i)}
                {i === 2 && "（選填）"}
                <input
                  value={o}
                  disabled={phase !== "setup"}
                  onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                  placeholder={["例如：沖繩", "例如：峇里島", "例如：墾丁"][i]}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-sm font-medium text-wood">{error}</p>}

        {phase === "setup" ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-muted">深呼吸，在心裡想著這趟旅行，準備好就開始洗牌。</p>
            <button onClick={start} className={primaryButton}>
              🔮 洗牌並開始抽牌
            </button>
          </div>
        ) : (
          <div className="mt-6 flex justify-center">
            <button onClick={reset} className={secondaryButton}>
              ↺ 換個牌陣或重新開始
            </button>
          </div>
        )}
      </section>

      {/* STEP 2：抽牌 */}
      {phase !== "setup" && (
        <section ref={pickRef} className="trail-card scroll-mt-6 p-5 sm:p-7">
          <StepLabel step={2}>
            {phase === "picking" ? `憑直覺抽出 ${positions.length} 張牌（已抽 ${picked.length} 張）` : "牌陣已完成"}
          </StepLabel>

          {/* 牌陣位置 */}
          <div className="mb-6 flex flex-wrap justify-center gap-3 sm:gap-5">
            {positions.map((p, i) => (
              <div key={p.title} className="flex w-[28%] max-w-36 min-w-24 flex-col items-center gap-2">
                {drawn[i] ? (
                  <TarotCardView
                    card={drawn[i].card}
                    reversed={drawn[i].reversed}
                    faceUp={phase === "revealed"}
                    delay={i * 400}
                    className="w-full"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-line">
                    {i + 1}
                  </div>
                )}
                <p className="text-center text-xs font-medium text-muted">{p.title}</p>
              </div>
            ))}
          </div>

          {/* 牌堆 */}
          {phase === "picking" && (
            <div className={`grid grid-cols-6 gap-2 sm:grid-cols-11 ${shuffling ? "animate-pulse" : ""}`}>
              {deck.map((_, i) => (
                <button
                  key={`${i}-${deck[i].card.id}`}
                  type="button"
                  onClick={() => pick(i)}
                  aria-label={`第 ${i + 1} 張牌`}
                  disabled={picked.includes(i)}
                  className="transition-transform hover:-translate-y-1.5 disabled:pointer-events-none disabled:opacity-20"
                  style={{ rotate: `${((i * 7) % 9) - 4}deg` }}
                >
                  <TarotCardView faceUp={false} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* STEP 3：解牌 */}
      {phase === "revealed" && (
        <Interpretation
          spread={spread}
          positions={positions}
          drawn={drawn}
          destination={destination.trim()}
          options={filledOptions}
        />
      )}
    </div>
  );
}

function Interpretation({
  spread,
  positions,
  drawn,
  destination,
  options,
}: {
  spread: Spread;
  positions: Spread["positions"];
  drawn: Drawn[];
  destination: string;
  options: string[];
}) {
  const average = drawn.reduce((sum, d) => sum + energy(d), 0) / drawn.length;
  const fortune = luck(average);
  const warnings = drawn.filter((d, i) => positions[i].kind === "warn" || d.reversed).map((d) => d.card);
  const adviceCard = drawn[positions.findIndex((p) => p.kind === "advice")] ?? drawn[0];

  // 抉擇牌陣：比較每個選項的牌
  const ranking =
    spread.id === "choose"
      ? options.map((o, i) => ({ option: o, drawn: drawn[i], energy: energy(drawn[i]) })).sort((a, b) => b.energy - a.energy)
      : [];
  const tie = ranking.length > 1 && ranking[0].energy - ranking[1].energy < 0.5;

  return (
    <section
      className="trail-card animate-[fade-in_0.6s_ease-out_both] p-5 sm:p-7"
      style={{ animationDelay: `${positions.length * 400 + 500}ms` }}
    >
      <StepLabel step={3}>解牌結果</StepLabel>

      {/* 總結 */}
      <div className="mb-6 rounded-2xl bg-moss p-5">
        {spread.id === "choose" ? (
          <>
            <p className="text-sm font-medium text-forest">🗺️ 塔羅的選擇</p>
            {tie ? (
              <p className="mt-1 text-xl font-bold text-ink">
                「{ranking[0].option}」和「{ranking[1].option}」能量相近，跟著心裡第一個浮現的答案走吧！
              </p>
            ) : (
              <p className="mt-1 text-xl font-bold text-ink">塔羅建議你去「{ranking[0].option}」</p>
            )}
            <ol className="mt-3 flex flex-col gap-1 text-sm text-ink">
              {ranking.map((r, i) => (
                <li key={r.option}>
                  {i + 1}. {r.option}：{r.drawn.card.emoji} {r.drawn.card.name}
                  {r.drawn.reversed ? "（逆位）" : "（正位）"}— {r.drawn.card.keywords.join("、")}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-forest">
              {destination ? `「${destination}」之旅的運勢` : spread.id === "daily" ? "今日出遊運勢" : "這趟旅程的運勢"}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-2xl font-bold text-ink">
              {fortune.level}
              <span className="text-lg tracking-widest text-wood" aria-label={`${fortune.stars} 顆星`}>
                {"★".repeat(fortune.stars)}
                <span className="text-line">{"★".repeat(5 - fortune.stars)}</span>
              </span>
            </p>
            <p className="mt-1 text-ink">{fortune.text}</p>
          </>
        )}
      </div>

      {/* 每張牌的解讀 */}
      <ol className="flex flex-col gap-4">
        {positions.map((p, i) => {
          const { card, reversed } = drawn[i];
          const reading = reversed ? card.rev : card.up;
          const text = p.kind === "option" ? reading.meaning : reading[p.kind];
          return (
            <li key={p.title} className="flex gap-4 rounded-2xl border border-line bg-sand p-4">
              <TarotCardView card={card} reversed={reversed} faceUp className="w-20 shrink-0 sm:w-24" />
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-wood">
                  {i + 1}．{p.title}
                </p>
                <p className="font-bold text-ink">
                  {card.name} {card.en}
                  <span className={`ml-2 text-sm font-medium ${reversed ? "text-wood" : "text-forest"}`}>
                    {reversed ? "逆位" : "正位"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {card.keywords.map((k) => (
                    <Tag key={k}>{k}</Tag>
                  ))}
                </div>
                <p className="text-ink">{text}</p>
                {(p.kind === "advice" || p.kind === "option" || spread.id === "daily") && (
                  <p className="text-sm text-muted">🎒 適合的旅行型態：{card.style}</p>
                )}
                {spread.id === "daily" && <p className="text-sm text-ink">💡 建議：{reading.advice}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {/* 行前提醒 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-wood-soft p-5">
          <p className="mb-2 font-semibold text-wood-deep">⚠️ 突發狀況預防清單</p>
          {warnings.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink">
              {warnings.map((c) => (
                <li key={c.id}>{(drawn.find((d) => d.card.id === c.id)!.reversed ? c.rev : c.up).warn}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink">牌面沒有明顯的警訊，照一般的行前準備即可：證件、保險、行動電源。</p>
          )}
        </div>
        <div className="rounded-2xl bg-ocean-soft p-5">
          <p className="mb-2 font-semibold text-ocean-deep">🧭 行程建議</p>
          <p className="text-sm text-ink">{(adviceCard.reversed ? adviceCard.card.rev : adviceCard.card.up).advice}</p>
          <p className="mt-2 text-sm text-muted">適合的旅行型態：{adviceCard.card.style}</p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">※ 塔羅牌僅供娛樂與自我覺察參考，實際出遊請以天氣、交通與官方資訊為準。</p>
    </section>
  );
}

