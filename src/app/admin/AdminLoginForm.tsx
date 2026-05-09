"use client";

import { useState } from "react";

export default function AdminLoginForm() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Credenciales invalidas");
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-white text-center">Admin Panel</h1>
        <input
          type="password"
          placeholder="Admin API Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-lg bg-[#111827] border border-[#1F2937] text-white px-4 py-3 text-sm"
          autoFocus
        />
        {error && (
          <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || key.length === 0}
          className="w-full rounded-lg bg-[#10B981] text-[#0A0E1A] font-bold py-3 text-sm disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
