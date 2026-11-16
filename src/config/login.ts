export type LoginSettings = { image: string; message: string; support: string };
export const defaultLoginSettings: LoginSettings = { image: "", message: "با هم، برای فردایی پایدارتر", support: "" };
export function validLoginSettings(value: unknown): value is LoginSettings {
  if (!value || typeof value !== "object") return false;
  const v = value as LoginSettings;
  return typeof v.image === "string" && v.image.length <= 500_000 && typeof v.message === "string" && v.message.length <= 120 && typeof v.support === "string" && v.support.length <= 120;
}
