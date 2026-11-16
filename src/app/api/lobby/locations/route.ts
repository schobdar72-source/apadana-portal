import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/guard";
export const dynamic="force-dynamic";
export async function GET() {
  const g=await requirePerm("lobby.manage"); if(g.err)return g.err;
  try {return NextResponse.json(await db.location.findMany({select:{id:true,name:true},orderBy:{name:"asc"}}),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"unavailable"},{status:503});}
}
