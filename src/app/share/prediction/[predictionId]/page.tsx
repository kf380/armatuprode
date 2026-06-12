import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ predictionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { predictionId } = await params;
  const pred = await prisma.prediction.findUnique({
    where: { id: predictionId },
    select: {
      scoreA: true,
      scoreB: true,
      user: { select: { name: true } },
      match: { select: { teamAName: true, teamBName: true } },
    },
  });
  if (!pred) return { title: "ArmatuProde" };
  const title = `${pred.user.name}: ${pred.match.teamAName} ${pred.scoreA}-${pred.scoreB} ${pred.match.teamBName}`;
  return {
    title,
    description: "Mirá el pronóstico y armá el tuyo en ArmatuProde.",
    openGraph: {
      title,
      description: "Mirá el pronóstico y armá el tuyo en ArmatuProde.",
      type: "article",
    },
  };
}

/**
 * Share landing for a single prediction. Has rich OG image (opengraph-image.tsx)
 * for WhatsApp/Twitter/IG preview. Browsers that follow the URL get redirected
 * to the SPA so the user lands on the actual app.
 */
export default async function SharePredictionPage({ params }: Props) {
  const { predictionId } = await params;
  const pred = await prisma.prediction.findUnique({
    where: { id: predictionId },
    select: { id: true },
  });
  if (!pred) notFound();
  // Quick redirect so a human clicking the link lands in the app.
  redirect("/");
}
