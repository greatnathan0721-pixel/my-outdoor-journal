import type { TarotCard } from "./cards";

type Props = {
  card?: TarotCard;
  reversed?: boolean;
  faceUp: boolean;
  delay?: number; // 翻牌延遲（毫秒），讓多張牌依序翻開
  className?: string;
};

// 一張可以翻面的塔羅牌：背面是步道指北針圖樣，正面是牌面
export default function TarotCardView({ card, reversed, faceUp, delay = 0, className = "" }: Props) {
  return (
    <div className={`aspect-[2/3] perspective-[1200px] ${className}`}>
      <div
        className={`relative h-full w-full transition-transform duration-700 transform-3d ${faceUp ? "rotate-y-180" : ""}`}
        style={{ transitionDelay: `${delay}ms` }}
      >
        {/* 背面 */}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border-[3px] border-wood bg-forest-deep shadow-md backface-hidden">
          <div className="absolute inset-1.5 rounded-lg border border-dashed border-white/35" />
          <div
            className="absolute inset-3 rounded-md opacity-25"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1.5px)", backgroundSize: "10px 10px" }}
          />
          <span className="relative text-[clamp(1rem,4vw,2rem)] drop-shadow">🧭</span>
        </div>

        {/* 正面 */}
        <div className="absolute inset-0 rotate-y-180 rounded-xl border-[3px] border-wood bg-card shadow-md backface-hidden">
          {card && (
            <div
              className={`flex h-full flex-col items-center justify-between p-[8%] text-center ${reversed ? "rotate-180" : ""}`}
            >
              <span className="text-[clamp(0.6rem,1.6vw,0.85rem)] font-bold tracking-widest text-wood">{card.numeral}</span>
              <span className="text-[clamp(1.6rem,6vw,3.2rem)] leading-none">{card.emoji}</span>
              <div>
                <p className="text-[clamp(0.75rem,2vw,1.05rem)] font-bold text-ink">{card.name}</p>
                <p className="text-[clamp(0.5rem,1.3vw,0.7rem)] uppercase tracking-wide text-muted">{card.en}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
