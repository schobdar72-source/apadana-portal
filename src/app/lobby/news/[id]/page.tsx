import { redirect } from "next/navigation";

export default function LegacyAnnouncement({ params }: { params: { id: string } }) {
  redirect(`/announcements?id=${encodeURIComponent(params.id)}`);
}
