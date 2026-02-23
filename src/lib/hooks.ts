"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/lib/store";
import { levels } from "@/lib/mock-data";

// --- Notification types ---

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  text: string;
  icon: string;
  user: string;
  userId: string;
  avatar: string;
  time: string;
}

// --- Types matching API responses ---

export interface ApiMatch {
  id: string;
  tournamentId: string;
  teamACode: string;
  teamAName: string;
  teamAFlag: string;
  teamBCode: string;
  teamBName: string;
  teamBFlag: string;
  matchDate: string;
  matchGroup: string | null;
  phase: string;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  scoreA: number | null;
  scoreB: number | null;
  prediction: { scoreA: number; scoreB: number; points: number } | null;
}

export interface ScreenMatch {
  id: string;
  teamA: { code: string; name: string; flag: string };
  teamB: { code: string; name: string; flag: string };
  date: string;
  time: string;
  group: string;
  status: "upcoming" | "finished" | "live";
  scoreA?: number;
  scoreB?: number;
  userPrediction: { scoreA: number; scoreB: number } | null;
  pointsEarned?: number;
}

export interface ApiGroup {
  id: string;
  name: string;
  emoji: string;
  tournament: string;
  memberCount: number;
  role: string;
  hasPool: boolean;
  entryFee: number;
  currency: string;
  inviteCode: string;
}

export interface ScreenGroup {
  id: string;
  name: string;
  emoji: string;
  tournament: string;
  members: number;
  userPosition: number;
  userPoints: number;
  maxPoints: number;
  hasPool: boolean;
  poolAmount: number;
  currency: string;
  entryFee: number;
  poolDistribution: [number, number, number];
  inviteCode: string;
}

export interface GroupDetailRanking {
  userId: string;
  name: string;
  avatar: string;
  country: string;
  points: number;
  role: string;
}

export interface GroupDetail {
  group: {
    id: string;
    name: string;
    emoji: string;
    tournament: { id: string; name: string; type: string };
    memberCount: number;
    hasPool: boolean;
    entryFee: number;
    currency: string;
    inviteCode: string;
  };
  ranking: GroupDetailRanking[];
}

export interface RankingEntry {
  position: number;
  userId: string;
  name: string;
  avatar: string;
  country: string;
  points: number;
  level: number;
}

export interface UserStats {
  points: number;
  globalRank: number;
  streak: number;
  precision: number;
  exactos: number;
  predictions: number;
}

// --- Helper: transform API match to screen format ---

function apiToScreenMatch(m: ApiMatch): ScreenMatch {
  const d = new Date(m.matchDate);
  const date = d.toISOString().split("T")[0];
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const result: ScreenMatch = {
    id: m.id,
    teamA: { code: m.teamACode, name: m.teamAName, flag: m.teamAFlag },
    teamB: { code: m.teamBCode, name: m.teamBName, flag: m.teamBFlag },
    date,
    time,
    group: m.matchGroup || m.phase,
    status: m.status === "UPCOMING" ? "upcoming" : m.status === "FINISHED" ? "finished" : "live",
    userPrediction: m.prediction ? { scoreA: m.prediction.scoreA, scoreB: m.prediction.scoreB } : null,
  };

  if (m.status === "FINISHED" || m.status === "LIVE") {
    result.scoreA = m.scoreA ?? undefined;
    result.scoreB = m.scoreB ?? undefined;
    if (m.prediction) {
      result.pointsEarned = m.prediction.points;
    }
  }

  return result;
}

// --- Helper: derive level from XP ---

export function deriveLevel(xp: number): { level: number; levelName: string; xpNext: number } {
  let current = levels[0];
  let next = levels[1];
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].xp) {
      current = levels[i];
      next = levels[i + 1] || { level: current.level + 1, name: current.name, xp: current.xp * 2 };
    }
  }
  return { level: current.level, levelName: current.name, xpNext: next.xp };
}

// --- Hooks ---

export function useMatches() {
  const { authFetch } = useApp();
  const [matches, setMatches] = useState<ScreenMatch[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState("Mundial 2026");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/matches");
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setTournamentId(data.tournament?.id ?? null);
      setTournamentName(data.tournament?.name ?? "Mundial 2026");
      setMatches((data.matches || []).map(apiToScreenMatch));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchMatches();
    }
  }, [fetchMatches]);

  return { matches, tournamentId, tournamentName, loading, error, refetch: fetchMatches };
}

export function useGroups() {
  const { authFetch } = useApp();
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data = await res.json();
      setGroups(data.groups || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchGroups();
    }
  }, [fetchGroups]);

  return { groups, loading, error, refetch: fetchGroups };
}

export function useGroupDetail(id: string | null) {
  const { authFetch } = useApp();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (groupId: string) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group detail");
      const data: GroupDetail = await res.json();
      setDetail(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (id) {
      fetchDetail(id);
    } else {
      setDetail(null);
    }
  }, [id, fetchDetail]);

  return { detail, loading, error, refetch: () => id && fetchDetail(id) };
}

export function useRanking() {
  const { authFetch } = useApp();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [userPosition, setUserPosition] = useState<RankingEntry | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchRanking = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/ranking");
      if (!res.ok) throw new Error("Failed to fetch ranking");
      const data = await res.json();
      setRanking(data.ranking || []);
      setUserPosition(data.userPosition || null);
      setTotalPlayers(data.totalPlayers || 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchRanking();
    }
  }, [fetchRanking]);

  return { ranking, userPosition, totalPlayers, loading, error, refetch: fetchRanking };
}

export function useUserStats() {
  const { authFetch } = useApp();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/users/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data.stats || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchStats();
    }
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useNotifications() {
  const { authFetch } = useApp();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Fallback: keep current state
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (ids?: string[]) => {
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      if (ids) {
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - ids.length));
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // Ignore
    }
  }, [authFetch]);

  return { notifications, unreadCount, loading, refetch: fetchNotifications, markAsRead };
}

// --- Tournament types ---

export interface ApiTournament {
  id: string;
  name: string;
  type: string;
  phase: string;
  startDate: string;
  endDate: string;
  matchCount: number;
}

export function useTournaments() {
  const { authFetch } = useApp();
  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/tournaments");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch {
      // Keep empty
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchTournaments();
    }
  }, [fetchTournaments]);

  return { tournaments, loading, refetch: fetchTournaments };
}

// --- Badge types ---

export interface ApiBadge {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

export function useUserBadges() {
  const { authFetch } = useApp();
  const [badges, setBadges] = useState<ApiBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/users/badges");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBadges(data.badges || []);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchBadges();
    }
  }, [fetchBadges]);

  return { badges, loading, refetch: fetchBadges };
}

// --- Live match types ---

export interface LiveGroupRanking {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  ranking: Array<{
    userId: string;
    name: string;
    avatar: string;
    prediction: string | null;
    isUser: boolean;
  }>;
}

export interface LiveMatch {
  id: string;
  teamACode: string;
  teamAName: string;
  teamAFlag: string;
  teamBCode: string;
  teamBName: string;
  teamBFlag: string;
  scoreA: number | null;
  scoreB: number | null;
  matchGroup: string | null;
  phase: string;
  userPrediction: { scoreA: number; scoreB: number } | null;
  groupRankings: LiveGroupRanking[];
}

export function useLiveMatches(pollInterval = 30000) {
  const { authFetch } = useApp();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLive = useCallback(async () => {
    try {
      const res = await authFetch("/api/matches/live");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, pollInterval);
    return () => clearInterval(interval);
  }, [fetchLive, pollInterval]);

  return { matches, loading, refetch: fetchLive };
}

export function useGroupActivity(groupId: string | null) {
  const { authFetch } = useApp();
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchActivity = useCallback(async (gId: string, cursor?: string) => {
    try {
      setLoading(true);
      const url = `/api/groups/${gId}/activity${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch activity");
      const data = await res.json();
      if (cursor) {
        setEvents((prev) => [...prev, ...(data.events || [])]);
      } else {
        setEvents(data.events || []);
      }
      setNextCursor(data.nextCursor || null);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (groupId) {
      fetchActivity(groupId);
    } else {
      setEvents([]);
      setNextCursor(null);
    }
  }, [groupId, fetchActivity]);

  const loadMore = useCallback(() => {
    if (groupId && nextCursor) {
      fetchActivity(groupId, nextCursor);
    }
  }, [groupId, nextCursor, fetchActivity]);

  return { events, loading, loadMore, hasMore: !!nextCursor };
}
