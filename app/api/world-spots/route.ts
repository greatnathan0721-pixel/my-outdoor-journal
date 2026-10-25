import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

// 沒有手動整理的國家，改從 Wikidata 查知名景點
const ENDPOINT = "https://query.wikidata.org/sparql";
const HEADERS = {
  Accept: "application/sparql-results+json",
  "User-Agent": "my-outdoor-journal/0.1 (Next.js learning project)",
};

// 每個旅行目的對應的 Wikidata 查詢條件（大條件合在一起查會逾時，所以分開查）
const PATTERNS: Record<string, string[]> = {
  n: ["wdt:P31 wd:Q46169", "wdt:P31 wd:Q34038", "wdt:P31 wd:Q23397"], // 國家公園、瀑布、湖泊
  h: ["wdt:P31 wd:Q8502", "wdt:P31 wd:Q8072"], // 山、火山
  b: ["wdt:P31 wd:Q40080", "wdt:P31 wd:Q23442"], // 海灘、島嶼
  c: ["wdt:P1435 wd:Q9259", "wdt:P31 wd:Q839954"], // 世界遺產、考古遺址
  f: ["DISH"], // 這個國家的傳統料理
  u: ["wdt:P31 wd:Q515"], // 城市
  a: ["wdt:P31 wd:Q33506", "wdt:P31 wd:Q207694"], // 博物館、美術館
  x: ["wdt:P31 wd:Q130003", "wdt:P31 wd:Q8072"], // 滑雪場、火山
  k: ["wdt:P31 wd:Q43501", "wdt:P31 wd:Q194195"], // 動物園、遊樂園
};

export type WikiSpot = {
  id: string;
  name: string;
  desc: string;
  image: string | null;
  purpose: string;
  link: string;
};

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Binding[]> {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Wikidata 回應 ${res.status}`);
  return (await res.json()).results.bindings;
}

// 一次最多同時送 4 個查詢，避免被 Wikidata 擋
async function limited<T>(tasks: (() => Promise<T>)[], size = 4): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...(await Promise.all(tasks.slice(i, i + size).map((t) => t()))));
  }
  return results;
}

async function getSpots(alpha2: string, purposeKey: string): Promise<WikiSpot[]> {
  "use cache";
  cacheLife("weeks");

  const [country] = await sparql(`SELECT ?c WHERE { ?c wdt:P297 "${alpha2}" }`);
  const qid = country?.c?.value.split("/").pop();
  if (!qid) return [];

  const jobs = [...purposeKey.split(""), ""].flatMap((p) =>
    (p ? PATTERNS[p] : ["wdt:P31 wd:Q570116"]).map((pattern) => ({ purpose: p, pattern })),
  );

  const lists = await limited(
    jobs.map(({ purpose, pattern }) => async () => {
      const where =
        pattern === "DISH"
          ? `?item wdt:P31 wd:Q746549 ; wdt:P495 wd:${qid} .`
          : `?item ${pattern} ; wdt:P17 wd:${qid} .`;
      const rows = await sparql(
        `SELECT ?item ?l WHERE { ${where} ?item wikibase:sitelinks ?l . } ORDER BY DESC(?l) LIMIT 6`,
      ).catch(() => []);
      return rows.map((r) => ({ id: r.item!.value.split("/").pop()!, links: Number(r.l!.value), purpose }));
    }),
  );

  // 同一個景點可能出現在好幾個查詢裡，留下有對應旅行目的的那筆
  const byId = new Map<string, { links: number; purpose: string }>();
  for (const row of lists.flat()) {
    const prev = byId.get(row.id);
    if (!prev || (!prev.purpose && row.purpose)) byId.set(row.id, row);
  }
  if (byId.size === 0) return [];

  const details = await sparql(`
    SELECT ?item ?itemLabel ?itemDescription (SAMPLE(?img) AS ?image) (SAMPLE(?zh) AS ?zhwiki) WHERE {
      VALUES ?item { ${[...byId.keys()].map((id) => `wd:${id}`).join(" ")} }
      OPTIONAL { ?item wdt:P18 ?img }
      OPTIONAL { ?zh schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-tw,zh-hant,zh,en". }
    } GROUP BY ?item ?itemLabel ?itemDescription`);

  return details
    .map((d) => {
      const id = d.item!.value.split("/").pop()!;
      const image = d.image?.value;
      return {
        id,
        name: d.itemLabel?.value ?? id,
        desc: d.itemDescription?.value ?? "",
        image: image ? `${image.replace("http://", "https://")}?width=480` : null,
        purpose: byId.get(id)!.purpose,
        link: d.zhwiki?.value ? `${d.zhwiki.value}?variant=zh-tw` : `https://www.wikidata.org/wiki/${id}`,
        links: byId.get(id)!.links,
      };
    })
    .filter((s) => s.name !== s.id) // 沒有任何語言名稱的資料略過
    .sort((a, b) => Number(Boolean(b.purpose)) - Number(Boolean(a.purpose)) || b.links - a.links)
    .slice(0, 12)
    .map(({ id, name, desc, image, purpose, link }) => ({ id, name, desc, image, purpose, link }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const country = params.get("country") ?? "";
  // 排序後當快取的 key，同樣的組合不用重查
  const purposeKey = [...new Set((params.get("purposes") ?? "").split(","))]
    .filter((p) => p in PATTERNS)
    .sort()
    .join("");

  if (!/^[A-Z]{2}$/.test(country)) {
    return Response.json({ error: "國碼格式不正確" }, { status: 400 });
  }

  try {
    return Response.json({ spots: await getSpots(country, purposeKey) });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
