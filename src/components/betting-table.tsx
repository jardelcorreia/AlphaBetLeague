"use client";

import React from "react";
import { Prediction, PlayerPredictions, Match } from "@/lib/types";
import { Input } from "./ui/input";
import { cn, cleanTeamName, getTeamAbrev } from "@/lib/utils";
import { Swords, AlertCircle, ShieldCheck } from "lucide-react";

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
  roundName,
  matches,
  predictions,
  setPrediction,
  results,
  placaresOcultos,
  currentPlayerId,
  isAdmin,
  allUsers,
  isLocked = false,
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
      <div className="w-full flex flex-col items-center justify-center py-24 gap-6 glass-card rounded-3xl border-dashed border-2">
        <AlertCircle className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-base font-black italic uppercase text-muted-foreground">Aguardando dados da rodada para exibir comparativo.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-primary/5 rounded-2xl border border-primary/10 mb-2">
        <div className="col-span-3 text-xs font-black uppercase text-primary/60 italic tracking-widest">Confronto</div>
        <div className="col-span-6 flex justify-around text-xs font-black uppercase text-primary/60 italic tracking-widest">Palpites dos Jogadores</div>
        <div className="col-span-3 text-center text-xs font-black uppercase text-primary/60 italic tracking-widest">Placar Oficial</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {matches.map((match, idx) => {
          const isOutOfWindow = match.isValidForPoints === false;
          const originalIdx = match.originalIndex ?? idx;
          const desc = `${cleanTeamName(match.homeTeam)} x ${cleanTeamName(match.awayTeam)}`;

          return (
            <div key={match.id || idx} className={cn(
              "glass-card border-none rounded-2xl overflow-hidden group transition-all duration-300",
              isOutOfWindow ? "opacity-60 saturate-50" : "hover:bg-primary/[0.02]"
            )}>
              <div className="grid grid-cols-1 md:grid-cols-12 items-center min-h-[70px] md:min-h-[80px]">
                <div className="md:col-span-3 px-6 py-4 flex items-center justify-between md:justify-start gap-4 border-b md:border-b-0 md:border-r border-dashed border-primary/10">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-primary/40 italic tabular-nums">#{originalIdx + 1}</span>
                    <div className="flex flex-col">
                      <div className="text-xs md:text-sm font-black italic uppercase text-primary leading-tight truncate max-w-[160px] sm:max-w-none group-hover:translate-x-1 transition-transform">
                        {desc || "---"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] font-black uppercase", match.status === 'live' ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                          {match.status === 'finished' ? 'Finalizado' : match.status === 'live' ? 'Ao Vivo' : match.status === 'cancelled' ? 'Adiado' : 'Agendado'}
                        </span>
                        {isOutOfWindow && (
                          <span className="text-[10px] font-black text-destructive uppercase flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" /> Fora da Janela
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:hidden flex items-center gap-1.5 px-2">
                    <div className="flex items-center gap-1.5 font-black text-sm text-primary tabular-nums">
                      <span>{results[idx].homeScore !== "" ? results[idx].homeScore : "-"}</span>
                      <span className="text-primary/30 font-bold">x</span>
                      <span>{results[idx].awayScore !== "" ? results[idx].awayScore : "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-6 px-4 py-4 flex items-center overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-3 min-w-max md:w-full md:justify-around">
                    {sortedUsers.map(u => {
                      const isCurrent = currentPlayerId === u.id;
                      const isHidden = placaresOcultos && !isCurrent;
                      const points = getPoints(u.id, idx);
                      const pred = predictions[u.id]?.[originalIdx] || { homeScore: "", awayScore: "" };

                      const isMatchLocked = isLocked || match.status === 'finished' || match.status === 'live' || match.status === 'cancelled' || match.isValidForPoints === false;

                      return (
                        <div key={u.id} className={cn("flex flex-col items-center min-w-[65px] md:min-w-[75px] relative transition-all", isCurrent && "scale-105 z-10")}>
                          <div className="flex items-center gap-1 mb-1.5 px-1 w-full justify-center">
                            <span className={cn("text-[10px] md:text-[11px] font-black uppercase tracking-tighter truncate text-center w-full", isCurrent ? "text-primary font-bold" : "text-muted-foreground/90 dark:text-foreground/80")}>
                              {u.username}
                            </span>
                          </div>
                          
                          <div className={cn("flex items-center justify-center gap-1.5 px-2 py-1 md:py-1.5 rounded-xl border-2 transition-all duration-300",
                            isOutOfWindow ? "bg-muted/50 border-transparent text-muted-foreground" :
                            points === 3 ? "bg-secondary text-white border-secondary shadow-lg shadow-secondary/20" :
                            points === 1 ? "bg-accent text-accent-foreground border-accent shadow-md" :
                            isCurrent ? (isMatchLocked ? "bg-primary/5 border-primary shadow-sm" : "bg-primary/5 border-primary/10 shadow-sm") :
                            "bg-background border-muted/30 shadow-sm"
                          )}>
                            {isCurrent && !isMatchLocked ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input 
                                  type="number" 
                                  value={pred.homeScore} 
                                  onChange={(e) => setPrediction(u.id, originalIdx, 'home', e.target.value)} 
                                  className={cn(
                                    "w-6 h-6 md:w-7 md:h-7 text-center p-0 font-black text-xs md:text-sm border-none bg-transparent shadow-none focus-visible:ring-0",
                                    points === 3 ? "text-white" : points === 1 ? "text-accent-foreground" : "text-primary"
                                  )} 
                                  placeholder="-"
                                />
                                <span className={cn("text-[10px] font-black italic opacity-30")}>x</span>
                                <Input 
                                  type="number" 
                                  value={pred.awayScore} 
                                  onChange={(e) => setPrediction(u.id, originalIdx, 'away', e.target.value)} 
                                  className={cn(
                                    "w-6 h-6 md:w-7 md:h-7 text-center p-0 font-black text-xs md:text-sm border-none bg-transparent shadow-none focus-visible:ring-0",
                                    points === 3 ? "text-white" : points === 1 ? "text-accent-foreground" : "text-primary"
                                  )} 
                                  placeholder="-"
                                />
                              </div>
                            ) : (
                              <>
                                <span className={cn(
                                  "text-sm md:text-base font-black tabular-nums tracking-tighter",
                                  points === 3 ? "text-white" : points === 1 ? "text-accent-foreground" : ""
                                )}>
                                  {isHidden ? "?" : (pred.homeScore || "-")}
                                </span>
                                <span className={cn(
                                  "text-[9px] md:text-[10px] font-black opacity-30 italic",
                                  (points === 3 || points === 1) ? "text-current opacity-30" : ""
                                )}>x</span>
                                <span className={cn(
                                  "text-sm md:text-base font-black tabular-nums tracking-tighter",
                                  points === 3 ? "text-white" : points === 1 ? "text-accent-foreground" : ""
                                )}>
                                  {isHidden ? "?" : (pred.awayScore || "-")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={cn("md:col-span-3 px-6 py-4 items-center justify-center md:border-l border-dashed border-primary/10 gap-3 hidden md:flex flex-col")}>
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary opacity-50">
                    <ShieldCheck className="h-3 w-3" /> Placar Oficial
                  </div>
                  <div className="flex items-center gap-3 bg-muted/20 p-1.5 rounded-2xl border border-transparent">
                    <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl font-black text-base bg-white dark:bg-slate-900 border border-primary/10 text-primary transition-colors">
                      {match.homeScore ?? "-"}
                    </div>
                    <Swords className="h-4 w-4 text-primary/20" />
                    <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl font-black text-base bg-white dark:bg-slate-900 border border-primary/10 text-primary transition-colors">
                      {match.awayScore ?? "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
