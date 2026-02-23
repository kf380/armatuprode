const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://armatuprode.com.ar";

interface ShareContent {
  text: string;
  url?: string;
}

function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function triggerShare(content: ShareContent): Promise<"shared" | "copied" | "whatsapp"> {
  const fullText = content.url ? `${content.text}\n${content.url}` : content.text;

  // Mobile: try WhatsApp deep link first
  if (isMobile()) {
    window.open(whatsappUrl(fullText), "_blank");
    return "whatsapp";
  }

  // Desktop: try Web Share API
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        text: content.text,
        url: content.url,
      });
      return "shared";
    } catch {
      // User cancelled or not supported, fall through to clipboard
    }
  }

  // Fallback: clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(fullText);
    return "copied";
  }

  return "copied";
}

export function shareGroupInvite(group: { name: string; emoji?: string; inviteCode: string }): Promise<"shared" | "copied" | "whatsapp"> {
  const url = `${APP_URL}/join/${group.inviteCode}`;
  return triggerShare({
    text: `Unite a *${group.emoji || ""} ${group.name}* en ArmatuProde! Arma tu prode y competi con amigos`,
    url,
  });
}

export function sharePrediction(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number): Promise<"shared" | "copied" | "whatsapp"> {
  return triggerShare({
    text: `${match.teamA.flag} ${match.teamA.code} ${scoreA}-${scoreB} ${match.teamB.code} ${match.teamB.flag}\nYo ya puse mi prediccion en ArmatuProde. Vos que decis?`,
    url: APP_URL,
  });
}

export function shareExactResult(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number, points: number): Promise<"shared" | "copied" | "whatsapp"> {
  const emoji = points === 3 ? "🎯" : "✅";
  const label = points === 3 ? "Acerte el resultado exacto!" : "Acerte el ganador!";
  return triggerShare({
    text: `${emoji} ${label}\n${match.teamA.flag} ${match.teamA.code} ${scoreA}-${scoreB} ${match.teamB.code} ${match.teamB.flag}\nPodes ganarme? Juga en ArmatuProde`,
    url: APP_URL,
  });
}

export function shareReferral(code: string): Promise<"shared" | "copied" | "whatsapp"> {
  const url = `${APP_URL}?ref=${code}`;
  return triggerShare({
    text: "Probá ArmatuProde! Armá tu prode y competí con amigos",
    url,
  });
}

export function shareRankingPosition(name: string, position: number, groupName?: string): Promise<"shared" | "copied" | "whatsapp"> {
  const where = groupName ? ` en ${groupName}` : " en el ranking global";
  return triggerShare({
    text: `Soy #${position}${where} de ArmatuProde! Podes ganarme?`,
    url: APP_URL,
  });
}
