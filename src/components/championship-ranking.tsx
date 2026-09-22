"use client";

import React, { useMemo } from "react";
import { ChampionshipWinner, PlayerOverallStats, PlayerScore } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Trophy, Medal, Star, TrendingUp, TrendingDown, History, Clock, Crown } from "lucide-react";
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
  isRoundFinished?: boolean;
}

export function ChampionshipRanking({ roundWinners, allUsers, currentRoundScores, currentRoundNumber, isRoundFinished }: ChampionshipRankingProps) {
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
      uniqueUsers.map((u) => [u.id, { id: u.id, name: u.username, wins: 0, draws: 0, points: 0, exactScores: 0, balance: 0, photoUrl: u.photoUrl }])
    );

    const processedRounds = new Set<number>();
    roundWinners.forEach((rw) => {
      if (!rw.round || processedRounds.has(rw.round)) return;
      const ptsEntries = Object.entries(rw.pointsMap || {});
      if (ptsEntries.length === 0) return;
      processedRounds.add(rw.round);

      ptsEntries.forEach(([key, pts]) => {
        let playerStat = stats[key] || Object.values(stats).find(s => s.id === key || s.name === key);
        if (playerStat) {
          playerStat.points += (Number(pts) || 0);
          playerStat.exactScores += (Number(rw.exactScoresMap?.[key]) || 0);
        }
      });

      const maxPts = Math.max(...ptsEntries.map(([_, p]) => Number(p)));
      if (maxPts > 0) {
        const potentialWinners = ptsEntries.filter(([_, p]) => Number(p) === maxPts).map(([key, _]) => key);
        const winnersExsMap: Record<string, number> = {};
        potentialWinners.forEach(key => { winnersExsMap[key] = Number(rw.exactScoresMap?.[key]) || 0; });
        const maxExsInRound = Math.max(...Object.values(winnersExsMap));
        const winnerKeys = potentialWinners.filter(key => winnersExsMap[key] === maxExsInRound);
        const roundValue = rw.value || 6;
        const numPlayers = uniqueUsers.length;
        const winnerIds = winnerKeys.map(key => stats[key] ? key : Object.values(stats).find(s => s.id === key || s.name === key)?.id).filter(id => !!id) as string[];

        if (winnerIds.length === 1) {
          const winnerId = winnerIds[0];
          if (stats[winnerId]) { stats[winnerId].wins += 1; stats[winnerId].balance += roundValue * (numPlayers - 1); }
          uniqueUsers.forEach(u => { if (u.id !== winnerId && stats[u.id]) stats[u.id].balance -= roundValue; });
        } else if (winnerIds.length > 1) {
          winnerIds.forEach((wId) => { if (stats[wId]) stats[wId].draws += 1; });
          const losers = uniqueUsers.filter(u => !winnerIds.includes(u.id));
          const prizePerWinner = (losers.length * roundValue) / winnerIds.length;
          winnerIds.forEach(wId => { if (stats[wId]) stats[wId].balance += prizePerWinner; });
          losers.forEach(l => { if (stats[l.id]) stats[l.id].balance -= roundValue; });
        }
      }
    });

    if (currentRoundScores && currentRoundNumber && !processedRounds.has(currentRoundNumber)) {
      currentRoundScores.forEach(s => { if (stats[s.id]) { stats[s.id].points += s.points; stats[s.id].exactScores += s.exactScores; } });
      if (isRoundFinished) {
        const maxPts = Math.max(...currentRoundScores.map(s => s.points));
        if (maxPts > 0) {
          const topPlayers = currentRoundScores.filter(s => s.points === maxPts);
          const maxExs = Math.max(...topPlayers.map(s => s.exactScores));
          const winners = topPlayers.filter(s => s.exactScores === maxExs);
          const roundValue = roundWinners.find(rw => rw.round === currentRoundNumber)?.value || 6;
          const numPlayers = uniqueUsers.length;
          if (winners.length === 1) {
            const winnerId = winners[0].id;
            if (stats[winnerId]) { stats[winnerId].wins += 1; stats[winnerId].balance += roundValue * (numPlayers - 1); }
            uniqueUsers.forEach(u => { if (u.id !== winnerId && stats[u.id]) stats[u.id].balance -= roundValue; });
          } else if (winners.length > 1) {
            const winnerIds = winners.map(w => w.id);
            const losers = uniqueUsers.filter(u => !winnerIds.includes(u.id));
            const prizePerWinner = (losers.length * roundValue) / winners.length;
            winnerIds.forEach(wId => { if (stats[wId]) stats[wId].balance += prizePerWinner; });
            losers.forEach(l => { if (stats[l.id]) stats[l.id].balance -= roundValue; });
          }
        }
      }
    }

    return Object.values(stats).sort((a, b) => b.wins - a.wins || b.draws - a.draws || b.points - a.points || b.exactScores - a.exactScores || b.balance - a.balance || a.name.localeCompare(b.name));
  }, [roundWinners, allUsers, currentRoundScores, currentRoundNumber, isRoundFinished]);

  const renderRoundItem = (rw: ChampionshipWinner, idx: number) => {
    let displayWinners = rw.winners || "";
    const ptsEntries = Object.entries(rw.pointsMap || {});
    if (ptsEntries.length > 0) {
      const maxPts = Math.max(...ptsEntries.map(([_, p]) => Number(p)));
      if (maxPts > 0) {
        const potentialWinners = ptsEntries.filter(([_, p]) => Number(p) === maxPts).map(([key, _]) => key);
        const maxExs = Math.max(...potentialWinners.map(key => Number(rw.exactScoresMap?.[key]) || 0));
        const winnerKeys = potentialWinners.filter(key => (Number(rw.exactScoresMap?.[key]) || 0) === maxExs);
        displayWinners = winnerKeys.map(key => userMap[key]?.username || key).join(", ");
      }
    }
    const isAvailable = displayWinners.trim() !== "";

    return (
      <div key={`${rw.round}-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/10 border border-transparent hover:border-primary/20 transition-all">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center font-black text-[10px]", isAvailable ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{rw.round}</div>
          <div className="flex flex-col min-w-0">
            <span className="text-[7px] font-black uppercase text-muted-foreground/50 tracking-widest">{isAvailable ? "Campeão" : "Aguardando"}</span>
            <span className="text-[10px] font-black italic uppercase text-primary truncate max-w-[140px]">{isAvailable ? displayWinners : "Pendente"}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[7px] font-black uppercase text-muted-foreground/50 block">Aposta</span>
          <span className="text-[10px] font-black text-primary/60 italic">R$ {(rw.value || 6).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
           {overallStats.map((player, index) => {
              const isFirst = index === 0 && (player.wins > 0 || player.points > 0);
              const isPositive = player.balance >= 0;

              return (
                <Card key={player.id} className={cn("glass-card border-none rounded-2xl overflow-hidden transition-all duration-300", isFirst && "ring-1 ring-accent ring-offset-2 ring-offset-background shadow-lg shadow-accent/10")}>
                  <CardContent className="p-0">
                     <div className={cn("p-5 flex items-center gap-6 relative", isFirst ? "bg-accent/5" : "bg-primary/[0.02]")}>
                        <div className="relative shrink-0">
                           <div className={cn("h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-2xl shadow-sm", isFirst ? "sports-gradient" : "bg-primary/5")}>
                              <Avatar className={cn("h-14 w-14 sm:h-18 sm:w-18 rounded-full border-2 border-background bg-muted", isFirst && "border-white/20")}>
                                <AvatarImage src={player.photoUrl || undefined} className="object-cover" />
                                <AvatarFallback className="text-xl font-black italic text-primary">
                                  {player.name ? player.name.substring(0, 2).toUpperCase() : "AL"}
                                </AvatarFallback>
                              </Avatar>
                           </div>
                           {isFirst && <div className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-accent rounded-full flex items-center justify-center shadow-lg"><Crown className="h-3.5 w-3.5 text-accent-foreground" /></div>}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg sm:text-xl font-black italic uppercase text-primary leading-tight truncate">{player.name}</h3>
                          <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-widest px-2 h-5 border-primary/10">{isFirst ? "Alpha Líder" : `Rank #${index + 1}`}</Badge>
                        </div>
                     </div>
                     <div className="p-4 space-y-4">
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div><span className="text-xl font-black italic text-primary block">{player.wins}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Vits</span></div>
                          <div><span className="text-xl font-black italic text-foreground block">{player.draws}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Emps</span></div>
                          <div><span className="text-xl font-black italic text-foreground block">{player.points}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Pts</span></div>
                          <div><span className="text-xl font-black italic text-secondary block">{player.exactScores}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Exatos</span></div>
                        </div>
                        <div className={cn("px-4 py-2.5 rounded-xl border border-dashed flex items-center justify-between", isPositive ? "bg-secondary/5 border-secondary/20" : "bg-red-500/5 border-red-500/20")}>
                          <div className="flex items-center gap-2"><div className={cn("h-6 w-6 rounded-lg flex items-center justify-center text-white", isPositive ? "bg-secondary" : "bg-red-500")}><TrendingUp className="h-3 w-3" /></div><span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Saldo</span></div>
                          <span className={cn("text-lg font-black italic", isPositive ? "text-secondary" : "text-red-500")}>R$ {player.balance.toFixed(2)}</span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
           })}
        </div>

        <div className="lg:col-span-4">
          <Card className="glass-card border-none rounded-2xl overflow-hidden sticky top-20 shadow-md">
             <CardHeader className="p-4 border-b border-primary/5">
                <div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-primary" /><CardTitle className="text-[10px] font-black italic uppercase text-primary">Histórico de Rodadas</CardTitle></div>
             </CardHeader>
             <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                   <AccordionItem value="turno1" className="border-none">
                      <AccordionTrigger className="px-4 hover:no-underline py-2.5 text-[10px] font-black uppercase text-primary/60">1º Turno (R1 - R19)</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-1.5">{roundWinners.slice(0, 19).map((rw, idx) => renderRoundItem(rw, idx))}</AccordionContent>
                   </AccordionItem>
                   <AccordionItem value="turno2" className="border-none">
                      <AccordionTrigger className="px-4 hover:no-underline py-2.5 text-[10px] font-black uppercase text-primary/60">2º Turno (R20 - R38)</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-1.5">{roundWinners.slice(19, 38).map((rw, idx) => renderRoundItem(rw, idx + 19))}</AccordionContent>
                   </AccordionItem>
                </Accordion>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
