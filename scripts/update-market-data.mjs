import { mkdir, writeFile } from "node:fs/promises";

const listUrl = "https://adnacf.co.kr/web/bbs/board.php?bo_table=price2025&page=1&sod=desc&sop=and&sst=wr_datetime";
const response = await fetch(listUrl, { headers: { "user-agent": "AndongApplePrices/1.0" } });
if (!response.ok) throw new Error(`목록을 불러오지 못했습니다: ${response.status}`);
const list = await response.text();
const ids = [...list.matchAll(/wr_id=(\d+)/g)].map((match) => match[1]);
if (!ids.length) throw new Error("최신 시세표 번호를 찾지 못했습니다.");
const link = `${listUrl}&wr_id=${ids[0]}`;
const pageResponse = await fetch(link, { headers: { "user-agent": "AndongApplePrices/1.0" } });
if (!pageResponse.ok) throw new Error(`시세표를 불러오지 못했습니다: ${pageResponse.status}`);
const page = await pageResponse.text();
const plain = page.replace(/<br\s*\/?>/gi, "\n").replace(/<\/tr>/gi, "\n").replace(/<\/t[dh]>/gi, "\t").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const date = plain.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/)?.slice(1).map(Number);
if (!date) throw new Error("시세표 날짜를 읽지 못했습니다.");
const textDate = `${date[0]}년 ${date[1]}월 ${date[2]}일`;
const boxes = [...plain.matchAll(/(?:금일|전일)\s*사과\s*:\s*([\d,]+)\s*상자/g)].map((match) => match[1]);
const wanted = new Set(["홍로", "아리수", "시나노골드", "양광", "홍옥", "루비에스"]);
const varieties = new Map();
let variety = "";
const clean = (value) => value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
for (const row of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1])).filter(Boolean);
  if (!cells.length) continue;
  if (cells.length === 7) { variety = wanted.has(cells[0]) ? cells.shift() : ""; }
  if (!variety || cells.length < 6) continue;
  const [grade, weight, qty, high, low, avg] = cells;
  if (!/^\d+(?:\.\d+)?$/.test(weight) || !/[\d,]+/.test(avg)) continue;
  const number = (value) => Number(value.replace(/,/g, ""));
  if (number(avg) > 0) varieties.set(variety, [...(varieties.get(variety) ?? []), [grade, weight, qty, high, low, avg]]);
}
if (varieties.size < 2) throw new Error("공시표의 품종별 시세를 읽지 못했습니다.");
await mkdir("dist/data", { recursive: true });
await writeFile("dist/data/latest.json", JSON.stringify({ date: textDate, today: boxes[0] ?? "-", yesterday: boxes[1] ?? "-", link, varieties: [...varieties].map(([name, rows]) => ({ name, rows })) }, null, 2) + "\n");
console.log(`${textDate} 시세표 저장 완료 (${varieties.size}개 품종)`);
