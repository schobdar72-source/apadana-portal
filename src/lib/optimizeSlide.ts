export async function optimizeSlide(file: File): Promise<{ image: string; bytes: number; width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.");
  if (file.size > 10 * 1024 * 1024) throw new Error("حجم فایل اولیه نباید بیشتر از ۱۰ مگابایت باشد.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("ابعاد تصویر پشتیبانی نمی‌شود.");
    let scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight);
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("پردازش تصویر در این مرورگر ممکن نیست.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (blob && blob.type === "image/webp" && blob.size <= 225_000) {
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("خواندن تصویر ممکن نیست.")); reader.readAsDataURL(blob); });
          return { image: data, bytes: blob.size, width: canvas.width, height: canvas.height };
        }
      }
      scale *= 0.8;
    }
    throw new Error("فشرده‌سازی این تصویر ممکن نشد؛ تصویر ساده‌تر یا کوچک‌تری انتخاب کنید.");
  } catch (e) { throw e instanceof Error ? e : new Error("خواندن تصویر ممکن نیست."); }
  finally { URL.revokeObjectURL(url); }
}
