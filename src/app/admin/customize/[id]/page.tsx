import { notFound } from "next/navigation";
import { pageDefs, type PageId } from "@/config/pages";
import { CustomizeEditor } from "./CustomizeEditor";

export default function Page({ params }: { params: { id: string } }) {
  const def = pageDefs.find((p) => p.id === params.id);
  if (!def) notFound();
  return <CustomizeEditor id={def.id as PageId} />;
}
