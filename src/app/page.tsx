import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await currentUser())) redirect("/login?next=%2F");
  return <HomeClient />;
}
