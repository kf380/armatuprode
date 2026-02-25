"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Zap, Shield, ShieldCheck, Coins, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";

const boosterDefs = [
  {
    id: "x2",
    name: "BOOSTER x2",
    description: "Duplica los puntos que ganes en un partido",
    icon: <Zap size={24} />,
    color: "text-accent",
    bgColor: "bg-accent/10 border-accent/30",
    price: 100,
  },
  {
    id: "shield",
    name: "ESCUDO",
    description: "Si fallas, no perdes la racha de aciertos",
    icon: <Shield size={24} />,
    color: "text-secondary",
    bgColor: "bg-secondary/10 border-secondary/30",
    price: 150,
  },
  {
    id: "insurance",
    name: "SEGURO",
    description: "Si fallas, recuperas 150 coins",
    icon: <ShieldCheck size={24} />,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10 border-purple-400/30",
    price: 200,
  },
];

const coinPacks = [
  { id: "small", coins: 500, price: 999, popular: false },
  { id: "medium", coins: 1200, price: 1999, popular: true },
  { id: "large", coins: 3000, price: 3999, popular: false },
];

export default function ShopScreen() {
  const { setScreen, coins, setCoins, authFetch } = useApp();
  const [purchased, setPurchased] = useState<string | null>(null);
  const [ownedBoosters, setOwnedBoosters] = useState<Record<string, number>>({});
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [buying, setBuying] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await authFetch("/api/shop/boosters");
      if (res.ok) {
        const data = await res.json();
        setOwnedBoosters(data.boosters || {});
        setCoins(data.coins);
      }
    } catch {
      // Keep defaults
    } finally {
      setLoadingInventory(false);
    }
  }, [authFetch, setCoins]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleBuyBooster = async (boosterId: string, price: number) => {
    if (coins < price || buying) return;
    setBuying(true);
    try {
      const res = await authFetch("/api/shop/buy-booster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: boosterId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoins(data.coins);
        setOwnedBoosters((prev) => ({
          ...prev,
          [boosterId]: (prev[boosterId] || 0) + 1,
        }));
        setPurchased(boosterId);
        setTimeout(() => setPurchased(null), 1500);
      } else {
        const data = await res.json();
        alert(data.error || "Error al comprar");
      }
    } catch {
      alert("Error de conexion");
    }
    setBuying(false);
  };

  const [buyingCoins, setBuyingCoins] = useState(false);

  const handleBuyCoins = async (packId: string) => {
    if (buyingCoins) return;
    setBuyingCoins(true);
    try {
      const res = await authFetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "coin_pack", packId }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.initPoint;
      } else {
        const data = await res.json();
        alert(data.error || "Error al iniciar el pago");
        setBuyingCoins(false);
      }
    } catch {
      alert("Error de conexion");
      setBuyingCoins(false);
    }
  };

  if (loadingInventory) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-5 md:px-8 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] mx-auto max-w-lg md:max-w-2xl lg:max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setScreen("main")}
          className="h-9 w-9 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold tracking-widest">TIENDA</h1>
        <div className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5">
          <Coins size={14} className="text-accent" />
          <span className="font-display text-sm font-bold text-accent">{coins}</span>
        </div>
      </div>

      {/* Boosters */}
      <div className="mb-8">
        <h2 className="font-display text-xs font-bold tracking-widest text-text-muted mb-4">BOOSTERS</h2>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {boosterDefs.map((booster) => {
            const owned = ownedBoosters[booster.id] || 0;
            const canAfford = coins >= booster.price;
            const justPurchased = purchased === booster.id;

            return (
              <motion.div
                key={booster.id}
                className={`relative rounded-2xl border p-5 transition-all ${booster.bgColor}`}
              >
                <AnimatePresence>
                  {justPurchased && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-bg-surface/95 rounded-2xl z-10"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-1">✅</div>
                        <div className="font-display text-sm font-bold text-primary">Comprado!</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-bg-primary/50 ${booster.color}`}>
                    {booster.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display text-sm font-bold tracking-wider">{booster.name}</h3>
                      {owned > 0 && (
                        <span className="text-[10px] font-display tracking-wider text-text-muted border border-border-default rounded-full px-2 py-0.5">
                          x{owned}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mb-3">{booster.description}</p>
                    <button
                      onClick={() => handleBuyBooster(booster.id, booster.price)}
                      disabled={!canAfford || buying}
                      className={`rounded-xl px-4 py-2 font-display text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                        canAfford && !buying
                          ? "bg-bg-primary border border-border-default text-text-primary hover:border-text-muted/30"
                          : "bg-bg-primary/50 border border-border-default/50 text-text-muted cursor-not-allowed"
                      }`}
                    >
                      <Coins size={12} className="text-accent" />
                      {booster.price} coins
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Coin packs */}
      <div>
        <h2 className="font-display text-xs font-bold tracking-widest text-text-muted mb-4">OBTENER COINS</h2>
        <div className="space-y-3">
          {coinPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleBuyCoins(pack.id)}
              disabled={buyingCoins}
              className={`w-full rounded-2xl border p-5 flex items-center justify-between transition-all hover:bg-bg-surface-hover active:scale-[0.99] disabled:opacity-50 ${
                pack.popular
                  ? "border-accent/30 bg-accent/5"
                  : "border-border-default bg-bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-accent">
                      {pack.coins.toLocaleString()}
                    </span>
                    <span className="text-sm text-text-muted">coins</span>
                    {pack.popular && (
                      <span className="text-[9px] font-display tracking-wider text-accent border border-accent/30 rounded-full px-2 py-0.5 bg-accent/10">
                        POPULAR
                      </span>
                    )}
                  </div>
                  {pack.popular && (
                    <div className="text-[10px] text-primary mt-0.5">Mejor valor</div>
                  )}
                </div>
              </div>
              <div className="font-display text-base font-bold">
                ${pack.price.toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
