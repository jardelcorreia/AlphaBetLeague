"use client";

import React from "react";
import { PlayerScore } from "@/lib/types";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { Trophy, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingSummaryProps {
  scores: PlayerScore[];
  isScoresHidden: boolean;
  isRoundFinished: boolean;
  totalValidMatches?: number;
}

export function RankingSummary({ scores, isScoresHidden, isRoundFinished, totalValidMatches = 10 }: RankingSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-black uppercase italic text-muted-foreground tracking-widest">
            {isRoundFinished ? "Classificação Final" : "Tempo Real"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {scores.map((score, index) => {
          const isLeader = score.isWinner;
          return (
            <Card key={score.id} className={cn("relative overflow-hidden transition-all duration-300 rounded-2xl group border-none", isLeader ? "bg-gradient-to-br from-primary to-blue-800 shadow-lg" : "glass-card hover:bg-primary/5 shadow-md")}>
              <CardContent className="p-4 flex flex-row items-center gap-4 relative z-10">
                <div className="relative shrink-0">
                  <Avatar className={cn("h-11 w-11 rounded-full border-2 border-background bg-muted", isLeader && "border-white/40")}>
                    <AvatarImage src={score.photoUrl || undefined} className="object-cover" />
                    <AvatarFallback className={cn("text-xs font-black italic", isLeader ? "bg-primary text-white" : "bg-primary/10 text-primary")}>{score.name ? score.name.substring(0, 2).toUpperCase() : "AL"}</AvatarFallback>
                  </Avatar>
                  {score.points > 0 && (
                    <div className={cn("absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-md border border-background z-20", index === 0 ? "bg-accent" : "bg-muted")}>
                      {index === 0 ? <Crown className="h-3 w-3 text-accent-foreground" /> : <span className="text-[8px] font-black">{index + 1}</span>}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className={cn("font-black italic uppercase text-sm truncate", isLeader ? "text-white" : "text-foreground")}>{score.name}</h3>
                    <span className={cn("text-lg font-black tabular-nums tracking-tighter", isLeader ? "text-white" : "text-primary")}>
                      {score.points} <span className="text-[9px] font-bold opacity-50 italic">PTS</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                     <span className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/5", isLeader ? "bg-white/10 text-white" : "text-muted-foreground")}>
                       {score.exactScores} Exatos
                     </span>
                     {isScoresHidden && (
                       <span className={cn("text-[9px] font-black uppercase italic tracking-tighter whitespace-nowrap", score.betsCompleted ? (isLeader ? "text-white" : "text-secondary") : "opacity-60")}>
                         {score.betsCompleted ? "Quilado" : `Pendente (${score.betsCount}/${totalValidMatches})`}
                       </span>
                     )}
                  </div>
                  {isScoresHidden && <Progress value={(score.betsCount / Math.max(1, totalValidMatches)) * 100} className={cn("h-1.5 mt-1.5", isLeader ? "bg-white/10 [&>div]:bg-white" : "bg-muted [&>div]:bg-primary")} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}