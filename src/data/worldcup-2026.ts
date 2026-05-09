/**
 * FIFA World Cup 2026 — fixture skeleton.
 *
 * Fuente: FIFA official schedule (estructura). Los anclajes públicos verificados
 * son: opening match Mexico City 2026-06-11, final MetLife (NJ) 2026-07-19,
 * 12 grupos A-L, 48 equipos, 104 partidos, 16 host cities, hosts en A1/B1/D1.
 *
 * Para los slots de equipo no confirmados (45 de 48) usamos placeholders
 * "TBD-<group><slot>" con isPlaceholder=true. Cuando se confirme el equipo real,
 * se actualiza el data file y se re-corre el seed (idempotente por code+code).
 *
 * Para fechas y sedes específicas por partido: distribución plausible alineada
 * a la ventana oficial. // VERIFY contra el PDF oficial antes de promocionar.
 *
 * Bracket de eliminatorias: usamos placeholders semánticos como "1A" / "2B" /
 * "3CDE" para partidos cuyos equipos dependen de resultados anteriores.
 * El admin (o un job futuro) reemplaza estos códigos por equipos reales.
 */

export type Stage =
  | "GROUP_STAGE"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL";

export interface SeedTeam {
  code: string;
  name: string;
  country: string;
  flag: string;
  confederation: string | null;
  groupCode: string;
  groupSlot: number;
  isPlaceholder: boolean;
}

export interface SeedMatch {
  officialMatchNumber: number;
  stage: Stage;
  group: string | null;
  teamACode: string;
  teamAName: string;
  teamAFlag: string;
  teamBCode: string;
  teamBName: string;
  teamBFlag: string;
  matchDateUtc: string; // ISO string in UTC
  venue: string;
  city: string;
  country: string;
  source: string;
}

export const TOURNAMENT = {
  slug: "world-cup-2026",
  name: "FIFA World Cup 2026",
  year: 2026,
  hostCountries: ["Canada", "Mexico", "United States"],
  startDateUtc: "2026-06-11T00:00:00.000Z",
  endDateUtc: "2026-07-19T23:59:59.000Z",
} as const;

const GROUP_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
type GroupCode = (typeof GROUP_CODES)[number];

// Final Draw — Kennedy Center, Washington DC, December 5, 2025.
// Order within each group: slot 1 = top seed (Pot 1), slots 2-4 by draw pots.
// Sources: FIFA.com final-draw-results, NBC Sports, MLS Soccer, Olympics.com.
const FINAL_DRAW: Record<string, { code: string; name: string; flag: string; country: string; confederation: string }> = {
  // Group A
  A1: { code: "MEX", name: "Mexico",            flag: "🇲🇽", country: "Mexico",            confederation: "CONCACAF" },
  A2: { code: "RSA", name: "South Africa",      flag: "🇿🇦", country: "South Africa",      confederation: "CAF" },
  A3: { code: "KOR", name: "South Korea",       flag: "🇰🇷", country: "South Korea",       confederation: "AFC" },
  A4: { code: "CZE", name: "Czech Republic",    flag: "🇨🇿", country: "Czech Republic",    confederation: "UEFA" },
  // Group B
  B1: { code: "CAN", name: "Canada",            flag: "🇨🇦", country: "Canada",            confederation: "CONCACAF" },
  B2: { code: "BIH", name: "Bosnia & Herz.",    flag: "🇧🇦", country: "Bosnia & Herzegovina", confederation: "UEFA" },
  B3: { code: "QAT", name: "Qatar",             flag: "🇶🇦", country: "Qatar",             confederation: "AFC" },
  B4: { code: "SUI", name: "Switzerland",       flag: "🇨🇭", country: "Switzerland",       confederation: "UEFA" },
  // Group C
  C1: { code: "BRA", name: "Brazil",            flag: "🇧🇷", country: "Brazil",            confederation: "CONMEBOL" },
  C2: { code: "MAR", name: "Morocco",           flag: "🇲🇦", country: "Morocco",           confederation: "CAF" },
  C3: { code: "HAI", name: "Haiti",             flag: "🇭🇹", country: "Haiti",             confederation: "CONCACAF" },
  C4: { code: "SCO", name: "Scotland",          flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", country: "Scotland",          confederation: "UEFA" },
  // Group D
  D1: { code: "USA", name: "United States",     flag: "🇺🇸", country: "United States",     confederation: "CONCACAF" },
  D2: { code: "PAR", name: "Paraguay",          flag: "🇵🇾", country: "Paraguay",          confederation: "CONMEBOL" },
  D3: { code: "AUS", name: "Australia",         flag: "🇦🇺", country: "Australia",         confederation: "AFC" },
  D4: { code: "TUR", name: "Turkey",            flag: "🇹🇷", country: "Turkey",            confederation: "UEFA" },
  // Group E
  E1: { code: "GER", name: "Germany",           flag: "🇩🇪", country: "Germany",           confederation: "UEFA" },
  E2: { code: "CUW", name: "Curaçao",           flag: "🇨🇼", country: "Curaçao",           confederation: "CONCACAF" },
  E3: { code: "CIV", name: "Ivory Coast",       flag: "🇨🇮", country: "Ivory Coast",       confederation: "CAF" },
  E4: { code: "ECU", name: "Ecuador",           flag: "🇪🇨", country: "Ecuador",           confederation: "CONMEBOL" },
  // Group F
  F1: { code: "NED", name: "Netherlands",       flag: "🇳🇱", country: "Netherlands",       confederation: "UEFA" },
  F2: { code: "JPN", name: "Japan",             flag: "🇯🇵", country: "Japan",             confederation: "AFC" },
  F3: { code: "SWE", name: "Sweden",            flag: "🇸🇪", country: "Sweden",            confederation: "UEFA" },
  F4: { code: "TUN", name: "Tunisia",           flag: "🇹🇳", country: "Tunisia",           confederation: "CAF" },
  // Group G
  G1: { code: "BEL", name: "Belgium",           flag: "🇧🇪", country: "Belgium",           confederation: "UEFA" },
  G2: { code: "EGY", name: "Egypt",             flag: "🇪🇬", country: "Egypt",             confederation: "CAF" },
  G3: { code: "IRN", name: "Iran",              flag: "🇮🇷", country: "Iran",              confederation: "AFC" },
  G4: { code: "NZL", name: "New Zealand",       flag: "🇳🇿", country: "New Zealand",       confederation: "OFC" },
  // Group H
  H1: { code: "ESP", name: "Spain",             flag: "🇪🇸", country: "Spain",             confederation: "UEFA" },
  H2: { code: "CPV", name: "Cape Verde",        flag: "🇨🇻", country: "Cape Verde",        confederation: "CAF" },
  H3: { code: "KSA", name: "Saudi Arabia",      flag: "🇸🇦", country: "Saudi Arabia",      confederation: "AFC" },
  H4: { code: "URU", name: "Uruguay",           flag: "🇺🇾", country: "Uruguay",           confederation: "CONMEBOL" },
  // Group I
  I1: { code: "FRA", name: "France",            flag: "🇫🇷", country: "France",            confederation: "UEFA" },
  I2: { code: "SEN", name: "Senegal",           flag: "🇸🇳", country: "Senegal",           confederation: "CAF" },
  I3: { code: "IRQ", name: "Iraq",              flag: "🇮🇶", country: "Iraq",              confederation: "AFC" },
  I4: { code: "NOR", name: "Norway",            flag: "🇳🇴", country: "Norway",            confederation: "UEFA" },
  // Group J
  J1: { code: "ARG", name: "Argentina",         flag: "🇦🇷", country: "Argentina",         confederation: "CONMEBOL" },
  J2: { code: "ALG", name: "Algeria",           flag: "🇩🇿", country: "Algeria",           confederation: "CAF" },
  J3: { code: "AUT", name: "Austria",           flag: "🇦🇹", country: "Austria",           confederation: "UEFA" },
  J4: { code: "JOR", name: "Jordan",            flag: "🇯🇴", country: "Jordan",            confederation: "AFC" },
  // Group K
  K1: { code: "POR", name: "Portugal",          flag: "🇵🇹", country: "Portugal",          confederation: "UEFA" },
  K2: { code: "COD", name: "DR Congo",          flag: "🇨🇩", country: "DR Congo",          confederation: "CAF" },
  K3: { code: "UZB", name: "Uzbekistan",        flag: "🇺🇿", country: "Uzbekistan",        confederation: "AFC" },
  K4: { code: "COL", name: "Colombia",          flag: "🇨🇴", country: "Colombia",          confederation: "CONMEBOL" },
  // Group L
  L1: { code: "ENG", name: "England",           flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "England",           confederation: "UEFA" },
  L2: { code: "CRO", name: "Croatia",           flag: "🇭🇷", country: "Croatia",           confederation: "UEFA" },
  L3: { code: "GHA", name: "Ghana",             flag: "🇬🇭", country: "Ghana",             confederation: "CAF" },
  L4: { code: "PAN", name: "Panama",            flag: "🇵🇦", country: "Panama",            confederation: "CONCACAF" },
};

// 16 host cities, keyed by short code for compact fixture references.
const VENUES: Record<string, { venue: string; city: string; country: string }> = {
  VAN: { venue: "BC Place", city: "Vancouver", country: "Canada" },
  SEA: { venue: "Lumen Field", city: "Seattle", country: "United States" },
  SFB: { venue: "Levi's Stadium", city: "Santa Clara", country: "United States" },
  LAX: { venue: "SoFi Stadium", city: "Inglewood", country: "United States" },
  GDL: { venue: "Estadio Akron", city: "Guadalajara", country: "Mexico" },
  MEX: { venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  MTY: { venue: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
  HOU: { venue: "NRG Stadium", city: "Houston", country: "United States" },
  DAL: { venue: "AT&T Stadium", city: "Arlington", country: "United States" },
  KAN: { venue: "Arrowhead Stadium", city: "Kansas City", country: "United States" },
  ATL: { venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States" },
  MIA: { venue: "Hard Rock Stadium", city: "Miami Gardens", country: "United States" },
  TOR: { venue: "BMO Field", city: "Toronto", country: "Canada" },
  BOS: { venue: "Gillette Stadium", city: "Foxborough", country: "United States" },
  PHI: { venue: "Lincoln Financial Field", city: "Philadelphia", country: "United States" },
  NYC: { venue: "MetLife Stadium", city: "East Rutherford", country: "United States" },
};
type VenueCode = keyof typeof VENUES;

function teamForSlot(group: GroupCode, slot: number): SeedTeam {
  const key = `${group}${slot}`;
  const drawn = FINAL_DRAW[key];
  if (!drawn) {
    throw new Error(`Missing FINAL_DRAW entry for ${key}`);
  }
  return {
    code: drawn.code,
    name: drawn.name,
    country: drawn.country,
    flag: drawn.flag,
    confederation: drawn.confederation,
    groupCode: group,
    groupSlot: slot,
    isPlaceholder: false,
  };
}

export const TEAMS: SeedTeam[] = GROUP_CODES.flatMap((g) =>
  [1, 2, 3, 4].map((slot) => teamForSlot(g, slot)),
);

function teamRef(group: GroupCode, slot: number): { code: string; name: string; flag: string } {
  const t = TEAMS.find((x) => x.groupCode === group && x.groupSlot === slot)!;
  return { code: t.code, name: t.name, flag: t.flag };
}

function knockoutPlaceholder(label: string): { code: string; name: string; flag: string } {
  return { code: label, name: label, flag: "🏳️" };
}

// ---- Match generation: FIFA OFFICIAL FIXTURE -----------------------------
// Source: FWC26 Match Schedule v17, 10-April-2026 © FIFA.
// All times are Eastern Time (ET) per the FIFA poster. ET in June/July is
// EDT = UTC-4, so UTC kickoff = ET + 4h. Date below is the calendar day in ET.
// `day` is days since 2026-06-11 (day 0 = Thursday June 11, opening match).

const SOURCE = "FIFA official schedule (FWC26 v17)";

function etToUtcIso(year: number, month: number, day: number, etHour: number, etMin: number): string {
  // EDT = UTC-4; UTC = ET + 4h. Date.UTC handles overflow (e.g. 22+4=26 → next day 02).
  return new Date(Date.UTC(year, month - 1, day, etHour + 4, etMin, 0, 0)).toISOString();
}

function dayToEtCalendar(dayOffset: number): { y: number; m: number; d: number } {
  // June 11, 2026 is dayOffset 0 (in ET).
  const base = new Date(Date.UTC(2026, 5, 11)); // June = month 5 (0-indexed)
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

// Compact fixture rows: [num, group, teamA, teamB, etDayOffset, etHour, etMin, venueCode]
// Group is null for knockouts; teamA/B for knockouts use placeholders like "1A", "W73".
type FixtureRow = [
  num: number,
  group: string | null,
  teamA: string,
  teamB: string,
  day: number,
  etH: number,
  etM: number,
  venue: VenueCode,
];

const FIXTURES: FixtureRow[] = [
  // ---- GROUP STAGE — Matchday 1 ----
  [1,  "A", "MEX", "RSA", 0, 15, 0, "MEX"],
  [2,  "A", "KOR", "CZE", 0, 22, 0, "GDL"],
  [3,  "B", "CAN", "BIH", 1, 15, 0, "TOR"],
  [4,  "D", "USA", "PAR", 1, 21, 0, "LAX"],
  [5,  "C", "HAI", "SCO", 2, 21, 0, "BOS"],
  [6,  "D", "AUS", "TUR", 3,  0, 0, "VAN"],
  [7,  "C", "BRA", "MAR", 2, 18, 0, "NYC"],
  [8,  "B", "QAT", "SUI", 2, 15, 0, "SFB"],
  [9,  "E", "CIV", "ECU", 3, 19, 0, "PHI"],
  [10, "E", "GER", "CUW", 3, 13, 0, "HOU"],
  [11, "F", "NED", "JPN", 3, 16, 0, "DAL"],
  [12, "F", "SWE", "TUN", 3, 22, 0, "MTY"],
  [13, "H", "KSA", "URU", 3, 18, 0, "MIA"],
  [14, "H", "ESP", "CPV", 4, 12, 0, "ATL"],
  [15, "G", "IRN", "NZL", 4, 21, 0, "LAX"],
  [16, "G", "BEL", "EGY", 4, 15, 0, "SEA"],
  [17, "I", "FRA", "SEN", 4, 15, 0, "NYC"],
  [18, "I", "IRQ", "NOR", 4, 18, 0, "BOS"],
  [19, "J", "ARG", "ALG", 5, 21, 0, "KAN"],
  [20, "J", "AUT", "JOR", 5,  0, 0, "SFB"],
  [21, "L", "GHA", "PAN", 5, 19, 0, "TOR"],
  [22, "L", "ENG", "CRO", 5, 16, 0, "DAL"],
  [23, "K", "POR", "COD", 5, 13, 0, "ATL"],
  [24, "K", "UZB", "COL", 5, 22, 0, "KAN"],
  // ---- Matchday 2 ----
  [25, "A", "CZE", "RSA", 6, 12, 0, "GDL"],
  [26, "B", "SUI", "BIH", 6, 15, 0, "ATL"],
  [27, "B", "CAN", "QAT", 6, 18, 0, "VAN"],
  [28, "A", "MEX", "KOR", 6, 21, 0, "MEX"],
  [29, "C", "BRA", "HAI", 7, 20, 30, "MIA"],
  [30, "C", "SCO", "MAR", 7, 18, 0, "BOS"],
  [31, "D", "TUR", "PAR", 7, 23, 0, "LAX"],
  [32, "D", "USA", "AUS", 7, 15, 0, "SEA"],
  [33, "E", "GER", "CIV", 8, 16, 0, "VAN"],
  [34, "E", "ECU", "CUW", 8, 20, 0, "KAN"],
  [35, "F", "NED", "SWE", 8, 13, 0, "HOU"],
  [36, "F", "TUN", "JPN", 8,  0, 0, "MTY"],
  [37, "H", "URU", "CPV", 9, 18, 0, "MIA"],
  [38, "H", "ESP", "KSA", 9, 12, 0, "ATL"],
  [39, "G", "BEL", "IRN", 9, 15, 0, "PHI"],
  [40, "G", "NZL", "EGY", 9, 21, 0, "SEA"],
  [41, "I", "NOR", "SEN",10, 20, 0, "BOS"],
  [42, "I", "FRA", "IRQ",10, 17, 0, "NYC"],
  [43, "J", "ARG", "AUT",10, 13, 0, "MIA"],
  [44, "J", "JOR", "ALG",10, 23, 0, "DAL"],
  [45, "L", "ENG", "GHA",11, 16, 0, "BOS"],
  [46, "L", "PAN", "CRO",11, 19, 0, "DAL"],
  [47, "K", "POR", "UZB",11, 13, 0, "MEX"],
  [48, "K", "COL", "COD",11, 22, 0, "KAN"],
  // ---- Matchday 3 (concurrent kickoffs by group) ----
  [49, "C", "SCO", "BRA",12, 18, 0, "MIA"],
  [50, "C", "MAR", "HAI",12, 18, 0, "BOS"],
  [51, "B", "SUI", "CAN",12, 15, 0, "PHI"],
  [52, "B", "BIH", "QAT",12, 15, 0, "ATL"],
  [53, "A", "CZE", "MEX",13, 21, 0, "GDL"],
  [54, "A", "RSA", "KOR",13, 21, 0, "ATL"],
  [55, "E", "CUW", "CIV",13, 16, 0, "HOU"],
  [56, "E", "ECU", "GER",13, 16, 0, "KAN"],
  [57, "F", "JPN", "SWE",14, 19, 0, "DAL"],
  [58, "F", "TUN", "NED",14, 19, 0, "MTY"],
  [59, "D", "TUR", "USA",14, 22, 0, "LAX"],
  [60, "D", "PAR", "AUS",14, 22, 0, "HOU"],
  [61, "I", "NOR", "FRA",15, 15, 0, "NYC"],
  [62, "I", "SEN", "IRQ",15, 15, 0, "TOR"],
  [63, "G", "EGY", "IRN",15, 23, 0, "VAN"],
  [64, "G", "NZL", "BEL",15, 23, 0, "SEA"],
  [65, "H", "CPV", "KSA",16, 20, 0, "ATL"],
  [66, "H", "URU", "ESP",16, 20, 0, "MIA"],
  [67, "L", "PAN", "ENG",16, 17, 0, "PHI"],
  [68, "L", "CRO", "GHA",16, 17, 0, "BOS"],
  [69, "J", "ALG", "AUT",16, 22, 0, "KAN"],
  [70, "J", "JOR", "ARG",16, 22, 0, "MIA"],
  [71, "K", "COL", "POR",16, 19, 30, "ATL"],
  [72, "K", "COD", "UZB",16, 19, 30, "BOS"],
  // ---- ROUND OF 32 (Sun 28 Jun → Fri 3 Jul) — placeholder team codes ----
  [73, null, "2A", "2B",        17, 15, 0, "LAX"],
  [74, null, "1E", "3-ABCDF",   17, 16, 30, "NYC"],
  [75, null, "1F", "2C",        18, 21, 0, "SEA"],
  [76, null, "1C", "2F",        18, 13, 0, "MEX"],
  [77, null, "1I", "3-CDFGH",   19, 17, 0, "PHI"],
  [78, null, "2E", "2I",        19, 13, 0, "DAL"],
  [79, null, "1A", "3-CEFHI",   20, 21, 0, "MEX"],
  [80, null, "1L", "3-EHIJK",   20, 12, 0, "NYC"],
  [81, null, "1D", "3-BEFIJ",   21, 20, 0, "DAL"],
  [82, null, "1G", "3-AEHIJ",   21, 16, 0, "SEA"],
  [83, null, "2K", "2L",        22, 19, 0, "KAN"],
  [84, null, "1H", "2J",        22, 15, 0, "MIA"],
  [85, null, "1B", "3-EFGIJ",   22, 23, 0, "VAN"],
  [86, null, "1J", "2H",        22, 18, 0, "BOS"],
  [87, null, "1K", "3-DEIJL",   22, 21, 30, "TOR"],
  [88, null, "2D", "2G",        22, 14, 0, "ATL"],
  // ---- ROUND OF 16 (Sat 4 Jul → Tue 7 Jul) ----
  [89, null, "W74", "W77",      23, 17, 0, "BOS"],
  [90, null, "W73", "W75",      23, 13, 0, "MEX"],
  [91, null, "W76", "W78",      24, 16, 0, "MIA"],
  [92, null, "W79", "W80",      24, 20, 0, "DAL"],
  [93, null, "W83", "W84",      25, 15, 0, "ATL"],
  [94, null, "W81", "W82",      25, 20, 0, "LAX"],
  [95, null, "W86", "W88",      26, 12, 0, "SEA"],
  [96, null, "W85", "W87",      26, 16, 0, "KAN"],
  // ---- QUARTER-FINALS (Thu 9 → Sun 12 Jul) ----
  [97, null, "W89", "W90",      28, 16, 0, "BOS"],
  [98, null, "W93", "W94",      29, 15, 0, "DAL"],
  [99, null, "W91", "W92",      30, 17, 0, "KAN"],
  [100, null, "W95", "W96",     31, 21, 0, "LAX"],
  // ---- SEMI-FINALS (Tue 14 → Wed 15 Jul) ----
  [101, null, "W97", "W98",     33, 15, 0, "ATL"],
  [102, null, "W99", "W100",    34, 15, 0, "DAL"],
  // ---- BRONZE FINAL (Sat 18 Jul) ----
  [103, null, "L101", "L102",   37, 17, 0, "MIA"],
  // ---- FINAL (Sun 19 Jul) ----
  [104, null, "W101", "W102",   38, 15, 0, "NYC"],
];

function stageFromMatchNumber(n: number): Stage {
  if (n <= 72) return "GROUP_STAGE";
  if (n <= 88) return "ROUND_OF_32";
  if (n <= 96) return "ROUND_OF_16";
  if (n <= 100) return "QUARTER_FINALS";
  if (n <= 102) return "SEMI_FINALS";
  if (n === 103) return "THIRD_PLACE";
  return "FINAL";
}

function teamFromCode(code: string): { code: string; name: string; flag: string } {
  // Real team if it matches a draw entry (search by code), else placeholder.
  const real = TEAMS.find((t) => t.code === code);
  if (real) return { code: real.code, name: real.name, flag: real.flag };
  return knockoutPlaceholder(code);
}

function buildMatch(row: FixtureRow): SeedMatch {
  const [num, group, aCode, bCode, day, etH, etM, venueCode] = row;
  const { y, m, d } = dayToEtCalendar(day);
  const venue = VENUES[venueCode];
  const teamA = teamFromCode(aCode);
  const teamB = teamFromCode(bCode);
  return {
    officialMatchNumber: num,
    stage: stageFromMatchNumber(num),
    group,
    teamACode: teamA.code,
    teamAName: teamA.name,
    teamAFlag: teamA.flag,
    teamBCode: teamB.code,
    teamBName: teamB.name,
    teamBFlag: teamB.flag,
    matchDateUtc: etToUtcIso(y, m, d, etH, etM),
    venue: venue.venue,
    city: venue.city,
    country: venue.country,
    source: SOURCE,
  };
}

export const MATCHES: SeedMatch[] = FIXTURES.map(buildMatch);

// Sanity: counts must be exact
if (MATCHES.length !== 104) {
  throw new Error(`worldcup-2026 data: expected 104 matches, got ${MATCHES.length}`);
}
if (TEAMS.length !== 48) {
  throw new Error(`worldcup-2026 data: expected 48 teams, got ${TEAMS.length}`);
}
