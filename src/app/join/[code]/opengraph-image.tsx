import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function OGImage({ params }: Props) {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      _count: { select: { members: true } },
      tournament: { select: { name: true } },
    },
  });

  const groupName = group?.name || "Grupo";
  const groupEmoji = group?.emoji || "🏆";
  const memberCount = group?._count.members || 0;
  const tournamentName = group?.tournament.name || "Mundial 2026";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0E1A 0%, #111827 50%, #0A0E1A 100%)",
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 20 }}>{groupEmoji}</div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: "0.05em",
            marginBottom: 12,
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          {groupName}
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#9CA3AF",
            marginBottom: 32,
          }}
        >
          {memberCount} miembros • {tournamentName}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(16, 185, 129, 0.15)",
            border: "2px solid rgba(16, 185, 129, 0.4)",
            borderRadius: 16,
            padding: "16px 40px",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#10B981" }}>
            Unite en ArmatuProde
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
