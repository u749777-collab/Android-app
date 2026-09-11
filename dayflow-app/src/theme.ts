export const colors = {
  bgTop: "#1A1333",
  bgMid: "#0D1226",
  bgBottom: "#080F1E",
  card: "#16182B",
  cardSoft: "#1B1E33",
  border: "#2A2D45",
  borderSoft: "#23263A",
  text: "#F7F7FC",
  textDim: "#8A8EA6",
  textFaint: "#6C7089",
  violet: "#7C3AED",
  violetSoft: "#A78BFA",
  blue: "#2563EB",
  blueSoft: "#60A5FA",
  cyan: "#22D3EE",
  green: "#5FD39B",
  red: "#F27C8D",
};

export const gradient = {
  accent: ["#7C3AED", "#4F46E5", "#2563EB"] as const,
  screen: [colors.bgTop, colors.bgMid, colors.bgBottom] as const,
  sport: ["#8B5CF6", "#6D28D9"] as const,
  study: ["#3B82F6", "#2563EB"] as const,
  leisure: ["#22D3EE", "#0EA5E9"] as const,
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 26 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
