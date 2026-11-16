/** Only same-site paths or explicit HTTP(S) addresses can be opened as links. */
export function safePortalLink(value: string): string | null {
  const link = value.trim();
  if (!link || /[\u0000-\u0020\u007f\\]/.test(link)) return null;
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  try {
    const url = new URL(link);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? link : null;
  } catch { return null; }
}
