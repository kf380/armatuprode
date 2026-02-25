const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://armatuprode.com.ar";

interface ShareContent {
  text: string;
  url?: string;
}

export function whatsappUrl(text: string, url?: string): string {
  const fullText = url ? `${text}\n${url}` : text;
  return `https://wa.me/?text=${encodeURIComponent(fullText)}`;
}

export async function copyToClipboard(text: string, url?: string): Promise<boolean> {
  const fullText = url ? `${text}\n${url}` : text;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(fullText);
    return true;
  }
  return false;
}

export async function nativeShare(content: ShareContent): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        text: content.text,
        url: content.url,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function getGroupInviteContent(group: { name: string; emoji?: string; inviteCode: string }): ShareContent {
  return {
    text: `Unite a *${group.emoji || ""} ${group.name}* en ArmatuProde!\nPredeci resultados y competi con amigos ⚽`,
    url: `${APP_URL}/join/${group.inviteCode}`,
  };
}

export function getPredictionContent(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number): ShareContent {
  return {
    text: `${match.teamA.flag} ${match.teamA.code} ${scoreA}-${scoreB} ${match.teamB.code} ${match.teamB.flag}\nYo ya puse mi prediccion en ArmatuProde. Vos que decis?`,
    url: APP_URL,
  };
}

export function getExactResultContent(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number, points: number): ShareContent {
  const emoji = points === 3 ? "🎯" : "✅";
  const label = points === 3 ? "Acerte el resultado exacto!" : "Acerte el ganador!";
  return {
    text: `${emoji} ${label}\n${match.teamA.flag} ${match.teamA.code} ${scoreA}-${scoreB} ${match.teamB.code} ${match.teamB.flag}\nPodes ganarme? Juga en ArmatuProde`,
    url: APP_URL,
  };
}

export function getReferralContent(code: string): ShareContent {
  return {
    text: "Proba ArmatuProde! Arma tu prode y competi con amigos ⚽",
    url: `${APP_URL}?ref=${code}`,
  };
}

export function getRankingContent(name: string, position: number, groupName?: string): ShareContent {
  const where = groupName ? ` en ${groupName}` : " en el ranking global";
  return {
    text: `Soy #${position}${where} de ArmatuProde! Podes ganarme? ⚽`,
    url: APP_URL,
  };
}

// Legacy wrappers for backward compat (deprecated — use ShareMenu instead)
export async function triggerShare(content: ShareContent): Promise<"shared" | "copied" | "whatsapp"> {
  const fullText = content.url ? `${content.text}\n${content.url}` : content.text;
  window.open(whatsappUrl(content.text, content.url), "_blank");
  return "whatsapp";
}

export function shareGroupInvite(group: { name: string; emoji?: string; inviteCode: string }) {
  const c = getGroupInviteContent(group);
  return triggerShare(c);
}
export function sharePrediction(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number) {
  return triggerShare(getPredictionContent(match, scoreA, scoreB));
}
export function shareExactResult(match: { teamA: { code: string; flag: string }; teamB: { code: string; flag: string } }, scoreA: number, scoreB: number, points: number) {
  return triggerShare(getExactResultContent(match, scoreA, scoreB, points));
}
export function shareReferral(code: string) {
  return triggerShare(getReferralContent(code));
}
export function shareRankingPosition(name: string, position: number, groupName?: string) {
  return triggerShare(getRankingContent(name, position, groupName));
}
