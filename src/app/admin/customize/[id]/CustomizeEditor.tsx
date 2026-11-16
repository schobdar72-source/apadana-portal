"use client";
import Link from "next/link";
import "@/styles/customize.css";
import { pageDef, type PageId } from "@/config/pages";
import { usePageCfg } from "@/services/pageCfg";
import { AppShell } from "@/components/layout/AppShell";
import { defaultLoginSettings, validLoginSettings } from "@/config/login";
import { useSharedPortalStore } from "@/services/sharedPortalStore";
import { fileToDataUrl } from "@/services/portalData";

// فرم سفارشی‌سازی یک صفحه به‌همراه پیش‌نمایش زنده. هر تغییر فوراً ذخیره می‌شود.
export function CustomizeEditor({ id }: { id: PageId }) {
  const def = pageDef(id);
  const { cfg, save, reset } = usePageCfg(id);
  const loginStore = useSharedPortalStore("login", defaultLoginSettings);
  const login = validLoginSettings(loginStore.value) ? loginStore.value : defaultLoginSettings;

  return (
    <AppShell title={`سفارشی‌سازی: ${def.label}`} activeHref="/admin/customize">
      <div className="cz-wrap">
        <Link href="/admin/customize" className="cz-go">← همه‌ی صفحه‌ها</Link>

        <div className="cz-form cz-panel">
          {id === "login" && <>
            <p>تنظیمات زیر برای همه کاربران مشترک است. {loginStore.status === "saving" ? "در حال ذخیره…" : loginStore.status === "error" || loginStore.status === "conflict" ? "ذخیره نشد؛ صفحه را بازخوانی کنید." : ""}</p>
            <label className="cz-row"><span>پیام صفحه ورود</span><input value={login.message} maxLength={120} disabled={loginStore.status === "loading"} onChange={e => loginStore.save({ ...login, message: e.target.value })} /></label>
            <label className="cz-row"><span>نشانی تصویر پس‌زمینه</span><input value={login.image.startsWith("data:") ? "" : login.image} maxLength={500} placeholder={login.image.startsWith("data:") ? "تصویر از دستگاه انتخاب شده است" : "/assets/… یا نشانی https"} disabled={loginStore.status === "loading"} onChange={e => loginStore.save({ ...login, image: e.target.value })} /><small>نشانی تصویر داخلی یا نشانی کامل https را وارد کنید.</small></label>
            <label className="cz-row"><span>انتخاب تصویر از دستگاه</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={loginStore.status === "loading"} onChange={async e => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; try { if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("فقط تصاویر JPG، PNG یا WebP پذیرفته می‌شوند."); const image = await fileToDataUrl(file, 300); loginStore.save({ ...login, image }); } catch (error) { alert(error instanceof Error ? error.message : "خواندن تصویر ممکن نیست."); } finally { input.value = ""; } }} /><small>JPG، PNG یا WebP؛ حداکثر ۳۰۰ کیلوبایت.</small></label>
            {login.image && <button type="button" onClick={() => loginStore.save({ ...login, image: "" })}>حذف تصویر انتخاب‌شده</button>}
            <label className="cz-row"><span>راه تماس پشتیبانی</span><input value={login.support} maxLength={120} placeholder="مثلاً داخلی ۱۲۳" disabled={loginStore.status === "loading"} onChange={e => loginStore.save({ ...login, support: e.target.value })} /></label>
            <button type="button" disabled={loginStore.status === "loading"} onClick={() => loginStore.save(defaultLoginSettings)}>بازگردانی تنظیمات مشترک ورود</button>
          </>}
          <label className="cz-row">
            <span>نمایش صفحه</span>
            <input type="checkbox" checked={cfg.enabled} disabled={def.locked}
              onChange={(e) => save({ enabled: e.target.checked })} />
            {def.locked && <small>این صفحه همیشه فعال است</small>}
          </label>

          <label className="cz-row">
            <span>عنوان نمایشی</span>
            <input type="text" value={cfg.title} placeholder={def.label} maxLength={60}
              onChange={(e) => save({ title: e.target.value.trim() })} />
          </label>

          <label className="cz-row">
            <span>رنگ تاکیدی</span>
            <input type="color" value={cfg.accent || "#ffc52e"}
              onChange={(e) => save({ accent: e.target.value })} />
            <button type="button" onClick={() => save({ accent: "" })}>رنگ پیش‌فرض</button>
          </label>

          <label className="cz-row">
            <span>ساعت و آب‌وهوا در هدر</span>
            <input type="checkbox" checked={cfg.showWidgets}
              onChange={(e) => save({ showWidgets: e.target.checked })} />
          </label>

          <div className="cz-actions">
            <button type="button" onClick={() => { if (confirm("همه‌ی تنظیمات این صفحه به پیش‌فرض برگردد؟")) reset(); }}>
              بازگردانی پیش‌فرض‌ها
            </button>
          </div>
        </div>

        <h2 className="cz-lead">پیش‌نمایش</h2>
        <div className="cz-preview">
          <iframe src={def.href} title={`پیش‌نمایش ${def.label}`} />
        </div>
      </div>
    </AppShell>
  );
}
