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
  // --- добавлено ---
  gold: "#F59E0B",
  goldSoft: "#FDE68A",
  overlay: "rgba(5, 7, 17, 0.78)",
  glassBorder: "rgba(255, 255, 255, 0.14)",
};

export const gradient = {
  accent: ["#7C3AED", "#4F46E5", "#2563EB"] as const,
  screen: [colors.bgTop, colors.bgMid, colors.bgBottom] as const,
  sport: ["#8B5CF6", "#6D28D9"] as const,
  study: ["#3B82F6", "#2563EB"] as const,
  leisure: ["#22D3EE", "#0EA5E9"] as const,
  // --- добавлено ---
  gold: ["#FBBF24", "#F59E0B"] as const,
  danger: ["#F87171", "#DC2626"] as const,
  glass: ["rgba(255,255,255,0.20)", "rgba(255,255,255,0.02)"] as const,
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 26 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/**
 * Единые тайминги анимаций — чтобы не плодить магические числа
 * (280мс, 420мс и т.д.) по разным файлам.
 */
export const durations = {
  fast: 160,
  base: 280,
  slow: 480,
  breathe: 1600,
} as const;

/**
 * Готовые пресеты теней. Единые shadowColor/Opacity/Radius/Offset/elevation,
 * чтобы карточки и бейджи выглядели консистентно на iOS и Android.
 */
export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  /** Цветное свечение под акцентные элементы (кнопки, бейджи, иконки). */
  glow: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  }),
} as const;
