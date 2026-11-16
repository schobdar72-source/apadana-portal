// داده‌ی نمونه‌ی لابی. فقط وقتی NEXT_PUBLIC_USE_MOCK=true باشد استفاده می‌شود و بعداً حذف می‌شود.
export const lobbySample = {
  welcome: "خوش آمدید",
  posters: [
    { id: 1, title: "نمونه‌ی پوستر ۱", note: "جای‌نگهدار تصویر" },
    { id: 2, title: "نمونه‌ی پوستر ۲", note: "جای‌نگهدار تصویر" },
  ],
  prices: [
    { id: "usd", label: "دلار", value: "۶۴,۲۰۰", unit: "تومان", source: "AlanChand", updated: "۱۷ آبان ۱۴۰۵ ـ ۱۱:۰۵" },
    { id: "coin", label: "سکه امامی", value: "۲۶۳,۹۰۰,۰۰۰", unit: "تومان", source: "AlanChand", updated: "۱۷ آبان ۱۴۰۵ ـ ۱۱:۰۵" },
    { id: "gold18", label: "طلای ۱۸ عیار", value: "۱۱,۲۰۰,۰۰۰", unit: "تومان", source: "Navasan", updated: "۱۷ آبان ۱۴۰۵ ـ ۱۱:۰۰" },
  ],
  ticker: "نمونه‌ی متن نوار خبری؛ داده‌ی واقعی بعد از تأیید منبع جایگزین می‌شود.",
  urgent: "نمونه‌ی تیتر فوری (قرمز)",
  birthdays: [{ name: "نام نمونه", unit: "واحد نمونه" }],
  news: [
    { id: 1, title: "نمونه‌ی خبر مهم اول", source: "منبع نمونه" },
    { id: 2, title: "نمونه‌ی خبر مهم دوم", source: "منبع نمونه" },
  ],
  meal: { name: "نمونه‌ی غذای روز", side: "برنج و سالاد", note: "داده‌ی نمونه" },
  announcements: [
    { id: 101, title: "برنامه‌ی آموزش ایمنی ماه آبان", summary: "خلاصه‌ی کوتاه نمونه برای نمایش در لابی.", long: true },
    { id: 102, title: "اطلاعیه‌ی نمونه‌ی کوتاه", summary: "متن کوتاه نمونه.", long: false },
  ],
};

export const lobbyAdminSample = {
  source: "alanchand" as "navasan" | "alanchand",
  keys: [
    { id: "navasan", name: "نوسان (Navasan)", masked: "••••••••3f9a", enabled: true },
    { id: "alanchand", name: "علان‌چند (AlanChand)", masked: "••••••••b71c", enabled: true },
  ],
  sections: [
  ],
  news: [
    { id: 101, title: "برنامه‌ی آموزش ایمنی ماه آبان", portal: true, lobby: false },
    { id: 102, title: "اطلاعیه‌ی نمونه‌ی کوتاه", portal: true, lobby: true },
  ],
};
