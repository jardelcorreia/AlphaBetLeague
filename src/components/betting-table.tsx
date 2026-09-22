"use client";

import React from "react";
import { Prediction, PlayerPredictions, Match } from "@/lib/types";
import { cn, cleanTeamName, getTeamAbrev } from "@/lib/utils";
import { Swords, AlertCircle, ShieldCheck, Trophy, Target, User, Zap } from "lucide-react";
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
      <div className="w-full flex flex-col items-center justify-center py-20 gap-4 glass-card rounded-2xl border-dashed border-2">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-30" />
        <p className="text-sm font-black italic uppercase text-muted-foreground">Aguardando dados oficiais para o comparativo.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {matches.map((match, idx) => {
          const isOutOfWindow = match.isValidForPoints === false;
          const originalIdx = match.originalIndex ?? idx;
          const desc = `${cleanTeamName(match.homeTeam)} x ${cleanTeamName(match.awayTeam)}`;
          const isLive = match.status === 'live';
          const isFinished = match.status === 'finished';

          return (
            <div key={match.id || idx} className={cn(
              "glass-card border-none rounded-2xl overflow-hidden group transition-all duration-300",
              isOutOfWindow ? "opacity-60 saturate-50" : "hover:ring-1 hover:ring-primary/20 shadow-lg"
            )}>
              {/* Header do Confronto */}
              <div className="bg-muted/30 dark:bg-slate-900/40 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-black italic text-xs">
                    #{originalIdx + 1}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-sm sm:text-base font-black italic uppercase text-primary leading-tight tracking-tight">
                      {desc}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase border-none h-5 px-2 flex items-center gap-1",
                        isLive ? "bg-red-600 text-white animate-pulse" : 
                        isFinished ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {isFinished ? 'Fim' : isLive ? 'Ao Vivo' : 'Agenda'}
                      </Badge>
                      {isOutOfWindow && (
                        <span className="text-[9px] font-black text-destructive uppercase flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Inválido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Placar Oficial */}
                <div className="flex items-center gap-3 bg-background/50 dark:bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 px-2">
                    <span className={cn("text-xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>
                      {results[idx].homeScore !== "" ? results[idx].homeScore : "-"}
                    </span>
                    <span className="text-muted-foreground/30 font-bold text-sm">X</span>
                    <span className={cn("text-xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>
                      {results[idx].awayScore !== "" ? results[idx].awayScore : "-"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="flex flex-col items-center">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary/40" />
                    <span className="text-[7px] font-black uppercase text-muted-foreground/60">Oficial</span>
                  </div>
                </div>
              </div>

              {/* Grid de Palpites */}
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {sortedUsers.map(u => {
                    const isCurrent = currentPlayerId === u.id;
                    const isHidden = placaresOcultos && !isCurrent;
                    const points = getPoints(u.id, idx);
                    const pred = predictions[u.id]?.[originalIdx] || { homeScore: "", awayScore: "" };

                    return (
                      <div key={u.id} className={cn(
                        "relative flex flex-col p-2.5 rounded-2xl border transition-all group/player",
                        points === 3 ? "bg-secondary/10 border-secondary/40 shadow-sm" :
                        points === 1 ? "bg-accent/10 border-accent/40 shadow-sm" :
                        isCurrent ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-transparent hover:bg-muted/20"
                      )}>
                        {points !== null && points > 0 && (
                          <div className={cn(
                            "absolute -top-1.5 -right-1.5 h-5 w-8 rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-lg z-10",
                            points === 3 ? "bg-secondary text-white" : "bg-accent text-accent-foreground"
                          )}>
                            +{points}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2 min-w-0">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={u.photoUrl} className="object-cover" />
                            <AvatarFallback className="text-[8px] font-black bg-primary/20 text-primary">
                              {u.username?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "text-[10px] font-black uppercase truncate",
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          )}>
                            {u.username}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 py-1 bg-background/50 dark:bg-black/20 rounded-lg border border-white/5 shadow-inner">
                           {isHidden ? (
                             <Zap className="h-3.5 w-3.5 text-muted-foreground/20 animate-pulse" />
                           ) : (
                             <>
                               <span className={cn("text-base font-black italic tabular-nums", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>
                                 {pred.homeScore || "0"}
                               </span>
                               <span className="text-[10px] font-bold opacity-10">-</span>
                               <span className={cn("text-base font-black italic tabular-nums", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>
                                 {pred.awayScore || "0"}
                               </span>
                             </>
                           )}
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

      <div className="flex flex-wrap items-center justify-center gap-6 py-6 opacity-40">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-secondary" />
          <span className="text-[10px] font-black uppercase tracking-wider">Na Mosca (+3)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-[10px] font-black uppercase tracking-wider">Vencedor (+1)</span>
        </div>
      </div>
    </div>
  );
}
