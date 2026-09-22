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
  // Mapeia os vencedores oficiais + vencedor da rodada atual se finalizada para exibição no histórico
  const historyForDisplay = useMemo(() => {
    const history = [...roundWinners];
    
    // Se a rodada atual está finalizada e não tem vencedor no histórico, calculamos virtualmente para o UI
    if (currentRoundScores && currentRoundNumber && isRoundFinished) {
      const idx = history.findIndex(h => h.round === currentRoundNumber);
      const existing = idx !== -1 ? history[idx] : null;
      
      if (!existing || !existing.winners) {
        const maxPts = Math.max(...currentRoundScores.map(s => s.points));
        if (maxPts > 0) {
          const topPlayers = currentRoundScores.filter(s => s.points === maxPts);
          const maxExs = Math.max(...topPlayers.map(s => s.exactScores));
          const winners = topPlayers.filter(s => s.exactScores === maxExs);
          const winnerNames = winners.map(w => w.name).join(", ");
          
          const virtualEntry: ChampionshipWinner = {
            round: currentRoundNumber,
            winners: winnerNames,
            value: existing?.value || 6,
            pointsMap: Object.fromEntries(currentRoundScores.map(s => [s.id, s.points])),
            exactScoresMap: Object.fromEntries(currentRoundScores.map(s => [s.id, s.exactScores]))
          };

          if (idx !== -1) {
            history[idx] = virtualEntry;
          } else {
            // Garantir que o array tenha o tamanho correto
            const fullHistory = Array.from({ length: 38 }, (_, i) => {
              const r = i + 1;
              if (r === currentRoundNumber) return virtualEntry;
              return history.find(h => h.round === r) || { round: r, winners: "", value: 6 };
            });
            return fullHistory;
          }
        }
      }
    }
    
    // Garante que o histórico sempre tenha 38 posições para o map
    return Array.from({ length: 38 }, (_, i) => {
      const r = i + 1;
      return history.find(h => h.round === r) || { round: r, winners: "", value: 6 };
    });
  }, [roundWinners, currentRoundScores, currentRoundNumber, isRoundFinished]);

  const overallStats = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());
    const stats: Record<string, PlayerOverallStats & { id: string; photoUrl?: string }> = Object.fromEntries(
      uniqueUsers.map((u) => [u.id, { id: u.id, name: u.username, wins: 0, draws: 0, points: 0, exactScores: 0, balance: 0, photoUrl: u.photoUrl }])
    );

    const processedRounds = new Set<number>();
    
    // Usamos o histórico de exibição para calcular as estatísticas, pois ele já contém a lógica de desempate
    historyForDisplay.forEach((rw) => {
      if (!rw.winners || processedRounds.has(rw.round)) return;
      processedRounds.add(rw.round);

      const ptsEntries = Object.entries(rw.pointsMap || {});
      ptsEntries.forEach(([key, pts]) => {
        let playerStat = stats[key] || Object.values(stats).find(s => s.id === key || s.name === key);
        if (playerStat) {
          playerStat.points += (Number(pts) || 0);
          playerStat.exactScores += (Number(rw.exactScoresMap?.[key]) || 0);
        }
      });

      const winnersNames = rw.winners.split(", ").map(n => n.trim());
      const winnerIds = winnersNames.map(name => {
        const u = uniqueUsers.find(user => user.username === name);
        return u ? u.id : null;
      }).filter(id => id !== null) as string[];

      const roundValue = rw.value || 6;
      if (winnerIds.length === 1) {
        const wId = winnerIds[0];
        if (stats[wId]) {
          stats[wId].wins += 1;
          stats[wId].balance += roundValue * (uniqueUsers.length - 1);
        }
        uniqueUsers.forEach(u => { if (u.id !== wId && stats[u.id]) stats[u.id].balance -= roundValue; });
      } else if (winnerIds.length > 1) {
        winnerIds.forEach(wId => { if (stats[wId]) stats[wId].draws += 1; });
        const losers = uniqueUsers.filter(u => !winnerIds.includes(u.id));
        const prizePerWinner = (losers.length * roundValue) / winnerIds.length;
        winnerIds.forEach(wId => { if (stats[wId]) stats[wId].balance += prizePerWinner; });
        losers.forEach(l => { if (stats[l.id]) stats[l.id].balance -= roundValue; });
      }
    });

    // Se a rodada atual não está finalizada mas tem pontos, somamos apenas os pontos/exatos
    if (currentRoundScores && currentRoundNumber && !processedRounds.has(currentRoundNumber)) {
      currentRoundScores.forEach(s => {
        if (stats[s.id]) {
          stats[s.id].points += s.points;
          stats[s.id].exactScores += s.exactScores;
        }
      });
    }

    return Object.values(stats).sort((a, b) => b.wins - a.wins || b.draws - a.draws || b.points - a.points || b.exactScores - a.exactScores || b.balance - a.balance || a.name.localeCompare(b.name));
  }, [historyForDisplay, allUsers, currentRoundScores, currentRoundNumber]);

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
                        <div className="min-w-0"><h3 className="text-sm font-black italic uppercase text-primary truncate leading-tight">{player.name}</h3><Badge variant="outline" className="rounded-full text-[10px] font-black uppercase h-5 px-2 border-primary/10">{isFirst ? "Alpha Líder" : `Rank #${index + 1}`}</Badge></div>
                     </div>
                     <div className="p-3 space-y-3">
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div><span className="text-base font-black italic text-primary block">{player.wins}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Vits</span></div>
                          <div><span className="text-base font-black italic text-foreground block">{player.draws}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Emps</span></div>
                          <div><span className="text-base font-black italic text-foreground block">{player.points}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Pts</span></div>
                          <div><span className="text-base font-black italic text-secondary block">{player.exactScores}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Exat</span></div>
                        </div>
                        <div className={cn("px-3 py-1.5 rounded-lg border border-dashed flex items-center justify-between", player.balance >= 0 ? "bg-secondary/5 border-secondary/20" : "bg-red-500/5 border-red-500/20")}>
                          <div className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="text-[10px] font-black uppercase text-muted-foreground">Saldo Bancário</span></div>
                          <span className={cn("text-base font-black italic", player.balance >= 0 ? "text-secondary" : "text-red-500")}>R$ {player.balance.toFixed(2)}</span>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              );
           })}
        </div>
        <div className="lg:col-span-4">
          <Card className="glass-card border-none rounded-xl overflow-hidden sticky top-20 shadow-md">
             <CardHeader className="p-3 border-b border-primary/5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><CardTitle className="text-[12px] font-black italic uppercase text-primary">Histórico de Vencedores</CardTitle></div></CardHeader>
             <CardContent className="p-0">
                <Accordion type="single" collapsible defaultValue={currentRoundNumber && currentRoundNumber > 19 ? "turno2" : "turno1"} className="w-full">
                   <AccordionItem value="turno1" className="border-none"><AccordionTrigger className="px-4 py-3 text-[11px] font-black uppercase text-primary/60 hover:no-underline">1º Turno (R1-R19)</AccordionTrigger><AccordionContent className="px-3 pb-3 space-y-1">{historyForDisplay.slice(0, 19).map((rw, i) => <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-[10px] font-bold"><span className="text-primary w-5">#{rw.round}</span><span className="flex-1 truncate mx-2 uppercase italic text-muted-foreground">{rw.winners || "Pendente"}</span><span className="text-primary/40 italic">R${rw.value}</span></div>)}</AccordionContent></AccordionItem>
                   <AccordionItem value="turno2" className="border-none"><AccordionTrigger className="px-4 py-3 text-[11px] font-black uppercase text-primary/60 hover:no-underline">2º Turno (R20-R38)</AccordionTrigger><AccordionContent className="px-3 pb-3 space-y-1">{historyForDisplay.slice(19, 38).map((rw, i) => <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 text-[10px] font-bold"><span className="text-primary w-5">#{rw.round}</span><span className="flex-1 truncate mx-2 uppercase italic text-muted-foreground">{rw.winners || "Pendente"}</span><span className="text-primary/40 italic">R${rw.value}</span></div>)}</AccordionContent></AccordionItem>
                </Accordion>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
