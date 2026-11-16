type ScopedAnnouncement = { portal?: boolean; lobby?: boolean; from?: string; to?: string; date?: string; locationIds?: number[]; disabled?: boolean };

export function canReadAnnouncement(item: ScopedAnnouncement, audience: "portal" | "lobby" | "archive" | "current", today: string, locationId: number | null) {
  const destination = audience === "lobby" ? item.lobby : audience === "portal" || audience === "archive" ? item.portal : item.portal || item.lobby;
  const matchesLocation = !item.locationIds?.length || (locationId !== null && item.locationIds.includes(locationId));
  return !item.disabled && !!destination && matchesLocation && (!item.from || item.from <= today) && (audience === "archive" ? (!item.date || item.date <= today) : (!item.to || item.to >= today));
}
