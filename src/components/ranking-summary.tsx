
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
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          <span className="text-sm font-black uppercase italic text-muted-foreground tracking-widest">
            {isRoundFinished ? "Classificação Final" : "Monitor em Tempo Real"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scores.map((score, index) => {
          const isLeader = score.isWinner;
          return (
            <Card key={score.id} className={cn(
              "relative overflow-hidden transition-all duration-300 rounded-3xl border-none shadow-xl", 
              isLeader 
                ? "bg-gradient-to-br from-primary via-blue-700 to-blue-900 ring-2 ring-primary/20 scale-[1.02] z-10" 
                : "glass-card hover:bg-primary/5"
            )}>
              <CardContent className="p-6 flex flex-row items-center gap-6 relative z-10">
                <div className="relative shrink-0">
                  <Avatar className={cn(
                    "h-20 w-20 rounded-2xl border-2 border-background shadow-2xl transition-transform group-hover:scale-105", 
                    isLeader && "border-white/30 h-24 w-24"
                  )}>
                    <AvatarImage src={score.photoUrl || undefined} className="object-cover" />
                    <AvatarFallback className={cn("text-xl font-black italic", isLeader ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                      {score.name ? score.name.substring(0, 2).toUpperCase() : "AL"}
                    </AvatarFallback>
                  </Avatar>
                  {score.points > 0 && (
                    <div className={cn(
                      "absolute -top-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center shadow-2xl border-2 border-background z-20", 
                      index === 0 ? "bg-accent" : "bg-muted"
                    )}>
                      {index === 0 ? <Crown className="h-4 w-4 text-accent-foreground" /> : <span className="text-xs font-black">{index + 1}</span>}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2 mb-1">
                    <h3 className={cn("font-black italic uppercase text-lg truncate tracking-tight", isLeader ? "text-white" : "text-primary")}>
                      {score.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-3xl font-black tabular-nums tracking-tighter", isLeader ? "text-white" : "text-foreground")}>
                      {score.points}
                    </span>
                    <span className={cn("text-[10px] font-black uppercase italic opacity-60", isLeader ? "text-white" : "text-muted-foreground")}>
                      Pontos
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                     <span className={cn(
                       "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg", 
                       isLeader ? "bg-white/10 text-white" : "bg-primary/5 text-primary/70"
                     )}>
                       {score.exactScores} Na Mosca
                     </span>
                     {isScoresHidden && (
                       <span className={cn(
                         "text-[9px] font-black uppercase italic tracking-tighter", 
                         score.betsCompleted ? (isLeader ? "text-white" : "text-secondary") : "opacity-40"
                       )}>
                         {score.betsCompleted ? "Finalizado" : `${score.betsCount}/${totalValidMatches}`}
                       </span>
                     )}
                  </div>
                  {isScoresHidden && (
                    <Progress 
                      value={(score.betsCount / Math.max(1, totalValidMatches)) * 100} 
                      className={cn("h-2.5 mt-3 rounded-full", isLeader ? "bg-white/10 [&>div]:bg-white" : "bg-muted [&>div]:bg-primary")} 
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
