"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  onShare: () => Promise<"shared" | "copied" | "whatsapp">;
  label?: string;
  variant?: "primary" | "outline" | "icon";
  className?: string;
}

export default function ShareButton({ onShare, label = "COMPARTIR", variant = "outline", className = "" }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClick = async () => {
    const result = await onShare();
    if (result === "copied") {
      setFeedback("Copiado!");
    } else if (result === "whatsapp") {
      setFeedback("Compartido!");
    } else {
      setFeedback("Compartido!");
    }
    setTimeout(() => setFeedback(null), 2000);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className={`h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-primary transition-colors ${className}`}
        title={label}
      >
        {feedback ? <span className="text-[10px] text-primary font-bold">✓</span> : <Share2 size={14} />}
      </button>
    );
  }

  const baseClasses = variant === "primary"
    ? "rounded-xl bg-[#25D366] py-3 font-display text-sm font-bold tracking-widest text-white transition-all hover:bg-[#25D366]/90 active:scale-[0.98]"
    : "rounded-xl border border-primary/30 bg-primary/10 py-3 font-display text-xs font-bold tracking-widest text-primary transition-all hover:bg-primary/20";

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-2 ${baseClasses} ${className}`}
    >
      {feedback ? (
        <span>{feedback}</span>
      ) : (
        <>
          <Share2 size={14} />
          {label}
        </>
      )}
    </button>
  );
}
