import { exportXlsx } from "@/lib/exporter";

export const phonebookHeaders = ["نام و نام خانوادگی", "کد پرسنلی", "محل خدمت", "جزئیات محل استقرار", "واحد سازمانی", "سمت", "شماره داخلی", "شماره مستقیم"];

export function exportPhonebookExcel(rows: string[][]) {
  exportXlsx("phonebook", phonebookHeaders, rows);
}

export async function exportPhonebookImage(rows: string[][], filters: string) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ساخت تصویر در این مرورگر ممکن نیست.");
  const widths = [265, 140, 220, 240, 220, 265, 150, 230];
  const margin = 40;
  const width = widths.reduce((sum, item) => sum + item, 0) + margin * 2;
  context.font = '22px Tahoma, Arial, sans-serif';
  const wrap = (value: string, maxWidth: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of (value || "—").split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
      while (context.measureText(line).width > maxWidth && line.length > 1) {
        let end = line.length - 1;
        while (end > 1 && context.measureText(line.slice(0, end)).width > maxWidth) end--;
        lines.push(line.slice(0, end)); line = line.slice(end);
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const filterLines = wrap(filters, width - 2 * margin - 30);
  const wrapped = rows.map(row => row.map((cell, index) => wrap(cell, widths[index] - 24)));
  const rowHeights = wrapped.map(row => Math.max(64, ...row.map(lines => lines.length * 32 + 28)));
  const headerY = 145 + filterLines.length * 28;
  const height = headerY + 62 + rowHeights.reduce((sum, item) => sum + item, 0) + 40;
  if (height > 30000) throw new Error("تعداد نتایج برای یک تصویر زیاد است؛ لطفاً فیلتر دقیق‌تری انتخاب کنید.");
  canvas.width = width; canvas.height = height;
  context.direction = "rtl"; context.textAlign = "right"; context.textBaseline = "middle";
  context.fillStyle = "#e4e4e0"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#303a3b"; context.fillRect(0, 0, width, 100);
  context.fillStyle = "#ffc43b"; context.fillRect(width - 10, 0, 10, 100);
  context.fillStyle = "#fff"; context.font = 'bold 32px Tahoma, Arial, sans-serif'; context.fillText("دفترچه تلفن سازمان", width - margin, 50);
  context.font = '20px Tahoma, Arial, sans-serif'; context.fillStyle = "#dce0dc"; context.textAlign = "left";
  context.fillText(new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date()), margin, 50);
  context.textAlign = "right"; context.fillStyle = "#4c5553";
  filterLines.forEach((line, index) => context.fillText(line, width - margin, 125 + index * 28));
  context.fillStyle = "#cfd3d1"; context.fillRect(margin, headerY, width - margin * 2, 62);
  context.fillStyle = "#303738"; context.font = 'bold 20px Tahoma, Arial, sans-serif';
  let right = width - margin;
  phonebookHeaders.forEach((header, index) => { context.fillText(header, right - 12, headerY + 31); right -= widths[index]; });
  let top = headerY + 62;
  wrapped.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    context.fillStyle = rowIndex % 2 ? "#dfe2df" : "#e8eae8"; context.fillRect(margin, top, width - margin * 2, rowHeight);
    context.font = '22px Tahoma, Arial, sans-serif'; context.fillStyle = "#303738";
    let columnRight = width - margin;
    row.forEach((lines, index) => { lines.forEach((line, lineIndex) => context.fillText(line, columnRight - 12, top + 25 + lineIndex * 32)); columnRight -= widths[index]; });
    top += rowHeight;
  });
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("ساخت تصویر ممکن نشد؛ لطفاً فیلتر دقیق‌تری انتخاب کنید.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "phonebook.png"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
