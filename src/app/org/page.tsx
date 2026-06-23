"use client";

import { useEffect } from "react";
import { Loader2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useApp } from "@/lib/store";
import { useOrganizations } from "@/lib/hooks";
import { useRouter } from "next/navigation";

export default function OrgIndexPage() {
  const { authLoading, isLoggedIn } = useApp();
  const { organizations, loading } = useOrganizations();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = "/?next=/org";
    }
  }, [authLoading, isLoggedIn]);

  // Auto-redirect if only one org
  useEffect(() => {
    if (!loading && organizations.length === 1) {
      router.replace(`/org/${organizations[0].id}`);
    }
  }, [loading, organizations, router]);

  if (authLoading || loading || (!loading && organizations.length === 1)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <h1 className="font-display text-xl font-bold tracking-wide mb-1">Mis organizaciones</h1>
      <p className="text-sm text-text-muted mb-6">
        Elegí una organización para gestionar su prode.
      </p>

      {organizations.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-8 text-center">
          <div className="text-3xl mb-3">🏢</div>
          <p className="text-sm text-text-muted mb-4">
            Todavía no tenés ninguna organización creada.
          </p>
          <Link
            href="/organizer/create"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white font-display font-bold tracking-wider text-sm px-5 py-2.5 hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Crear organización
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/org/${org.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border-default bg-bg-surface px-4 py-4 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              {org.logoUrl ? (
                <Image
                  src={org.logoUrl}
                  alt={org.name}
                  width={40}
                  height={40}
                  className="rounded-xl object-cover border border-border-default shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-lg shrink-0">
                  🏢
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm truncate">{org.name}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  armatuprode.com.ar/{org.slug}
                </div>
              </div>
              <ChevronRight
                size={14}
                className="text-text-muted group-hover:text-primary transition-colors shrink-0"
              />
            </Link>
          ))}

          <Link
            href="/organizer/create"
            className="flex items-center gap-3 rounded-2xl border border-dashed border-border-default px-4 py-4 hover:border-primary/40 transition-colors text-text-muted hover:text-primary"
          >
            <div className="w-10 h-10 rounded-xl border border-dashed border-border-default flex items-center justify-center shrink-0">
              <Plus size={16} />
            </div>
            <span className="text-sm font-display font-bold tracking-wider">
              Nueva organización
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
