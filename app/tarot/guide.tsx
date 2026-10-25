import { cards, spreads } from "./cards";

// 牌陣與解牌指南（靜態內容，不需要互動）
export default function Guide() {
  return (
    <section className="trail-card p-5 sm:p-7">
      <p className="text-sm font-medium text-wood">📖 解牌指南</p>
      <h2 className="mt-1 text-2xl font-bold text-ink">專為出遊設計的牌陣</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {spreads.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-sand p-4">
            <p className="font-semibold text-ink">
              {s.emoji} {s.name}
            </p>
            <p className="mb-3 text-sm text-muted">{s.forWho}</p>
            <ol className="flex flex-col gap-1.5 text-sm text-ink">
              {s.id === "choose" ? (
                <>
                  <li>
                    <b>每個選項各 1 張：</b>看去那裡的旅行能量，正位越強越推薦
                  </li>
                  <li>
                    <b>最終建議：</b>不論選哪裡都要記得的事
                  </li>
                </>
              ) : (
                s.positions.map((p, i) => (
                  <li key={p.title}>
                    <b>
                      {i + 1}．{p.title}：
                    </b>
                    {p.hint}
                  </li>
                ))
              )}
            </ol>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-semibold text-ink">正位與逆位怎麼看？</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="rounded-2xl bg-moss p-4 text-sm text-ink">
          <b className="text-forest">正位</b>：牌面朝上，代表這股能量順暢地發揮，多半是可以放心去做的方向。
        </p>
        <p className="rounded-2xl bg-wood-soft p-4 text-sm text-ink">
          <b className="text-wood-deep">逆位</b>：牌面倒過來，代表能量受阻或過度，提醒你多準備、放慢腳步，不一定是壞事。
        </p>
      </div>

      <h3 className="mt-8 font-semibold text-ink">22 張大阿爾克那・旅行關鍵字</h3>
      <p className="mt-1 text-sm text-muted">點開每張牌可以看正位、逆位在旅行中的意思。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <details key={c.id} className="group rounded-2xl border border-line bg-sand p-3 open:bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="text-2xl">{c.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">
                  {c.numeral}．{c.name}
                </span>
                <span className="block text-xs text-muted">{c.keywords.join("・")}</span>
              </span>
              <span className="text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 text-sm text-ink">
              <p>
                <b className="text-forest">正位：</b>
                {c.up.meaning}
              </p>
              <p>
                <b className="text-wood-deep">逆位：</b>
                {c.rev.meaning}
              </p>
              <p className="text-muted">🎒 {c.style}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
