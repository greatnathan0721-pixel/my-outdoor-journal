import Image from "next/image";
import { cardImage, type TarotCard } from "./cards";

type Props = {
  card?: TarotCard;
  reversed?: boolean;
  faceUp: boolean;
  delay?: number; // 翻牌延遲（毫秒），讓多張牌依序翻開
  className?: string;
  sizes?: string;
};

// 一張可以翻面的塔羅牌：背面是步道指北針圖樣，正面是 Rider–Waite–Smith 牌面
export default function TarotCardView({ card, reversed, faceUp, delay = 0, className = "", sizes = "160px" }: Props) {
  return (
    <div className={`aspect-[4/7] perspective-[1200px] ${className}`}>
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
        <div className="absolute inset-0 rotate-y-180 overflow-hidden rounded-xl bg-[#f4ecd8] shadow-md ring-1 ring-black/10 backface-hidden">
          {card && (
            <Image
              src={cardImage(card)}
              alt={`${card.name}（${card.en}）${reversed ? "逆位" : "正位"}`}
              fill
              sizes={sizes}
              className={`object-cover ${reversed ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
