
"use client";

import React, { useMemo } from "react";
import { ChampionshipWinner, PlayerOverallStats, PlayerScore } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Trophy, Medal, Star, TrendingUp, TrendingDown, History, Clock, ChevronDown, Crown, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { cn } from "@/lib/utils";

interface ChampionshipRankingProps {
  roundWinners: ChampionshipWinner[];
  setRoundWinners: React.Dispatch<React.SetStateAction<ChampionshipWinner[]>>;
  allUsers: any[];
  isAdmin?: boolean;
  onSave?: (data?: ChampionshipWinner[]) => Promise<void>;
  isSaving?: boolean;
  currentRoundScores?: PlayerScore[];
  currentRoundNumber?: number | null;
}

export function ChampionshipRanking({ roundWinners, allUsers, currentRoundScores, currentRoundNumber }: ChampionshipRankingProps) {
  const userMap = useMemo(() => {
    const map: Record<string, any> = {};
    const uniqueUsersMap = new Map();
    allUsers?.forEach(u => {
      if (!uniqueUsersMap.has(u.id)) {
        uniqueUsersMap.set(u.id, u);
        map[u.id] = u;
      }
    });
    return map;
  }, [allUsers]);

  const overallStats = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];

    const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());

    const stats: Record<string, PlayerOverallStats & { id: string; photoUrl?: string }> = Object.fromEntries(
      uniqueUsers.map((u) => [
        u.id, 
        { id: u.id, name: u.username, wins: 0, draws: 0, points: 0, exactScores: 0, balance: 0, photoUrl: u.photoUrl }
      ])
    );

    const processedRounds = new Set<number>();
    
    // Processamos o histórico consolidado
    roundWinners.forEach((rw) => {
      if (!rw.round || processedRounds.has(rw.round)) return;
      
      const ptsEntries = Object.entries(rw.pointsMap || {});
      if (ptsEntries.length === 0) return;

      processedRounds.add(rw.round);

      // Agregar Pontos e Exatos
      ptsEntries.forEach(([key, pts]) => {
        let playerStat = stats[key];
        if (!playerStat) {
          playerStat = Object.values(stats).find(s => s.name === key);
        }

        if (playerStat) {
          playerStat.points += (Number(pts) || 0);
          playerStat.exactScores += (Number(rw.exactScoresMap?.[key]) || 0);
        }
      });

      // Lógica de Vencedores e Saldo
      const maxPts = Math.max(...ptsEntries.map(([_, p]) => Number(p)));
      if (maxPts > 0) {
        const winnerKeys = ptsEntries.filter(([_, p]) => Number(p) === maxPts).map(([key, _]) => key);
        const roundValue = rw.value || 0;
        const numPlayers = uniqueUsers.length;

        const winnerIds = winnerKeys.map(key => {
          if (stats[key]) return key;
          return Object.values(stats).find(s => s.name === key)?.id;
        }).filter(id => !!id) as string[];

        if (winnerIds.length === 1) {
          const winnerId = winnerIds[0];
          if (stats[winnerId]) {
            stats[winnerId].wins += 1;
            stats[winnerId].balance += roundValue * (numPlayers - 1);
          }
          uniqueUsers.forEach(u => {
            if (u.id !== winnerId && stats[u.id]) {
              stats[u.id].balance -= roundValue;
            }
          });
        } else if (winnerIds.length > 1) {
          winnerIds.forEach((wId) => { if (stats[wId]) stats[wId].draws += 1; });
          const losers = uniqueUsers.filter(u => !winnerIds.includes(u.id));
          const totalPot = losers.length * roundValue;
          const prizePerWinner = totalPot / winnerIds.length;
          winnerIds.forEach(wId => { if (stats[wId]) stats[wId].balance += prizePerWinner; });
          losers.forEach(l => { if (stats[l.id]) stats[l.id].balance -= roundValue; });
        }
      }
    });

    // Adicionamos os dados da rodada atual se ela ainda não estiver consolidada no histórico
    if (currentRoundScores && currentRoundNumber && !processedRounds.has(currentRoundNumber)) {
      currentRoundScores.forEach(s => {
        if (stats[s.id]) {
          stats[s.id].points += s.points;
          stats[s.id].exactScores += s.exactScores;
        }
      });
    }

    const hasAnyActivity = Object.values(stats).some(s => s.wins > 0 || s.draws > 0 || s.points > 0 || s.balance !== 0);

    // Critério de Ordenação: Vitórias -> Empates -> Pontos -> Exatos -> Saldo
    return Object.values(stats).sort((a, b) => {
      if (!hasAnyActivity) return a.name.localeCompare(b.name);
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.draws !== a.draws) return b.draws - a.draws;
      if (b.points !== a.points) return b.points - a.points;
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.name.localeCompare(b.name);
    });
  }, [roundWinners, allUsers, currentRoundScores, currentRoundNumber]);

  const renderRoundItem = (rw: ChampionshipWinner, idx: number) => {
    let displayWinners = rw.winners || "";
    const ptsEntries = Object.entries(rw.pointsMap || {});
    const maxPts = Math.max(...ptsEntries.map(([_, p]) => Number(p)));
    const hasData = ptsEntries.length > 0 && maxPts > 0;

    if (hasData) {
      const winnerKeys = ptsEntries.filter(([_, p]) => Number(p) === maxPts).map(([key, _]) => key);
      displayWinners = winnerKeys.map(key => userMap[key]?.username || key).join(", ");
    }

    const isAvailable = displayWinners.trim() !== "";

    return (
      <div key={`${rw.round}-${idx}`} className="group relative flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all duration-300">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-sm transition-transform group-hover:rotate-3",
            isAvailable ? "bg-primary text-white shadow-primary/10" : "bg-muted text-muted-foreground"
          )}>
            {rw.round}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-1">
              {isAvailable ? <Trophy className="h-2 w-2 text-accent" /> : <Clock className="h-2 w-2" />}
              {isAvailable ? "Campeão" : "Aguardando"}
            </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {isAvailable ? (
                <span className="text-[11px] font-black italic uppercase text-primary truncate max-w-[160px]">
                  {displayWinners}
                </span>
              ) : (
                <span className="text-[10px] font-medium italic text-muted-foreground/40">Pendente</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end shrink-0 ml-3">
          <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Aposta</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black text-primary/60 italic">R$ {(rw.value || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
           {overallStats.map((player, index) => {
              const hasActivity = player.wins > 0 || player.draws > 0 || player.points > 0 || player.balance !== 0;
              const isFirst = index === 0 && hasActivity;
              const isPositive = player.balance >= 0;

              return (
                <Card key={player.id} className={cn(
                  "glass-card border-none rounded-[2rem] overflow-hidden transition-all duration-500 group relative",
                  isFirst && "ring-2 ring-accent ring-offset-4 ring-offset-background shadow-2xl shadow-accent/20"
                )}>
                  <CardContent className="p-0">
                     <div className={cn(
                       "p-6 sm:p-10 flex flex-row items-center justify-center gap-6 sm:gap-10 relative overflow-hidden",
                       isFirst ? "bg-accent/10" : "bg-primary/[0.03]"
                     )}>
                        {isFirst && (
                          <div className="absolute -top-4 -right-4 opacity-[0.05] text-accent transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110">
                            <Crown className="h-32 w-32" />
                          </div>
                        )}

                        <div className="relative shrink-0 flex items-center justify-center">
                           <div className={cn(
                             "relative h-20 w-20 sm:h-28 sm:w-28 flex items-center justify-center rounded-[2rem] shadow-inner transition-all duration-500 group-hover:scale-105",
                             isFirst ? "sports-gradient shadow-lg" : "bg-primary/5 border border-primary/10"
                           )}>
                              <Avatar className={cn(
                                 "h-[72px] w-[72px] sm:h-[104px] sm:w-[104px] rounded-full border-2 border-background shadow-md bg-muted flex items-center justify-center transition-all",
                                 isFirst && "border-white/40"
                              )}>
                                <AvatarImage src={player.photoUrl || undefined} className="object-cover" />
                                <AvatarFallback className={cn(
                                  "text-2xl sm:text-4xl font-black italic w-full h-full flex items-center justify-center",
                                  isFirst ? "bg-white text-primary" : "bg-primary/10 text-primary"
                                )}>
                                  {player.name ? player.name.substring(0, 2).toUpperCase() : "AL"}
                                </AvatarFallback>
                              </Avatar>
                           </div>
                           
                           {hasActivity && (
                             <div className={cn(
                               "absolute -top-2 -right-2 h-7 w-7 sm:h-10 w-10 rounded-full flex items-center justify-center shadow-lg border-2 border-background z-20 transition-transform group-hover:rotate-12",
                               index === 0 ? "bg-accent" : index === 1 ? "bg-slate-300" : index === 2 ? "bg-amber-600" : "bg-muted"
                             )}>
                                {index === 0 ? <Trophy className="h-4 w-4 sm:h-5 w-5 text-accent-foreground" /> : 
                                 index === 1 ? <Medal className="h-4 w-4 sm:h-5 w-5 text-slate-600" /> :
                                 <Star className="h-3.5 w-3.5 sm:h-4 w-4 text-white" />}
                             </div>
                           )}
                        </div>

                        <div className="flex flex-col items-start space-y-1 relative z-10 min-w-0">
                          <h3 className="text-xl sm:text-3xl font-black italic uppercase text-primary leading-tight tracking-tighter truncate w-full">{player.name}</h3>
                          <Badge variant="outline" className={cn(
                             "rounded-full text-[10px] sm:text-[12px] font-black uppercase tracking-[0.15em] px-3 py-0.5 h-6 border-primary/10 bg-white/50 dark:bg-black/20 whitespace-nowrap",
                             isFirst ? "text-accent border-accent/20" : "text-muted-foreground"
                          )}>
                             {isFirst ? "Alpha Líder" : `Posição ${index + 1}`}
                          </Badge>
                        </div>
                     </div>

                     <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="flex flex-col items-center">
                             <span className="text-2xl sm:text-3xl font-black italic text-primary leading-none">{player.wins}</span>
                             <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Vits</span>
                          </div>
                          <div className="flex flex-col items-center">
                             <span className="text-2xl sm:text-3xl font-black italic text-foreground leading-none">{player.draws}</span>
                             <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Emps</span>
                          </div>
                          <div className="flex flex-col items-center">
                             <span className="text-2xl sm:text-3xl font-black italic text-foreground leading-none">{player.points}</span>
                             <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Pts</span>
                          </div>
                          <div className="flex flex-col items-center">
                             <span className="text-2xl sm:text-3xl font-black italic text-secondary leading-none">{player.exactScores}</span>
                             <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Exatos</span>
                          </div>
                        </div>

                        <div className={cn(
                          "p-4 sm:p-6 rounded-2xl border border-dashed flex items-center justify-between transition-colors",
                          isPositive ? "bg-secondary/5 border-secondary/20" : "bg-red-600/5 dark:bg-red-400/5 border-red-600/20 dark:border-red-400/20"
                        )}>
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "h-8 w-8 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shadow-md",
                               isPositive ? "bg-secondary text-white" : "bg-red-600 dark:bg-red-400 text-white"
                             )}>
                                {isPositive ? <TrendingUp className="h-4 w-4 sm:h-6 w-6" /> : <TrendingDown className="h-4 w-4 sm:h-6 w-6" />}
                             </div>
                             <span className="text-[10px] sm:text-[11px] font-black uppercase text-muted-foreground tracking-[0.2em]">Saldo Bancário</span>
                          </div>
                          <span className={cn(
                             "text-2xl sm:text-3xl font-black italic leading-none",
                             isPositive ? "text-secondary" : "text-red-600 dark:text-red-400"
                          )}>
                             R$ {player.balance.toFixed(2)}
                          </span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
           })}
        </div>

        <div className="lg:col-span-4">
          <Card className="glass-card border-none rounded-[1.5rem] overflow-hidden sticky top-24 shadow-xl">
             <CardHeader className="p-5 border-b border-primary/5">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      <div>
                         <CardTitle className="text-[12px] font-black italic uppercase text-primary leading-tight">Histórico</CardTitle>
                         <p className="text-muted-foreground text-[8px] font-bold uppercase tracking-widest">Registro de Rodadas</p>
                      </div>
                   </div>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                   <AccordionItem value="turno1" className="border-none">
                      <AccordionTrigger className="px-5 hover:no-underline hover:bg-primary/5 py-3 transition-colors text-xs">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="rounded-full text-[11px] font-black uppercase text-primary border-primary/10 bg-primary/5 px-3 h-6">
                             1º Turno (R1 a R19)
                           </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-1 space-y-2">
                        {roundWinners.slice(0, 19).map((rw, idx) => renderRoundItem(rw, idx))}
                      </AccordionContent>
                   </AccordionItem>

                   <AccordionItem value="turno2" className="border-none">
                      <AccordionTrigger className="px-5 hover:no-underline hover:bg-primary/5 py-3 transition-colors text-xs">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="rounded-full text-[11px] font-black uppercase text-primary border-primary/10 bg-primary/5 px-3 h-6">
                             2º Turno (R20 a R38)
                           </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-1 space-y-2">
                        {roundWinners.slice(19, 38).map((rw, idx) => renderRoundItem(rw, idx + 19))}
                      </AccordionContent>
                   </AccordionItem>
                </Accordion>
                <div className="px-5 py-3 border-t border-primary/5">
                   <p className="text-[10px] font-bold text-muted-foreground/60 uppercase text-center tracking-tighter">
                      Sincronizado com resultados oficiais
                   </p>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
