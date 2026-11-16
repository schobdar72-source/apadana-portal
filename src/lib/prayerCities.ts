import provinces from "@/data/iran-prayer-cities.json";

export const prayerProvinces = provinces.map(province => ({ ...province, cities: province.slug.toLowerCase() === "yazd" && !province.cities.some(city => city.name === "ساغند") ? [...province.cities, { name: "ساغند", latitude: 31.98, longitude: 55.42 }] : province.cities }));

export function findPrayerCity(province: string, city: string) {
  return prayerProvinces.find(item => item.slug === province)?.cities.find(item => item.name === city);
}
