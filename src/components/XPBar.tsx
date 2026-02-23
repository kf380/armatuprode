"use client";

import { motion } from "framer-motion";

export default function XPBar({
  level,
  levelName,
  xp,
  xpNext,
  compact = false,
}: {
  level: number;
  levelName: string;
  xp: number;
  xpNext: number;
  compact?: boolean;
}) {
  const pct = (xp / xpNext) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-display text-accent font-bold">Nv.{level}</span>
        <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <span className="text-[10px] text-text-muted font-mono">{xp}/{xpNext}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-display text-accent font-bold tracking-wider">
            Nivel {level}
          </span>
          <span className="text-xs text-text-secondary">- {levelName}</span>
        </div>
        <span className="text-xs font-mono text-text-muted">
          {xp} / {xpNext} XP
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-primary border border-border-default">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #10B981, #3B82F6, #8B5CF6)",
            boxShadow: "0 0 10px rgba(16,185,129,0.4)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
