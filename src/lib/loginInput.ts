export function normalizeEmployeeCode(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660))).trim();
}

export function safeLoginDestination(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u0020\u007f\\]/.test(value)) return "/";
  return value;
}
