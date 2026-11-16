export type HomeSlide = { id: string; image: string; enabled: boolean; style: "light" | "dark" | "artwork" };
export const defaultHomeSlides: HomeSlide[] = [
  { id: "welcome", image: "/assets/mining/home-reference-v2-optimized.jpg", enabled: true, style: "light" },
  { id: "quarry", image: "/assets/website_background_01_quarry.webp", enabled: true, style: "dark" },
  { id: "banner", image: "/assets/lobby/header_bg.webp", enabled: true, style: "artwork" },
];
export function validHomeSlides(value: unknown): value is HomeSlide[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) return false;
  return value.every(s => s && typeof s.id === "string" && s.id.length > 0 && s.id.length <= 80 && typeof s.enabled === "boolean" && ["light", "dark", "artwork"].includes(s.style) && typeof s.image === "string" && s.image.length <= 310_000 && (/^\/assets\/[a-zA-Z0-9_./-]+$/.test(s.image) || /^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(s.image))) && value.some(s => s.enabled) && new Set(value.map(s => s.id)).size === value.length;
}
