export type TripType =
  | "exhibition"
  | "performance"
  | "family"
  | "hiking"
  | "diving"
  | "food"
  | "hotspring"
  | "beach"
  | "nature"
  | "oldstreet"
  | "camping";

export const tripTypes: { id: TripType; label: string; emoji: string; live?: string[] }[] = [
  // live：要即時抓文化部 API 的類別
  { id: "exhibition", label: "展覽", emoji: "🖼️", live: ["6"] },
  { id: "performance", label: "藝文表演", emoji: "🎭", live: ["1", "2", "3", "17"] },
  { id: "family", label: "親子活動", emoji: "🧸", live: ["4"] },
  { id: "hiking", label: "爬山健行", emoji: "⛰️" },
  { id: "diving", label: "潛水浮潛", emoji: "🤿" },
  { id: "food", label: "美食小吃", emoji: "🍜" },
  { id: "hotspring", label: "泡溫泉", emoji: "♨️" },
  { id: "beach", label: "海邊玩水", emoji: "🏖️" },
  { id: "nature", label: "自然賞景", emoji: "🌲" },
  { id: "oldstreet", label: "老街文化", emoji: "🏮" },
  { id: "camping", label: "露營", emoji: "⛺" },
];

export type Transport = "car" | "scooter" | "transit";

export const transports: { id: Transport; label: string }[] = [
  { id: "car", label: "🚗 開車" },
  { id: "scooter", label: "🛵 騎機車" },
  { id: "transit", label: "🚆 大眾運輸" },
];

export const travelTimes = [
  { minutes: 30, label: "30 分鐘內" },
  { minutes: 60, label: "1 小時內" },
  { minutes: 90, label: "1.5 小時內" },
  { minutes: 120, label: "2 小時內" },
  { minutes: 180, label: "3 小時內" },
  { minutes: 240, label: "4 小時內" },
  { minutes: Infinity, label: "不限" },
];

export const stays = [
  { hours: 3, label: "2–3 小時" },
  { hours: 5, label: "半天" },
  { hours: 10, label: "一整天" },
  { hours: 36, label: "兩天一夜" },
  { hours: 72, label: "三天兩夜以上" },
];

export type Island = "penghu" | "kinmen" | "matsu" | "liuqiu" | "greenisland" | "orchid";

type LatLon = [number, number];

// 出發地：各縣市主要車站或市中心
export const origins: { name: string; at: LatLon; island?: Island }[] = [
  { name: "基隆市", at: [25.131, 121.739] },
  { name: "台北市", at: [25.048, 121.517] },
  { name: "新北市", at: [25.014, 121.464] },
  { name: "桃園市", at: [24.989, 121.314] },
  { name: "新竹市", at: [24.802, 120.972] },
  { name: "新竹縣", at: [24.839, 121.009] },
  { name: "苗栗縣", at: [24.57, 120.822] },
  { name: "台中市", at: [24.137, 120.686] },
  { name: "彰化縣", at: [24.081, 120.538] },
  { name: "南投縣", at: [23.91, 120.684] },
  { name: "雲林縣", at: [23.711, 120.541] },
  { name: "嘉義市", at: [23.479, 120.441] },
  { name: "嘉義縣", at: [23.46, 120.33] },
  { name: "台南市", at: [22.997, 120.212] },
  { name: "高雄市", at: [22.639, 120.302] },
  { name: "屏東縣", at: [22.669, 120.486] },
  { name: "宜蘭縣", at: [24.754, 121.758] },
  { name: "花蓮縣", at: [23.993, 121.601] },
  { name: "台東縣", at: [22.793, 121.123] },
  { name: "澎湖縣", at: [23.567, 119.566], island: "penghu" },
  { name: "金門縣", at: [24.432, 118.318], island: "kinmen" },
  { name: "連江縣", at: [26.157, 119.951], island: "matsu" },
];

const airports = {
  songshan: [25.069, 121.552] as LatLon,
  taichung: [24.264, 120.621] as LatLon,
  chiayi: [23.462, 120.393] as LatLon,
  tainan: [22.95, 120.206] as LatLon,
  kaohsiung: [22.577, 120.35] as LatLon,
};

// 去離島要先到本島的機場或港口，extra 是候機／候船加上飛行／航程的分鐘數
export const islandGateways: Record<Island, { label: string; at: LatLon[]; extra: number }> = {
  penghu: {
    label: "搭飛機",
    at: [airports.songshan, airports.taichung, airports.chiayi, airports.tainan, airports.kaohsiung],
    extra: 110,
  },
  kinmen: {
    label: "搭飛機",
    at: [airports.songshan, airports.taichung, airports.chiayi, airports.tainan, airports.kaohsiung],
    extra: 120,
  },
  matsu: { label: "搭飛機", at: [airports.songshan, airports.taichung], extra: 120 },
  liuqiu: { label: "東港搭船", at: [[22.466, 120.443]], extra: 60 },
  greenisland: { label: "富岡漁港搭船", at: [[22.792, 121.191]], extra: 80 },
  orchid: { label: "富岡漁港搭船", at: [[22.792, 121.191]], extra: 170 },
};

export type Spot = {
  name: string;
  county: string;
  at: LatLon;
  types: TripType[];
  hours: [number, number]; // 建議停留時間（小時）
  desc: string;
  months?: number[]; // 最佳月份
  island?: Island;
};

const summer = [4, 5, 6, 7, 8, 9, 10];
const winter = [11, 12, 1, 2, 3];

export const spots: Spot[] = [
  // 爬山健行
  { name: "象山步道", county: "台北市", at: [25.027, 121.576], types: ["hiking"], hours: [2, 3], desc: "市區就能爬，山頂看台北 101 夜景。" },
  { name: "陽明山七星山", county: "台北市", at: [25.171, 121.554], types: ["hiking", "nature"], hours: [3, 5], desc: "台北最高峰，沿途有硫磺噴氣孔與芒草。" },
  { name: "觀音山硬漢嶺", county: "新北市", at: [25.135, 121.428], types: ["hiking"], hours: [3, 4], desc: "俯瞰淡水河出海口，下山順遊八里左岸。" },
  { name: "草嶺古道", county: "新北市", at: [25.011, 121.91], types: ["hiking", "nature"], hours: [4, 6], months: [10, 11, 12], desc: "百年古道，秋冬滿山芒草，終點可看龜山島。" },
  { name: "抹茶山（聖母登山步道）", county: "宜蘭縣", at: [24.832, 121.744], types: ["hiking"], hours: [5, 7], desc: "稜線像抹茶冰淇淋，爬完下山泡礁溪溫泉。" },
  { name: "獅頭山", county: "苗栗縣", at: [24.638, 120.989], types: ["hiking", "oldstreet"], hours: [3, 5], desc: "沿途古剎林立，可接南庄老街。" },
  { name: "鳶嘴山", county: "台中市", at: [24.212, 120.966], types: ["hiking"], hours: [4, 6], desc: "岩稜拉繩攀爬，刺激又有成就感的中級山。" },
  { name: "合歡山", county: "南投縣", at: [24.142, 121.272], types: ["hiking", "nature"], hours: [5, 36], desc: "開車就能到 3000 公尺，主峰、東峰、石門山輕鬆入門百岳。" },
  { name: "雪山主峰", county: "台中市", at: [24.383, 121.232], types: ["hiking", "camping"], hours: [36, 60], desc: "台灣第二高峰，需申請入園與山屋。" },
  { name: "玉山主峰", county: "南投縣", at: [23.47, 120.957], types: ["hiking"], hours: [36, 60], desc: "東北亞第一高峰，需抽排雲山莊床位。" },
  { name: "嘉明湖", county: "台東縣", at: [23.293, 121.035], types: ["hiking", "camping", "nature"], hours: [60, 80], desc: "「天使的眼淚」高山湖泊，三天兩夜經典路線。" },
  { name: "北大武山", county: "屏東縣", at: [22.62, 120.73], types: ["hiking"], hours: [36, 48], desc: "五嶽之一，排灣族聖山，檜谷山莊過夜。" },
  { name: "柴山", county: "高雄市", at: [22.649, 120.27], types: ["hiking", "nature"], hours: [2, 4], desc: "市區珊瑚礁山林，常遇到台灣獼猴。" },

  // 潛水浮潛
  { name: "龍洞灣", county: "新北市", at: [25.112, 121.918], types: ["diving"], hours: [4, 10], months: summer, desc: "北部潛水勝地，浮潛、水肺、攀岩都可以。" },
  { name: "潮境公園", county: "基隆市", at: [25.143, 121.802], types: ["diving", "nature"], hours: [3, 6], months: summer, desc: "海洋保育區，魚群多，適合浮潛新手。" },
  { name: "墾丁後壁湖", county: "屏東縣", at: [21.945, 120.744], types: ["diving", "beach"], hours: [4, 36], months: summer, desc: "南台灣潛水重鎮，體驗潛水業者很多。" },
  { name: "小琉球", county: "屏東縣", at: [22.34, 120.374], types: ["diving", "beach", "food"], hours: [10, 60], months: summer, island: "liuqiu", desc: "浮潛幾乎必遇海龜，環島騎機車一圈約 1 小時。" },
  { name: "綠島", county: "台東縣", at: [22.661, 121.49], types: ["diving", "hotspring", "nature"], hours: [36, 60], months: summer, island: "greenisland", desc: "珊瑚礁與海底溫泉（朝日溫泉），夜觀梅花鹿。" },
  { name: "蘭嶼", county: "台東縣", at: [22.045, 121.548], types: ["diving", "nature", "camping"], hours: [36, 72], months: summer, island: "orchid", desc: "達悟族文化、飛魚季，海水透明度極高。" },
  { name: "澎湖南方四島", county: "澎湖縣", at: [23.25, 119.6], types: ["diving", "nature"], hours: [36, 72], months: summer, island: "penghu", desc: "國家公園海域，雙心石滬與玄武岩地景。" },
  { name: "澎湖吉貝嶼", county: "澎湖縣", at: [23.738, 119.605], types: ["diving", "beach"], hours: [10, 36], months: summer, island: "penghu", desc: "沙尾白沙灘與各式水上活動。" },

  // 美食小吃
  { name: "士林夜市", county: "台北市", at: [25.088, 121.524], types: ["food"], hours: [2, 4], desc: "台北最大夜市，大餅包小餅、豪大雞排。" },
  { name: "饒河街夜市", county: "台北市", at: [25.051, 121.577], types: ["food"], hours: [2, 3], desc: "胡椒餅、藥燉排骨，一條直線好逛。" },
  { name: "寧夏夜市", county: "台北市", at: [25.056, 121.515], types: ["food"], hours: [2, 3], desc: "台灣小吃密度最高的夜市之一。" },
  { name: "基隆廟口夜市", county: "基隆市", at: [25.128, 121.744], types: ["food"], hours: [2, 3], desc: "營養三明治、鼎邊趖，海鮮小吃齊全。" },
  { name: "新竹城隍廟小吃", county: "新竹市", at: [24.804, 120.966], types: ["food", "oldstreet"], hours: [2, 3], desc: "米粉、貢丸、潤餅，老字號聚集。" },
  { name: "逢甲夜市", county: "台中市", at: [24.175, 120.646], types: ["food"], hours: [2, 4], desc: "創意小吃發源地，攤位超多。" },
  { name: "鹿港老街", county: "彰化縣", at: [24.057, 120.433], types: ["food", "oldstreet"], hours: [3, 6], desc: "蚵仔煎、麵線糊，配上天后宮與九曲巷。" },
  { name: "嘉義文化路夜市", county: "嘉義市", at: [23.481, 120.449], types: ["food"], hours: [2, 3], desc: "雞肉飯一級戰區。" },
  { name: "台南中西區小吃", county: "台南市", at: [22.995, 120.198], types: ["food", "oldstreet"], hours: [4, 36], desc: "國華街、保安路，牛肉湯、碗粿、鱔魚意麵吃不完。" },
  { name: "花園夜市", county: "台南市", at: [23.011, 120.208], types: ["food"], hours: [2, 3], desc: "南部最大夜市，週四、六、日營業。" },
  { name: "瑞豐夜市", county: "高雄市", at: [22.666, 120.299], types: ["food"], hours: [2, 3], desc: "在地人最愛的高雄夜市。" },
  { name: "羅東夜市", county: "宜蘭縣", at: [24.677, 121.77], types: ["food"], hours: [2, 3], desc: "包心粉圓、羊肉湯，旁邊就是羅東運動公園。" },
  { name: "花蓮東大門夜市", county: "花蓮縣", at: [23.976, 121.611], types: ["food"], hours: [2, 3], desc: "原住民一條街烤山豬肉、各省一條街。" },
  { name: "金門金城鎮", county: "金門縣", at: [24.432, 118.318], types: ["food", "oldstreet"], hours: [36, 60], island: "kinmen", desc: "廣東粥、蚵仔麵線，模範街與閩式古厝。" },
  { name: "澎湖馬公市區", county: "澎湖縣", at: [23.567, 119.566], types: ["food", "oldstreet"], hours: [10, 36], island: "penghu", desc: "中央老街、天后宮，海鮮與仙人掌冰。" },

  // 泡溫泉
  { name: "北投溫泉", county: "台北市", at: [25.137, 121.507], types: ["hotspring"], hours: [3, 6], months: winter, desc: "捷運直達，地熱谷與溫泉博物館。" },
  { name: "金山溫泉", county: "新北市", at: [25.222, 121.638], types: ["hotspring", "food"], hours: [3, 6], months: winter, desc: "海邊溫泉，順吃金山老街鴨肉。" },
  { name: "烏來溫泉", county: "新北市", at: [24.864, 121.551], types: ["hotspring", "nature"], hours: [4, 8], months: winter, desc: "泰雅族部落與台車、瀑布。" },
  { name: "礁溪溫泉", county: "宜蘭縣", at: [24.827, 121.773], types: ["hotspring"], hours: [3, 36], months: winter, desc: "火車站旁就有泡腳池，國道 5 號直達。" },
  { name: "泰安溫泉", county: "苗栗縣", at: [24.465, 120.99], types: ["hotspring", "nature"], hours: [5, 36], months: winter, desc: "山谷裡的碳酸氫鈉美人湯。" },
  { name: "谷關溫泉", county: "台中市", at: [24.203, 121.003], types: ["hotspring", "hiking"], hours: [5, 36], months: winter, desc: "谷關七雄登山口，爬完泡湯。" },
  { name: "關子嶺溫泉", county: "台南市", at: [23.338, 120.505], types: ["hotspring"], hours: [3, 36], months: winter, desc: "少見的泥漿溫泉，水火同源奇景。" },
  { name: "四重溪溫泉", county: "屏東縣", at: [22.093, 120.744], types: ["hotspring"], hours: [3, 36], months: winter, desc: "台灣四大名湯之一，去墾丁順路。" },
  { name: "知本溫泉", county: "台東縣", at: [22.693, 121.012], types: ["hotspring", "nature"], hours: [4, 36], months: winter, desc: "知本森林遊樂區旁的老牌溫泉鄉。" },
  { name: "瑞穗溫泉", county: "花蓮縣", at: [23.507, 121.354], types: ["hotspring"], hours: [3, 36], months: winter, desc: "鐵鏽色的「生男湯」，順遊瑞穗牧場。" },

  // 海邊玩水
  { name: "福隆海水浴場", county: "新北市", at: [25.022, 121.945], types: ["beach", "food"], hours: [4, 8], months: summer, desc: "金黃沙灘，必吃福隆便當。" },
  { name: "白沙灣", county: "新北市", at: [25.284, 121.512], types: ["beach"], hours: [3, 6], months: summer, desc: "北海岸玩沙、風箏衝浪。" },
  { name: "外澳沙灘", county: "宜蘭縣", at: [24.88, 121.846], types: ["beach"], hours: [3, 6], months: summer, desc: "衝浪入門首選，正對龜山島。" },
  { name: "七星潭", county: "花蓮縣", at: [24.03, 121.627], types: ["beach", "nature"], hours: [2, 4], desc: "月牙形礫石海灣，看日出很美（不適合下水）。" },
  { name: "墾丁南灣", county: "屏東縣", at: [21.959, 120.762], types: ["beach"], hours: [4, 36], months: summer, desc: "水上摩托車、香蕉船一次玩。" },
  { name: "旗津海水浴場", county: "高雄市", at: [22.61, 120.268], types: ["beach", "food"], hours: [2, 4], desc: "搭渡輪過去，吃海產看夕陽。" },
  { name: "都蘭", county: "台東縣", at: [22.877, 121.233], types: ["beach", "camping"], hours: [5, 36], months: summer, desc: "衝浪小鎮，週末有手作市集。" },

  // 自然賞景
  { name: "野柳地質公園", county: "新北市", at: [25.207, 121.69], types: ["nature"], hours: [2, 3], desc: "女王頭與各種奇岩。" },
  { name: "拉拉山", county: "桃園市", at: [24.715, 121.434], types: ["nature", "hiking", "camping"], hours: [5, 36], desc: "神木群步道，夏天水蜜桃季。" },
  { name: "高美濕地", county: "台中市", at: [24.312, 120.549], types: ["nature"], hours: [2, 3], desc: "風車與夕陽倒影，記得查潮汐。" },
  { name: "武陵農場", county: "台中市", at: [24.36, 121.311], types: ["nature", "camping", "hiking"], hours: [6, 36], months: [2, 3], desc: "早春櫻花季，也是雪山登山口。" },
  { name: "福壽山農場", county: "台中市", at: [24.245, 121.244], types: ["nature", "camping"], hours: [6, 36], months: [10, 11, 12, 1, 2], desc: "高山露營區，秋天賞楓、冬天賞梅。" },
  { name: "清境農場", county: "南投縣", at: [24.059, 121.163], types: ["nature", "family"], hours: [5, 36], desc: "青青草原綿羊秀，往合歡山的中繼站。" },
  { name: "日月潭", county: "南投縣", at: [23.857, 120.916], types: ["nature", "hiking"], hours: [5, 36], desc: "環湖自行車道、遊艇、纜車。" },
  { name: "奧萬大", county: "南投縣", at: [23.95, 121.177], types: ["nature", "hiking"], hours: [5, 36], months: [11, 12, 1], desc: "全台最有名的賞楓地點。" },
  { name: "杉林溪", county: "南投縣", at: [23.638, 120.795], types: ["nature", "camping"], hours: [5, 36], months: [3, 4, 5], desc: "春天牡丹與繡球花季，森林芬多精。" },
  { name: "阿里山國家森林遊樂區", county: "嘉義縣", at: [23.51, 120.802], types: ["nature", "hiking"], hours: [5, 36], desc: "神木、小火車、祝山日出、雲海。" },
  { name: "太平山", county: "宜蘭縣", at: [24.496, 121.535], types: ["nature", "hiking", "hotspring"], hours: [6, 36], desc: "見晴懷古步道、翠峰湖，鳩之澤溫泉。" },
  { name: "六十石山", county: "花蓮縣", at: [23.202, 121.287], types: ["nature"], hours: [3, 5], months: [8, 9], desc: "夏末滿山金針花海。" },
  { name: "池上伯朗大道", county: "台東縣", at: [23.1, 121.219], types: ["nature", "food"], hours: [3, 6], desc: "騎單車穿越稻田，吃池上便當。" },
  { name: "鹿野高台", county: "台東縣", at: [22.918, 121.135], types: ["nature", "camping", "family"], hours: [3, 36], months: [6, 7, 8], desc: "夏天熱氣球嘉年華，飛行傘起飛點。" },
  { name: "三仙台", county: "台東縣", at: [23.124, 121.414], types: ["nature"], hours: [2, 3], desc: "八拱跨海步橋，東海岸看日出首選。" },
  { name: "墾丁國家公園", county: "屏東縣", at: [21.904, 120.852], types: ["nature", "beach", "camping"], hours: [10, 72], desc: "龍磐草原、鵝鑾鼻燈塔、墾丁大街。" },
  { name: "馬祖南北竿", county: "連江縣", at: [26.157, 119.951], types: ["nature", "oldstreet"], hours: [36, 72], months: [4, 5, 6, 7, 8, 9], island: "matsu", desc: "芹壁閩東聚落、戰地坑道，春夏有藍眼淚。" },

  // 老街文化
  { name: "九份老街", county: "新北市", at: [25.109, 121.844], types: ["oldstreet", "food"], hours: [3, 6], desc: "山城茶樓、芋圓，晚上紅燈籠最有氣氛。" },
  { name: "平溪十分", county: "新北市", at: [25.043, 121.775], types: ["oldstreet", "nature"], hours: [3, 6], desc: "放天燈、十分瀑布，搭平溪線小火車。" },
  { name: "淡水老街", county: "新北市", at: [25.17, 121.439], types: ["oldstreet", "food"], hours: [3, 5], desc: "阿給、魚丸，漁人碼頭看夕陽。" },
  { name: "三峽老街", county: "新北市", at: [24.934, 121.369], types: ["oldstreet"], hours: [2, 3], desc: "巴洛克紅磚街屋、祖師廟、金牛角。" },
  { name: "大溪老街", county: "桃園市", at: [24.884, 121.287], types: ["oldstreet", "food"], hours: [2, 4], desc: "豆干名產，牌樓立面很好拍。" },
  { name: "北埔老街", county: "新竹縣", at: [24.7, 121.057], types: ["oldstreet", "food"], hours: [2, 4], desc: "客家擂茶、柿餅，金廣成文化館。" },
  { name: "內灣老街", county: "新竹縣", at: [24.705, 121.183], types: ["oldstreet", "food"], hours: [3, 5], desc: "內灣線終點，野薑花粽。" },
  { name: "南庄老街", county: "苗栗縣", at: [24.597, 121.0], types: ["oldstreet", "camping"], hours: [3, 36], desc: "桂花巷、賽夏族文化，周邊露營區很多。" },
  { name: "安平老街", county: "台南市", at: [23.001, 120.161], types: ["oldstreet", "food"], hours: [3, 6], desc: "安平古堡、樹屋、蝦餅與劍獅。" },
  { name: "旗山老街", county: "高雄市", at: [22.888, 120.483], types: ["oldstreet", "food"], hours: [2, 4], desc: "香蕉之鄉，巴洛克街屋與枝仔冰。" },

  // 露營
  { name: "司馬庫斯", county: "新竹縣", at: [24.578, 121.333], types: ["camping", "hiking"], hours: [36, 60], desc: "「上帝的部落」，巨木群步道。" },

  // 補充景點
  { name: "鼻頭角步道", county: "新北市", at: [25.123, 121.919], types: ["hiking", "diving"], hours: [2, 5], months: summer, desc: "海蝕平台與燈塔步道，夏天岸潛熱點。" },
  { name: "和平島公園", county: "基隆市", at: [25.16, 121.762], types: ["diving", "beach", "family"], hours: [2, 4], months: summer, desc: "奇岩地景，海水泳池適合小朋友戲水。" },
  { name: "墾丁萬里桐", county: "屏東縣", at: [21.996, 120.705], types: ["diving"], hours: [3, 6], months: summer, desc: "珊瑚礁淺灘，浮潛看小丑魚。" },
  { name: "石梯坪", county: "花蓮縣", at: [23.486, 121.512], types: ["diving", "nature", "camping"], hours: [3, 36], months: summer, desc: "海蝕地形與壺穴，旁邊就是海景露營區。" },
  { name: "杉原灣", county: "台東縣", at: [22.832, 121.185], types: ["diving", "beach"], hours: [3, 6], months: summer, desc: "台東少數能玩水的沙灘，浮潛、SUP 都可以。" },
  { name: "翡翠灣", county: "新北市", at: [25.19, 121.68], types: ["beach"], hours: [3, 6], months: summer, desc: "北海岸半月形海灣，飛行傘降落點。" },
  { name: "外木山海岸", county: "基隆市", at: [25.155, 121.711], types: ["beach", "diving"], hours: [2, 4], months: summer, desc: "情人湖下方的海岸，夏天戲水浮潛。" },
  { name: "烏石港", county: "宜蘭縣", at: [24.869, 121.84], types: ["beach", "food"], hours: [3, 6], months: summer, desc: "衝浪店林立，賞鯨船也從這裡出發。" },
  { name: "漁光島", county: "台南市", at: [22.983, 120.156], types: ["beach", "nature"], hours: [2, 4], desc: "木麻黃防風林與沙灘，看夕陽好地方。" },
  { name: "墾丁白砂灣", county: "屏東縣", at: [21.939, 120.708], types: ["beach"], hours: [2, 5], months: summer, desc: "細白沙灘，人比南灣少。" },
  { name: "澎湖隘門沙灘", county: "澎湖縣", at: [23.57, 119.649], types: ["beach"], hours: [3, 6], months: summer, island: "penghu", desc: "離馬公最近的沙灘，水上活動齊全。" },
  { name: "南寮漁港", county: "新竹市", at: [24.848, 120.926], types: ["beach", "food", "family"], hours: [2, 4], desc: "大草皮放風箏，海鮮直銷中心。" },
  { name: "大安濱海樂園", county: "台中市", at: [24.371, 120.588], types: ["beach", "family"], hours: [3, 5], months: summer, desc: "台中唯一海水浴場，沙灘與風車步道。" },
  { name: "蘇澳冷泉", county: "宜蘭縣", at: [24.596, 121.851], types: ["hotspring"], hours: [2, 3], months: summer, desc: "全台唯一的低溫碳酸泉，夏天泡最過癮。" },
  { name: "東埔溫泉", county: "南投縣", at: [23.564, 120.929], types: ["hotspring", "hiking"], hours: [5, 36], months: winter, desc: "玉山登山口旁，八通關古道起點。" },
  { name: "旭海溫泉", county: "屏東縣", at: [22.2, 120.875], types: ["hotspring", "hiking"], hours: [3, 36], months: winter, desc: "阿朗壹古道入口，海邊野溪溫泉。" },
  { name: "金崙溫泉", county: "台東縣", at: [22.531, 120.968], types: ["hotspring"], hours: [3, 36], months: winter, desc: "排灣族部落裡的溫泉，可順遊多良車站。" },
  { name: "清泉溫泉", county: "新竹縣", at: [24.575, 121.105], types: ["hotspring", "oldstreet"], hours: [3, 36], months: winter, desc: "三毛故居所在的山中溫泉。" },
  { name: "寶來溫泉", county: "高雄市", at: [23.11, 120.703], types: ["hotspring", "camping"], hours: [4, 36], months: winter, desc: "荖濃溪畔溫泉，周邊露營與泛舟。" },
  { name: "安通溫泉", county: "花蓮縣", at: [23.29, 121.345], types: ["hotspring"], hours: [3, 36], months: winter, desc: "日治時期老湯屋，花東縱谷順遊。" },
  { name: "深坑老街", county: "新北市", at: [25.002, 121.616], types: ["oldstreet", "food"], hours: [2, 3], desc: "臭豆腐一條街，順遊炮子崙步道。" },
  { name: "頭城老街", county: "宜蘭縣", at: [24.857, 121.823], types: ["oldstreet"], hours: [2, 3], desc: "宜蘭第一街，搶孤民俗發源地。" },
  { name: "西螺老街", county: "雲林縣", at: [23.799, 120.464], types: ["oldstreet", "food"], hours: [2, 4], desc: "醬油老廠與西螺大橋。" },
  { name: "美濃", county: "高雄市", at: [22.898, 120.542], types: ["oldstreet", "food", "nature"], hours: [3, 10], desc: "客家粄條、油紙傘，冬天波斯菊花海。" },
  { name: "恆春古城", county: "屏東縣", at: [22.002, 120.745], types: ["oldstreet", "food"], hours: [2, 4], desc: "保存完整的清代城門，綠豆蒜必吃。" },
  { name: "奮起湖", county: "嘉義縣", at: [23.505, 120.695], types: ["oldstreet", "food", "nature"], hours: [3, 10], desc: "阿里山小火車中途站，鐵路便當與老街。" },
  { name: "國立傳統藝術中心", county: "宜蘭縣", at: [24.685, 121.825], types: ["oldstreet", "family"], hours: [3, 5], desc: "傳統工藝與戲曲表演，大人小孩都能玩。" },
  { name: "大雪山國家森林遊樂區", county: "台中市", at: [24.279, 120.95], types: ["nature", "hiking", "camping"], hours: [5, 36], desc: "賞鳥天堂，帝雉常在路邊散步。" },
  { name: "雪霸觀霧", county: "新竹縣", at: [24.506, 121.115], types: ["nature", "hiking", "camping"], hours: [5, 36], desc: "雲霧森林與檜山巨木，夏天避暑。" },
  { name: "鯉魚潭", county: "花蓮縣", at: [23.928, 121.508], types: ["nature", "camping", "family"], hours: [3, 36], desc: "湖邊露營、天鵝船，夏夜可賞螢火蟲。" },
  { name: "台北兒童新樂園", county: "台北市", at: [25.097, 121.515], types: ["family"], hours: [3, 5], desc: "捷運就能到，票價親民。" },
  { name: "國立科學工藝博物館", county: "高雄市", at: [22.64, 120.322], types: ["family", "exhibition"], hours: [3, 5], desc: "可以動手玩的科學展示。" },
  { name: "Xpark 水族館", county: "桃園市", at: [25.014, 121.214], types: ["family"], hours: [2, 4], desc: "都會型水族館，企鵝和水母區超夢幻。" },
  { name: "國立故宮博物院", county: "台北市", at: [25.102, 121.548], types: ["exhibition", "family"], hours: [3, 5], desc: "翠玉白菜、肉形石，常態展加特展。" },
  { name: "奇美博物館", county: "台南市", at: [22.934, 120.226], types: ["exhibition", "family"], hours: [3, 5], desc: "西洋藝術、樂器與兵器收藏，建築本身就很好拍。" },
  { name: "台北市立美術館", county: "台北市", at: [25.072, 121.525], types: ["exhibition"], hours: [2, 3], desc: "台灣第一座現代美術館，雙年展重鎮。" },
  { name: "國立台灣美術館", county: "台中市", at: [24.141, 120.663], types: ["exhibition", "family"], hours: [2, 4], desc: "免費參觀，戶外雕塑公園適合散步。" },
  { name: "高雄市立美術館", county: "高雄市", at: [22.657, 120.287], types: ["exhibition", "nature"], hours: [2, 4], desc: "內惟埤濕地環繞的美術館。" },
  { name: "國家兩廳院", county: "台北市", at: [25.036, 121.519], types: ["performance"], hours: [2, 3], desc: "國家戲劇院與音樂廳，週末常有戶外廣場活動。" },
  { name: "衛武營國家藝術文化中心", county: "高雄市", at: [22.623, 120.341], types: ["performance", "family"], hours: [2, 4], desc: "全世界最大單一屋頂劇院，榕樹廣場可野餐。" },
  { name: "台中國家歌劇院", county: "台中市", at: [24.163, 120.64], types: ["performance", "exhibition"], hours: [2, 3], desc: "伊東豊雄設計的曲牆建築，空中花園可免費參觀。" },

  // 親子
  { name: "台北市立動物園", county: "台北市", at: [24.998, 121.581], types: ["family"], hours: [4, 6], desc: "大貓熊館、企鵝館，搭貓空纜車上山。" },
  { name: "國立自然科學博物館", county: "台中市", at: [24.157, 120.666], types: ["family"], hours: [3, 5], desc: "恐龍廳、太空劇場，下雨天也能玩。" },
  { name: "六福村主題遊樂園", county: "新竹縣", at: [24.811, 121.17], types: ["family"], hours: [6, 10], desc: "野生動物園加上刺激遊樂設施。" },
  { name: "麗寶樂園", county: "台中市", at: [24.324, 120.698], types: ["family"], hours: [6, 10], desc: "夏天馬拉灣水樂園、天空之夢摩天輪。" },
  { name: "劍湖山世界", county: "雲林縣", at: [23.623, 120.585], types: ["family"], hours: [6, 10], desc: "中部老牌遊樂園。" },
  { name: "義大遊樂世界", county: "高雄市", at: [22.732, 120.407], types: ["family"], hours: [6, 10], desc: "希臘城堡主題，旁邊就是 Outlet。" },
  { name: "國立海洋生物博物館", county: "屏東縣", at: [22.046, 120.698], types: ["family"], hours: [4, 8], desc: "白鯨與企鵝，還能夜宿海生館。" },
];
