"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  LayoutDashboard,
  Settings,
  Users,
  Plus,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useApp } from "@/lib/store";
import {
  useOrganizationDetail,
  useOrgGroups,
  useUpdateOrganization,
  type ApiOrgGroup,
  type ApiOrganizationDetail,
} from "@/lib/hooks";
import { createBrowserClient } from "@/lib/supabase";
import { uploadOrgLogo } from "@/lib/storage";

type TabKey = "grupos" | "config" | "miembros";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "grupos", label: "Grupos", icon: LayoutDashboard },
  { key: "config", label: "Config", icon: Settings },
  { key: "miembros", label: "Miembros", icon: Users },
];

const STATUS_LABEL: Record<string, { text: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  ACTIVE: { text: "Activo", tone: "ok" },
  PENDING_PAYMENT: { text: "Pendiente pago", tone: "warn" },
  PAYMENT_FAILED: { text: "Pago fallido", tone: "danger" },
  PAUSED: { text: "Pausado", tone: "warn" },
  FINISHED: { text: "Finalizado", tone: "neutral" },
  CANCELLED: { text: "Cancelado", tone: "danger" },
  DRAFT: { text: "Borrador", tone: "neutral" },
};

export default function OrgAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { authLoading, isLoggedIn } = useApp();
  const { org, loading: orgLoading, error: orgError, refetch: refetchOrg } = useOrganizationDetail(id);
  const { groups, loading: groupsLoading, refetch: refetchGroups } = useOrgGroups(id);
  const [tab, setTab] = useState<TabKey>("grupos");

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = `/?next=/org/${id}`;
    }
  }, [authLoading, isLoggedIn, id]);

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (orgError || !org) {
    return (
      <div className="min-h-screen px-5 py-12 max-w-md mx-auto">
        <Link href="/organizer" className="text-xs text-text-muted">← Volver</Link>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-text-primary">
          {orgError || "No se pudo cargar la organización"}
        </div>
      </div>
    );
  }

  if (!org.isOwner && org.role === "PLAYER") {
    return (
      <div className="min-h-screen px-5 py-12 max-w-md mx-auto">
        <Link href="/organizer" className="text-xs text-text-muted">← Volver</Link>
        <div className="mt-6 rounded-2xl border border-border-default bg-bg-surface p-5 text-sm text-text-primary">
          Solo el dueño o admins pueden acceder a este panel.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-6 pb-20">
      <Link
        href="/organizer"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={12} /> Mis prodes
      </Link>

      {/* Org header */}
      <div className="flex items-center gap-3 mb-4">
        {org.logoUrl ? (
          <Image
            src={org.logoUrl}
            alt={org.name}
            width={48}
            height={48}
            className="rounded-xl object-cover border border-border-default"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl">
            🏢
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold tracking-wide truncate">{org.name}</h1>
          <div className="text-xs text-text-muted">
            armatuprode.com.ar/{org.slug}
          </div>
        </div>
        <a
          href={`/${org.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-text-muted hover:text-primary"
          title="Ver página pública"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 mt-4 mb-4 border-b border-border-default">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-display tracking-wider font-bold border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "grupos" && (
        <TabGrupos groups={groups} loading={groupsLoading} onRefresh={refetchGroups} />
      )}
      {tab === "config" && <TabConfig org={org} onSaved={refetchOrg} />}
      {tab === "miembros" && <TabMiembros groups={groups} loading={groupsLoading} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Grupos
// ---------------------------------------------------------------------------

function TabGrupos({
  groups,
  loading,
  onRefresh,
}: {
  groups: ApiOrgGroup[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copyInvite(code: string) {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted font-display tracking-wider uppercase">
          {groups.length} grupo{groups.length !== 1 ? "s" : ""}
        </span>
        <Link
          href="/organizer/create"
          className="inline-flex items-center gap-1.5 text-xs font-display font-bold tracking-wider text-primary hover:text-primary/80"
        >
          <Plus size={12} /> Crear grupo
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center text-sm text-text-muted">
          Todavía no hay grupos en esta organización.{" "}
          <Link href="/organizer/create" className="text-primary hover:underline">
            Crear el primero
          </Link>
        </div>
      ) : (
        groups.map((g) => {
          const status = STATUS_LABEL[g.status] || { text: g.status, tone: "neutral" as const };
          return (
            <div
              key={g.id}
              className="flex items-center gap-3 rounded-2xl border border-border-default bg-bg-surface px-4 py-3"
            >
              <span className="text-xl shrink-0">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm truncate">{g.name}</div>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  <StatusPill tone={status.tone}>{status.text}</StatusPill>
                  <span className="flex items-center gap-1">
                    <Users size={10} /> {g.memberCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyInvite(g.inviteCode)}
                  className="text-text-muted hover:text-primary"
                  title="Copiar link de invitación"
                >
                  {copied === g.inviteCode ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                </button>
                <Link
                  href={`/organizer/${g.id}`}
                  className="text-text-muted hover:text-primary"
                  title="Administrar grupo"
                >
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Config
// ---------------------------------------------------------------------------

function TabConfig({
  org,
  onSaved,
}: {
  org: ApiOrganizationDetail;
  onSaved: () => void;
}) {
  const { updateOrg } = useUpdateOrganization();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const supabase = createBrowserClient();
      const url = await uploadOrgLogo(supabase, org.id, file);
      setLogoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await updateOrg(org.id, {
        name: name.trim(),
        description: description.trim() || null,
        logoUrl: logoUrl || null,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div>
        <label className="block text-xs font-display font-bold tracking-wider text-text-muted uppercase mb-2">
          Logo
        </label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logo"
              width={56}
              height={56}
              className="rounded-xl object-cover border border-border-default"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-bg-surface border border-border-default flex items-center justify-center text-2xl">
              🏢
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs font-display font-bold tracking-wider text-primary hover:text-primary/80 disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : "Subir imagen"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
            {logoUrl && (
              <button
                onClick={() => setLogoUrl("")}
                className="text-xs text-text-muted hover:text-danger"
              >
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-display font-bold tracking-wider text-text-muted uppercase mb-1.5">
          Nombre
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/60"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-display font-bold tracking-wider text-text-muted uppercase mb-1.5">
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={200}
          className="w-full rounded-xl border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/60 resize-none"
          placeholder="Aparece en la página pública de tu organización"
        />
      </div>

      {/* Slug (read-only) */}
      <div>
        <label className="block text-xs font-display font-bold tracking-wider text-text-muted uppercase mb-1.5">
          URL pública
        </label>
        <div className="rounded-xl border border-border-default bg-bg-primary px-3 py-2.5 text-sm text-text-muted select-all">
          armatuprode.com.ar/{org.slug}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-xs text-danger">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full rounded-xl bg-primary text-white font-display font-bold tracking-wider text-sm py-3 hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {success ? "✓ Guardado" : saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Miembros
// ---------------------------------------------------------------------------

function TabMiembros({
  groups,
  loading,
}: {
  groups: ApiOrgGroup[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  const totalPlayers = groups.reduce((sum, g) => sum + g.memberCount, 0);
  const activeGroups = groups.filter((g) => g.status === "ACTIVE");

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total jugadores" value={totalPlayers} />
        <StatCard label="Grupos activos" value={activeGroups.length} />
      </div>

      {/* Per-group breakdown */}
      {groups.length > 0 && (
        <div>
          <p className="text-xs text-text-muted font-display tracking-wider uppercase mb-2">
            Por grupo
          </p>
          <div className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-xl border border-border-default bg-bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{g.emoji}</span>
                  <span className="text-sm font-display font-bold truncate">{g.name}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                  <Users size={11} /> {g.memberCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center text-sm text-text-muted">
          Creá grupos para empezar a tener jugadores.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "text-primary bg-primary/10"
      : tone === "warn"
        ? "text-accent bg-accent/10"
        : tone === "danger"
          ? "text-danger bg-danger/10"
          : "text-text-muted bg-bg-primary";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-display font-bold tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
      <div className="text-2xl font-display font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
