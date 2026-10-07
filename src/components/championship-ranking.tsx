
"use client";

import React, { useMemo } from "react";
import { ChampionshipWinner, PlayerOverallStats, PlayerScore } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Trophy, TrendingUp, History, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { cn } from "@/lib/utils";

interface ChampionshipRankingProps {
  roundWinners: ChampionshipWinner[] | Record<string, ChampionshipWinner>;
  setRoundWinners: React.Dispatch<React.SetStateAction<ChampionshipWinner[]>>;
  allUsers: any[];
  isAdmin?: boolean;
  onSave?: (data?: ChampionshipWinner[]) => Promise<void>;
  isSaving?: boolean;
  currentRoundScores?: PlayerScore[];
  currentRoundNumber?: number | null;
  isRoundFinished?: boolean;
}

export function ChampionshipRanking({ roundWinners, allUsers, currentRoundScores, currentRoundNumber }: ChampionshipRankingProps) {
  const historyForDisplay = useMemo(() => {
    let historyArray: ChampionshipWinner[] = [];
    
    if (Array.isArray(roundWinners)) {
      historyArray = [...roundWinners];
    } else if (roundWinners && typeof roundWinners === 'object') {
      historyArray = Array.from({ length: 38 }, (_, i) => {
        const key = (i + 1).toString();
        return (roundWinners as any)[key] || { round: i + 1, winners: "", value: 6 };
      });
    }

    // Injetar dados da rodada atual na visualização se ela estiver ativa
    if (currentRoundScores && currentRoundNumber) {
      const idx = historyArray.findIndex(h => h.round === currentRoundNumber);
      const virtualEntry: ChampionshipWinner = {
        round: currentRoundNumber,
        winners: historyArray[idx]?.winners || "",
        value: historyArray[idx]?.value || 6,
        pointsMap: Object.fromEntries(currentRoundScores.map(s => [s.id, s.points])),
        exactScoresMap: Object.fromEntries(currentRoundScores.map(s => [s.id, s.exactScores]))
      };
      if (idx !== -1) historyArray[idx] = virtualEntry;
      else historyArray.push(virtualEntry);
    }

    return Array.from({ length: 38 }, (_, i) => {
      const r = i + 1;
      return historyArray.find(h => h.round === r) || { round: r, winners: "", value: 6 };
    });
  }, [roundWinners, currentRoundScores, currentRoundNumber]);

  const overallStats = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    
    const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());
    const stats: Record<string, PlayerOverallStats & { id: string; photoUrl?: string }> = Object.fromEntries(
      uniqueUsers.map((u) => [u.id, { id: u.id, name: u.username, wins: 0, draws: 0, points: 0, exactScores: 0, balance: 0, photoUrl: u.photoUrl }])
    );

    historyForDisplay.forEach((rw) => {
      const pMap = rw.pointsMap || {};
      const eMap = rw.exactScoresMap || {};
      const val = rw.value || 6;
      
      // Somar pontos e exatos de todas as rodadas com dados
      Object.entries(pMap).forEach(([uid, pts]) => {
        if (stats[uid]) {
          stats[uid].points += (Number(pts) || 0);
          stats[uid].exactScores += (Number(eMap[uid]) || 0);
        }
      });

      // Calcular Vitórias e Saldo (apenas se houver vencedor definido ou rodada passada com pontos)
      let winnerIds: string[] = [];
      if (rw.winners) {
        const winnerNames = rw.winners.split(", ").map(n => n.trim());
        winnerIds = winnerNames.map(name => uniqueUsers.find(u => u.username === name)?.id).filter(id => !!id) as string[];
      } else if (Object.keys(pMap).length > 0 && rw.round < (currentRoundNumber || 0)) {
        // Cálculo dinâmico para rodadas passadas sem vencedor salvo
        const maxPts = Math.max(...Object.values(pMap).map(p => Number(p)), 0);
        if (maxPts > 0) {
          const playersWithMax = uniqueUsers.filter(u => Number(pMap[u.id] || 0) === maxPts);
          const maxExs = Math.max(...playersWithMax.map(u => Number(eMap[u.id] || 0)), 0);
          winnerIds = playersWithMax.filter(u => Number(eMap[u.id] || 0) === maxExs).map(u => u.id);
        }
      }

      if (winnerIds.length > 0) {
        if (winnerIds.length === 1) {
          const wid = winnerIds[0];
          if (stats[wid]) { 
            stats[wid].wins += 1; 
            stats[wid].balance += val * (uniqueUsers.length - 1); 
          }
          uniqueUsers.forEach(u => { if (u.id !== wid && stats[u.id]) stats[u.id].balance -= val; });
        } else {
          winnerIds.forEach(wid => { if (stats[wid]) stats[wid].draws += 1; });
          const losers = uniqueUsers.filter(u => !winnerIds.includes(u.id));
          const prize = (losers.length * val) / winnerIds.length;
          winnerIds.forEach(wid => { if (stats[wid]) stats[wid].balance += prize; });
          losers.forEach(l => { if (stats[l.id]) stats[l.id].balance -= val; });
        }
      }
    });

    return Object.values(stats).sort((a, b) => 
      b.points - a.points || 
      b.exactScores - a.exactScores || 
      b.wins - a.wins || 
      (a.name || "").localeCompare(b.name || "")
    );
  }, [historyForDisplay, allUsers, currentRoundNumber]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4">
           {overallStats.map((player, index) => {
              const isFirst = index === 0 && (player.points > 0);
              return (
                <Card key={player.id} className={cn(
                  "glass-card border-none rounded-[2rem] overflow-hidden transition-all duration-300 shadow-xl", 
                  isFirst && "ring-2 ring-primary/40 shadow-primary/10"
                )}>
                  <CardContent className="p-0">
                     <div className="p-6 flex items-center justify-between bg-primary/[0.03]">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="h-16 w-16 border-2 border-background rounded-2xl shadow-xl">
                              <AvatarImage src={player.photoUrl || undefined} className="object-cover" />
                              <AvatarFallback className="text-xl font-black italic bg-primary/10 text-primary">
                                {player.name?.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {isFirst && <div className="absolute -top-2 -right-2 h-6 w-6 bg-accent rounded-full flex items-center justify-center shadow-lg"><Crown className="h-3 w-3 text-accent-foreground" /></div>}
                          </div>
                          <div>
                            <h3 className="text-lg font-black italic uppercase text-primary tracking-tight leading-tight">{player.name}</h3>
                            <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase h-5 px-2 mt-1 border-primary/20 bg-primary/5 text-primary/80">Rank #{index + 1}</Badge>
                          </div>
                        </div>
                     </div>
                     
                     <div className="p-8 space-y-8">
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div className="space-y-1">
                            <span className="text-2xl font-black italic text-primary block tracking-tighter">{player.wins}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vit</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-2xl font-black italic text-foreground block tracking-tighter">{player.draws}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Emp</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-2xl font-black italic text-foreground block tracking-tighter">{player.points}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pts</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-2xl font-black italic text-secondary block tracking-tighter">{player.exactScores}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Exa</span>
                          </div>
                        </div>

                        <div className={cn(
                          "px-6 py-4 rounded-[1.5rem] border-2 border-dashed flex items-center justify-between transition-colors",
                          player.balance >= 0 ? "bg-secondary/5 border-secondary/30" : "bg-red-500/5 border-red-500/30"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", player.balance >= 0 ? "bg-secondary/20" : "bg-red-500/20")}>
                              <TrendingUp className={cn("h-4 w-4", player.balance >= 0 ? "text-secondary" : "text-red-500")} />
                            </div>
                            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Saldo Liga</span>
                          </div>
                          <span className={cn("text-xl font-black italic tracking-tight", player.balance >= 0 ? "text-secondary" : "text-red-500")}>
                            R$ {player.balance.toFixed(2)}
                          </span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
           })}
        </div>
        <div className="lg:col-span-3">
          <Card className="glass-card border-none rounded-3xl overflow-hidden sticky top-24 shadow-2xl">
             <CardHeader className="p-5 border-b border-primary/5 bg-primary/[0.02]">
               <div className="flex items-center gap-3">
                 <History className="h-5 w-5 text-primary" />
                 <CardTitle className="text-sm font-black italic uppercase text-primary tracking-widest">Histórico Alpha</CardTitle>
               </div>
             </CardHeader>
             <CardContent className="p-0">
                <Accordion type="single" collapsible defaultValue="turno2" className="w-full">
                   <AccordionItem value="turno1" className="border-none">
                     <AccordionTrigger className="px-5 py-4 text-[11px] font-black uppercase text-primary/60 hover:no-underline hover:bg-primary/5">
                       Turno 01 (R01-R19)
                     </AccordionTrigger>
                     <AccordionContent className="px-4 pb-4 space-y-1">
                       {historyForDisplay.slice(0, 19).map((rw, i) => (
                         <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 text-[10px] font-bold border border-white/5">
                           <span className="text-primary w-6 italic">#{rw.round}</span>
                           <span className="flex-1 truncate mx-3 uppercase italic text-muted-foreground/80">{rw.winners || "Em disputa..."}</span>
                           <span className="text-primary/40 italic font-black">R${rw.value}</span>
                         </div>
                       ))}
                     </AccordionContent>
                   </AccordionItem>
                   <AccordionItem value="turno2" className="border-none">
                     <AccordionTrigger className="px-5 py-4 text-[11px] font-black uppercase text-primary/60 hover:no-underline hover:bg-primary/5">
                       Turno 02 (R20-R38)
                     </AccordionTrigger>
                     <AccordionContent className="px-4 pb-4 space-y-1">
                       {historyForDisplay.slice(19, 38).map((rw, i) => (
                         <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 text-[10px] font-bold border border-white/5">
                           <span className="text-primary w-6 italic">#{rw.round}</span>
                           <span className="flex-1 truncate mx-3 uppercase italic text-muted-foreground/80">{rw.winners || "Em disputa..."}</span>
                           <span className="text-primary/40 italic font-black">R${rw.value}</span>
                         </div>
                       ))}
                     </AccordionContent>
                   </AccordionItem>
                </Accordion>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
