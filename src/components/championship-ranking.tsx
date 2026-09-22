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
    allUsers?.forEach(u => map[u.id] = u);
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
        const maxExsInRound = Math.max(...potentialWinners.map(key => Number(rw.exactScoresMap?.[key]) || 0));
        const winnerKeys = potentialWinners.filter(key => (Number(rw.exactScoresMap?.[key]) || 0) === maxExsInRound);
        const roundValue = rw.value || 6;
        const winnerIds = winnerKeys.map(key => stats[key] ? key : Object.values(stats).find(s => s.id === key || s.name === key)?.id).filter(id => !!id) as string[];

        if (winnerIds.length === 1) {
          const wId = winnerIds[0];
          if (stats[wId]) { stats[wId].wins += 1; stats[wId].balance += roundValue * (uniqueUsers.length - 1); }
          uniqueUsers.forEach(u => { if (u.id !== wId && stats[u.id]) stats[u.id].balance -= roundValue; });
        } else if (winnerIds.length > 1) {
          winnerIds.forEach(wId => { if (stats[wId]) stats[wId].draws += 1; });
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
          if (winners.length === 1) {
            const wId = winners[0].id;
            if (stats[wId]) { stats[wId].wins += 1; stats[wId].balance += roundValue * (uniqueUsers.length - 1); }
            uniqueUsers.forEach(u => { if (u.id !== wId && stats[u.id]) stats[u.id].balance -= roundValue; });
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

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
           {overallStats.map((player, index) => {
              const isFirst = index === 0 && (player.wins > 0 || player.points > 0);
              return (
                <Card key={player.id} className={cn("glass-card border-none rounded-xl overflow-hidden transition-all duration-300", isFirst && "ring-1 ring-accent ring-offset-2 ring-offset-background shadow-lg shadow-accent/10")}>
                  <CardContent className="p-0">
                     <div className={cn("p-4 flex items-center gap-4 relative", isFirst ? "bg-accent/5" : "bg-primary/[0.02]")}>
                        <div className="relative shrink-0"><div className={cn("h-12 w-12 flex items-center justify-center rounded-xl", isFirst ? "sports-gradient" : "bg-primary/5")}><Avatar className="h-10 w-10 border border-background"><AvatarImage src={player.photoUrl || undefined} /><AvatarFallback className="text-xs font-black italic">{player.name?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar></div>{isFirst && <div className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full flex items-center justify-center shadow-md"><Crown className="h-2.5 w-2.5 text-accent-foreground" /></div>}</div>
                        <div className="min-w-0"><h3 className="text-sm font-black italic uppercase text-primary truncate leading-tight">{player.name}</h3><Badge variant="outline" className="rounded-full text-[8px] font-black uppercase h-4 px-2 border-primary/10">{isFirst ? "Alpha Líder" : `Rank #${index + 1}`}</Badge></div>
                     </div>
                     <div className="p-3 space-y-3">
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div><span className="text-base font-black italic text-primary block">{player.wins}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Vits</span></div>
                          <div><span className="text-base font-black italic text-foreground block">{player.draws}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Emps</span></div>
                          <div><span className="text-base font-black italic text-foreground block">{player.points}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Pts</span></div>
                          <div><span className="text-base font-black italic text-secondary block">{player.exactScores}</span><span className="text-[7px] font-bold text-muted-foreground uppercase">Exat</span></div>
                        </div>
                        <div className={cn("px-3 py-1.5 rounded-lg border border-dashed flex items-center justify-between", player.balance >= 0 ? "bg-secondary/5 border-secondary/20" : "bg-red-500/5 border-red-500/20")}>
                          <div className="flex items-center gap-1.5"><TrendingUp className="h-3 w-3 text-muted-foreground" /><span className="text-[8px] font-black uppercase text-muted-foreground">Saldo</span></div>
                          <span className={cn("text-sm font-black italic", player.balance >= 0 ? "text-secondary" : "text-red-500")}>R$ {player.balance.toFixed(2)}</span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
           })}
        </div>
        <div className="lg:col-span-4">
          <Card className="glass-card border-none rounded-xl overflow-hidden sticky top-20 shadow-md">
             <CardHeader className="p-3 border-b border-primary/5"><div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-primary" /><CardTitle className="text-[10px] font-black italic uppercase text-primary">Histórico</CardTitle></div></CardHeader>
             <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                   <AccordionItem value="turno1" className="border-none"><AccordionTrigger className="px-3 py-2 text-[9px] font-black uppercase text-primary/60">1º Turno (R1-R19)</AccordionTrigger><AccordionContent className="px-3 pb-3 space-y-1">{roundWinners.slice(0, 19).map((rw, i) => <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/10 text-[9px] font-bold"><span className="text-primary w-4">#{rw.round}</span><span className="flex-1 truncate mx-2 uppercase italic text-muted-foreground">{rw.winners || "Pendente"}</span><span className="text-primary/40 italic">R${rw.value}</span></div>)}</AccordionContent></AccordionItem>
                   <AccordionItem value="turno2" className="border-none"><AccordionTrigger className="px-3 py-2 text-[9px] font-black uppercase text-primary/60">2º Turno (R20-R38)</AccordionTrigger><AccordionContent className="px-3 pb-3 space-y-1">{roundWinners.slice(19, 38).map((rw, i) => <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/10 text-[9px] font-bold"><span className="text-primary w-4">#{rw.round}</span><span className="flex-1 truncate mx-2 uppercase italic text-muted-foreground">{rw.winners || "Pendente"}</span><span className="text-primary/40 italic">R${rw.value}</span></div>)}</AccordionContent></AccordionItem>
                </Accordion>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
