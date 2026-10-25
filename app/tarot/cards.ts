// 22 張大阿爾克那，牌義改寫成旅行版本
type Reading = {
  meaning: string; // 整體運勢
  warn: string; // 可能的突發狀況
  advice: string; // 行程建議
  gain: string; // 旅程收穫
};

export type TarotCard = {
  id: number;
  numeral: string;
  name: string;
  en: string;
  emoji: string;
  keywords: [string, string, string];
  style: string; // 適合的旅行型態
  score: number; // 正位的旅行能量，-2～2
  up: Reading;
  rev: Reading;
};

export const cards: TarotCard[] = [
  {
    id: 0, numeral: "0", name: "愚者", en: "The Fool", emoji: "🎒",
    keywords: ["說走就走", "冒險", "新開始"],
    style: "背包客、第一次去的國家、沒排滿的自由行",
    score: 2,
    up: {
      meaning: "旅途充滿新鮮感，很適合嘗試沒去過的地方，好運常出現在計畫之外。",
      warn: "太隨興可能漏帶證件或錯過班次，出門前再檢查一次護照、充電器。",
      advice: "行程留白一天，讓自己跟著直覺走進小巷或臨時加入當地活動。",
      gain: "你會帶回一段「還好有去」的意外故事。",
    },
    rev: {
      meaning: "衝動多於準備，容易因為小疏忽讓行程卡關。",
      warn: "注意訂錯日期、沒查簽證或天候突變，冒險行程請確認安全措施。",
      advice: "把關鍵資訊（住宿、交通、保險）先訂好，其餘再自由發揮。",
      gain: "學會在自由與準備之間找到平衡。",
    },
  },
  {
    id: 1, numeral: "I", name: "魔術師", en: "The Magician", emoji: "🧭",
    keywords: ["行動力", "資源", "主導"],
    style: "自己規劃的自駕、多城市串連",
    score: 2,
    up: {
      meaning: "你手上的資源都到位了，規劃能力強，旅程很順手。",
      warn: "行程排太滿，體力可能跟不上計畫。",
      advice: "善用 App 與在地資訊，自駕或自己串聯交通會很有成就感。",
      gain: "證明自己能把想像變成真實的旅行。",
    },
    rev: {
      meaning: "計畫很多卻沒落實，或被不實資訊誤導。",
      warn: "小心網路上過時的攻略、浮報價格的包車或假訂房網站。",
      advice: "重要預訂只走官方管道，出發前再確認一次營業時間。",
      gain: "學會查證，不再被漂亮的廣告牽著走。",
    },
  },
  {
    id: 2, numeral: "II", name: "女祭司", en: "The High Priestess", emoji: "🌙",
    keywords: ["直覺", "靜謐", "探索未知"],
    style: "寺廟、古蹟、湖邊或森林裡的安靜住宿",
    score: 1,
    up: {
      meaning: "這趟旅行偏向內在探索，安靜的地方會帶給你最多感受。",
      warn: "資訊不夠透明，有些規定（如服裝、拍照禁令）要事先了解。",
      advice: "安排一個沒有網路、只看風景的時段，相信你的直覺選路線。",
      gain: "會更清楚自己真正喜歡什麼樣的旅行。",
    },
    rev: {
      meaning: "直覺被焦慮蓋過，容易想太多而遲遲無法決定。",
      warn: "忽略身體的小警訊（疲勞、水土不服）可能演變成大問題。",
      advice: "不舒服就休息，備好常用藥，別硬撐跑完行程。",
      gain: "學會聆聽自己的節奏。",
    },
  },
  {
    id: 3, numeral: "III", name: "皇后", en: "The Empress", emoji: "🌸",
    keywords: ["豐盛", "享受", "自然"],
    style: "花季、農場、美食與溫泉度假",
    score: 2,
    up: {
      meaning: "五感滿足的旅程，美食、花海、舒服的住宿都很有緣。",
      warn: "吃太多或花太多，記得留意預算與腸胃。",
      advice: "安排花季、農場或溫泉行程，放慢腳步享受當下。",
      gain: "身心都被好好照顧，回來充滿能量。",
    },
    rev: {
      meaning: "過度放縱或過度節省，都讓旅行少了點樂趣。",
      warn: "生食、路邊攤要挑衛生的店，避免腸胃不適。",
      advice: "設定每日預算，把錢花在最想體驗的一兩件事上。",
      gain: "找到適合自己的享受方式。",
    },
  },
  {
    id: 4, numeral: "IV", name: "皇帝", en: "The Emperor", emoji: "🏰",
    keywords: ["秩序", "規劃", "掌控"],
    style: "經典城市、歷史名城、跟團或行程明確的旅行",
    score: 1,
    up: {
      meaning: "照計畫走就會很順，適合結構清楚的行程。",
      warn: "太堅持計畫，遇到變動容易煩躁。",
      advice: "把核心景點排好，搭配一個備案（雨天方案、替代交通）。",
      gain: "累積帶領旅行的自信與經驗。",
    },
    rev: {
      meaning: "控制欲或僵化讓旅伴有壓力，行程缺乏彈性。",
      warn: "罷工、封路、班次取消時，硬要照原計畫反而更糟。",
      advice: "保留 20% 的彈性時間，也聽聽旅伴想去哪裡。",
      gain: "學會放手，旅行才會更輕鬆。",
    },
  },
  {
    id: 5, numeral: "V", name: "教皇", en: "The Hierophant", emoji: "⛩️",
    keywords: ["傳統", "文化", "指引"],
    style: "文化深度遊、參加導覽、朝聖之路",
    score: 1,
    up: {
      meaning: "跟著在地人或專業導覽會收穫最多，傳統文化是亮點。",
      warn: "進入宗教場所要注意禮儀與服裝規定。",
      advice: "報名一次導覽或手作課程，了解當地的故事。",
      gain: "對一個文化有更深的理解。",
    },
    rev: {
      meaning: "照著網紅路線走，少了自己的發現。",
      warn: "小心「熱門」帶來的人潮與排隊，時間被大量消耗。",
      advice: "避開尖峰時段，或選擇在地人推薦的替代景點。",
      gain: "建立屬於自己的旅行方式。",
    },
  },
  {
    id: 6, numeral: "VI", name: "戀人", en: "The Lovers", emoji: "💞",
    keywords: ["旅伴", "選擇", "連結"],
    style: "雙人旅行、蜜月、和好朋友同遊",
    score: 2,
    up: {
      meaning: "和旅伴默契極佳，非常適合一起出遊增進感情。",
      warn: "兩人意見不同時，記得先溝通再決定。",
      advice: "安排一個屬於你們的儀式感行程，像看日出或浪漫晚餐。",
      gain: "和重要的人留下共同回憶。",
    },
    rev: {
      meaning: "旅伴之間容易因小事起摩擦，或在選擇間搖擺不定。",
      warn: "分攤費用、作息差異是常見的爭吵來源。",
      advice: "出發前先講好預算與每天的步調，也給彼此一點獨處時間。",
      gain: "更了解彼此，也更了解自己要什麼。",
    },
  },
  {
    id: 7, numeral: "VII", name: "戰車", en: "The Chariot", emoji: "🚙",
    keywords: ["移動", "突破", "意志"],
    style: "公路旅行、環島、跨國火車",
    score: 2,
    up: {
      meaning: "移動運極佳，交通順暢，適合長途或公路旅行。",
      warn: "趕路容易疲勞駕駛，長途開車要輪替休息。",
      advice: "規劃一條公路或鐵道路線，沿途的風景就是重點。",
      gain: "完成一段有挑戰性的旅程，成就感滿分。",
    },
    rev: {
      meaning: "交通容易延誤或方向迷失，行程推進不順。",
      warn: "注意航班延誤、轉機時間太短、租車糾紛。",
      advice: "轉機至少留 2 小時，租車前拍照存證，買旅平險含延誤險。",
      gain: "學會在混亂中保持冷靜。",
    },
  },
  {
    id: 8, numeral: "VIII", name: "力量", en: "Strength", emoji: "🦁",
    keywords: ["勇氣", "耐力", "溫柔"],
    style: "登山健行、長程步道、野生動物觀察",
    score: 1,
    up: {
      meaning: "體力與心力都很充足，適合挑戰登山或長程步道。",
      warn: "別逞強，高山症或中暑的徵兆要及早處理。",
      advice: "選一條有挑戰性但在能力範圍內的路線，按自己的節奏前進。",
      gain: "發現自己比想像中更強大。",
    },
    rev: {
      meaning: "信心不足或體力透支，行程容易半途而廢。",
      warn: "注意運動傷害、天候轉壞時要果斷撤退。",
      advice: "降低難度，換成步道或半日行程，安全最重要。",
      gain: "懂得量力而為也是一種勇氣。",
    },
  },
  {
    id: 9, numeral: "IX", name: "隱者", en: "The Hermit", emoji: "🏔️",
    keywords: ["獨處", "沉澱", "山林"],
    style: "獨旅、山中小屋、偏鄉慢旅行",
    score: 1,
    up: {
      meaning: "很適合一個人的旅行，遠離人群會讓你充電。",
      warn: "偏遠地區訊號弱、補給少，要先準備好地圖與食物。",
      advice: "選擇山中小屋或小鎮慢遊，把手機收起來寫寫旅行日記。",
      gain: "腦袋被清空，回來後思路更清晰。",
    },
    rev: {
      meaning: "孤單感上升，或刻意逃避而不是真正放鬆。",
      warn: "獨自行動時注意人身安全，告訴親友你的行程。",
      advice: "加入一日遊團或住青旅，適度與人交流。",
      gain: "明白獨處與孤單的差別。",
    },
  },
  {
    id: 10, numeral: "X", name: "命運之輪", en: "Wheel of Fortune", emoji: "🎡",
    keywords: ["轉機", "幸運", "變化"],
    style: "隨機目的地、抽籤決定、跟著季節走的旅行",
    score: 2,
    up: {
      meaning: "運氣站在你這邊，常有升等、好天氣或意外驚喜。",
      warn: "好運來得快去得也快，重要事項還是要確認。",
      advice: "讓命運決定一次：抽一個目的地，或搭第一班出發的車。",
      gain: "相信「轉角遇到驚喜」的旅行魔力。",
    },
    rev: {
      meaning: "計畫常被外在因素打亂，天氣或時機不太配合。",
      warn: "颱風、雨季、旺季漲價，出發前多看天氣預報。",
      advice: "選擇可免費取消的住宿，必要時延後出發。",
      gain: "學會接受無法控制的事。",
    },
  },
  {
    id: 11, numeral: "XI", name: "正義", en: "Justice", emoji: "⚖️",
    keywords: ["公平", "規則", "平衡"],
    style: "行程清楚的城市旅行、商務順遊",
    score: 1,
    up: {
      meaning: "一切按規則走就順利，付出與回報成正比。",
      warn: "入境規定、退稅與當地法規要遵守。",
      advice: "整理好所有預訂憑證，費用分攤用記帳 App 一目了然。",
      gain: "一趟沒有糾紛、清清楚楚的旅程。",
    },
    rev: {
      meaning: "容易遇到不公平的對待或價格糾紛。",
      warn: "小心計程車繞路、商家多收費，保留收據。",
      advice: "先問價再消費，使用叫車 App 或跳表計程車。",
      gain: "練就保護自己權益的能力。",
    },
  },
  {
    id: 12, numeral: "XII", name: "倒吊人", en: "The Hanged Man", emoji: "🙃",
    keywords: ["暫停", "換角度", "等待"],
    style: "慢旅行、長住一地、海島放空",
    score: 0,
    up: {
      meaning: "旅程節奏會變慢，但換個角度會發現不一樣的風景。",
      warn: "可能遇到延誤或需要等待，帶本書打發時間。",
      advice: "選一個地方住久一點，不趕景點，像當地人一樣生活。",
      gain: "學會享受「什麼都不做」的時光。",
    },
    rev: {
      meaning: "卡在原地、遲遲無法出發，或旅程感覺停滯。",
      warn: "簽證、請假、預算問題可能讓計畫一延再延。",
      advice: "先訂一個近一點的小旅行，讓自己動起來。",
      gain: "突破猶豫，踏出第一步。",
    },
  },
  {
    id: 13, numeral: "XIII", name: "死神", en: "Death", emoji: "🍂",
    keywords: ["結束", "轉變", "重生"],
    style: "人生轉換期的長途旅行、gap year",
    score: 0,
    up: {
      meaning: "這趟旅行是一個階段的結束與新的開始，會帶來深刻轉變。",
      warn: "原本的計畫可能必須取消或大改，不用太執著。",
      advice: "把這趟旅程當成告別儀式，去一個能讓你重新開始的地方。",
      gain: "帶著全新的自己回家。",
    },
    rev: {
      meaning: "抗拒改變，想去新地方卻又放不下熟悉感。",
      warn: "留戀舊行程而錯過新的可能。",
      advice: "這次試著去一個完全陌生的國家或城市。",
      gain: "發現改變沒有想像中可怕。",
    },
  },
  {
    id: 14, numeral: "XIV", name: "節制", en: "Temperance", emoji: "♨️",
    keywords: ["平衡", "療癒", "調和"],
    style: "溫泉、瑜伽、養生慢旅",
    score: 1,
    up: {
      meaning: "動靜平衡的旅程最舒服，療癒系行程特別有感。",
      warn: "時差與作息要調整，避免第一天就累垮。",
      advice: "一天排一個主要景點，搭配泡湯、按摩或散步。",
      gain: "身心重新回到平衡。",
    },
    rev: {
      meaning: "行程失衡，不是太累就是太無聊。",
      warn: "暴飲暴食、熬夜趕行程會讓身體出狀況。",
      advice: "重新調整步調，每兩天安排一個輕鬆日。",
      gain: "找到適合自己的旅行節奏。",
    },
  },
  {
    id: 15, numeral: "XV", name: "惡魔", en: "The Devil", emoji: "🎰",
    keywords: ["誘惑", "消費", "束縛"],
    style: "夜生活、購物城市（但請節制）",
    score: -1,
    up: {
      meaning: "誘惑很多，容易超支或被享樂綁住。",
      warn: "小心賭場、酒精、衝動購物，以及「太好康」的旅遊推銷。",
      advice: "設好花費上限，夜間活動結伴同行。",
      gain: "看清自己真正想要的是什麼。",
    },
    rev: {
      meaning: "掙脫束縛，準備好放下工作或壓力去旅行。",
      warn: "放鬆過頭時仍要顧好財物。",
      advice: "關掉工作通知，給自己一個完整的假期。",
      gain: "重新拿回生活的主導權。",
    },
  },
  {
    id: 16, numeral: "XVI", name: "高塔", en: "The Tower", emoji: "⛈️",
    keywords: ["突發", "變動", "震撼"],
    style: "目前不宜冒險，建議近郊或可退款的行程",
    score: -2,
    up: {
      meaning: "旅途中可能發生計畫外的大變動，需要隨機應變。",
      warn: "特別注意天災、航班取消、行李遺失或證件遺失。",
      advice: "買足旅遊保險、證件拍照雲端備份，選擇可退改的票券。",
      gain: "經歷過後，你會變成更有韌性的旅人。",
    },
    rev: {
      meaning: "危機有機會避開，但仍有小狀況的預兆。",
      warn: "出發前出現的小問題（證件快過期、行李箱壞掉）要立刻處理。",
      advice: "延後或簡化行程都是好選擇，安全第一。",
      gain: "躲過一劫，懂得預防的重要。",
    },
  },
  {
    id: 17, numeral: "XVII", name: "星星", en: "The Star", emoji: "✨",
    keywords: ["希望", "星空", "療癒"],
    style: "看星空、極光、海邊與高山營地",
    score: 2,
    up: {
      meaning: "充滿希望與療癒的旅程，大自然會給你很大的力量。",
      warn: "夜間活動注意保暖與照明。",
      advice: "安排一晚看星空或極光，選光害少的露營地或高山。",
      gain: "重新找回對生活的期待。",
    },
    rev: {
      meaning: "期待太高，現實與想像有落差。",
      warn: "天氣可能讓你看不到想看的美景，先做好心理準備。",
      advice: "多留一兩天彈性，或準備雨天的替代行程。",
      gain: "懂得欣賞不完美中的美好。",
    },
  },
  {
    id: 18, numeral: "XVIII", name: "月亮", en: "The Moon", emoji: "🌫️",
    keywords: ["迷霧", "不安", "不確定"],
    style: "行程不宜太複雜，以熟悉或治安好的地方為主",
    score: -1,
    up: {
      meaning: "資訊模糊、容易迷路或誤會，心情也比較起伏。",
      warn: "提防詐騙、假導遊，夜間避免獨自走偏僻路段。",
      advice: "下載離線地圖、住交通方便的區域，天黑前回住宿。",
      gain: "學會在不確定中照顧好自己。",
    },
    rev: {
      meaning: "迷霧散去，之前困擾的問題漸漸明朗。",
      warn: "仍要再次確認行程細節，避免小誤會。",
      advice: "把疑問直接問清楚（飯店、航空公司），會比猜測更安心。",
      gain: "恐懼消散，旅程越走越順。",
    },
  },
  {
    id: 19, numeral: "XIX", name: "太陽", en: "The Sun", emoji: "☀️",
    keywords: ["晴朗", "快樂", "活力"],
    style: "海島、親子旅行、戶外活動",
    score: 2,
    up: {
      meaning: "大吉！好天氣、好心情，是一趟充滿笑容的旅行。",
      warn: "陽光太烈，防曬與補水不能少。",
      advice: "安排海邊、戶外或親子活動，盡情享受陽光。",
      gain: "滿滿的快樂回憶與照片。",
    },
    rev: {
      meaning: "整體還是不錯，只是熱情稍減或有點小掃興。",
      warn: "中暑、曬傷或天氣比預期差。",
      advice: "調整到早晚較涼爽的時段活動，中午進室內。",
      gain: "小小的不如意也能變成笑談。",
    },
  },
  {
    id: 20, numeral: "XX", name: "審判", en: "Judgement", emoji: "📯",
    keywords: ["召喚", "重返", "覺醒"],
    style: "重遊舊地、尋根之旅、圓夢清單",
    score: 1,
    up: {
      meaning: "某個地方正在呼喚你，現在是實現夢想清單的好時機。",
      warn: "臨時起意的決定要確認休假與預算是否允許。",
      advice: "去那個「一直想去卻沒去」的地方，或重返有回憶的城市。",
      gain: "完成一個放在心裡很久的願望。",
    },
    rev: {
      meaning: "猶豫不決、錯過時機，或對上次旅行留有遺憾。",
      warn: "拖太久可能遇到漲價或名額額滿。",
      advice: "設定一個出發期限，先把機票訂下來。",
      gain: "不再讓「下次再說」成為藉口。",
    },
  },
  {
    id: 21, numeral: "XXI", name: "世界", en: "The World", emoji: "🌍",
    keywords: ["圓滿", "環遊", "完成"],
    style: "出國長途旅行、環遊世界、畢業旅行",
    score: 2,
    up: {
      meaning: "圓滿的旅程，非常適合出國或完成一趟大旅行。",
      warn: "長途旅行的行李與證件管理要做好。",
      advice: "大膽規劃跨國或長天數的行程，這次會很值得。",
      gain: "視野被打開，覺得世界更大了。",
    },
    rev: {
      meaning: "旅程差臨門一腳，或結束時有點意猶未盡。",
      warn: "最後一天容易出狀況（趕不上飛機、忘了退稅）。",
      advice: "回程那天留足時間，把未完成的地方記下來當下次的目標。",
      gain: "留一點遺憾，讓自己有理由再回來。",
    },
  },
];

export type PositionKind = keyof Reading | "option";

export type Spread = {
  id: "daily" | "trip" | "choose";
  name: string;
  emoji: string;
  forWho: string;
  positions: { title: string; kind: PositionKind; hint: string }[];
};

export const spreads: Spread[] = [
  {
    id: "daily",
    name: "單張出遊指引",
    emoji: "🃏",
    forWho: "今天或這週末想出門，抽一張看看運勢",
    positions: [{ title: "今日出遊指引", kind: "meaning", hint: "今天出門的整體能量與提醒" }],
  },
  {
    id: "trip",
    name: "旅途運勢四牌陣",
    emoji: "🧳",
    forWho: "已經決定要去哪，想預測即將到來的旅行",
    positions: [
      { title: "旅途整體運勢", kind: "meaning", hint: "這趟旅程的主要氛圍" },
      { title: "需要避開的突發狀況", kind: "warn", hint: "最可能出錯的地方與預防方法" },
      { title: "行程建議", kind: "advice", hint: "怎麼安排會最順利" },
      { title: "旅程收穫", kind: "gain", hint: "這趟旅行會帶給你什麼" },
    ],
  },
  {
    id: "choose",
    name: "目的地抉擇牌陣",
    emoji: "🗺️",
    forWho: "正在猶豫要去哪裡，在 2–3 個選項之間做決定",
    positions: [], // 依使用者輸入的選項數量動態產生
  },
];

// 選擇牌陣：每個選項一張，加一張「最終建議」
export function choosePositions(options: string[]): Spread["positions"] {
  return [
    ...options.map((o) => ({ title: `選項：${o}`, kind: "option" as const, hint: `去「${o}」的旅行能量` })),
    { title: "最終建議", kind: "advice" as const, hint: "不論選哪裡，都要記得的事" },
  ];
}
