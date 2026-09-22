"use client";

import React, { useState, useEffect, useRef } from "react";
import { Match, PlayerPredictions } from "@/lib/types";
import { cn, getTeamAbrev } from "@/lib/utils";
import { Camera, Share2, X } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog";

interface RoundCardDialogProps {
  roundName: string;
  matches: Match[];
  predictions: PlayerPredictions;
  allUsers: any[];
  triggerClassName?: string;
  buttonLabel?: string;
}

function RoundCardView({
  roundName,
  matches,
  predictions,
  sortedUsers,
}: {
  roundName: string;
  matches: Match[];
  predictions: PlayerPredictions;
  sortedUsers: any[];
}) {
  const [cardScale, setCardScale] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  const COL_WIDTH = 90;
  const CONFRONTO_WIDTH = 105;
  const BASE_WIDTH = CONFRONTO_WIDTH + sortedUsers.length * COL_WIDTH + 40;
  const BASE_HEIGHT = 580;

  useEffect(() => {
    const calculateScale = () => {
      if (typeof window === "undefined") return;
      const dialogWidth = Math.min(window.innerWidth * 0.95, 700);
      const availableWidth = dialogWidth - 32;
      const newScale = Math.min(1, availableWidth / BASE_WIDTH);
      setCardScale(newScale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [BASE_WIDTH]);

  const scaledWidth = BASE_WIDTH * cardScale;
  const scaledHeight = BASE_HEIGHT * cardScale;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div
        style={{
          width: scaledWidth,
          height: scaledHeight,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          ref={cardRef}
          className="bg-[#020617] p-3 flex flex-col relative shadow-2xl overflow-hidden border border-white/10 rounded-2xl"
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `scale(${cardScale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[80px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[80px] rounded-full" />
          </div>

          <div className="relative z-10 flex justify-between items-center mb-2 border-b border-white/10 pb-3">
            <Logo showText />
            <div className="bg-white/5 px-3 h-8 rounded border border-white/10 text-center">
              <span
                className="text-[12px] font-black text-accent italic uppercase"
                style={{ lineHeight: "30px" }}
              >
                {roundName}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center mb-1 px-2 h-6">
              <div
                style={{
                  width: CONFRONTO_WIDTH,
                  minWidth: CONFRONTO_WIDTH,
                  maxWidth: CONFRONTO_WIDTH,
                  flexShrink: 0,
                }}
                className="text-[9px] font-black uppercase text-white/20 italic h-full"
              >
                <span style={{ lineHeight: "24px" }} className="block w-full">
                  CONFRONTO
                </span>
              </div>
              {sortedUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    width: COL_WIDTH,
                    minWidth: COL_WIDTH,
                    maxWidth: COL_WIDTH,
                    flexShrink: 0,
                  }}
                  className="flex justify-center items-center text-center text-[12px] font-black uppercase text-accent px-1 h-full truncate"
                >
                  <span style={{ lineHeight: "24px" }} className="block w-full">
                    {u.username}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col justify-between py-1">
              {Array.from({ length: 10 }).map((_, idx) => {
                const match = matches[idx];
                const homeAbrev = match ? getTeamAbrev(match.homeTeam) : "---";
                const awayAbrev = match ? getTeamAbrev(match.awayTeam) : "---";
                const abrevDesc = `${homeAbrev} x ${awayAbrev}`;
                const isInvalid = match?.isValidForPoints === false;

                return (
                  <div
                    key={idx}
                    className="flex items-center bg-white/[0.03] px-2 rounded-xl border border-white/[0.02]"
                    style={{ height: 44 }}
                  >
                    <div
                      style={{
                        width: CONFRONTO_WIDTH,
                        minWidth: CONFRONTO_WIDTH,
                        maxWidth: CONFRONTO_WIDTH,
                        flexShrink: 0,
                      }}
                      className="flex gap-1.5 pr-2 h-full"
                    >
                      <span
                        className="text-[7px] font-black text-white/10 italic tabular-nums"
                        style={{ lineHeight: "42px" }}
                      >
                        #{idx + 1}
                      </span>
                      <div className="flex-1 overflow-hidden h-full">
                        <span
                          className={cn(
                            "block text-[13px] font-black italic uppercase truncate tracking-tighter",
                            isInvalid ? "text-white/20" : "text-white"
                          )}
                          style={{ lineHeight: "42px" }}
                        >
                          {abrevDesc}
                        </span>
                      </div>
                    </div>

                    {sortedUsers.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          width: COL_WIDTH,
                          minWidth: COL_WIDTH,
                          maxWidth: COL_WIDTH,
                          flexShrink: 0,
                        }}
                        className="px-1 h-8"
                      >
                        <div className="bg-black/60 w-full h-full rounded-xl border border-white/5 text-center overflow-hidden">
                          <div
                            className={cn(
                              "w-full h-full whitespace-nowrap",
                              isInvalid ? "text-white/20" : "text-white"
                            )}
                            style={{ lineHeight: "30px" }}
                          >
                            <span className="text-[16px] font-black tabular-nums tracking-tighter">
                              {predictions[u.id]?.[idx]?.homeScore || ""}
                            </span>
                            <span className="text-[12px] font-black opacity-30 mx-1">
                              -
                            </span>
                            <span className="text-[16px] font-black tabular-nums tracking-tighter">
                              {predictions[u.id]?.[idx]?.awayScore || ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 flex justify-center items-center mt-2 pt-2 border-t border-white/5">
            <span className="text-[7px] font-black text-white/10 uppercase tracking-[0.5em] pb-1">
              AlphaBet League • Visão de Dados Técnica
            </span>
          </div>
        </div>
      </div>
      <div className="text-center py-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">
          Card pronto para print manual!
        </p>
      </div>
    </div>
  );
}

export function RoundCardDialog({
  roundName,
  matches,
  predictions,
  allUsers,
  triggerClassName,
  buttonLabel = "Gerar Card da Rodada",
}: RoundCardDialogProps) {
  const sortedUsers = [...allUsers].sort((a, b) =>
    (a.username || "").localeCompare(b.username || "")
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className={cn(
            "bg-accent hover:bg-accent/90 text-accent-foreground font-black italic uppercase rounded-full gap-2 shadow-lg shadow-accent/20 h-10 px-6",
            triggerClassName
          )}
        >
          <Camera className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[95vh] p-0 border-none bg-black/95 backdrop-blur-xl shadow-2xl focus:outline-none rounded-[2rem] overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Card da Rodada</DialogTitle>
          <DialogDescription>
            Visualização técnica dos palpites da rodada para compartilhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col p-4 gap-3">
          <div className="flex justify-between items-center px-1">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Share2 className="h-3 w-3 text-accent" /> AlphaBet League
            </p>
            <DialogClose className="text-white/40 hover:text-white transition-colors p-1">
              <X className="h-5 w-5" />
            </DialogClose>
          </div>

          <RoundCardView
            roundName={roundName}
            matches={matches}
            predictions={predictions}
            sortedUsers={sortedUsers}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
