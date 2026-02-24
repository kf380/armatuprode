"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppProvider, useApp } from "@/lib/store";
import TabBar from "@/components/TabBar";
import SplashScreen from "@/components/screens/SplashScreen";
import LoginScreen from "@/components/screens/LoginScreen";
import SetupScreen from "@/components/screens/SetupScreen";
import HomeScreen from "@/components/screens/HomeScreen";
import MatchesScreen from "@/components/screens/MatchesScreen";
import GroupsScreen from "@/components/screens/GroupsScreen";
import RankingScreen from "@/components/screens/RankingScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import JoinGroupScreen from "@/components/screens/JoinGroupScreen";
import LiveMatchScreen from "@/components/screens/LiveMatchScreen";
import ShopScreen from "@/components/screens/ShopScreen";
import NotificationsScreen from "@/components/screens/NotificationsScreen";
import RulesScreen from "@/components/screens/RulesScreen";

function DeepLinkHandler() {
  const { isLoggedIn, setScreen, authLoading } = useApp();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    const refCode = params.get("ref");

    // Save referral code for later
    if (refCode) {
      localStorage.setItem("pendingRefCode", refCode);
    }

    if (!joinCode) return;

    if (authLoading) return; // Wait for auth to resolve

    if (isLoggedIn) {
      // Already logged in — go straight to join screen
      // The JoinGroupScreen will read the code from the URL
      setScreen("join-group");
    } else {
      // Not logged in — save code for after login
      localStorage.setItem("pendingJoinCode", joinCode);
    }
  }, [isLoggedIn, authLoading, setScreen]);

  // After login, check for pending join code
  useEffect(() => {
    if (!isLoggedIn) return;
    const pendingCode = localStorage.getItem("pendingJoinCode");
    if (pendingCode) {
      setScreen("join-group");
    }
  }, [isLoggedIn, setScreen]);

  return null;
}

function AppContent() {
  const { screen, activeTab, setActiveTab } = useApp();

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  // Full-screen screens (no tab bar)
  if (screen === "splash") return <><DeepLinkHandler /><SplashScreen /></>;
  if (screen === "login") return <><DeepLinkHandler /><LoginScreen /></>;
  if (screen === "setup") return <><DeepLinkHandler /><SetupScreen /></>;
  if (screen === "join-group") return <JoinGroupScreen />;
  if (screen === "live-match") return <LiveMatchScreen />;
  if (screen === "shop") return <ShopScreen />;
  if (screen === "notifications") return <NotificationsScreen />;
  if (screen === "rules") return <RulesScreen />;

  // Main app with tab bar
  return (
    <div className="min-h-screen bg-bg-primary">
      <DeepLinkHandler />
      <main className="mx-auto max-w-lg md:max-w-2xl lg:max-w-4xl px-5 md:px-8 lg:px-12 pt-6 pb-24 md:pb-6 md:pt-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "home" && <HomeScreen onNavigate={handleNavigate} />}
            {activeTab === "matches" && <MatchesScreen />}
            {activeTab === "groups" && <GroupsScreen />}
            {activeTab === "ranking" && <RankingScreen />}
            {activeTab === "profile" && <ProfileScreen />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
