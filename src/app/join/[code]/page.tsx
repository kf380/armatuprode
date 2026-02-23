import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });

  if (!group) {
    return { title: "ArmatuProde - Grupo no encontrado" };
  }

  return {
    title: `Unite a ${group.emoji} ${group.name} - ArmatuProde`,
    description: `${group._count.members} miembros ya estan compitiendo. Unite y demostra quien sabe mas!`,
    openGraph: {
      title: `${group.emoji} ${group.name}`,
      description: `${group._count.members} miembros jugando en ArmatuProde`,
      type: "website",
    },
  };
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  redirect(`/?join=${code}`);
}
