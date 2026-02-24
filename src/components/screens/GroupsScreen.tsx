"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Share2, Copy, ChevronLeft, MessageCircle, Trophy, BarChart3, CheckCircle2, Circle, DollarSign, Loader2, Send, SmilePlus, X, Trash2, Flag, VolumeX } from "lucide-react";
import { groups as mockGroups } from "@/lib/mock-data";
import { useApp } from "@/lib/store";
import { useGroups, useGroupDetail, useGroupActivity, useGroupChat } from "@/lib/hooks";
import { STICKERS_BY_CATEGORY, type Sticker } from "@/lib/stickers";
import { shareGroupInvite, shareRankingPosition } from "@/lib/share";
import ShareButton from "@/components/ShareButton";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
} as const;

type GroupTab = "ranking" | "activity" | "chat";

type GroupType = "fun" | "pool";

const ENTRY_FEE_PRESETS = [2000, 5000, 10000];

function formatChatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function GroupsScreen() {
  const { authFetch, dbUser } = useApp();
  const { groups: apiGroups, loading: groupsLoading, error: groupsError, refetch: refetchGroups } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { detail, loading: detailLoading } = useGroupDetail(selectedGroup);
  const { events: activityEvents, loading: activityLoading, loadMore, hasMore } = useGroupActivity(selectedGroup);
  const [groupTab, setGroupTab] = useState<GroupTab>("ranking");
  const {
    messages: chatMessages,
    loading: chatLoading,
    error: chatError,
    hasOlder: chatHasOlder,
    sendMessage,
    loadOlder: loadOlderMessages,
    deleteMessage,
    reportMessage,
    muteUser,
    clearError: clearChatError,
  } = useGroupChat(selectedGroup, groupTab === "chat");
  const [chatInput, setChatInput] = useState("");
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerCategory, setStickerCategory] = useState<string>("football");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (groupTab === "chat" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages.length, groupTab]);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [creating, setCreating] = useState(false);

  // Pool data from API
  const [poolData, setPoolData] = useState<{
    totalCollected: number;
    contributions: Array<{ userId: string; user: { id: string; name: string; avatar: string }; paid: boolean; amount: number }>;
  } | null>(null);

  // Create group modal state
  const [createGroupType, setCreateGroupType] = useState<GroupType>("fun");
  const [createEntryFee, setCreateEntryFee] = useState<number>(5000);
  const [createName, setCreateName] = useState("");
  const [createEmoji, setCreateEmoji] = useState("🏆");

  // Groups for display - API data with fallback to mock
  const displayGroups = useMemo(() => {
    if (groupsError || (apiGroups.length === 0 && !groupsLoading)) {
      return mockGroups;
    }
    return apiGroups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      tournament: g.tournament,
      members: g.memberCount,
      userPosition: 0, // Will be populated from detail
      userPoints: 0,
      maxPoints: 100,
      hasPool: g.hasPool,
      poolAmount: 0,
      currency: g.currency,
      entryFee: g.entryFee,
      poolDistribution: [50, 30, 20] as [number, number, number],
      inviteCode: g.inviteCode,
    }));
  }, [apiGroups, groupsLoading, groupsError]);

  // Fetch pool data when detail loads and has pool
  const fetchPoolData = useCallback(async (groupId: string) => {
    try {
      const res = await authFetch(`/api/groups/${groupId}/pool`);
      if (res.ok) {
        const data = await res.json();
        setPoolData({
          totalCollected: data.pool.totalCollected,
          contributions: data.pool.contributions,
        });
      }
    } catch {
      // Ignore pool errors
    }
  }, [authFetch]);

  useEffect(() => {
    if (selectedGroup && detail?.group.hasPool) {
      fetchPoolData(selectedGroup);
    } else {
      setPoolData(null);
    }
  }, [selectedGroup, detail, fetchPoolData]);

  const handleCopy = async () => {
    if (detail?.group) {
      const result = await shareGroupInvite({
        name: detail.group.name,
        emoji: detail.group.emoji,
        inviteCode: detail.group.inviteCode,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return result;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateGroup = async () => {
    if (!createName.trim()) return;

    setCreating(true);
    try {
      // Get tournament ID from first group or fetch matches
      let tournamentId = detail?.group.tournament.id;
      if (!tournamentId) {
        const matchRes = await authFetch("/api/matches");
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          tournamentId = matchData.tournament?.id;
        }
      }
      if (!tournamentId) {
        alert("No se encontro un torneo activo");
        setCreating(false);
        return;
      }

      const res = await authFetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          emoji: createEmoji,
          tournamentId,
          hasPool: createGroupType === "pool",
          entryFee: createGroupType === "pool" ? createEntryFee : 0,
          currency: "ARS",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al crear grupo");
        setCreating(false);
        return;
      }

      setShowCreate(false);
      setCreateGroupType("fun");
      setCreateEntryFee(5000);
      setCreateName("");
      setCreateEmoji("🏆");
      refetchGroups();
    } catch {
      alert("Error de conexion");
    }
    setCreating(false);
  };

  const handlePayEntry = async (groupId: string) => {
    try {
      const res = await authFetch(`/api/groups/${groupId}/pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setJustPaid(true);
        setTimeout(() => setJustPaid(false), 2500);
        fetchPoolData(groupId);
      }
    } catch {
      alert("Error al registrar pago");
    }
  };

  // Group detail view
  if (selectedGroup) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      );
    }

    const group = detail?.group;
    const ranking = detail?.ranking || [];

    if (!group) {
      // Fallback: find in display groups
      const fallbackGroup = displayGroups.find((g) => g.id === selectedGroup);
      if (!fallbackGroup) {
        setSelectedGroup(null);
        return null;
      }
    }

    const groupName = group?.name || "";
    const groupEmoji = group?.emoji || "";
    const groupMembers = group?.memberCount || 0;
    const groupTournament = group?.tournament.name || "";
    const groupHasPool = group?.hasPool || false;
    const groupEntryFee = group?.entryFee || 0;
    const groupCurrency = group?.currency || "ARS";
    const groupInviteCode = group?.inviteCode || "";
    const poolDistribution = [50, 30, 20];

    const contributions = poolData?.contributions || [];
    const totalCollected = poolData?.totalCollected || 0;
    const paidCount = contributions.filter((c) => c.paid).length;
    const totalTarget = groupMembers * groupEntryFee;
    const progressPct = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;
    const userContribution = contributions.find((c) => c.user.id === dbUser?.id);
    const userHasPaid = userContribution?.paid ?? false;

    // Find user in ranking
    const userInRanking = ranking.find((r) => r.userId === dbUser?.id);
    const userRankPosition = userInRanking ? ranking.indexOf(userInRanking) + 1 : 0;

    return (
      <motion.div className="space-y-4 pb-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedGroup(null)}
            className="h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-sm font-bold tracking-wider">
              {groupEmoji} {groupName}
            </h1>
            <p className="text-xs text-text-muted">{groupMembers} miembros • {groupTournament}</p>
          </div>
          <ShareButton
            onShare={() => shareGroupInvite({ name: groupName, emoji: groupEmoji, inviteCode: groupInviteCode })}
            variant="icon"
          />
        </div>

        {/* Pool section */}
        {groupHasPool && (
          <div className="space-y-3">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="text-xs font-display tracking-widest text-accent/70 mb-1 text-center">POZO ACUMULADO</div>
              <div className="font-display text-3xl font-bold text-accent text-center">
                ${totalCollected.toLocaleString()}
              </div>
              <div className="text-xs text-text-muted mt-0.5 text-center">
                de ${totalTarget.toLocaleString()} {groupCurrency} objetivo
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-primary">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="text-[10px] text-text-muted mt-1 text-right">{paidCount}/{groupMembers} pagaron</div>

              <div className="mt-3 flex justify-center gap-4">
                {[
                  { place: "1ro", pct: poolDistribution[0], icon: "🥇" },
                  { place: "2do", pct: poolDistribution[1], icon: "🥈" },
                  { place: "3ro", pct: poolDistribution[2], icon: "🥉" },
                ].map((d) => (
                  <div key={d.place} className="text-center">
                    <div className="text-lg">{d.icon}</div>
                    <div className="text-xs font-bold text-text-primary">{d.pct}%</div>
                    <div className="text-[10px] text-accent font-semibold">
                      ${Math.round((totalTarget * d.pct) / 100).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!userHasPaid && (
              <motion.button
                onClick={() => handlePayEntry(selectedGroup)}
                className="w-full rounded-xl bg-accent py-3.5 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-accent/90 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ boxShadow: "0 0 20px rgba(234,179,8,0.3)" }}
                whileTap={{ scale: 0.97 }}
              >
                <DollarSign size={16} />
                PAGAR MI ENTRADA — ${groupEntryFee.toLocaleString()}
              </motion.button>
            )}
            {justPaid && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center"
              >
                <span className="text-primary font-display text-sm font-bold tracking-wider">
                  Pago registrado!
                </span>
              </motion.div>
            )}

            {/* Contributions list */}
            {contributions.length > 0 && (
              <div>
                <div className="text-xs font-display tracking-widest text-text-muted mb-2">CONTRIBUCIONES</div>
                <div className="space-y-1">
                  {contributions.map((c) => (
                    <div
                      key={c.user.id}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                        c.paid ? "border-primary/20 bg-primary/5" : "border-border-default bg-bg-surface"
                      }`}
                    >
                      <span className="text-lg">{c.user.avatar}</span>
                      <span className="flex-1 text-sm font-medium">
                        {c.user.name}
                        {c.user.id === dbUser?.id && (
                          <span className="ml-1.5 text-[9px] font-display tracking-wider text-primary/70 border border-primary/30 rounded px-1">VOS</span>
                        )}
                      </span>
                      {c.paid ? (
                        <CheckCircle2 size={18} className="text-primary" />
                      ) : (
                        <Circle size={18} className="text-text-muted/40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setGroupTab("ranking")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-xs font-bold tracking-wider transition-all ${
              groupTab === "ranking"
                ? "bg-primary text-bg-primary"
                : "border border-border-default text-text-muted"
            }`}
          >
            <Trophy size={12} /> Ranking
          </button>
          <button
            onClick={() => setGroupTab("activity")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-xs font-bold tracking-wider transition-all ${
              groupTab === "activity"
                ? "bg-primary text-bg-primary"
                : "border border-border-default text-text-muted"
            }`}
          >
            <BarChart3 size={12} /> Actividad
          </button>
          <button
            onClick={() => setGroupTab("chat")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-xs font-bold tracking-wider transition-all ${
              groupTab === "chat"
                ? "bg-primary text-bg-primary"
                : "border border-border-default text-text-muted"
            }`}
          >
            <MessageCircle size={12} /> Chat
          </button>
        </div>

        {/* Ranking view */}
        {groupTab === "ranking" && (
          <motion.div className="space-y-1.5" variants={stagger} initial="hidden" animate="show">
            {ranking.map((player, i) => {
              const isUser = player.userId === dbUser?.id;
              const isLeader = i === 0;
              const isLast = i === ranking.length - 1 && ranking.length > 2;
              const position = i + 1;

              return (
                <motion.div
                  key={player.userId}
                  variants={fadeUp}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    isUser
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : isLeader
                      ? "border-accent/30 bg-accent/5"
                      : isLast
                      ? "border-danger/20 bg-danger/5"
                      : "border-border-default bg-bg-surface"
                  }`}
                >
                  <div className={`w-7 text-center font-display text-sm font-bold ${
                    position === 1 ? "text-accent" : position <= 3 ? "text-secondary" : "text-text-muted"
                  }`}>
                    {position === 1 ? "👑" : isLast ? "💀" : `#${position}`}
                  </div>
                  <div className="text-xl">{player.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold ${isUser ? "text-primary" : ""}`}>
                        {player.name}
                      </span>
                      {isUser && (
                        <span className="text-[9px] font-display tracking-wider text-primary/70 border border-primary/30 rounded px-1">VOS</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold">{player.points}</div>
                      <div className="text-[10px] text-text-muted">pts</div>
                    </div>
                    {/* Share button for user's position */}
                    {isUser && (
                      <ShareButton
                        onShare={() => shareRankingPosition(player.name, position, groupName)}
                        variant="icon"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Activity view */}
        {groupTab === "activity" && (
          <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="show">
            {activityLoading && activityEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : activityEvents.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                No hay actividad todavia
              </div>
            ) : (
              <>
                {activityEvents.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={fadeUp}
                    className="rounded-xl border border-border-default bg-bg-surface p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm">
                          <strong>{item.user}</strong>{" "}
                          <span className="text-text-secondary">{item.text}</span>
                        </p>
                        <span className="text-[10px] text-text-muted">
                          {(() => {
                            const diff = Date.now() - new Date(item.time).getTime();
                            const mins = Math.floor(diff / 60000);
                            if (mins < 1) return "ahora";
                            if (mins < 60) return `hace ${mins} min`;
                            const hours = Math.floor(mins / 60);
                            if (hours < 24) return `hace ${hours}h`;
                            return `hace ${Math.floor(hours / 24)}d`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    className="w-full text-center text-xs text-primary font-semibold py-2"
                  >
                    Cargar mas
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Chat view */}
        {groupTab === "chat" && (
          <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Error banner */}
            {chatError && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                <span className="flex-1">{chatError}</span>
                <button onClick={clearChatError}><X size={14} /></button>
              </div>
            )}

            {/* Messages container */}
            <div
              ref={chatContainerRef}
              className="max-h-[60vh] overflow-y-auto space-y-2 rounded-xl border border-border-default bg-bg-primary p-3"
            >
              {/* Load older */}
              {chatHasOlder && chatMessages.length > 0 && (
                <button
                  onClick={loadOlderMessages}
                  className="w-full text-center text-xs text-primary font-semibold py-1"
                  disabled={chatLoading}
                >
                  {chatLoading ? "Cargando..." : "Ver mensajes anteriores"}
                </button>
              )}

              {chatLoading && chatMessages.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">
                  No hay mensajes todavia. Se el primero!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  if (msg.deleted) {
                    return (
                      <div key={msg.id} className="text-center text-xs text-text-muted italic py-1">
                        Mensaje eliminado
                      </div>
                    );
                  }

                  // SYSTEM message
                  if (msg.type === "SYSTEM") {
                    return (
                      <div key={msg.id} className="flex justify-center py-1">
                        <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-1.5 text-xs text-text-secondary text-center max-w-[80%]">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  const isOwn = msg.userId === dbUser?.id;
                  const isAdmin = ranking.find((r) => r.userId === dbUser?.id)?.role === "ADMIN";

                  // STICKER message
                  if (msg.type === "STICKER") {
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
                        <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                          {!isOwn && msg.user && (
                            <span className="text-[10px] text-text-muted ml-1">{msg.user.name}</span>
                          )}
                          <div className="text-4xl py-1 px-2">{msg.content}</div>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] text-text-muted ${msg.pending ? "italic" : ""}`}>
                              {msg.pending ? "enviando..." : formatChatTime(msg.createdAt)}
                            </span>
                            {!isOwn && (
                              <button onClick={() => reportMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Flag size={10} className="text-text-muted" />
                              </button>
                            )}
                            {isAdmin && !isOwn && (
                              <>
                                <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={10} className="text-danger" />
                                </button>
                                {msg.userId && (
                                  <button onClick={() => muteUser(msg.userId!)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <VolumeX size={10} className="text-danger" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // TEXT message
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
                      <div className={`max-w-[70%]`}>
                        {!isOwn && msg.user && (
                          <span className="text-[10px] text-text-muted ml-1">{msg.user.name}</span>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            isOwn
                              ? "bg-primary text-bg-primary rounded-br-md"
                              : "bg-bg-surface border border-border-default rounded-bl-md"
                          } ${msg.pending ? "opacity-60" : ""}`}
                        >
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] text-text-muted ${isOwn ? "text-right w-full" : ""}`}>
                            {msg.pending ? "enviando..." : formatChatTime(msg.createdAt)}
                          </span>
                          {!isOwn && (
                            <button onClick={() => reportMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Flag size={10} className="text-text-muted" />
                            </button>
                          )}
                          {isAdmin && !isOwn && (
                            <>
                              <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={10} className="text-danger" />
                              </button>
                              {msg.userId && (
                                <button onClick={() => muteUser(msg.userId!)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <VolumeX size={10} className="text-danger" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sticker Picker */}
            <AnimatePresence>
              {showStickerPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden rounded-xl border border-border-default bg-bg-surface"
                >
                  <div className="flex gap-1 p-2 border-b border-border-default">
                    {Object.keys(STICKERS_BY_CATEGORY).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setStickerCategory(cat)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-display tracking-wider font-bold transition-colors ${
                          stickerCategory === cat
                            ? "bg-primary text-bg-primary"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {cat === "football" ? "Futbol" : cat === "cargadas" ? "Cargadas" : cat === "ranking" ? "Ranking" : "Boosters"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1 p-2">
                    {(STICKERS_BY_CATEGORY[stickerCategory] || []).map((sticker: Sticker) => (
                      <button
                        key={sticker.key}
                        onClick={async () => {
                          setSending(true);
                          setShowStickerPicker(false);
                          await sendMessage("STICKER", sticker.emoji, sticker.key);
                          setSending(false);
                        }}
                        className="flex flex-col items-center gap-0.5 rounded-lg p-2 hover:bg-bg-primary transition-colors"
                      >
                        <span className="text-2xl">{sticker.emoji}</span>
                        <span className="text-[9px] text-text-muted">{sticker.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Composer bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStickerPicker((v) => !v)}
                className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                  showStickerPicker
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border-default text-text-muted hover:text-text-primary"
                }`}
              >
                <SmilePlus size={18} />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 120))}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && chatInput.trim() && !sending) {
                      setSending(true);
                      const text = chatInput.trim();
                      setChatInput("");
                      await sendMessage("TEXT", text);
                      setSending(false);
                    }
                  }}
                  placeholder="Escribi un mensaje..."
                  className="w-full rounded-xl border border-border-default bg-bg-primary px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
                  maxLength={120}
                />
                {chatInput.length >= 80 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">
                    {chatInput.length}/120
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  if (!chatInput.trim() || sending) return;
                  setSending(true);
                  const text = chatInput.trim();
                  setChatInput("");
                  await sendMessage("TEXT", text);
                  setSending(false);
                }}
                disabled={!chatInput.trim() || sending}
                className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-bg-primary transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Invite button */}
        <ShareButton
          onShare={() => shareGroupInvite({ name: groupName, emoji: groupEmoji, inviteCode: groupInviteCode })}
          label="INVITAR AMIGOS"
          variant="primary"
        />
      </motion.div>
    );
  }

  // Groups list view
  if (groupsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <motion.div className="space-y-5 pb-6" variants={stagger} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-widest">MIS GRUPOS</h1>
          <p className="mt-0.5 text-base text-text-secondary">{displayGroups.length} grupos activos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-display text-xs font-bold tracking-wider text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.97]"
        >
          <Plus size={14} /> CREAR
        </button>
      </motion.div>

      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {displayGroups.map((group) => (
          <motion.button
            key={group.id}
            variants={fadeUp}
            onClick={() => setSelectedGroup(group.id)}
            className="w-full rounded-xl border border-border-default bg-bg-surface p-4 text-left transition-all hover:border-primary/20 hover:bg-bg-surface-hover active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{group.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{group.name}</div>
                <div className="text-xs text-text-muted">
                  {group.members} miembros • {group.tournament}
                </div>
              </div>
            </div>
            {group.hasPool && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                <BarChart3 size={12} />
                Pozo: ${group.poolAmount.toLocaleString()} {group.currency}
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border-t border-x md:border border-border-default bg-bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6 md:max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h3 className="font-display text-sm font-bold tracking-wider mb-4">CREAR GRUPO</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Nombre del grupo</label>
                  <input
                    type="text"
                    placeholder="Ej: Amigos del asado"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">Emoji del grupo</label>
                  <div className="flex gap-2 flex-wrap">
                    {["🏆", "⚽", "🔥", "🎯", "🍕", "🎮", "💰", "🏟️"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setCreateEmoji(emoji)}
                        className={`h-11 w-11 rounded-xl border text-xl flex items-center justify-center transition-colors ${
                          createEmoji === emoji
                            ? "border-primary/50 bg-primary/10"
                            : "border-border-default bg-bg-primary hover:border-primary/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">Torneo</label>
                  <div className="w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary">
                    Mundial 2026
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">Tipo</label>
                  <div className="space-y-2">
                    <button
                      onClick={() => setCreateGroupType("fun")}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        createGroupType === "fun"
                          ? "border-primary/40 bg-primary/5"
                          : "border-border-default bg-bg-primary hover:border-primary/20"
                      }`}
                    >
                      <div className="text-sm font-semibold">Solo por diversion</div>
                      <div className="text-xs text-text-muted">Sin dinero, solo gloria</div>
                    </button>
                    <button
                      onClick={() => setCreateGroupType("pool")}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        createGroupType === "pool"
                          ? "border-accent/40 bg-accent/5"
                          : "border-border-default bg-bg-primary hover:border-accent/30"
                      }`}
                    >
                      <div className="text-sm font-semibold flex items-center gap-1">
                        Con pozo de premios <span className="text-accent text-xs">💰</span>
                      </div>
                      <div className="text-xs text-text-muted">Cada miembro aporta al pozo</div>
                    </button>
                  </div>
                </div>

                {/* Entry fee section — only when pool type */}
                <AnimatePresence>
                  {createGroupType === "pool" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-xs text-text-muted mb-1.5 block">Entrada por persona</label>
                          <div className="flex gap-2">
                            {ENTRY_FEE_PRESETS.map((fee) => (
                              <button
                                key={fee}
                                onClick={() => setCreateEntryFee(fee)}
                                className={`flex-1 rounded-xl border py-2.5 font-display text-xs font-bold tracking-wider transition-colors ${
                                  createEntryFee === fee
                                    ? "border-accent/50 bg-accent/10 text-accent"
                                    : "border-border-default bg-bg-primary text-text-secondary hover:border-accent/30"
                                }`}
                              >
                                ${fee.toLocaleString()}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            placeholder="O ingresa monto personalizado"
                            value={createEntryFee || ""}
                            onChange={(e) => setCreateEntryFee(Number(e.target.value))}
                            className="mt-2 w-full rounded-xl border border-border-default bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none transition-colors"
                          />
                        </div>

                        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                          <div className="text-[10px] font-display tracking-widest text-accent/70 mb-1">PREVIEW DEL POZO (10 miembros)</div>
                          <div className="font-display text-xl font-bold text-accent">
                            ${(createEntryFee * 10).toLocaleString()} ARS
                          </div>
                          <div className="mt-2 flex gap-3 text-[10px] text-text-muted">
                            <span>🥇 50% = ${(createEntryFee * 10 * 0.5).toLocaleString()}</span>
                            <span>🥈 30% = ${(createEntryFee * 10 * 0.3).toLocaleString()}</span>
                            <span>🥉 20% = ${(createEntryFee * 10 * 0.2).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleCreateGroup}
                disabled={creating || !createName.trim()}
                className="mt-6 w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}
              >
                {creating ? (
                  <><Loader2 size={16} className="animate-spin" /> CREANDO...</>
                ) : (
                  "CREAR GRUPO"
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
