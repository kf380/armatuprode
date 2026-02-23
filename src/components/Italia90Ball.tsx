"use client";

import { motion } from "framer-motion";

export default function Italia90Ball({ size = 180 }: { size?: number }) {
  return (
    <motion.div
      className="relative"
      style={{ width: size, height: size }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
          transform: "scale(1.5)",
        }}
      />

      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]"
      >
        <defs>
          {/* Ball gradient - light grey base like the real Etrusco */}
          <radialGradient id="ballGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#f0f0f0" />
            <stop offset="60%" stopColor="#d8d8d8" />
            <stop offset="100%" stopColor="#a0a0a0" />
          </radialGradient>

          {/* Etrusco panel gradient - the green accent */}
          <linearGradient id="panelGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="panelGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="panelGrad3" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Shine highlight */}
          <radialGradient id="shine" cx="35%" cy="30%" r="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Shadow beneath */}
          <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ball shadow */}
        <ellipse cx="100" cy="190" rx="50" ry="8" fill="url(#shadow)" />

        {/* Main ball circle */}
        <circle cx="100" cy="95" r="85" fill="url(#ballGrad)" />

        {/* Panel lines - the characteristic seam pattern */}
        <g stroke="#bbb" strokeWidth="0.8" fill="none" opacity="0.5">
          {/* Horizontal seams */}
          <path d="M 30,70 Q 60,55 100,55 Q 140,55 170,70" />
          <path d="M 25,100 Q 60,90 100,88 Q 140,90 175,100" />
          <path d="M 30,130 Q 60,120 100,118 Q 140,120 170,130" />
          {/* Vertical seams */}
          <path d="M 60,25 Q 55,60 55,95 Q 55,130 60,165" />
          <path d="M 100,15 Q 100,55 100,95 Q 100,135 100,175" />
          <path d="M 140,25 Q 145,60 145,95 Q 145,130 140,165" />
        </g>

        {/* Etrusco Triade decorations - the iconic design element */}
        {/* Top center triade */}
        <g transform="translate(100, 55)" opacity="0.9">
          <motion.g
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Etrusco-style flowing curves */}
            <path
              d="M -15,-8 C -10,-15 -3,-18 0,-12 C 3,-18 10,-15 15,-8"
              fill="none" stroke="url(#panelGrad1)" strokeWidth="2.5" strokeLinecap="round"
            />
            <path
              d="M -12,0 C -8,-8 -2,-10 0,-5 C 2,-10 8,-8 12,0"
              fill="none" stroke="url(#panelGrad1)" strokeWidth="2" strokeLinecap="round"
            />
            <circle cx="0" cy="-5" r="2" fill="#10B981" />
          </motion.g>
        </g>

        {/* Left triade */}
        <g transform="translate(55, 95) rotate(-30)" opacity="0.85">
          <motion.g
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          >
            <path
              d="M -14,-7 C -9,-14 -3,-16 0,-10 C 3,-16 9,-14 14,-7"
              fill="none" stroke="url(#panelGrad2)" strokeWidth="2.5" strokeLinecap="round"
            />
            <path
              d="M -11,0 C -7,-7 -2,-9 0,-4 C 2,-9 7,-7 11,0"
              fill="none" stroke="url(#panelGrad2)" strokeWidth="2" strokeLinecap="round"
            />
            <circle cx="0" cy="-4" r="2" fill="#10B981" />
          </motion.g>
        </g>

        {/* Right triade */}
        <g transform="translate(145, 95) rotate(30)" opacity="0.85">
          <motion.g
            animate={{ opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          >
            <path
              d="M -14,-7 C -9,-14 -3,-16 0,-10 C 3,-16 9,-14 14,-7"
              fill="none" stroke="url(#panelGrad3)" strokeWidth="2.5" strokeLinecap="round"
            />
            <path
              d="M -11,0 C -7,-7 -2,-9 0,-4 C 2,-9 7,-7 11,0"
              fill="none" stroke="url(#panelGrad3)" strokeWidth="2" strokeLinecap="round"
            />
            <circle cx="0" cy="-4" r="2" fill="#10B981" />
          </motion.g>
        </g>

        {/* Bottom left triade */}
        <g transform="translate(70, 135) rotate(-15)" opacity="0.75">
          <motion.g
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
          >
            <path
              d="M -12,-6 C -8,-12 -2,-14 0,-9 C 2,-14 8,-12 12,-6"
              fill="none" stroke="url(#panelGrad1)" strokeWidth="2" strokeLinecap="round"
            />
            <path
              d="M -9,0 C -6,-6 -2,-8 0,-3 C 2,-8 6,-6 9,0"
              fill="none" stroke="url(#panelGrad1)" strokeWidth="1.5" strokeLinecap="round"
            />
            <circle cx="0" cy="-3" r="1.5" fill="#10B981" />
          </motion.g>
        </g>

        {/* Bottom right triade */}
        <g transform="translate(130, 135) rotate(15)" opacity="0.75">
          <motion.g
            animate={{ opacity: [0.55, 0.95, 0.55] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          >
            <path
              d="M -12,-6 C -8,-12 -2,-14 0,-9 C 2,-14 8,-12 12,-6"
              fill="none" stroke="url(#panelGrad2)" strokeWidth="2" strokeLinecap="round"
            />
            <path
              d="M -9,0 C -6,-6 -2,-8 0,-3 C 2,-8 6,-6 9,0"
              fill="none" stroke="url(#panelGrad2)" strokeWidth="1.5" strokeLinecap="round"
            />
            <circle cx="0" cy="-3" r="1.5" fill="#10B981" />
          </motion.g>
        </g>

        {/* Shine overlay */}
        <circle cx="100" cy="95" r="85" fill="url(#shine)" />

        {/* Subtle rim stroke */}
        <circle cx="100" cy="95" r="85" fill="none" stroke="#999" strokeWidth="0.5" opacity="0.4" />
      </svg>

      {/* Floating particles around the ball */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary"
          style={{
            width: 3 + Math.random() * 3,
            height: 3 + Math.random() * 3,
            left: `${20 + Math.random() * 60}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            y: [0, -20 - Math.random() * 20, 0],
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}
