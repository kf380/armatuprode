import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Mi pronóstico — ArmatuProde";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Open Graph image for a single prediction. Used by /share/prediction/[id]
 * — when this URL is shared on WhatsApp/Twitter/etc, the preview card
 * shows this rich image with score + result + points.
 */
export default async function Image({ params }: { params: { predictionId: string } }) {
  const pred = await prisma.prediction.findUnique({
    where: { id: params.predictionId },
    include: {
      user: { select: { name: true, avatar: true } },
      match: { select: { teamAName: true, teamAFlag: true, teamBName: true, teamBFlag: true, scoreA: true, scoreB: true, status: true } },
    },
  });

  if (!pred) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#0B1220", color: "#FAFAF7", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
          ArmatuProde
        </div>
      ),
      { ...size },
    );
  }

  const m = pred.match;
  const isFinished = m.status === "FINISHED" && m.scoreA != null && m.scoreB != null;
  const isExact = isFinished && pred.scoreA === m.scoreA && pred.scoreB === m.scoreB;
  const isWinner =
    isFinished &&
    pred.scoreA !== m.scoreA &&
    Math.sign(pred.scoreA - pred.scoreB) === Math.sign((m.scoreA ?? 0) - (m.scoreB ?? 0));
  const resultLabel = isExact ? "✓ EXACTO" : isWinner ? "✓ GANADOR" : isFinished ? "✗" : "EN ESPERA";
  const resultColor = isExact ? "#10B981" : isWinner ? "#10B981" : isFinished ? "#EF4444" : "#94A3B8";
  const pts = pred.points ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0B1220 0%, #0F1B2E 60%, #0B1220 100%)",
          color: "#FAFAF7",
          padding: 60,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div style={{ fontSize: 14, letterSpacing: 8, color: "#10B981", fontWeight: 700 }}>ARMATUPRODE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 28, color: "#94A3B8", marginBottom: 16 }}>
            {pred.user.avatar} {pred.user.name} predijo
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
              <div style={{ fontSize: 80 }}>{m.teamAFlag}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{m.teamAName}</div>
            </div>
            <div style={{ fontSize: 140, fontWeight: 900, color: "#10B981", letterSpacing: 4 }}>
              {pred.scoreA} - {pred.scoreB}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
              <div style={{ fontSize: 80 }}>{m.teamBFlag}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{m.teamBName}</div>
            </div>
          </div>

          {isFinished && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 16 }}>
              <div style={{ fontSize: 28, color: "#94A3B8" }}>Resultado real: {m.scoreA}-{m.scoreB}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: resultColor }}>{resultLabel}</div>
              {pts > 0 && (
                <div style={{ fontSize: 28, fontWeight: 800, color: "#F5B82E" }}>+{pts} pts</div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1E293B", paddingTop: 20 }}>
          <div style={{ fontSize: 18, color: "#94A3B8" }}>armatuprode.com.ar</div>
          <div style={{ fontSize: 18, color: "#10B981", fontWeight: 700 }}>Armá el tuyo</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
