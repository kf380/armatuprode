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
  qualifiedTeam: string | null;
  prediction: { scoreA: number; scoreB: number; points: number; predictedQualifier?: string | null } | null;
}

export interface ScreenMatch {
  id: string;
  teamA: { code: string; name: string; flag: string };
  teamB: { code: string; name: string; flag: string };
  date: string;
  time: string;
  group: string;
  phase: string;
  status: "upcoming" | "finished" | "live";
  scoreA?: number;
  scoreB?: number;
  qualifiedTeam?: string | null;
  userPrediction: { scoreA: number; scoreB: number; predictedQualifier?: string | null } | null;
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
    phase: m.phase,
    status: m.status === "UPCOMING" ? "upcoming" : m.status === "FINISHED" ? "finished" : "live",
    qualifiedTeam: m.qualifiedTeam,
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

// --- Chat types ---

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

  return { messages, loading, error, hasOlder, sendMessage, loadOlder, deleteMessage, reportMessage, muteUser, clearError };
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
