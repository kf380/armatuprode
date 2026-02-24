export interface Sticker {
  key: string;
  emoji: string;
  label: string;
  category: "football" | "cargadas" | "ranking" | "boosters";
}

export const STICKERS: Sticker[] = [
  // Football (5)
  { key: "gol", emoji: "⚽", label: "Gol", category: "football" },
  { key: "futbol_fire", emoji: "🔥", label: "Fuego", category: "football" },
  { key: "trophy", emoji: "🏆", label: "Trofeo", category: "football" },
  { key: "red_card", emoji: "🟥", label: "Roja", category: "football" },
  { key: "stadium", emoji: "🏟️", label: "Estadio", category: "football" },

  // Cargadas (5)
  { key: "laugh", emoji: "😂", label: "Jaja", category: "cargadas" },
  { key: "clown", emoji: "🤡", label: "Payaso", category: "cargadas" },
  { key: "skull", emoji: "💀", label: "Muerto", category: "cargadas" },
  { key: "cry", emoji: "😭", label: "Llora", category: "cargadas" },
  { key: "wave", emoji: "👋", label: "Chau", category: "cargadas" },

  // Ranking (5)
  { key: "crown", emoji: "👑", label: "Rey", category: "ranking" },
  { key: "rocket", emoji: "🚀", label: "Cohete", category: "ranking" },
  { key: "chart_up", emoji: "📈", label: "Sube", category: "ranking" },
  { key: "chart_down", emoji: "📉", label: "Baja", category: "ranking" },
  { key: "target", emoji: "🎯", label: "Exacto", category: "ranking" },

  // Boosters (5)
  { key: "star", emoji: "⭐", label: "Estrella", category: "boosters" },
  { key: "lightning", emoji: "⚡", label: "Rayo", category: "boosters" },
  { key: "shield", emoji: "🛡️", label: "Escudo", category: "boosters" },
  { key: "gem", emoji: "💎", label: "Gema", category: "boosters" },
  { key: "muscle", emoji: "💪", label: "Fuerza", category: "boosters" },
];

export const VALID_STICKER_KEYS = new Set(STICKERS.map((s) => s.key));

export const STICKERS_BY_CATEGORY = STICKERS.reduce(
  (acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  },
  {} as Record<string, Sticker[]>,
);
