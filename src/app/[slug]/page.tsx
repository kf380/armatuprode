import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Users, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CheckBallLogo } from "@/components/CheckBallLogo";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) return { title: "ArmatuProde" };

  return {
    title: `${org.name} - Prode en ArmatuProde`,
    description: org.description ?? `Unite al prode de ${org.name} y competi con todos.`,
    openGraph: {
      title: org.name,
      description: org.description ?? `Prode de ${org.name}`,
      images: org.logoUrl ? [org.logoUrl] : [],
      type: "website",
    },
  };
}

export default async function PublicOrgPage({ params }: Props) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      groups: {
        where: { status: "ACTIVE" },
        include: { _count: { select: { members: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!org) notFound();

  const activeGroups = org.groups;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="border-b border-border-default px-5 py-4 flex items-center justify-between">
        <Link href="/">
          <CheckBallLogo size={28} />
        </Link>
        <Link
          href="/"
          className="text-xs text-text-muted hover:text-text-primary font-display tracking-wider"
        >
          Crear mi prode
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-5 py-10">
        {/* Org branding */}
        <div className="flex items-center gap-4 mb-8">
          {org.logoUrl ? (
            <Image
              src={org.logoUrl}
              alt={org.name}
              width={64}
              height={64}
              className="rounded-2xl object-cover border border-border-default"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
              🏆
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide">{org.name}</h1>
            {org.description && (
              <p className="text-sm text-text-muted mt-0.5">{org.description}</p>
            )}
          </div>
        </div>

        {/* Groups */}
        {activeGroups.length === 0 ? (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center text-sm text-text-muted">
            No hay prodes activos por ahora.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-text-muted font-display tracking-wider uppercase mb-2">
              Prodes activos
            </p>
            {activeGroups.map((g) => (
              <Link
                key={g.id}
                href={`/?join=${g.inviteCode}`}
                className="flex items-center gap-3 rounded-2xl border border-border-default bg-bg-surface px-4 py-4 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
              >
                <span className="text-2xl shrink-0">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sm truncate">{g.name}</div>
                  <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                    <Users size={10} />
                    {g._count.members} jugadores
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-text-muted group-hover:text-primary transition-colors shrink-0"
                />
              </Link>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-text-muted">
          Powered by{" "}
          <Link href="/" className="text-primary hover:underline">
            armatuprode.com.ar
          </Link>
        </p>
      </div>
    </div>
  );
}
