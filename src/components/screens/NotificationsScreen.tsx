"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useNotifications } from "@/lib/hooks";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export default function NotificationsScreen() {
  const { setScreen, setUnreadCount } = useApp();
  const { notifications, unreadCount, loading, markAsRead } = useNotifications();

  const markAllRead = async () => {
    await markAsRead();
    setUnreadCount(0);
  };

  const handleClick = async (id: string, read: boolean) => {
    if (!read) {
      await markAsRead([id]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-5 md:px-8 py-6 mx-auto max-w-lg md:max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setScreen("main")}
          className="h-9 w-9 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold tracking-widest">NOTIFICACIONES</h1>
        {unreadCount > 0 ? (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-primary font-semibold"
          >
            <Check size={14} /> Leer todo
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Unread count */}
      {unreadCount > 0 && (
        <div className="mb-4 text-xs text-text-muted">
          <span className="font-display font-bold text-primary">{unreadCount}</span> sin leer
        </div>
      )}

      {/* Notifications list */}
      <motion.div className="space-y-2" variants={stagger} initial="hidden" animate="show">
        {notifications.map((notif) => (
          <motion.button
            key={notif.id}
            variants={fadeUp}
            onClick={() => handleClick(notif.id, notif.read)}
            className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${
              notif.read
                ? "border-border-default bg-bg-surface"
                : "border-primary/20 bg-primary/[0.03]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{notif.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-bold ${!notif.read ? "text-text-primary" : "text-text-secondary"}`}>
                    {notif.title}
                  </span>
                  {!notif.read && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{notif.body}</p>
                <span className="text-[10px] text-text-muted mt-1.5 block">{timeAgo(notif.createdAt)}</span>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {notifications.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-text-muted">No tenes notificaciones</p>
        </div>
      )}
    </div>
  );
}
