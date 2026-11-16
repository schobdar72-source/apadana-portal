// SAMPLE DATA ONLY. Remove with the mock layer when the real weather source is connected.
export const mockWeather: Record<string, { temp: number; condition: string; icon: "sun-cloud" | "cloud" | "rain" | "sun" }> = {
  tehran: { temp: 22, condition: "نیمه ابری", icon: "sun-cloud" },
  yazd: { temp: 26, condition: "آفتابی", icon: "sun" },
  saghand: { temp: 25, condition: "آفتابی", icon: "sun" },
  kerman: { temp: 19, condition: "ابری", icon: "cloud" },
  sirjan: { temp: 23, condition: "نیمه ابری", icon: "sun-cloud" },
};
