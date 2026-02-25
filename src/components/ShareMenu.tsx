"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, MessageCircle, Share2 } from "lucide-react";
import { whatsappUrl, copyToClipboard, nativeShare } from "@/lib/share";

interface ShareContent {
  text: string;
  url?: string;
}

interface ShareMenuProps {
  open: boolean;
  onClose: () => void;
  content: ShareContent;
  title?: string;
}

export default function ShareMenu({ open, onClose, content, title = "Compartir" }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleWhatsApp = () => {
    window.open(whatsappUrl(content.text, content.url), "_blank");
    onClose();
  };

  const handleCopy = async () => {
    await copyToClipboard(content.text, content.url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1200);
  };

  const handleNativeShare = async () => {
    const shared = await nativeShare(content);
    if (shared) onClose();
  };

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-bg-surface border-t border-border-default p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-sm font-bold tracking-widest">{title}</h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            <div className="rounded-xl bg-bg-primary border border-border-default p-3 mb-5 text-sm text-text-secondary leading-relaxed break-words">
              {content.text}
              {content.url && (
                <div className="mt-1 text-primary text-xs truncate">{content.url}</div>
              )}
            </div>

            {/* Share options */}
            <div className="space-y-2.5">
              {/* WhatsApp — primary */}
              <button
                onClick={handleWhatsApp}
                className="flex w-full items-center gap-4 rounded-xl bg-[#25D366] p-4 text-white font-bold transition-all hover:bg-[#25D366]/90 active:scale-[0.98]"
              >
                <MessageCircle size={22} fill="white" />
                <span className="text-sm">Enviar por WhatsApp</span>
              </button>

              {/* Copy link */}
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-4 rounded-xl border border-border-default bg-bg-primary p-4 text-text-primary font-semibold transition-all hover:bg-bg-surface active:scale-[0.98]"
              >
                {copied ? <Check size={22} className="text-primary" /> : <Copy size={22} />}
                <span className="text-sm">{copied ? "Copiado!" : "Copiar link"}</span>
              </button>

              {/* Native share (mobile) */}
              {hasNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex w-full items-center gap-4 rounded-xl border border-border-default bg-bg-primary p-4 text-text-primary font-semibold transition-all hover:bg-bg-surface active:scale-[0.98]"
                >
                  <Share2 size={22} />
                  <span className="text-sm">Mas opciones...</span>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
