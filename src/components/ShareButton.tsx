"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import ShareMenu from "@/components/ShareMenu";

interface ShareContent {
  text: string;
  url?: string;
}

interface ShareButtonProps {
  content: ShareContent;
  label?: string;
  variant?: "primary" | "outline" | "icon";
  className?: string;
  menuTitle?: string;
  // Legacy support
  onShare?: () => Promise<"shared" | "copied" | "whatsapp">;
}

export default function ShareButton({ content, onShare, label = "COMPARTIR", variant = "outline", className = "", menuTitle }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (onShare && !content) {
      // Legacy mode
      onShare();
      return;
    }
    setOpen(true);
  };

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleClick}
          className={`h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-primary transition-colors ${className}`}
          title={label}
        >
          <Share2 size={14} />
        </button>
        {content && <ShareMenu open={open} onClose={() => setOpen(false)} content={content} title={menuTitle} />}
      </>
    );
  }

  const baseClasses = variant === "primary"
    ? "rounded-xl bg-[#25D366] py-3 font-display text-sm font-bold tracking-widest text-white transition-all hover:bg-[#25D366]/90 active:scale-[0.98]"
    : "rounded-xl border border-primary/30 bg-primary/10 py-3 font-display text-xs font-bold tracking-widest text-primary transition-all hover:bg-primary/20";

  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full flex items-center justify-center gap-2 ${baseClasses} ${className}`}
      >
        <Share2 size={14} />
        {label}
      </button>
      {content && <ShareMenu open={open} onClose={() => setOpen(false)} content={content} title={menuTitle} />}
    </>
  );
}
