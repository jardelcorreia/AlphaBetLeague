"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = false }: LogoProps) {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-14 w-14",
    xl: "h-20 w-24",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative shrink-0", sizes[size])}>
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
          <path d="M50 10L85 85H68L50 45L32 85H15L50 10Z" fill="url(#logo-gradient)" />
          <circle cx="50" cy="70" r="12" fill="hsl(var(--accent))" className="animate-float" />
          <path d="M50 25L62 55H38L50 25Z" fill="rgba(255,255,255,0.2)" />
          <defs>
            <linearGradient id="logo-gradient" x1="50" y1="10" x2="50" y2="85" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="#1e40af" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-black italic uppercase tracking-tighter text-primary", size === "lg" ? "text-2xl" : "text-lg")}>Alpha<span className="text-foreground dark:text-white">Bet</span></span>
          <span className={cn("font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-60", size === "lg" ? "text-[8px]" : "text-[7px]")}>League 2026</span>
        </div>
      )}
    </div>
  );
}
