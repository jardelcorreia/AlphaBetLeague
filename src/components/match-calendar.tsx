"use client";

import React from "react";
import { Match, Prediction, MatchStatus } from "@/lib/types";
import { TEAMS } from "@/lib/constants";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Save, Loader2, Sparkles, AlertTriangle, ShieldCheck, User, Zap, Lock, AlertCircle, CheckCircle2, History, Timer } from "lucide-react";
import { cn, cleanTeamName } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MatchCalendarProps {
  matches: Match[];
  round: number;
  systemCurrentRound: number | null;
  totalRounds: number;
  predictions: Prediction[];
  setPrediction: (matchIndex: number, type: 'home' | 'away', value: string) => void;
  updateMatchManual: (idx: number, updates: Partial<Match>) => void;
  isAdmin: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  isSaving: boolean;
  isLocked?: boolean;
}

export function MatchCalendar({ 
  matches, 
  round, 
  systemCurrentRound,
  totalRounds, 
  predictions,
  setPrediction,
  updateMatchManual,
  isAdmin,
  onPrev, 
  onNext,
  onSave,
  isSaving,
  isLocked = false
}: MatchCalendarProps) {
  
  const getTeamInfo = (name: string) => {
    if (TEAMS[name]) return TEAMS[name];
    const cleaned = cleanTeamName(name);
    return {
      abrev: cleaned.substring(0, 3).toUpperCase(),
      nome: cleaned,
      escudo: "https://logodetimes.com/imagens/generico-256.png"
    };
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const getMatchPoints = (match: Match, pred: Prediction) => {
    if (!match || (match.status !== 'finished' && match.status !== 'live')) return null;
    if (match.homeScore === undefined || match.awayScore === undefined || match.homeScore === null || match.awayScore === null) return null;
    if (!pred.homeScore || !pred.awayScore) return null;

    const rh = match.homeScore;
    const ra = match.awayScore;
    const ph = parseInt(pred.homeScore);
    const pa = parseInt(pred.awayScore);

    if (isNaN(ph) || isNaN(pa)) return null;

    if (ph === rh && pa === ra) return 3;
    if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) return 1;
    return 0;
  };

  const handlePredictionChange = (idx: number, originalIdx: number, type: 'home' | 'away', value: string) => {
    if (isLocked) return;
    const cleanValue = value.slice(-1);
    setPrediction(originalIdx, type, cleanValue);

    if (cleanValue !== "") {
      if (type === 'home') {
        const nextInput = document.getElementById(`cal-input-${idx}-away`);
        nextInput?.focus();
      } else {
        const nextInput = document.getElementById(`cal-input-${idx + 1}-home`);
        nextInput?.focus();
      }
    }
  };

  const isOfficialCurrent = systemCurrentRound === round;
  const isPastRound = systemCurrentRound ? round < systemCurrentRound : false;

  if (!matches || matches.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center glass-card rounded-2xl border-dashed border-2 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        <span className="text-sm font-black italic uppercase text-muted-foreground">Sincronizando Jogos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-card p-4 rounded-2xl shadow-md border-none">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={round <= 1} className="rounded-xl h-10 w-10 hover:bg-primary/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase px-2 h-5">Brasileirão 2026</Badge>
            {isOfficialCurrent && (
              <Badge className="bg-secondary/10 text-secondary border-none text-[9px] font-black uppercase px-2 h-5 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" /> Atual
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
             <span className="text-xs font-bold text-muted-foreground uppercase">Rodada</span>
             <span className={cn("text-2xl font-black italic leading-none", isOfficialCurrent ? "text-primary" : "text-foreground opacity-60")}>#{round}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={round >= totalRounds} className="rounded-xl h-10 w-10 hover:bg-primary/10">
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((match, idx) => {
          const home = getTeamInfo(match.homeTeam);
          const away = getTeamInfo(match.awayTeam);
          const isFinished = match.status === 'finished';
          const isLive = match.status === 'live';
          const isCancelled = match.status === 'cancelled';
          const originalIdx = match.originalIndex ?? idx;
          const currentPred = predictions[originalIdx] || { homeScore: "", awayScore: "" };
          const isOutOfWindow = match.isValidForPoints === false;
          const points = getMatchPoints(match, currentPred);

          return (
            <Card key={match.id || idx} className={cn(
              "glass-card border-none rounded-2xl overflow-hidden hover:ring-1 hover:ring-primary/20 transition-all group relative",
              (isOutOfWindow || isCancelled) && "opacity-80"
            )}>
              <CardContent className="p-0">
                <div className="px-4 py-2 bg-muted/20 flex justify-between items-center border-b border-white/5">
                   <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground">{formatDate(match.utcDate)}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {isLive ? (
                        <Badge className="rounded-full px-2 text-[9px] font-black uppercase bg-red-600 text-white animate-pulse h-5 gap-1">
                          <div className="h-1 w-1 rounded-full bg-white animate-ping" /> Ao Vivo
                        </Badge>
                      ) : isFinished ? (
                        <Badge className="bg-primary/20 text-primary rounded-full px-2 text-[9px] font-black uppercase h-5">Fim</Badge>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-primary/40">{formatTime(match.utcDate)}</span>
                      )}
                   </div>
                </div>

                <div className="p-5 md:p-6 flex items-center justify-between gap-2">
                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <img src={home.escudo} alt={home.nome} className="w-10 h-10 md:w-14 md:h-14 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                    <span className="text-lg md:text-xl font-black italic uppercase text-primary leading-none tracking-tight truncate w-full">{home.abrev}</span>
                  </div>

                  <div className="flex flex-col items-center justify-center w-1/3 gap-3">
                    {(isFinished || isLive) && !isAdmin ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-3 relative">
                          <span className={cn("text-3xl md:text-4xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{match.homeScore ?? 0}</span>
                          <span className="text-muted-foreground/20 font-black italic text-lg">X</span>
                          <span className={cn("text-3xl md:text-4xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{match.awayScore ?? 0}</span>
                        </div>
                        
                        <div className="flex flex-col items-center bg-primary/5 px-4 py-1.5 rounded-xl border border-primary/10 relative">
                           {points !== null && (
                             <div className={cn(
                               "absolute -top-3 -right-3 rounded-lg text-[9px] font-black italic shadow-md h-5 px-2 flex items-center",
                               points === 3 ? "bg-secondary text-white" : points === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                             )}>
                               {points === 3 ? "+3" : points === 1 ? "+1" : "0"}
                             </div>
                           )}
                           <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1">Meu Palpite</span>
                           <div className="flex items-center gap-2 font-black italic text-sm text-primary/70 tabular-nums leading-none">
                              <span>{currentPred.homeScore || "0"}</span>
                              <span className="opacity-20 text-[8px]">-</span>
                              <span>{currentPred.awayScore || "0"}</span>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                         <div className="flex items-center gap-2">
                            <Input
                              id={`cal-input-${idx}-home`}
                              type="number"
                              value={currentPred.homeScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'home', e.target.value)}
                              className={cn(
                                "w-10 h-10 md:w-12 md:h-12 text-center rounded-xl p-0 font-black text-xl border-primary/20",
                                isLocked && "opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                            <span className="font-black text-primary/20 italic text-sm">X</span>
                            <Input
                              id={`cal-input-${idx}-away`}
                              type="number"
                              value={currentPred.awayScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'away', e.target.value)}
                              className={cn(
                                "w-10 h-10 md:w-12 md:h-12 text-center rounded-xl p-0 font-black text-xl border-primary/20",
                                isLocked && "opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                         </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <img src={away.escudo} alt={away.nome} className="w-10 h-10 md:w-14 md:h-14 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                    <span className="text-lg md:text-xl font-black italic uppercase text-primary leading-none tracking-tight truncate w-full">{away.abrev}</span>
                  </div>
                </div>

                {(isOutOfWindow || isCancelled) && (
                   <div className="bg-destructive/10 px-4 py-1.5 flex items-center justify-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      <span className="text-[9px] font-black uppercase text-destructive tracking-widest">{isCancelled ? 'Jogo Adiado' : 'Fora da Janela'}</span>
                   </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLocked && (
        <div className="flex justify-center pt-6">
          <Button 
            size="lg" 
            onClick={onSave} 
            disabled={isSaving}
            className="h-14 px-10 rounded-2xl gap-3 font-black italic uppercase text-lg sports-gradient shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 fill-current" />}
            {isSaving ? "Sincronizando..." : "CONFIRMAR QUILA"}
          </Button>
        </div>
      )}
    </div>
  );
}
