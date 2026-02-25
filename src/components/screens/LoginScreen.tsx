"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { createBrowserClient } from "@/lib/supabase";

export default function LoginScreen() {
  const { setScreen } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  const handleEmailAuth = async () => {
    setError("");
    if (!email || !password) {
      setError("Completa email y contraseña");
      return;
    }
    setLoading(true);
    const supabase = createBrowserClient();

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation disabled — session available immediately
        window.location.reload();
      } else {
        // Email confirmation enabled — tell user to check email
        setError("Revisa tu email para confirmar la cuenta y despues inicia sesion.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Reload to let middleware set cookies, then auth listener handles navigation
        window.location.reload();
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 md:mt-12">
      <motion.div
        className="w-full max-w-sm md:max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="text-6xl mb-4">⚽</div>
        <h1 className="font-display text-2xl font-bold tracking-[0.2em] text-primary mb-2">
          ARMATUPRODE
        </h1>
        <p className="text-text-secondary text-base mb-10 leading-relaxed">
          Crea tu prode, invita amigos,<br />
          demostra quien sabe mas
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!showEmailForm ? (
          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 px-6 text-sm font-bold text-gray-800 transition-all hover:bg-gray-100 active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>

            <button
              onClick={() => setShowEmailForm(true)}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg-surface py-4 px-6 text-sm font-bold text-text-primary transition-all hover:bg-bg-surface-hover active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              Entrar con email
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-left">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-2xl border border-border-default bg-bg-surface px-5 py-4 text-base text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full rounded-2xl border border-border-default bg-bg-surface px-5 py-4 text-base text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleEmailAuth}
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-bg-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Cargando..." : isSignUp ? "Crear cuenta" : "Iniciar sesion"}
            </button>
            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => setShowEmailForm(false)}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                Volver
              </button>
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-primary hover:underline"
              >
                {isSignUp ? "Ya tengo cuenta" : "Crear cuenta nueva"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-xs text-text-muted leading-relaxed">
          Al continuar aceptas los{" "}
          <a href="/terms" className="text-primary underline">terminos y condiciones</a>
          {" "}y la{" "}
          <a href="/privacy" className="text-primary underline">politica de privacidad</a>
        </p>
      </motion.div>
    </div>
  );
}
