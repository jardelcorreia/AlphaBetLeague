"use client";

import React from "react";
import { Match, Prediction, MatchStatus } from "@/lib/types";
import { TEAMS } from "@/lib/constants";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Save, Loader2, Sparkles, AlertTriangle, ShieldCheck, User, Zap, Lock, AlertCircle, CheckCircle2, TrendingUp, History, Timer } from "lucide-react";
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
  const isFutureRound = systemCurrentRound ? round > systemCurrentRound : false;

  if (!matches || matches.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center glass-card rounded-[2.5rem] border-dashed border-2 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-30" />
        <span className="text-base font-black italic uppercase text-muted-foreground">Nenhum jogo encontrado para esta rodada.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between glass-card p-5 rounded-3xl shadow-lg border-none">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={round <= 1} className="rounded-2xl h-12 w-12 hover:bg-primary/10">
          <ChevronLeft className="h-8 w-8" />
        </Button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-primary/10 text-primary border-none text-[11px] font-black uppercase px-4 h-6">Brasileirão 2026</Badge>
            {isOfficialCurrent ? (
              <Badge className="bg-secondary/10 text-secondary border-none text-[11px] font-black uppercase px-4 h-6 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" /> Rodada Atual
              </Badge>
            ) : isPastRound ? (
              <Badge className="bg-muted text-muted-foreground border-none text-[11px] font-black uppercase px-4 h-6 flex items-center gap-1">
                <History className="h-3 w-3" /> Encerrada
              </Badge>
            ) : (
              <Badge className="bg-accent/10 text-accent border-none text-[11px] font-black uppercase px-4 h-6 flex items-center gap-1">
                <Timer className="h-3 w-3 text-accent" /> Próxima
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
             <span className="text-sm font-bold text-muted-foreground uppercase">Rodada</span>
             <span className={cn(
               "text-3xl font-black italic leading-none",
               isOfficialCurrent ? "text-primary" : "text-foreground opacity-60"
             )}>#{round}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={round >= totalRounds} className="rounded-2xl h-12 w-12 hover:bg-primary/10">
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matches.map((match, idx) => {
          const home = getTeamInfo(match.homeTeam);
          const away = getTeamInfo(match.awayTeam);
          const isFinished = match.status === 'finished';
          const isLive = match.status === 'live';
          const isCancelled = match.status === 'cancelled';
          const originalIdx = match.originalIndex ?? idx;
          const currentPred = predictions[originalIdx] || { homeScore: "", awayScore: "" };
          const isOutOfWindow = match.isValidForPoints === false;
          const isEffectivelyInvalid = isOutOfWindow || isCancelled;
          const points = getMatchPoints(match, currentPred);

          return (
            <Card key={match.id} className={cn(
              "glass-card border-none rounded-[2.5rem] overflow-hidden hover:shadow-2xl transition-all duration-500 group relative",
              isEffectivelyInvalid && "border-2 border-destructive/20 opacity-90"
            )}>
              <CardContent className="p-0">
                <div className="px-6 py-4 bg-muted/30 flex justify-between items-center border-b border-white/10">
                   <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[11px] font-black uppercase text-muted-foreground">{formatDate(match.utcDate)}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {isEffectivelyInvalid && (
                        <Badge variant="destructive" className="rounded-full px-4 text-[10px] font-black uppercase border-none h-6 animate-pulse">
                          {isCancelled ? 'Jogo Adiado' : 'Fora da Janela'}
                        </Badge>
                      )}
                      {isAdmin ? (
                        <Select
                          value={match.status}
                          onValueChange={(val: MatchStatus) => updateMatchManual(idx, { status: val })}
                        >
                          <SelectTrigger className="h-8 rounded-full text-[10px] font-black uppercase border-none bg-primary/10 text-primary px-4 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-xl">
                            <SelectItem value="upcoming" className="text-xs font-black uppercase italic">Agendado</SelectItem>
                            <SelectItem value="live" className="text-xs font-black uppercase italic text-red-600 dark:text-red-400">Ao Vivo</SelectItem>
                            <SelectItem value="finished" className="text-xs font-black uppercase italic text-primary">Finalizado</SelectItem>
                            <SelectItem value="cancelled" className="text-xs font-black uppercase italic text-muted-foreground">Adiado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={cn(
                          "rounded-full px-4 text-[10px] font-black uppercase border-none h-7 flex items-center",
                          isLive ? "bg-red-600 text-white animate-pulse" : 
                          isFinished ? "bg-primary/20 text-primary" : 
                          isCancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        )}>
                          {isFinished ? 'Finalizado' : isLive ? 'Ao Vivo' : isCancelled ? 'Adiado' : 'Agendado'}
                        </Badge>
                      )}
                   </div>
                </div>

                <div className="p-7 md:p-10 flex items-center justify-between gap-3">
                  <div className="flex flex-col items-center gap-3 w-1/3 text-center">
                    <img src={home.escudo} alt={home.nome} className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex flex-col items-center">
                       <span className="text-2xl md:text-3xl font-black italic uppercase text-primary leading-none">{home.abrev}</span>
                       <span className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase leading-tight line-clamp-1 mt-1">{home.nome}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center w-1/3 gap-5">
                    {isAdmin && (
                      <div className="flex flex-col items-center gap-2 p-3 bg-primary/5 rounded-2xl border border-dashed border-primary/20 w-full">
                         <div className="flex items-center gap-1 text-[10px] font-black uppercase text-primary">
                            <ShieldCheck className="h-3 w-3" /> Oficial
                         </div>
                         <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={match.homeScore ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                                updateMatchManual(idx, { homeScore: val });
                              }}
                              className="w-10 h-10 text-center rounded-xl p-0 font-black text-lg border-primary/20 bg-background dark:bg-slate-900 focus-visible:ring-primary/20"
                              placeholder="-"
                            />
                            <span className="font-black text-primary/30 italic text-xs">X</span>
                            <Input
                              type="number"
                              value={match.awayScore ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                                updateMatchManual(idx, { awayScore: val });
                              }}
                              className="w-10 h-10 text-center rounded-xl p-0 font-black text-lg border-primary/20 bg-background dark:bg-slate-900 focus-visible:ring-primary/20"
                              placeholder="-"
                            />
                         </div>
                      </div>
                    )}

                    {(isFinished || isLive) && !isAdmin ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 md:gap-5 relative">
                          {isLive && (
                            <Zap className="h-4 w-4 text-red-600 dark:text-red-400 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce fill-current" />
                          )}
                          <span className={cn(
                            "text-4xl md:text-5xl font-black italic",
                            isLive ? "text-red-600 dark:text-red-400" : "text-primary"
                          )}>{match.homeScore ?? 0}</span>
                          <div className="h-8 md:h-10 w-[2px] bg-muted/50 rotate-12" />
                          <span className={cn(
                            "text-4xl md:text-5xl font-black italic",
                            isLive ? "text-red-600 dark:text-red-400" : "text-primary"
                          )}>{match.awayScore ?? 0}</span>
                        </div>
                        
                        <div className="flex flex-col items-center bg-primary/5 px-4 py-1.5 rounded-xl border border-primary/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500 relative">
                           {points !== null && (
                             <Badge className={cn(
                               "absolute -top-4 -right-4 rounded-lg text-[10px] font-black italic shadow-lg animate-in zoom-in duration-300 h-6 px-3",
                               points === 3 ? "bg-secondary text-white" : points === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                             )}>
                               {points === 3 ? "+3 PTS" : points === 1 ? "+1 PT" : "0 PTS"}
                             </Badge>
                           )}
                           <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                              <User className="h-2.5 w-2.5" /> Meu Palpite
                           </div>
                           <div className="flex items-center gap-2 font-black italic text-sm text-primary/70 tabular-nums">
                              <span>{currentPred.homeScore || "0"}</span>
                              <span className="text-[10px] opacity-30">X</span>
                              <span>{currentPred.awayScore || "0"}</span>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                         {!isAdmin && (
                           <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground">
                              <User className="h-2.5 w-2.5" /> {isLocked ? "Palpite Encerrado" : "Meu Palpite"}
                           </div>
                         )}
                         <div className="flex items-center gap-2">
                            <Input
                              id={`cal-input-${idx}-home`}
                              type="number"
                              value={currentPred.homeScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'home', e.target.value)}
                              className={cn(
                                "w-11 h-11 md:w-12 md:h-12 text-center rounded-xl p-0 font-black text-xl border-primary/20 shadow-inner",
                                isLocked && "bg-muted/30 opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                            <span className="font-black text-primary/40 italic text-sm">X</span>
                            <Input
                              id={`cal-input-${idx}-away`}
                              type="number"
                              value={currentPred.awayScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'away', e.target.value)}
                              className={cn(
                                "w-11 h-11 md:w-12 md:h-12 text-center rounded-xl p-0 font-black text-xl border-primary/20 shadow-inner",
                                isLocked && "bg-muted/30 opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                         </div>
                         {!isLocked && (
                           <div className="flex items-center gap-1 mt-1.5">
                              <CheckCircle2 className="h-3 w-3 text-secondary opacity-70" />
                              <span className="text-[8px] font-black uppercase text-primary/70 dark:text-primary/90 tracking-widest">Auto-Save Ativo</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-3 w-1/3 text-center">
                    <img src={away.escudo} alt={away.nome} className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex flex-col items-center">
                       <span className="text-2xl md:text-3xl font-black italic uppercase text-primary leading-none">{away.abrev}</span>
                       <span className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase leading-tight line-clamp-1 mt-1">{away.nome}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "px-6 py-5 flex flex-col items-center gap-1.5",
                  isEffectivelyInvalid ? "bg-destructive/5" : "bg-primary/5"
                )}>
                   <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary/40" />
                      <span className="text-[11px] font-black italic text-primary/60">
                        {formatTime(match.utcDate)} {isLive ? "" : `• ${isFinished ? "RESULTADO FINAL" : isCancelled ? "PARTIDA ADIADA" : isLocked ? "PALPITES ENCERRADOS" : "QUILA EM ANDAMENTO"}`}
                      </span>
                   </div>
                   {isEffectivelyInvalid && (
                     <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-black text-[10px] uppercase tracking-wider text-center px-4">
                        <AlertTriangle className="h-4 w-4" /> 
                        {isCancelled ? 'Pontuação suspensa para este jogo' : 'Jogo indisponível para pontuação'}
                     </div>
                   )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLocked && (
        <div className="flex justify-center pt-8">
          <Button 
            size="lg" 
            onClick={onSave} 
            disabled={isSaving}
            className="h-16 px-12 rounded-3xl gap-4 font-black italic uppercase text-xl sports-gradient shadow-2xl shadow-primary/40 hover:scale-[1.05] transition-transform active:scale-95"
          >
            {isSaving ? <Loader2 className="h-7 w-7 animate-spin" /> : <Sparkles className="h-7 w-7 fill-current" />}
            {isSaving ? "Sincronizando..." : "CONFIRMAR QUILA"}
          </Button>
        </div>
      )}

      {isLocked && !isAdmin && (
        <div className="flex justify-center pt-8">
           <div className="flex items-center gap-4 bg-muted/50 px-10 py-5 rounded-3xl border border-dashed border-primary/20 text-muted-foreground animate-in fade-in zoom-in duration-500">
              <Lock className="h-6 w-6 opacity-40" />
              <span className="text-base font-black italic uppercase tracking-widest">Os palpites para esta rodada foram encerrados</span>
           </div>
        </div>
      )}
    </div>
  );
}
