/**
 * MatchesScreen invariants — file-level checks (no DOM render).
 *
 * Verifies the screen wires up:
 *  - Date filter pills (HOY/MAÑANA/SEMANA/TODOS) using classifyMatchDay
 *  - Phase filter chips with PHASE_LABEL
 *  - Search input filtering by team code/name
 *  - Group-by-day rendering when filter spans multiple days
 *  - Empty states for each filter combination
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("MatchesScreen — date filter wiring", () => {
  const file = read("src/components/screens/MatchesScreen.tsx");

  it("imports classifyMatchDay and formatMatchDayLabel", () => {
    expect(file).toMatch(/classifyMatchDay/);
    expect(file).toMatch(/formatMatchDayLabel/);
  });

  it("declares all four date filter values", () => {
    expect(file).toMatch(/"today" \| "tomorrow" \| "week" \| "all"/);
  });

  it("renders FILTERS array with HOY MAÑANA SEMANA TODOS labels", () => {
    expect(file).toMatch(/today:\s*"HOY"/);
    expect(file).toMatch(/tomorrow:\s*"MAÑANA"/);
    expect(file).toMatch(/week:\s*"SEMANA"/);
    expect(file).toMatch(/all:\s*"TODOS"/);
  });

  it("uses bucketCounts so each pill shows a real count badge", () => {
    expect(file).toMatch(/bucketCounts/);
    expect(file).toMatch(/bucketCounts\.today/);
    expect(file).toMatch(/bucketCounts\.tomorrow/);
    expect(file).toMatch(/bucketCounts\.thisWeek/);
  });

  it("date filter actually filters via dateFiltered useMemo", () => {
    expect(file).toMatch(/dateFiltered\s*=\s*useMemo/);
    // Ensure the filter chains: filter "today" matches bucket "today" etc.
    expect(file).toMatch(/b\s*===\s*"today"/);
    expect(file).toMatch(/b\s*===\s*"tomorrow"/);
  });
});

describe("MatchesScreen — phase filter chips", () => {
  const file = read("src/components/screens/MatchesScreen.tsx");

  it("declares PhaseFilter type with all 7 stages + ALL", () => {
    expect(file).toMatch(/type PhaseFilter\s*=\s*"ALL"/);
    expect(file).toMatch(/"GROUP_STAGE"/);
    expect(file).toMatch(/"ROUND_OF_32"/);
    expect(file).toMatch(/"ROUND_OF_16"/);
    expect(file).toMatch(/"QUARTER_FINALS"/);
    expect(file).toMatch(/"SEMI_FINALS"/);
    expect(file).toMatch(/"THIRD_PLACE"/);
    expect(file).toMatch(/"FINAL"/);
  });

  it("has PHASE_LABEL with Spanish names", () => {
    expect(file).toMatch(/GROUP_STAGE:\s*"GRUPOS"/);
    expect(file).toMatch(/ROUND_OF_16:\s*"OCTAVOS"/);
    expect(file).toMatch(/QUARTER_FINALS:\s*"CUARTOS"/);
    expect(file).toMatch(/SEMI_FINALS:\s*"SEMIS"/);
  });

  it("only shows phase chips when more than one phase exists", () => {
    expect(file).toMatch(/availablePhases\.length\s*>\s*1/);
  });

  it("phase filter applied via phaseFiltered useMemo", () => {
    expect(file).toMatch(/phaseFiltered\s*=\s*useMemo/);
    expect(file).toMatch(/m\.phase\s*===\s*phaseFilter/);
  });
});

describe("MatchesScreen — search", () => {
  const file = read("src/components/screens/MatchesScreen.tsx");

  it("declares matchSearchHit helper that checks code + name on both teams", () => {
    expect(file).toMatch(/matchSearchHit/);
    expect(file).toMatch(/teamA\.code\.toLowerCase\(\)\.includes/);
    expect(file).toMatch(/teamA\.name\.toLowerCase\(\)\.includes/);
    expect(file).toMatch(/teamB\.code\.toLowerCase\(\)\.includes/);
    expect(file).toMatch(/teamB\.name\.toLowerCase\(\)\.includes/);
  });

  it("renders an input with placeholder 'Buscar equipo...'", () => {
    expect(file).toMatch(/placeholder="Buscar equipo\.\.\."/);
  });

  it("has clear button (X) when search has value", () => {
    expect(file).toMatch(/setSearch\(""\)/);
    expect(file).toMatch(/aria-label="Limpiar búsqueda"/);
  });
});

describe("MatchesScreen — group-by-day rendering", () => {
  const file = read("src/components/screens/MatchesScreen.tsx");

  it("computes groupedByDay only for filters spanning multiple days", () => {
    expect(file).toMatch(/groupedByDay\s*=\s*useMemo/);
    // Skip grouping for today/tomorrow (single day, redundant)
    expect(file).toMatch(/filter === "today" \|\| filter === "tomorrow"/);
  });

  it("groups matches by calendarDayInTz", () => {
    expect(file).toMatch(/calendarDayInTz\(m\.matchDateIso\)/);
  });

  it("sorts day groups chronologically", () => {
    expect(file).toMatch(/\.localeCompare/);
  });

  it("renders day header with formatMatchDayLabel + count", () => {
    expect(file).toMatch(/formatMatchDayLabel\(items\[0\]\.matchDateIso\)/);
    expect(file).toMatch(/items\.length === 1 \? "" : "s"/);
  });
});

describe("MatchesScreen — empty states are filter-aware", () => {
  const file = read("src/components/screens/MatchesScreen.tsx");

  it("shows 'Sin resultados para' when search has value", () => {
    expect(file).toMatch(/Sin resultados para/);
  });

  it("shows 'No hay partidos en {phase}' when phase filter has no matches", () => {
    expect(file).toMatch(/No hay partidos en/);
  });

  it("offers contextual CTA buttons depending on filter combination", () => {
    expect(file).toMatch(/LIMPIAR BÚSQUEDA/);
    expect(file).toMatch(/TODAS LAS FASES/);
    expect(file).toMatch(/VER TODOS/);
  });
});
