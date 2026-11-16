import { NextRequest, NextResponse } from "next/server";

export const dynamic="force-dynamic";
// فقط برای شناسایی نمونه جداگانه آزمون؛ هیچ داده یا اطلاعات اتصال برنمی‌گرداند.
export async function GET(request:NextRequest){
 const token=process.env.ITSM_TEST_TOKEN||'',url=process.env.DATABASE_URL||'';
 let database='';try{database=new URL(url).pathname;}catch{/* invalid config */}
 if(process.env.NODE_ENV==='production'||process.env.ITSM_TEST_ISOLATED!=='1'||!/^[a-f0-9]{32}$/.test(token)||request.headers.get('x-itsm-test-token')!==token||!/^\/apadana_itsm_test_[a-f0-9]{12}$/.test(database))return new NextResponse(null,{status:404});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
