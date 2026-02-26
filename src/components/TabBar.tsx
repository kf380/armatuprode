"use client";

import { Home, Calendar, Users, Trophy, User } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "matches", label: "Partidos", icon: Calendar },
  { id: "groups", label: "Grupos", icon: Users },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "profile", label: "Perfil", icon: User },
];

export default function TabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <>
      {/* Desktop: top horizontal nav */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 border-b border-border-default/60 bg-bg-surface/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl lg:max-w-4xl items-center justify-around px-8 py-2.5">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                aria-label={tab.label}
                className="relative flex items-center gap-2 px-4 py-2 transition-all"
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors ${
                    isActive
                      ? "text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : "text-text-muted"
                  }`}
                />
                <span
                  className={`text-xs font-bold tracking-widest uppercase font-display transition-colors ${
                    isActive ? "text-primary" : "text-text-muted"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator-desktop"
                    className="absolute -bottom-2.5 left-2 right-2 h-[3px] rounded-full bg-primary"
                    style={{ boxShadow: "0 0 12px rgba(16,185,129,0.5)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border-default/60 bg-bg-surface/90 backdrop-blur-2xl">
        <div className="mx-auto flex items-center justify-around px-1 pt-2 pb-2">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                aria-label={tab.label}
                className="relative flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1 transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-2 h-[3px] w-8 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 12px rgba(16,185,129,0.5)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={`transition-colors ${
                    isActive
                      ? "text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : "text-text-muted"
                  }`}
                />
                <span
                  className={`text-[9px] font-bold tracking-wider uppercase font-display transition-colors truncate max-w-full ${
                    isActive ? "text-primary" : "text-text-muted"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Safe area for iPhone */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
