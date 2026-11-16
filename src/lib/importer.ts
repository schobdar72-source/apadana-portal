// Dependency-free reader for .csv and .xlsx (uses the browser's DecompressionStream).
export type Table = string[][];

export const parseCsv = (text: string): Table => {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Table = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = ""; rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
};

const inflateRaw = async (data: Uint8Array) => {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const unzip = async (buf: ArrayBuffer) => {
  const d = new Uint8Array(buf);
  const v = new DataView(buf);
  let e = d.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("فایل اکسل معتبر نیست.");
  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const out: Record<string, Uint8Array> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(d.subarray(p + 46, p + 46 + nlen));
    const dataStart = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
    const raw = d.subarray(dataStart, dataStart + csize);
    if (/^xl\/(worksheets\/sheet\d+|sharedStrings)\.xml$|^xl\/workbook\.xml$/.test(name))
      out[name] = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : (() => { throw new Error("نوع فشرده‌سازی پشتیبانی نمی‌شود."); })();
    p += 46 + nlen + xlen + clen;
  }
  return out;
};

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const textOf = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join("");
const colIdx = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

export const parseXlsx = async (buf: ArrayBuffer): Promise<Table> => {
  const z = await unzip(buf);
  const dec = new TextDecoder();
  const sheetName = Object.keys(z).filter((k) => k.startsWith("xl/worksheets/")).sort()[0];
  if (!sheetName) throw new Error("برگه‌ای در فایل پیدا نشد.");
  const shared = z["xl/sharedStrings.xml"]
    ? [...dec.decode(z["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => textOf(m[1] ?? ""))
    : [];
  const xml = dec.decode(z[sheetName]);
  const rows: Table = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(cm[1])?.[1];
      const t = /t="(\w+)"/.exec(cm[1])?.[1];
      const inner = cm[2] ?? "";
      let val = "";
      if (t === "inlineStr") val = textOf(inner);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        val = t === "s" ? shared[+v] ?? "" : unesc(v);
      }
      const ci = ref ? colIdx(ref) : row.length;
      while (row.length < ci) row.push("");
      row[ci] = val;
    }
    rows.push(row);
  }
  return rows;
};

export const readTableFile = async (file: File): Promise<Table> => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  throw new Error("فقط فایل xlsx یا csv پذیرفته می‌شود.");
};
