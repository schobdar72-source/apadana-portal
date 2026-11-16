// تست‌های نوشتنی فقط روی پایگاه و سرور جداگانه‌ای که ابزار پذیرش ساخته اجرا می‌شوند.
function isolatedTestBase(){
 if(process.env.ITSM_TEST_ISOLATED!=='1' || !process.env.DATABASE_URL || !process.env.ITSM_TEST_BASE_URL || !/^[a-f0-9]{32}$/.test(process.env.ITSM_TEST_TOKEN||''))throw Error('Run this test only through npm run itsm:acceptance.');
 const db=new URL(process.env.DATABASE_URL), app=new URL(process.env.ITSM_TEST_BASE_URL);
 if(!/^\/apadana_itsm_test_[a-f0-9]{12}$/.test(db.pathname) || !['http:','https:'].includes(app.protocol) || !['127.0.0.1','localhost','[::1]'].includes(app.hostname) || !app.port || app.port==='3000' || app.username || app.password || app.pathname!=='/' || app.search || app.hash)throw Error('Unsafe ITSM test database or server URL.');
 return app.origin;
}
async function verifyTestServer(){const response=await fetch(isolatedTestBase()+'/api/itsm/test-identity',{headers:{'x-itsm-test-token':process.env.ITSM_TEST_TOKEN}});if(!response.ok)throw Error('The isolated ITSM server could not be verified.');}
module.exports={isolatedTestBase,verifyTestServer};
