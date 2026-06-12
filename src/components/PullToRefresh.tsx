"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * Lightweight pull-to-refresh for mobile. Triggers `onRefresh` when the user
 * pulls down ≥ 70px at the top of the scroll container. Desktop is no-op.
 * No external dep; uses native touch events + framer motion for spring.
 */
const THRESHOLD = 70;
const MAX_PULL = 120;

export default function PullToRefresh({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) return;
      const damped = Math.min(MAX_PULL, delta * 0.5);
      setPull(damped);
    };

    const onTouchEnd = async () => {
      if (startY.current == null || refreshing) {
        startY.current = null;
        setPull(0);
        return;
      }
      startY.current = null;
      if (pull >= THRESHOLD) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  const visible = pull > 8 || refreshing;
  const indicatorTop = refreshing ? THRESHOLD : pull;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <>
      {visible && (
        <motion.div
          className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-[65] flex items-center justify-center"
          style={{
            top: 0,
            transform: `translate(-50%, ${indicatorTop - 36}px)`,
          }}
        >
          <div className="h-10 w-10 rounded-full bg-bg-surface border border-border-default shadow-lg flex items-center justify-center">
            {refreshing ? (
              <Loader2 size={18} className="animate-spin text-primary" />
            ) : (
              <motion.div style={{ rotate: progress * 360 }} className="text-primary">
                <Loader2 size={18} />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
      <motion.div animate={{ y: refreshing ? 24 : pull * 0.4 }} transition={{ type: "spring", damping: 20 }}>
        {children}
      </motion.div>
    </>
  );
}
