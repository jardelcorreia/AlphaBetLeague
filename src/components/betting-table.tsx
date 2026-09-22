"use client";

import React from "react";
import { Prediction, PlayerPredictions, Match } from "@/lib/types";
import { cn, cleanTeamName, getTeamAbrev } from "@/lib/utils";
import { AlertCircle, ShieldCheck, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

interface BettingTableProps {
  roundName: string;
  matches: Match[];
  predictions: PlayerPredictions;
  setPrediction: (userId: string, matchIndex: number, type: 'home' | 'away', value: string) => void;
  results: Prediction[];
  placaresOcultos: boolean;
  currentPlayerId: string;
  isAdmin?: boolean;
  allUsers: any[];
  isLocked?: boolean;
}

export function BettingTable({
  matches,
  predictions,
  results,
  placaresOcultos,
  currentPlayerId,
  allUsers,
}: BettingTableProps) {
  const getPoints = (userId: string, idx: number) => {
    const match = matches[idx];
    if (!match || match.isValidForPoints === false) return null;
    const res = results[idx];
    const originalIdx = match.originalIndex ?? idx;
    const pred = predictions[userId]?.[originalIdx];
    if (!res?.homeScore || !res?.awayScore || !pred?.homeScore || !pred?.awayScore) return null;
    const rh = parseInt(res.homeScore), ra = parseInt(res.awayScore);
    const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
    if (ph === rh && pa === ra) return 3;
    if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) return 1;
    return 0;
  };

  const sortedUsers = [...allUsers].sort((a, b) => (a.username || "").localeCompare(b.username || ""));

  if (!matches || matches.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-4 glass-card rounded-xl border-dashed border-2">
        <AlertCircle className="h-8 w-8 text-muted-foreground opacity-30" />
        <p className="text-xs font-black italic uppercase text-muted-foreground">Aguardando dados oficiais.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {matches.map((match, idx) => {
          const isOutOfWindow = match.isValidForPoints === false;
          const originalIdx = match.originalIndex ?? idx;
          const desc = `${cleanTeamName(match.homeTeam)} x ${cleanTeamName(match.awayTeam)}`;
          const isLive = match.status === 'live';
          const isFinished = match.status === 'finished';

          return (
            <div key={match.id || idx} className={cn(
              "glass-card border-none rounded-xl overflow-hidden group transition-all duration-300",
              isOutOfWindow ? "opacity-60 saturate-50" : "hover:ring-1 hover:ring-primary/20 shadow-md"
            )}>
              <div className="bg-muted/30 dark:bg-slate-900/40 px-4 py-2 flex items-center justify-between gap-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-black italic text-[10px]">#{originalIdx + 1}</div>
                  <div className="flex flex-col">
                    <h4 className="text-xs font-black italic uppercase text-primary leading-tight">{desc}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={cn("text-[8px] font-black uppercase h-4 px-1.5", isLive ? "bg-red-600 animate-pulse" : isFinished ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{isFinished ? 'Fim' : isLive ? 'Ao Vivo' : 'Agenda'}</Badge>
                      {isOutOfWindow && <span className="text-[8px] font-black text-destructive uppercase">Inválido</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background/50 px-2 py-1 rounded-lg border border-white/5">
                  <div className="flex items-center gap-1.5"><span className={cn("text-sm font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{results[idx].homeScore !== "" ? results[idx].homeScore : "-"}</span><span className="text-muted-foreground/30 font-bold text-[10px]">X</span><span className={cn("text-sm font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{results[idx].awayScore !== "" ? results[idx].awayScore : "-"}</span></div>
                  <div className="h-4 w-px bg-white/10" /><ShieldCheck className="h-3 w-3 text-primary/40" />
                </div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {sortedUsers.map(u => {
                    const isCurrent = currentPlayerId === u.id;
                    const isHidden = placaresOcultos && !isCurrent;
                    const points = getPoints(u.id, idx);
                    const pred = predictions[u.id]?.[originalIdx] || { homeScore: "", awayScore: "" };
                    return (
                      <div key={u.id} className={cn("relative flex flex-col p-2 rounded-xl border transition-all", points === 3 ? "bg-secondary/10 border-secondary/40" : points === 1 ? "bg-accent/10 border-accent/40" : isCurrent ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-transparent")}>
                        {points !== null && points > 0 && <div className={cn("absolute -top-1 -right-1 h-4 w-6 rounded-md flex items-center justify-center text-[9px] font-black italic shadow-md z-10", points === 3 ? "bg-secondary text-white" : "bg-accent text-accent-foreground")}>+{points}</div>}
                        <div className="flex items-center gap-1.5 mb-1.5 min-w-0"><Avatar className="h-4 w-4 shrink-0"><AvatarImage src={u.photoUrl} /><AvatarFallback className="text-[7px] font-black bg-primary/20 text-primary">{u.username?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar><span className={cn("text-[9px] font-black uppercase truncate", isCurrent ? "text-primary" : "text-muted-foreground")}>{u.username}</span></div>
                        <div className="flex items-center justify-center gap-1.5 py-0.5 bg-background/50 rounded-lg border border-white/5">
                           {isHidden ? <Zap className="h-3 w-3 text-muted-foreground/20 animate-pulse" /> : <><span className={cn("text-xs font-black italic tabular-nums", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>{pred.homeScore || "0"}</span><span className="text-[8px] font-bold opacity-10">-</span><span className={cn("text-xs font-black italic tabular-nums", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>{pred.awayScore || "0"}</span></>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
