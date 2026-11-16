import { NextRequest, NextResponse } from "next/server";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const dynamic = "force-dynamic";
const sources = {
  irna: { url: "https://www.irna.ir/rss", domain: "irna.ir" },
  mehr: { url: "https://www.mehrnews.com/rss", domain: "mehrnews.com" },
  darsotoon: { url: "https://darsotoon.ir/", domain: "darsotoon.ir" },
} as const;
type Source = keyof typeof sources;
type Headline = { title: string; url: string; publishedAt: string | null; category: string; source: Source };
type Cache = { items: Headline[]; updatedAt: string; fetchedAt: number };
const cache: Partial<Record<Source, Cache>> = {};
const inFlight: Partial<Record<Source, Promise<Cache>>> = {};
const ttl = 15 * 60 * 1000;

async function limitedText(response: Response, limit: number) {
  if (!response.ok || !response.body || Number(response.headers.get("content-length") || 0) > limit) throw new Error("source unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = "", bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new Error("source too large"); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", zwnj: "‌", ndash: "–", mdash: "—" };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? match;
    const number = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : "";
  });
}

async function loadDarsotoon(): Promise<Cache> {
  const response = await fetch(sources.darsotoon.url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ApadanaPortal/1.0)" } });
  const html = await limitedText(response, 1_000_000);
  const token = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/)?.[1];
  const component = html.match(/wire:snapshot="([^"]+)"[^>]*wire:name="feed"[^>]*x-init="\$wire\.__lazyLoad\(&#039;([^&]+)&#039;\)"/);
  const update = html.match(/data-update-uri="(https:\/\/darsotoon\.ir\/livewire-[a-zA-Z0-9]+\/update)"/)?.[1];
  const cookies = response.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]).join("; ");
  if (!token || !component || !update || !cookies) throw new Error("news feed unavailable");
  const result = await fetch(update, { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000), headers: { "Content-Type": "application/json", "X-Livewire": "", Cookie: cookies }, body: JSON.stringify({ _token: token, components: [{ snapshot: decodeHtml(component[1]), updates: {}, calls: [{ path: "", method: "__lazyLoad", params: [component[2]] }] }] }) });
  const data = JSON.parse(await limitedText(result, 4_000_000));
  const rendered = data?.components?.[0]?.effects?.html;
  if (typeof rendered !== "string" || rendered.length > 3_000_000) throw new Error("invalid news feed");
  const items: Headline[] = [], seen = new Set<string>();
  for (const match of rendered.matchAll(/<article\b[^>]*\bdata-news-card\b[^>]*>[\s\S]*?<\/article>/g)) {
    const article = match[0], href = article.match(/href="(https:\/\/darsotoon\.ir\/news\/\d+)"/)?.[1];
    const heading = article.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/)?.[1];
    if (!href || !heading || seen.has(href)) continue;
    const title = decodeHtml(heading.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 240);
    if (!title) continue;
    const dateString = article.match(/<time\b[^>]*\bdatetime="([^"]+)"/)?.[1];
    const date = dateString ? new Date(dateString) : null;
    const category = decodeHtml(article.match(/data-news-category[^>]*>([^<]+)/)?.[1] ?? "عمومی").trim().slice(0, 40);
    seen.add(href); items.push({ title, url: href, publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null, category: category || "عمومی", source: "darsotoon" });
    if (items.length >= 200) break;
  }
  if (!items.length) throw new Error("empty news feed");
  items.sort((first, second) => (second.publishedAt ? Date.parse(second.publishedAt) : 0) - (first.publishedAt ? Date.parse(first.publishedAt) : 0));
  return { items: items.slice(0, 20), updatedAt: new Date().toISOString(), fetchedAt: Date.now() };
}

async function loadFeed(source: Source, url: string, category: string): Promise<Headline[]> {
  const spec = sources[source];
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ApadanaPortal/1.0)", Accept: "application/rss+xml, application/xml, text/xml" } });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 1_000_000) throw new Error("feed unavailable");
  if (!response.body) throw new Error("empty feed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let xml = ""; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1_000_000) { await reader.cancel(); throw new Error("feed too large"); }
    xml += decoder.decode(value, { stream: true });
  }
  xml += decoder.decode();
  if (xml.length > 1_000_000 || /<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("invalid feed");
  const parsed = new XMLParser().parse(xml);
  const raw = parsed?.rss?.channel?.item;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const items: Headline[] = [];
  for (const row of rows.slice(0, 50)) {
    if (typeof row?.title !== "string" || typeof row?.link !== "string") continue;
    try {
      const link = new URL(row.link.trim());
      if (link.protocol !== "https:" || (link.hostname !== spec.domain && !link.hostname.endsWith(`.${spec.domain}`))) continue;
      const title = row.title.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!title) continue;
      const date = new Date(row.pubDate);
      items.push({ title, url: link.href, publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(), category, source });
      if (items.length === 20) break;
    } catch { /* Ignore malformed links. */ }
  }
  if (!items.length) throw new Error("empty feed");
  return items;
}

async function load(source: Source): Promise<Cache> {
  if (source === "darsotoon") return loadDarsotoon();
  const feeds = [
    { source, url: sources[source].url, category: "عمومی" },
    { source: "mehr" as const, url: "https://www.mehrnews.com/rss/tp/9", category: "ورزشی" },
    { source: "mehr" as const, url: "https://www.mehrnews.com/rss/tp/25", category: "اقتصادی" },
    { source: "mehr" as const, url: "https://www.mehrnews.com/rss/tp/5", category: "فناوری" },
    { source: "mehr" as const, url: "https://www.mehrnews.com/rss/tp/48", category: "صنعت و معدن" },
  ];
  const results = await Promise.allSettled(feeds.map(f => loadFeed(f.source, f.url, f.category)));
  const groups = results.map(result => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();
  const items: Headline[] = [];
  for (let i = 0; i < 20 && items.length < 20; i++) {
    for (const group of groups) {
      const item = group[i];
      if (item && !seen.has(item.url)) { seen.add(item.url); items.push(item); }
      if (items.length === 20) break;
    }
  }
  if (!items.length) throw new Error("all feeds unavailable");
  return { items, updatedAt: new Date().toISOString(), fetchedAt: Date.now() };
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") || "irna";
  if (source !== "irna" && source !== "mehr" && source !== "darsotoon") return NextResponse.json({ error: "invalid source" }, { status: 400 });
  const previous = cache[source];
  if (previous && Date.now() - previous.fetchedAt < ttl) return NextResponse.json({ ...previous, stale: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const pending = inFlight[source] ?? (inFlight[source] = load(source));
    const current = await pending;
    cache[source] = current;
    return NextResponse.json({ ...current, stale: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (previous) return NextResponse.json({ ...previous, stale: true }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "feed unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally { delete inFlight[source]; }
}
