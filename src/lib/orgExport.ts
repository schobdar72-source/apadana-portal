// SVG -> SVG / PNG / PDF (dependency-free). PDF = one page with the diagram embedded as JPEG.
const dl = (blob: Blob, name: string) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };

const svgText = (svg: SVGSVGElement) => {
  const c = svg.cloneNode(true) as SVGSVGElement;
  c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  c.removeAttribute("style");
  return new XMLSerializer().serializeToString(c);
};
export const exportSvg = (svg: SVGSVGElement, name: string) => dl(new Blob([svgText(svg)], { type: "image/svg+xml" }), `${name}.svg`);

const toCanvas = (svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> => new Promise((res, rej) => {
  const w = Number(svg.getAttribute("width")), h = Number(svg.getAttribute("height"));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = w * scale; cv.height = h * scale;
    const x = cv.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height);
    res(cv);
  };
  img.onerror = rej;
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText(svg));
});

export const exportPng = async (svg: SVGSVGElement, name: string) => {
  const cv = await toCanvas(svg);
  cv.toBlob((b) => b && dl(b, `${name}.png`), "image/png");
};

export const exportPdf = async (svg: SVGSVGElement, name: string) => {
  const cv = await toCanvas(svg, 2);
  const jpg = Uint8Array.from(atob(cv.toDataURL("image/jpeg", 0.92).split(",")[1]), (c) => c.charCodeAt(0));
  const iw = cv.width, ih = cv.height;
  const land = iw >= ih, PW = land ? 842 : 595, PH = land ? 595 : 842, m = 24;
  const k = Math.min((PW - 2 * m) / iw, (PH - 2 * m) / ih), dw = iw * k, dh = ih * k;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const offs: number[] = []; let len = 0;
  const push = (u: Uint8Array) => { parts.push(u); len += u.length; };
  const t = (s: string) => push(enc.encode(s));
  const obj = (n: number, body: string | Uint8Array[]) => { offs[n] = len; t(`${n} 0 obj\n`); typeof body === "string" ? t(body) : body.forEach(push); t("\nendobj\n"); };
  t("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const cs = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${((PW - dw) / 2).toFixed(2)} ${((PH - dh) / 2).toFixed(2)} cm /Im0 Do Q`;
  obj(4, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
  obj(5, [enc.encode(`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`), jpg, enc.encode("\nendstream")]);
  const xr = len;
  t(`xref\n0 6\n0000000000 65535 f \n` + [1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, "0") + " 00000 n \n").join(""));
  t(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  dl(new Blob(parts as BlobPart[], { type: "application/pdf" }), `${name}.pdf`);
};
