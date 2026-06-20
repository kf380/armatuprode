"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/lib/store";
import { levels } from "@/lib/mock-data";
import { formatMatchTime } from "@/lib/format-date";

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
  officialMatchNumber: number | null;
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
  qualifiedTeam: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  prediction: { scoreA: number; scoreB: number; points: number; predictedQualifier?: string | null } | null;
}

export interface ScreenMatch {
  id: string;
  officialMatchNumber: number | null;
  teamA: { code: string; name: string; flag: string };
  teamB: { code: string; name: string; flag: string };
  /** YYYY-MM-DD in UTC. Legacy — prefer matchDateIso for filtering. */
  date: string;
  /** Original ISO from API; use this to classify by browser-local day. */
  matchDateIso: string;
  time: string;
  group: string;
  phase: string;
  status: "upcoming" | "finished" | "live";
  scoreA?: number;
  scoreB?: number;
  qualifiedTeam?: string | null;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  userPrediction: { scoreA: number; scoreB: number; predictedQualifier?: string | null } | null;
  pointsEarned?: number;
}

export type ApiGroupStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED";

export type ApiPlanType = "FREE" | "PERSONAL_PLUS" | "COMMUNITY" | "BUSINESS" | "WHITE_LABEL";
export type ApiGroupKind = "PERSONAL" | "ORGANIZATION";
export type ApiPrizeType = "NONE" | "MANUAL_FIXED" | "SPONSOR";
export type ApiPaymentResponsibility = "NONE" | "ORGANIZER" | "COMPANY";

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
  createdById: string;
  // --- B2B fields ---
  type: ApiGroupKind;
  planType: ApiPlanType;
  status: ApiGroupStatus;
  isPremium: boolean;
  participantLimit: number;
  prizeType: ApiPrizeType;
  prizeDescription: string | null;
  rulesDescription: string | null;
  publicJoinEnabled: boolean;
  brandingConfig: Record<string, unknown> | null;
  billingStatus: string | null;
  paymentResponsibility: ApiPaymentResponsibility;
  organizationId: string | null;
  // Phase 2: Manual Pool (always present in GET responses; null when MoneyMode=NONE)
  moneyMode?: "NONE" | "MANUAL_POOL" | "AUTOMATED_POOL";
  declaredPoolEntry?: number | null;
  declaredPoolCurrency?: string | null;
  declaredPoolUpdatedAt?: string | null;
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
    revealPredictionsBeforeKickoff?: boolean;
  };
  ranking: GroupDetailRanking[];
  availableDates: string[];
  selectedDate: string | null;
  permissions?: { canEdit: boolean; canViewBilling: boolean; canResumePayment: boolean };
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

export function apiToScreenMatch(m: ApiMatch): ScreenMatch {
  const d = new Date(m.matchDate);
  const date = d.toISOString().split("T")[0];
  const time = formatMatchTime(d);

  const result: ScreenMatch = {
    id: m.id,
    officialMatchNumber: m.officialMatchNumber,
    teamA: { code: m.teamACode, name: m.teamAName, flag: m.teamAFlag },
    teamB: { code: m.teamBCode, name: m.teamBName, flag: m.teamBFlag },
    date,
    matchDateIso: m.matchDate,
    time,
    group: m.matchGroup || m.phase,
    phase: m.phase,
    status: m.status === "UPCOMING" ? "upcoming" : m.status === "FINISHED" ? "finished" : "live",
    qualifiedTeam: m.qualifiedTeam,
    venue: m.venue,
    city: m.city,
    country: m.country,
    userPrediction: m.prediction
      ? { scoreA: m.prediction.scoreA, scoreB: m.prediction.scoreB, predictedQualifier: m.prediction.predictedQualifier }
      : null,
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

/**
 * Lean group shape consumed by HomeScreen. ApiGroup tiene 20+ campos para
 * GroupsScreen detail; en Home solo necesitamos identificar + contar miembros
 * + flag de pool. Tipear esto separado baja el response del dashboard ~30%
 * sin romper el detail.
 */
export interface DashboardGroup {
  id: string;
  name: string;
  emoji: string;
  tournament: string;
  memberCount: number;
  hasPool: boolean;
  currency: string;
  entryFee: number;
  inviteCode: string;
}

export interface DashboardPayload {
  stats: UserStats;
  tournament: { id: string; name: string; type: string; slug: string } | null;
  matches: ApiMatch[];
  liveMatches: LiveMatch[];
  groups: DashboardGroup[];
  badges: Array<{ id: string; earnedAt: string }>;
}

/**
 * Aggregated dashboard fetch. Replaces 5 parallel hooks on Home with one
 * round-trip. Use this in HomeScreen instead of useMatches/useGroups/...
 * — keeps the others available for screens that don't need everything.
 */
/**
 * Stale-while-revalidate cache for the dashboard. On mount:
 *   1. Reads last response from localStorage and shows it instantly (≤1ms).
 *   2. Fires a fresh fetch in background and swaps when it arrives.
 *   3. Persists the new response for the next visit.
 * The user never sees "…" infinito on warm sessions because there's always
 * something to render.
 */
const DASHBOARD_CACHE_KEY = "ap_dashboard_cache_v1";
const DASHBOARD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — older snapshots get discarded

type DashboardCacheEntry = { ts: number; userId: string | null; data: DashboardPayload };

function readDashboardCache(currentUserId: string | null): DashboardPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const entry: DashboardCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > DASHBOARD_CACHE_TTL) return null;
    // If the cached snapshot belongs to a different user, ignore it.
    if (currentUserId && entry.userId && entry.userId !== currentUserId) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeDashboardCache(userId: string | null, data: DashboardPayload): void {
  if (typeof window === "undefined") return;
  try {
    const entry: DashboardCacheEntry = { ts: Date.now(), userId, data };
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* quota / serialization — ignore, no-op */
  }
}

export function useDashboard() {
  const { authFetch, dbUser } = useApp();
  const userId = dbUser?.id ?? null;
  // Initial state seeded from localStorage so first paint shows real data.
  // loading starts false when cache exists — no spinner on warm sessions.
  const [data, setData] = useState<DashboardPayload | null>(() => readDashboardCache(userId));
  const [loading, setLoading] = useState(() => readDashboardCache(userId) === null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    try {
      // Only show spinner on cold start (no existing data). Background refreshes
      // update silently so the list never disappears mid-session.
      setData((prev) => { if (prev === null) setLoading(true); return prev; });
      const res = await authFetch("/api/users/dashboard");
      if (!res.ok) throw new Error("Failed");
      const payload: DashboardPayload = await res.json();
      setData(payload);
      setError(null);
      writeDashboardCache(userId, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, userId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchDashboard();
    }
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}

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

  // Live polling: while any match is LIVE, refetch every 30s so scores update
  // in real time without manual refresh. Cleared as soon as no match is live.
  const hasLive = matches.some((m) => m.status === "live");
  useEffect(() => {
    if (!hasLive) return;
    const id = setInterval(() => {
      fetchMatches();
    }, 30_000);
    return () => clearInterval(id);
  }, [hasLive, fetchMatches]);

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

export function useGroupDetail(id: string | null, date?: string | null) {
  const { authFetch } = useApp();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (groupId: string, filterDate?: string | null) => {
    try {
      setLoading(true);
      const url = filterDate
        ? `/api/groups/${groupId}?date=${encodeURIComponent(filterDate)}`
        : `/api/groups/${groupId}`;
      const res = await authFetch(url);
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
      setDetail(null); // clear stale data before fetching new group to avoid flash
      fetchDetail(id, date ?? null);
    } else {
      setDetail(null);
    }
  }, [id, date, fetchDetail]);

  return { detail, loading, error, refetch: () => id && fetchDetail(id, date ?? null) };
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
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
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

  return { notifications, unreadCount, loading, error, refetch: fetchNotifications, markAsRead };
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
  matchDate?: string | Date;
  teamACode: string;
  teamAName: string;
  teamAFlag: string;
  teamBCode: string;
  teamBName: string;
  teamBFlag: string;
  scoreA: number | null;
  scoreB: number | null;
  minute: number | null;
  period: string | null;
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

// --- Chat types ---

export interface ChatReactionAggregate {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ChatMessageItem {
  id: string;
  type: "TEXT" | "STICKER" | "SYSTEM";
  content: string;
  stickerKey: string | null;
  deleted: boolean;
  userId: string | null;
  user: { id: string; name: string; avatar: string } | null;
  createdAt: string;
  pending?: boolean;
  reactions?: ChatReactionAggregate[];
}

export function useGroupChat(groupId: string | null, active: boolean) {
  const { authFetch, dbUser } = useApp();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const lastGroupRef = useRef<string | null>(null);

  // Initial load
  const loadInitial = useCallback(async (gId: string) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/groups/${gId}/chat`);
      if (!res.ok) throw new Error("Failed to load chat");
      const data = await res.json();
      const msgs: ChatMessageItem[] = data.messages || [];
      setMessages(msgs);
      if (msgs.length > 0) {
        cursorRef.current = msgs[msgs.length - 1].id;
      } else {
        cursorRef.current = null;
      }
      setHasOlder(msgs.length >= 20);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Poll for new messages
  const poll = useCallback(async (gId: string) => {
    try {
      // If we have a cursor, fetch only newer messages; otherwise fetch latest
      const url = cursorRef.current
        ? `/api/groups/${gId}/chat?after=${cursorRef.current}`
        : `/api/groups/${gId}/chat`;
      const res = await authFetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const newMsgs: ChatMessageItem[] = data.messages || [];
      if (newMsgs.length > 0) {
        if (cursorRef.current) {
          // Append new messages, replacing optimistic ones
          setMessages((prev) => {
            const nonPending = prev.filter((m) => !m.pending);
            const stillPending = prev.filter(
              (m) => m.pending && !newMsgs.some((nm) => nm.content === m.content && nm.userId === m.userId),
            );
            return [...nonPending, ...newMsgs, ...stillPending];
          });
        } else {
          // First messages arriving in an empty chat
          setMessages(newMsgs);
        }
        cursorRef.current = newMsgs[newMsgs.length - 1].id;
      }
    } catch {
      // Keep current state
    }
  }, [authFetch]);

  // Single effect: initialize, poll, and reset
  useEffect(() => {
    if (!groupId || !active) {
      // Reset state when deactivated
      setMessages([]);
      cursorRef.current = null;
      setHasOlder(true);
      lastGroupRef.current = null;
      return;
    }

    // Load initial messages when activated or group changes
    if (lastGroupRef.current !== groupId) {
      lastGroupRef.current = groupId;
      setMessages([]);
      cursorRef.current = null;
      loadInitial(groupId);
    }

    const interval = setInterval(() => poll(groupId), 7000);
    return () => clearInterval(interval);
  }, [groupId, active, loadInitial, poll]);

  // Load older messages
  const loadOlder = useCallback(async () => {
    if (!groupId || messages.length === 0) return;
    const oldest = messages[0];
    try {
      setLoading(true);
      const res = await authFetch(`/api/groups/${groupId}/chat?before=${oldest.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const olderMsgs: ChatMessageItem[] = data.messages || [];
      setMessages((prev) => [...olderMsgs, ...prev]);
      setHasOlder(olderMsgs.length >= 20);
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, [groupId, messages, authFetch]);

  // Send message with optimistic UI
  const sendMessage = useCallback(async (
    type: "TEXT" | "STICKER",
    content: string,
    stickerKey?: string,
  ) => {
    if (!groupId || !dbUser) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageItem = {
      id: tempId,
      type,
      content,
      stickerKey: stickerKey || null,
      deleted: false,
      userId: dbUser.id,
      user: { id: dbUser.id, name: dbUser.name, avatar: dbUser.avatar },
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setError(null);

    try {
      const res = await authFetch(`/api/groups/${groupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: type === "TEXT" ? content : undefined, stickerKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(data.error || "Error al enviar");
        return;
      }

      const data = await res.json();
      // Replace optimistic with real message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data.message, pending: false } : m)),
      );
      cursorRef.current = data.message.id;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Error de conexion");
    }
  }, [groupId, dbUser, authFetch]);

  // Delete message (admin)
  const deleteMessage = useCallback(async (msgId: string) => {
    if (!groupId) return;
    try {
      const res = await authFetch(`/api/groups/${groupId}/chat/${msgId}`, { method: "DELETE" });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, deleted: true, content: "" } : m)),
        );
      }
    } catch {
      // Ignore
    }
  }, [groupId, authFetch]);

  // Report message
  const reportMessage = useCallback(async (msgId: string) => {
    if (!groupId) return;
    try {
      await authFetch(`/api/groups/${groupId}/chat/${msgId}/report`, { method: "POST" });
    } catch {
      // Ignore
    }
  }, [groupId, authFetch]);

  // Mute user (admin)
  const muteUser = useCallback(async (targetUserId: string, durationMinutes = 30) => {
    if (!groupId) return;
    try {
      await authFetch(`/api/groups/${groupId}/chat/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, durationMinutes }),
      });
    } catch {
      // Ignore
    }
  }, [groupId, authFetch]);

  const clearError = useCallback(() => setError(null), []);

  const refetch = useCallback(() => {
    if (lastGroupRef.current) {
      cursorRef.current = null;
      void loadInitial(lastGroupRef.current);
    }
  }, [loadInitial]);

  return { messages, loading, error, hasOlder, sendMessage, loadOlder, deleteMessage, reportMessage, muteUser, clearError, refetch };
}

// --- Public runtime config (feature flags + caps) ---

export interface PublicConfig {
  flags: {
    enableRealMoneyPools: boolean;
    enableCoinShop: boolean;
    enablePremiumTournaments: boolean;
    enableManualPrizes: boolean;
    publicLaunchMode: "closed" | "controlled" | "open";
    enableB2bOrganizers: boolean;
    enablePersonalGroups: boolean;
    enableOrganizationPlans: boolean;
    enablePlayerPayments: boolean;
    enableManualPools: boolean;
  };
  limits: {
    maxPoolParticipants: number;
    maxEntryFee: number;
  };
}

const DEFAULT_CONFIG: PublicConfig = {
  flags: {
    enableRealMoneyPools: false,
    enableCoinShop: false,
    enablePremiumTournaments: false,
    enableManualPrizes: true,
    publicLaunchMode: "controlled",
    enableB2bOrganizers: true,
    enablePersonalGroups: true,
    enableOrganizationPlans: true,
    enablePlayerPayments: false,
    enableManualPools: false,
  },
  limits: { maxPoolParticipants: 50, maxEntryFee: 20000 },
};

export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = (await res.json()) as PublicConfig;
          setConfig(data);
        }
      } catch {
        // Keep defaults — fail-safe = pools off.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { config, loading };
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

// ===========================================================================
// B2B — Organizations + group activation
// ===========================================================================

export interface ApiOrganization {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  plan: ApiPlanType;
  isOwner: boolean;
}

export interface ApiOrganizationDetail extends ApiOrganization {
  billingStatus: string | null;
  maxPlayers: number;
  memberCount: number;
  groupCount: number;
  role: "OWNER" | "ADMIN" | "PLAYER" | null;
}

export interface ApiGroupBilling {
  groupId: string;
  planType: ApiPlanType;
  planConfig: {
    maxPlayers: number;
    flatUsd: number;
    pricePerPlayerUsd: number;
    minimumUsd: number;
    analytics: "none" | "basic" | "advanced";
  };
  status: ApiGroupStatus;
  isPremium: boolean;
  paymentResponsibility: ApiPaymentResponsibility;
  billingStatus: string | null;
  participantLimit: number;
  currentPlayers: number;
  quoteForCurrentSize: {
    planType: ApiPlanType;
    estimatedPlayers: number;
    amountUsd: number;
    amountArs: number;
    arsRate: number;
    priceMethod: "free" | "flat" | "per_player_with_min";
  };
  orders: Array<{
    id: string;
    status: string;
    amount: number;
    description: string;
    externalId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export function useOrganizations() {
  const { authFetch } = useApp();
  const [organizations, setOrganizations] = useState<ApiOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchOrgs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to load organizations");
      const data = await res.json();
      setOrganizations(data.organizations || []);
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
      fetchOrgs();
    }
  }, [fetchOrgs]);

  return { organizations, loading, error, refetch: fetchOrgs };
}

export function useCreateOrganization() {
  const { authFetch } = useApp();

  const createOrganization = useCallback(
    async (input: { slug: string; name: string; logoUrl?: string; description?: string }) => {
      const res = await authFetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear la organización");
      }
      const data = await res.json();
      return data.organization as ApiOrganization;
    },
    [authFetch],
  );

  return { createOrganization };
}

export function useGroupBilling(groupId: string | null) {
  const { authFetch } = useApp();
  const [billing, setBilling] = useState<ApiGroupBilling | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/groups/${id}/billing`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo leer billing");
      }
      const data = await res.json();
      setBilling(data.billing);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (groupId) fetchBilling(groupId);
    else setBilling(null);
  }, [groupId, fetchBilling]);

  return { billing, loading, error, refetch: () => groupId && fetchBilling(groupId) };
}

export function useActivateGroup() {
  const { authFetch } = useApp();

  const activateFree = useCallback(async (groupId: string) => {
    const res = await authFetch(`/api/groups/${groupId}/activate`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo activar el prode");
    }
    return res.json();
  }, [authFetch]);

  return { activateFree };
}

export function useCreateGroupActivationPayment() {
  const { authFetch } = useApp();

  const createActivationPayment = useCallback(
    async (input: { groupId: string; planType: ApiPlanType; estimatedPlayers?: number }) => {
      const res = await authFetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group_activation", ...input }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo iniciar el pago");
      }
      const data = await res.json();
      return data as { initPoint: string; orderId: string };
    },
    [authFetch],
  );

  return { createActivationPayment };
}

export interface ApiGroupMember {
  userId: string;
  name: string;
  avatar: string | null;
  country: string | null;
  xp: number;
  role: string;
  joinedAt: string;
}

export interface ApiGroupDetail extends ApiGroup {
  organization: { id: string; name: string; logoUrl: string | null; slug: string } | null;
  members: ApiGroupMember[];
  ranking: Array<{ userId: string; name: string; avatar: string | null; country: string | null; points: number; role: string }>;
  myRole: string | null;
  myOrgRole: "OWNER" | "ADMIN" | "PLAYER" | null;
  permissions: { canEdit: boolean; canViewBilling: boolean; canResumePayment: boolean };
}

/**
 * Hook for the /organizer/[id] dashboard. Returns a flattened ApiGroupDetail
 * (B2B fields + members + permissions). Distinct from useGroupDetail (which
 * powers GroupsScreen and uses the legacy `{detail: {group, ranking}}` shape).
 */
export function useOrganizerGroup(groupId: string | null) {
  const { authFetch } = useApp();
  const [data, setData] = useState<ApiGroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/groups/${id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "No se pudo cargar el prode");
      }
      const json = await res.json();
      const merged: ApiGroupDetail = {
        ...(json.group as ApiGroup),
        organization: json.group.organization ?? null,
        members: json.members ?? [],
        ranking: json.ranking ?? [],
        myRole: json.myRole ?? null,
        myOrgRole: json.myOrgRole ?? null,
        permissions: json.permissions ?? { canEdit: false, canViewBilling: false, canResumePayment: false },
      };
      setData(merged);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (groupId) fetchDetail(groupId);
    else setData(null);
  }, [groupId, fetchDetail]);

  return { group: data, loading, error, refetch: () => groupId && fetchDetail(groupId) };
}

export function useUpdateGroup() {
  const { authFetch } = useApp();

  const updateGroup = useCallback(
    async (
      groupId: string,
      patch: Partial<{
        prizeType: ApiPrizeType;
        prizeDescription: string | null;
        rulesDescription: string | null;
        publicJoinEnabled: boolean;
        brandingConfig: Record<string, unknown> | null;
      }>,
    ) => {
      const res = await authFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "No se pudo guardar");
      }
      return res.json();
    },
    [authFetch],
  );

  return { updateGroup };
}

export interface ApiPoolTrackingMember {
  userId: string;
  name: string;
  avatar: string | null;
  role: string;
  paid: boolean;
  paidAt: string | null;
  note: string | null;
}

export interface ApiPoolTracking {
  moneyMode: "NONE" | "MANUAL_POOL" | "AUTOMATED_POOL";
  declaredPoolEntry: number;
  declaredPoolCurrency: string;
  totalDeclared: number;
  totalCollected: number;
  paidCount: number;
  pendingCount: number;
  members: ApiPoolTrackingMember[];
}

export function usePoolTracking(groupId: string | null) {
  const { authFetch } = useApp();
  const [data, setData] = useState<ApiPoolTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        const res = await authFetch(`/api/groups/${id}/pool-tracking`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "No se pudo cargar el tracking");
        }
        setData(await res.json());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (groupId) fetchTracking(groupId);
    else setData(null);
  }, [groupId, fetchTracking]);

  const setPaid = useCallback(
    async (userId: string, paid: boolean, note?: string | null) => {
      if (!groupId) return;
      const res = await authFetch(`/api/groups/${groupId}/pool-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paid, ...(note !== undefined ? { note } : {}) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "No se pudo actualizar");
      }
      await fetchTracking(groupId);
    },
    [groupId, authFetch, fetchTracking],
  );

  return {
    data,
    loading,
    error,
    refetch: () => groupId && fetchTracking(groupId),
    setPaid,
  };
}

export function useResumeGroupPayment() {
  const { authFetch } = useApp();

  const resume = useCallback(
    async (groupId: string) => {
      const res = await authFetch(`/api/groups/${groupId}/resume-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json.error || "No se pudo retomar el pago") as Error & {
          code?: string;
          minutesLeft?: number;
          status?: number;
        };
        err.code = json.code;
        err.minutesLeft = json.minutesLeft;
        err.status = res.status;
        throw err;
      }
      return json as { initPoint: string; orderId: string; reused?: boolean };
    },
    [authFetch],
  );

  return { resume };
}
