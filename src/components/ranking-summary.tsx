"use client";

import React from "react";
import { PlayerScore } from "@/lib/types";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { Trophy, Medal, Star, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankingSummaryProps {
  scores: PlayerScore[];
  isScoresHidden: boolean;
  isRoundFinished: boolean;
  totalValidMatches?: number;
}

export function RankingSummary({ scores, isScoresHidden, isRoundFinished, totalValidMatches = 10 }: RankingSummaryProps) {
  const sortedScores = scores;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          <span className="text-xs font-black uppercase italic text-muted-foreground tracking-widest">
            {isRoundFinished ? "Classificação Final" : "Classificação em Tempo Real"}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-4 gap-4">
        {sortedScores.map((score, index) => {
          const progressPercentage = (score.betsCount / Math.max(1, totalValidMatches)) * 100;
          const showWinnerStyles = score.isWinner;
          const showMedals = score.points > 0 && (isRoundFinished || score.isWinner);
          
          return (
            <Card 
              key={score.id} 
              className={cn(
                "relative overflow-hidden transition-all duration-500 rounded-3xl group border-none",
                showWinnerStyles 
                  ? "bg-gradient-to-br from-primary via-primary/90 to-blue-800 shadow-xl shadow-primary/20 scale-[1.02] md:scale-105 z-20" 
                  : "glass-card hover:bg-primary/5"
              )}
            >
              {showWinnerStyles && (
                <div className="absolute top-0 right-0 p-2 opacity-10 md:opacity-20">
                   <Crown className="h-20 w-20 text-white animate-pulse" />
                </div>
              )}
              
              <CardContent className="p-5 md:p-6 flex flex-row md:flex-col items-center md:text-center gap-5 relative z-10">
                <div className="relative shrink-0 group">
                  <div className={cn(
                    "relative h-16 w-16 md:h-20 md:w-20 flex items-center justify-center rounded-[1.5rem] md:rounded-[1.75rem] shadow-inner transition-transform group-hover:scale-105",
                    showWinnerStyles ? "bg-white/20" : "bg-primary/5"
                  )}>
                    <Avatar className={cn(
                       "h-14 w-14 md:h-[72px] md:w-[72px] rounded-full border-2 border-background shadow-md bg-muted flex items-center justify-center transition-all",
                       showWinnerStyles && "border-white/40"
                    )}>
                      <AvatarImage src={score.photoUrl || undefined} className="object-cover" />
                      <AvatarFallback className={cn(
                        "text-2xl md:text-2xl font-black italic w-full h-full flex items-center justify-center",
                        showWinnerStyles ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      )}>
                        {score.name ? score.name.substring(0, 2).toUpperCase() : "AL"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  {showMedals && (
                    <div className={cn(
                      "absolute -top-2 -right-2 h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center shadow-lg border-2 border-background z-20",
                      index === 0 ? "bg-accent" : index === 1 ? "bg-slate-300" : index === 2 ? "bg-amber-600" : "bg-muted"
                    )}>
                      {index === 0 ? <Trophy className="h-4 w-4 md:h-4 md:w-4 text-accent-foreground" /> : 
                       index === 1 ? <Medal className="h-4 w-4 md:h-4 md:w-4 text-slate-600" /> :
                       index === 2 ? <Medal className="h-4 w-4 md:h-4 md:w-4 text-white" /> :
                       <Star className="h-3 w-3 md:h-3 md:w-3 text-muted-foreground" />}
                    </div>
                  )}

                  {!score.isWinner && score.points > 0 && (
                    <div className="absolute -top-1 -right-1 h-6 w-6 bg-primary text-white rounded-full flex items-center justify-center text-[11px] font-black border-2 border-background shadow-lg">
                      {index + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full min-w-0 space-y-1">
                  <div className="flex flex-row md:flex-col justify-between md:justify-start items-center md:items-center gap-2">
                    <h3 className={cn(
                      "font-black italic uppercase text-lg md:text-base leading-none truncate pr-1",
                      showWinnerStyles ? "text-white" : "text-foreground"
                    )}>{score.name}</h3>
                    
                    <div className="flex items-center md:flex-col gap-2 md:gap-0">
                      <span className={cn(
                         "text-3xl md:text-3xl font-black tabular-nums tracking-tighter",
                         showWinnerStyles ? "text-white" : "text-primary"
                      )}>
                        {score.points} <span className="text-[12px] md:text-[11px] font-bold opacity-50 italic">PTS</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:mt-2">
                     <Badge variant="outline" className={cn(
                        "rounded-full text-[11px] md:text-[10px] font-black uppercase tracking-widest border-none px-3 h-6",
                        showWinnerStyles ? "bg-white/10 text-white" : "bg-primary/5 text-muted-foreground"
                     )}>
                       {score.exactScores} Exatos
                     </Badge>

                     {isScoresHidden && (
                       <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[12px] md:text-[11px] font-black uppercase italic tracking-tighter whitespace-nowrap",
                            score.betsCompleted 
                              ? (showWinnerStyles ? "text-white" : "text-secondary") 
                              : (showWinnerStyles ? "text-white/80" : "text-muted-foreground/80")
                          )}>
                            {score.betsCompleted ? "Quilado" : "Não Quilou"}
                            <span className="ml-1 opacity-50 tabular-nums">({score.betsCount}/{totalValidMatches})</span>
                          </span>
                       </div>
                     )}
                  </div>

                  {isScoresHidden && (
                    <div className="mt-2">
                      <Progress 
                        value={progressPercentage} 
                        className={cn(
                          "h-2 rounded-full",
                          showWinnerStyles ? "bg-white/10 [&>div]:bg-white" : "bg-muted [&>div]:bg-primary"
                        )} 
                      />
                    </div>
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
