import { promises as fs } from "fs";
import path from "path";

export type EmpConfig = { source: "hr" | "api"; apiUrl: string; apiToken: string };
const CFG_FILE = path.join(process.cwd(), "data", "employees-config.json");

/** تنظیمات ذخیره‌شده در فایل؛ اگر نباشد، از متغیرهای محیطی (پیش‌فرض استقرار) خوانده می‌شود. */
export async function readConfig(): Promise<EmpConfig> {
  const env: EmpConfig = {
    source: process.env.EMPLOYEE_SOURCE === "api" ? "api" : "hr",
    apiUrl: process.env.EMPLOYEE_API_URL ?? "",
    apiToken: process.env.EMPLOYEE_API_TOKEN ?? "",
  };
  try {
    const c = JSON.parse(await fs.readFile(CFG_FILE, "utf8"));
    return { source: c.source === "api" ? "api" : "hr", apiUrl: String(c.apiUrl ?? ""), apiToken: String(c.apiToken ?? "") };
  } catch {
    return env;
  }
}

export async function writeConfig(c: EmpConfig) {
  await fs.mkdir(path.dirname(CFG_FILE), { recursive: true });
  await fs.writeFile(CFG_FILE, JSON.stringify(c, null, 2), "utf8");
}
