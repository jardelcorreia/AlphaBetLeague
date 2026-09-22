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
      <div className="w-full flex flex-col items-center justify-center py-32 gap-6 glass-card rounded-[2.5rem] border-dashed border-2">
        <AlertCircle className="h-14 w-14 text-muted-foreground opacity-30" />
        <p className="text-lg font-black italic uppercase text-muted-foreground">Aguardando dados da CBF para o comparativo.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div className="grid grid-cols-1 gap-8">
        {matches.map((match, idx) => {
          const isOutOfWindow = match.isValidForPoints === false;
          const originalIdx = match.originalIndex ?? idx;
          const desc = `${cleanTeamName(match.homeTeam)} x ${cleanTeamName(match.awayTeam)}`;
          const isLive = match.status === 'live';
          const isFinished = match.status === 'finished';

          return (
            <div key={match.id || idx} className={cn(
              "glass-card border-none rounded-[2.5rem] overflow-hidden group transition-all duration-500",
              isOutOfWindow ? "opacity-60 saturate-50" : "hover:shadow-2xl hover:shadow-primary/10"
            )}>
              {/* Header do Confronto */}
              <div className="bg-muted/30 dark:bg-slate-900/40 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/5">
                <div className="flex items-center gap-5">
                  <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black italic text-base shadow-inner">
                    #{originalIdx + 1}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-lg sm:text-xl font-black italic uppercase text-primary leading-none tracking-tighter">
                      {desc}
                    </h4>
                    <div className="flex items-center gap-2.5 mt-2">
                      <Badge className={cn(
                        "text-[11px] font-black uppercase border-none h-6 px-3 flex items-center gap-1.5",
                        isLive ? "bg-red-600 text-white animate-pulse" : 
                        isFinished ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {isLive && <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />}
                        {isFinished ? 'Finalizado' : isLive ? 'Ao Vivo' : 'Agendado'}
                      </Badge>
                      {isOutOfWindow && (
                        <span className="text-[11px] font-black text-destructive uppercase flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> Inválido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Placar Oficial em Destaque */}
                <div className="flex items-center gap-4 bg-background/50 dark:bg-black/30 p-3 rounded-2xl border border-white/5 shadow-xl">
                  <div className="flex items-center gap-3 px-5 py-1">
                    <span className={cn("text-3xl font-black italic tabular-nums tracking-tighter", isLive ? "text-red-600" : "text-primary")}>
                      {results[idx].homeScore !== "" ? results[idx].homeScore : "-"}
                    </span>
                    <span className="text-muted-foreground/30 font-bold text-lg">X</span>
                    <span className={cn("text-3xl font-black italic tabular-nums tracking-tighter", isLive ? "text-red-600" : "text-primary")}>
                      {results[idx].awayScore !== "" ? results[idx].awayScore : "-"}
                    </span>
                  </div>
                  <div className="h-10 w-px bg-white/10 hidden sm:block" />
                  <div className="hidden sm:flex flex-col items-center px-2">
                    <ShieldCheck className="h-5 w-5 text-primary/40" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Oficial</span>
                  </div>
                </div>
              </div>

              {/* Grid de Palpites dos Jogadores */}
              <div className="p-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {sortedUsers.map(u => {
                    const isCurrent = currentPlayerId === u.id;
                    const isHidden = placaresOcultos && !isCurrent;
                    const points = getPoints(u.id, idx);
                    const pred = predictions[u.id]?.[originalIdx] || { homeScore: "", awayScore: "" };

                    return (
                      <div key={u.id} className={cn(
                        "relative flex flex-col p-4 rounded-3xl border-2 transition-all duration-300 group/player",
                        points === 3 ? "bg-secondary/10 border-secondary shadow-lg shadow-secondary/10" :
                        points === 1 ? "bg-accent/10 border-accent shadow-md shadow-accent/10" :
                        isCurrent ? "bg-primary/5 border-primary/30" : "bg-muted/10 border-transparent hover:bg-muted/20"
                      )}>
                        {/* Indicador de Pontuação */}
                        {points !== null && points > 0 && (
                          <div className={cn(
                            "absolute -top-3 -right-3 h-8 w-12 rounded-xl flex items-center justify-center text-[13px] font-black italic shadow-2xl z-10 animate-in zoom-in duration-500",
                            points === 3 ? "bg-secondary text-white" : "bg-accent text-accent-foreground"
                          )}>
                            +{points}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-3 min-w-0">
                          <Avatar className="h-8 w-8 border-2 border-white/10 shrink-0 shadow-sm">
                            <AvatarImage src={u.photoUrl} className="object-cover" />
                            <AvatarFallback className="text-[10px] font-black bg-primary/20 text-primary">
                              {u.username?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn(
                            "text-[12px] font-black uppercase truncate tracking-tight",
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          )}>
                            {u.username}
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-2 py-2.5 bg-background/50 dark:bg-black/20 rounded-2xl border border-white/5 shadow-inner">
                           {isHidden ? (
                             <Zap className="h-5 w-5 text-muted-foreground/20 animate-pulse" />
                           ) : (
                             <>
                               <span className={cn("text-2xl font-black italic tabular-nums tracking-tighter", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>
                                 {pred.homeScore || "0"}
                               </span>
                               <span className="text-[12px] font-bold opacity-20">X</span>
                               <span className={cn("text-2xl font-black italic tabular-nums tracking-tighter", points === 3 ? "text-secondary" : points === 1 ? "text-accent" : "text-foreground")}>
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

      <div className="flex flex-wrap items-center justify-center gap-8 py-10 opacity-50">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-secondary shadow-lg shadow-secondary/20" />
          <span className="text-[12px] font-black uppercase tracking-widest">Placar Exato (+3)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-accent shadow-lg shadow-accent/20" />
          <span className="text-[12px] font-black uppercase tracking-widest">Vencedor/Empate (+1)</span>
        </div>
      </div>
    </div>
  );
}
