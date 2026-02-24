"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { PoolContribution } from "@/lib/mock-data";
import { createBrowserClient } from "@/lib/supabase";
import type { User as SupabaseUser, SupabaseClient } from "@supabase/supabase-js";

export type AppScreen =
  | "splash"
  | "login"
  | "setup"
  | "main"
  | "join-group"
  | "live-match"
  | "shop"
  | "notifications"
  | "rules";

export interface DbUser {
  id: string;
  authId: string;
  email: string;
  name: string;
  avatar: string;
  country: string;
  countryName: string;
  xp: number;
  coins: number;
  referralCode?: string | null;
}

interface AppState {
  screen: AppScreen;
  setScreen: (s: AppScreen) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  authUser: SupabaseUser | null;
  dbUser: DbUser | null;
  setDbUser: (u: DbUser | null) => void;
  authLoading: boolean;
  coins: number;
  setCoins: (v: number) => void;
  unreadCount: number;
  setUnreadCount: (v: number) => void;
  boosters: Record<string, number>;
  addBooster: (type: string) => void;
  useBooster: (type: string) => boolean;
  poolContributions: Record<string, PoolContribution[]>;
  contributeToPool: (groupId: string) => void;
  liveMatchId: string | null;
  setLiveMatchId: (id: string | null) => void;
  selectedTournamentId: string | null;
  setSelectedTournamentId: (id: string | null) => void;
  signOut: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}


let supabaseInstance: SupabaseClient | null = null;
function getSupabase() {
  if (!supabaseInstance) supabaseInstance = createBrowserClient();
  return supabaseInstance;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<AppScreen>("splash");
  const [activeTab, setActiveTab] = useState("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [coins, setCoins] = useState(350);
  const [unreadCount, setUnreadCount] = useState(0);
  const [boosters, setBoosters] = useState<Record<string, number>>({ x2: 0, shield: 0, second_chance: 0 });
  const [poolContributions, setPoolContributions] = useState<Record<string, PoolContribution[]>>({});
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Helper: fetch with auth token in header
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const existingHeaders = (options.headers || {}) as Record<string, string>;
    const headers: Record<string, string> = {
      ...existingHeaders,
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return fetch(url, { ...options, headers });
  }, []);

  // Supabase auth listener
  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        // Try to fetch DB profile with auth token
        try {
          const res = await fetch("/api/users", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              setDbUser(data.user);
              setCoins(data.user.coins);
              setIsLoggedIn(true);
              setScreen("main");
            } else {
              setScreen("setup");
            }
          } else {
            setScreen("setup");
          }
        } catch (err) {
          console.error("Auth fetch error:", err);
          // On 404 go to setup, on other errors show login
          setScreen("setup");
        }
      } else {
        // No session, go past splash
        setScreen("login");
      }
      setAuthLoading(false);
    }).catch((err) => {
      console.error("Supabase getSession error:", err);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
        } else {
          setAuthUser(null);
          setDbUser(null);
          setIsLoggedIn(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setAuthUser(null);
    setDbUser(null);
    setIsLoggedIn(false);
    setScreen("login");
  }, []);

  const contributeToPool = useCallback((groupId: string) => {
    setPoolContributions((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] || []).map((c) =>
        c.userId === "u1" ? { ...c, paid: true } : c
      ),
    }));
  }, []);

  const addBooster = (type: string) => {
    setBoosters((prev) => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
  };

  const useBooster = (type: string): boolean => {
    if ((boosters[type] || 0) <= 0) return false;
    setBoosters((prev) => ({ ...prev, [type]: prev[type] - 1 }));
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        screen, setScreen,
        activeTab, setActiveTab,
        isLoggedIn, setIsLoggedIn,
        authUser, dbUser, setDbUser, authLoading,
        coins, setCoins,
        unreadCount, setUnreadCount,
        boosters, addBooster, useBooster,
        poolContributions, contributeToPool,
        liveMatchId, setLiveMatchId,
        selectedTournamentId, setSelectedTournamentId,
        signOut,
        authFetch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
