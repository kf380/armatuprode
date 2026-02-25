"use client";

import { useState, useEffect, useCallback } from "react";

interface Tournament {
  id: string;
  name: string;
  type: string;
  phase: string;
  startDate: string;
  endDate: string;
  matchCount: number;
}

interface Match {
  id: string;
  teamACode: string;
  teamAName: string;
  teamAFlag: string;
  teamBCode: string;
  teamBName: string;
  teamBFlag: string;
  matchDate: string;
  matchGroup: string | null;
  phase: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  minute: number | null;
  period: string | null;
}

type Tab = "tournaments" | "matches" | "live";

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<Tab>("matches");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminKey}`,
  }), [adminKey]);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  // Fetch tournaments
  const fetchTournaments = useCallback(async () => {
    const res = await fetch("/api/tournaments", {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTournaments(data.tournaments || []);
      if (data.tournaments?.length > 0 && !selectedTournament) {
        setSelectedTournament(data.tournaments[0].id);
      }
    }
  }, [adminKey, selectedTournament]);

  // Fetch matches for selected tournament
  const fetchMatches = useCallback(async () => {
    if (!selectedTournament) return;
    const res = await fetch(`/api/matches?tournamentId=${selectedTournament}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setMatches(data.matches || []);
    }
  }, [adminKey, selectedTournament]);

  useEffect(() => {
    if (authenticated) {
      fetchTournaments();
    }
  }, [authenticated, fetchTournaments]);

  useEffect(() => {
    if (authenticated && selectedTournament) {
      fetchMatches();
    }
  }, [authenticated, selectedTournament, fetchMatches]);

  const handleLogin = () => {
    if (adminKey.length > 10) {
      setAuthenticated(true);
    }
  };

  // Create tournament
  const [newTournament, setNewTournament] = useState({ name: "", type: "WORLD_CUP", startDate: "", endDate: "" });
  const createTournament = async () => {
    setLoading(true);
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(newTournament),
    });
    if (res.ok) {
      showMsg("Torneo creado");
      setNewTournament({ name: "", type: "WORLD_CUP", startDate: "", endDate: "" });
      fetchTournaments();
    } else {
      const data = await res.json();
      showMsg(`Error: ${data.error}`);
    }
    setLoading(false);
  };

  // Create match
  const [newMatch, setNewMatch] = useState({
    teamACode: "", teamAName: "", teamAFlag: "",
    teamBCode: "", teamBName: "", teamBFlag: "",
    matchDate: "", matchGroup: "", phase: "GROUP_STAGE",
  });
  const createMatch = async () => {
    setLoading(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...newMatch, tournamentId: selectedTournament }),
    });
    if (res.ok) {
      showMsg("Partido creado");
      setNewMatch({
        teamACode: "", teamAName: "", teamAFlag: "",
        teamBCode: "", teamBName: "", teamBFlag: "",
        matchDate: "", matchGroup: "", phase: "GROUP_STAGE",
      });
      fetchMatches();
    } else {
      const data = await res.json();
      showMsg(`Error: ${data.error}`);
    }
    setLoading(false);
  };

  // Start live
  const startLive = async (matchId: string, scoreA: number, scoreB: number, minute?: number, period?: string) => {
    const res = await fetch(`/api/matches/${matchId}/update-live`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ scoreA, scoreB, minute, period }),
    });
    if (res.ok) {
      showMsg("Partido actualizado a LIVE");
      fetchMatches();
    } else {
      const data = await res.json();
      showMsg(`Error: ${data.error}`);
    }
  };

  // Finish match
  const finishMatch = async (matchId: string, scoreA: number, scoreB: number, qualifiedTeam?: string) => {
    const res = await fetch(`/api/matches/${matchId}/finish`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ scoreA, scoreB, qualifiedTeam }),
    });
    if (res.ok) {
      showMsg("Partido finalizado y puntuado");
      fetchMatches();
    } else {
      const data = await res.json();
      showMsg(`Error: ${data.error}`);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-5">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white text-center">Admin Panel</h1>
          <input
            type="password"
            placeholder="Admin API Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-lg bg-[#111827] border border-[#1F2937] text-white px-4 py-3 text-sm"
          />
          <button
            onClick={handleLogin}
            className="w-full rounded-lg bg-[#10B981] text-[#0A0E1A] font-bold py-3 text-sm"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white p-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        {message && <span className="text-sm text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full">{message}</span>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["tournaments", "matches", "live"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${
              tab === t ? "bg-[#10B981] text-[#0A0E1A]" : "bg-[#111827] border border-[#1F2937] text-gray-400"
            }`}
          >
            {t === "tournaments" ? "Torneos" : t === "matches" ? "Partidos" : "En Vivo"}
          </button>
        ))}
      </div>

      {/* Tournament selector */}
      {tournaments.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.matchCount} partidos)</option>
            ))}
          </select>
        </div>
      )}

      {/* Tournaments tab */}
      {tab === "tournaments" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Crear Torneo</h2>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nombre" value={newTournament.name} onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <select value={newTournament.type} onChange={(e) => setNewTournament({ ...newTournament, type: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm">
              <option value="WORLD_CUP">Mundial</option>
              <option value="COPA_AMERICA">Copa America</option>
              <option value="CHAMPIONS_LEAGUE">Champions League</option>
              <option value="LIBERTADORES">Libertadores</option>
              <option value="LEAGUE">Liga</option>
              <option value="OTHER">Otro</option>
            </select>
            <input type="date" placeholder="Inicio" value={newTournament.startDate} onChange={(e) => setNewTournament({ ...newTournament, startDate: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input type="date" placeholder="Fin" value={newTournament.endDate} onChange={(e) => setNewTournament({ ...newTournament, endDate: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
          </div>
          <button onClick={createTournament} disabled={loading || !newTournament.name} className="rounded-lg bg-[#10B981] text-[#0A0E1A] font-bold px-6 py-2 text-sm disabled:opacity-50">Crear Torneo</button>

          <h2 className="text-lg font-bold mt-6">Torneos existentes</h2>
          <div className="space-y-2">
            {tournaments.map((t) => (
              <div key={t.id} className="rounded-lg bg-[#111827] border border-[#1F2937] p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.type} | {t.phase} | {t.matchCount} partidos</div>
                </div>
                <div className="text-xs text-gray-500 font-mono">{t.id.slice(0, 8)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matches tab */}
      {tab === "matches" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Crear Partido</h2>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Codigo A (ARG)" value={newMatch.teamACode} onChange={(e) => setNewMatch({ ...newMatch, teamACode: e.target.value.toUpperCase() })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Nombre A (Argentina)" value={newMatch.teamAName} onChange={(e) => setNewMatch({ ...newMatch, teamAName: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Bandera A (🇦🇷)" value={newMatch.teamAFlag} onChange={(e) => setNewMatch({ ...newMatch, teamAFlag: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Codigo B (BRA)" value={newMatch.teamBCode} onChange={(e) => setNewMatch({ ...newMatch, teamBCode: e.target.value.toUpperCase() })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Nombre B (Brasil)" value={newMatch.teamBName} onChange={(e) => setNewMatch({ ...newMatch, teamBName: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Bandera B (🇧🇷)" value={newMatch.teamBFlag} onChange={(e) => setNewMatch({ ...newMatch, teamBFlag: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input type="datetime-local" value={newMatch.matchDate} onChange={(e) => setNewMatch({ ...newMatch, matchDate: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <input placeholder="Grupo (A, B...)" value={newMatch.matchGroup} onChange={(e) => setNewMatch({ ...newMatch, matchGroup: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm" />
            <select value={newMatch.phase} onChange={(e) => setNewMatch({ ...newMatch, phase: e.target.value })} className="rounded-lg bg-[#111827] border border-[#1F2937] text-white px-3 py-2 text-sm">
              <option value="GROUP_STAGE">Fase de Grupos</option>
              <option value="ROUND_OF_16">Octavos</option>
              <option value="QUARTER_FINALS">Cuartos</option>
              <option value="SEMI_FINALS">Semis</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <button onClick={createMatch} disabled={loading || !newMatch.teamACode || !newMatch.teamBCode || !newMatch.matchDate} className="rounded-lg bg-[#10B981] text-[#0A0E1A] font-bold px-6 py-2 text-sm disabled:opacity-50">Crear Partido</button>

          <h2 className="text-lg font-bold mt-6">Partidos ({matches.length})</h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchRow key={m.id} match={m} onStartLive={startLive} onFinish={finishMatch} />
            ))}
          </div>
        </div>
      )}

      {/* Live tab */}
      {tab === "live" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Partidos en vivo</h2>
          {matches.filter((m) => m.status === "LIVE").length === 0 && (
            <p className="text-gray-400 text-sm">No hay partidos en vivo</p>
          )}
          {matches.filter((m) => m.status === "LIVE").map((m) => (
            <LiveMatchControl key={m.id} match={m} onUpdate={startLive} onFinish={finishMatch} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ match: m, onStartLive, onFinish }: {
  match: Match;
  onStartLive: (id: string, scoreA: number, scoreB: number) => void;
  onFinish: (id: string, scoreA: number, scoreB: number, qualified?: string) => void;
}) {
  const statusColors: Record<string, string> = {
    UPCOMING: "text-[#3B82F6]",
    LIVE: "text-[#EF4444]",
    FINISHED: "text-gray-500",
  };

  return (
    <div className="rounded-lg bg-[#111827] border border-[#1F2937] p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-bold">
            {m.teamAFlag} {m.teamACode} vs {m.teamBCode} {m.teamBFlag}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(m.matchDate).toLocaleString("es-AR")} | {m.matchGroup || m.phase}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {m.status === "LIVE" && (
            <span className="text-sm font-bold">{m.scoreA ?? 0}-{m.scoreB ?? 0}</span>
          )}
          {m.status === "FINISHED" && (
            <span className="text-sm font-bold text-gray-500">{m.scoreA}-{m.scoreB}</span>
          )}
          <span className={`text-xs font-bold ${statusColors[m.status]}`}>{m.status}</span>
        </div>
      </div>
      {m.status === "UPCOMING" && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onStartLive(m.id, 0, 0)}
            className="text-xs bg-[#EF4444]/20 text-[#EF4444] font-bold px-3 py-1.5 rounded-lg"
          >
            Iniciar LIVE
          </button>
        </div>
      )}
    </div>
  );
}

function LiveMatchControl({ match: m, onUpdate, onFinish }: {
  match: Match;
  onUpdate: (id: string, scoreA: number, scoreB: number, minute?: number, period?: string) => void;
  onFinish: (id: string, scoreA: number, scoreB: number, qualified?: string) => void;
}) {
  const [scoreA, setScoreA] = useState(m.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(m.scoreB ?? 0);
  const [minute, setMinute] = useState(m.minute ?? 0);
  const [period, setPeriod] = useState(m.period ?? "1T");
  const [qualifiedTeam, setQualifiedTeam] = useState("");

  const isKnockout = m.phase !== "GROUP_STAGE";

  return (
    <div className="rounded-lg bg-[#111827] border border-[#EF4444]/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">
          {m.teamAFlag} {m.teamACode} vs {m.teamBCode} {m.teamBFlag}
        </div>
        <span className="text-xs font-bold text-[#EF4444] animate-pulse">LIVE</span>
      </div>

      {/* Score controls */}
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{m.teamACode}</span>
          <button onClick={() => setScoreA(Math.max(0, scoreA - 1))} className="w-8 h-8 rounded bg-[#1F2937] text-white font-bold">-</button>
          <span className="text-xl font-bold w-8 text-center">{scoreA}</span>
          <button onClick={() => setScoreA(scoreA + 1)} className="w-8 h-8 rounded bg-[#1F2937] text-white font-bold">+</button>
        </div>
        <span className="text-gray-500">-</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setScoreB(Math.max(0, scoreB - 1))} className="w-8 h-8 rounded bg-[#1F2937] text-white font-bold">-</button>
          <span className="text-xl font-bold w-8 text-center">{scoreB}</span>
          <button onClick={() => setScoreB(scoreB + 1)} className="w-8 h-8 rounded bg-[#1F2937] text-white font-bold">+</button>
          <span className="text-xs text-gray-400">{m.teamBCode}</span>
        </div>
      </div>

      {/* Minute & period */}
      <div className="flex items-center gap-3 justify-center">
        <input
          type="number"
          min={0}
          max={120}
          value={minute}
          onChange={(e) => setMinute(Number(e.target.value))}
          className="w-16 rounded bg-[#1F2937] border border-[#1F2937] text-white px-2 py-1.5 text-sm text-center"
          placeholder="Min"
        />
        <span className="text-xs text-gray-400">&apos;</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded bg-[#1F2937] border border-[#1F2937] text-white px-2 py-1.5 text-sm">
          <option value="1T">1er Tiempo</option>
          <option value="HT">Entretiempo</option>
          <option value="2T">2do Tiempo</option>
          <option value="ET">Extra Time</option>
          <option value="PEN">Penales</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => onUpdate(m.id, scoreA, scoreB, minute, period)}
          className="text-sm bg-[#3B82F6]/20 text-[#3B82F6] font-bold px-4 py-2 rounded-lg"
        >
          Actualizar Score
        </button>
        <button
          onClick={() => {
            if (confirm(`Finalizar ${m.teamACode} ${scoreA}-${scoreB} ${m.teamBCode}?`)) {
              onFinish(m.id, scoreA, scoreB, isKnockout ? qualifiedTeam : undefined);
            }
          }}
          className="text-sm bg-[#10B981]/20 text-[#10B981] font-bold px-4 py-2 rounded-lg"
        >
          Finalizar
        </button>
      </div>

      {/* Knockout: qualified team */}
      {isKnockout && (
        <div className="flex items-center gap-2 justify-center">
          <span className="text-xs text-gray-400">Clasificado:</span>
          <button onClick={() => setQualifiedTeam(m.teamACode)} className={`text-xs px-3 py-1 rounded ${qualifiedTeam === m.teamACode ? "bg-[#10B981] text-[#0A0E1A]" : "bg-[#1F2937] text-gray-400"}`}>{m.teamACode}</button>
          <button onClick={() => setQualifiedTeam(m.teamBCode)} className={`text-xs px-3 py-1 rounded ${qualifiedTeam === m.teamBCode ? "bg-[#10B981] text-[#0A0E1A]" : "bg-[#1F2937] text-gray-400"}`}>{m.teamBCode}</button>
        </div>
      )}
    </div>
  );
}
