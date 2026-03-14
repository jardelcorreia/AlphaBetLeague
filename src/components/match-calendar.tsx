
"use client";

import React from "react";
import { Match, Prediction, MatchStatus } from "@/lib/types";
import { TEAMS } from "@/lib/constants";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Save, Loader2, Sparkles, AlertTriangle, ShieldCheck, User, Zap, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
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

  const handlePredictionChange = (idx: number, originalIdx: number, type: 'home' | 'away', value: string) => {
    if (isLocked) return;
    const cleanValue = value.slice(-1);
    
    // Dispara a atualização imediata (HomeContent gerencia o auto-save via setPrediction)
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

  if (!matches || matches.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center glass-card rounded-[2.5rem] border-dashed border-2 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-30" />
        <span className="text-sm font-black italic uppercase text-muted-foreground">Nenhum jogo encontrado para esta rodada.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between glass-card p-4 rounded-3xl shadow-lg border-none">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={round <= 1} className="rounded-2xl hover:bg-primary/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex flex-col items-center">
          <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase mb-1 px-3">Brasileirão 2026</Badge>
          <div className="flex items-baseline gap-2">
             <span className="text-xs font-bold text-muted-foreground uppercase">Rodada</span>
             <span className="text-2xl font-black italic text-primary leading-none">#{round}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={round >= totalRounds} className="rounded-2xl hover:bg-primary/10">
          <ChevronRight className="h-6 w-6" />
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

          return (
            <Card key={match.id} className={cn(
              "glass-card border-none rounded-[2.5rem] overflow-hidden hover:shadow-2xl transition-all duration-500 group relative",
              isEffectivelyInvalid && "border-2 border-destructive/20 opacity-90"
            )}>
              <CardContent className="p-0">
                <div className="px-6 py-3 bg-muted/30 flex justify-between items-center border-b border-white/10">
                   <div className="flex items-center gap-2">
                      <CalendarDays className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] font-black uppercase text-muted-foreground">{formatDate(match.utcDate)}</span>
                   </div>
                   <div className="flex items-center gap-2">
                      {isEffectivelyInvalid && (
                        <Badge variant="destructive" className="rounded-full px-3 text-[8px] font-black uppercase border-none animate-pulse">
                          {isCancelled ? 'Jogo Adiado' : 'Fora da Janela'}
                        </Badge>
                      )}
                      {isAdmin ? (
                        <Select
                          value={match.status}
                          onValueChange={(val: MatchStatus) => updateMatchManual(idx, { status: val })}
                        >
                          <SelectTrigger className="h-6 rounded-full text-[8px] font-black uppercase border-none bg-primary/10 text-primary px-3 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-xl">
                            <SelectItem value="upcoming" className="text-[10px] font-black uppercase italic">Agendado</SelectItem>
                            <SelectItem value="live" className="text-[10px] font-black uppercase italic text-red-600 dark:text-red-400">Ao Vivo</SelectItem>
                            <SelectItem value="finished" className="text-[10px] font-black uppercase italic text-primary">Finalizado</SelectItem>
                            <SelectItem value="cancelled" className="text-[10px] font-black uppercase italic text-muted-foreground">Adiado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={cn(
                          "rounded-full px-3 text-[8px] font-black uppercase border-none",
                          isLive ? "bg-red-600 text-white animate-pulse" : 
                          isFinished ? "bg-primary/20 text-primary" : 
                          isCancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                        )}>
                          {isFinished ? 'Finalizado' : isLive ? 'Ao Vivo' : isCancelled ? 'Adiado' : 'Agendado'}
                        </Badge>
                      )}
                   </div>
                </div>

                <div className="p-6 md:p-8 flex items-center justify-between gap-2">
                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <img src={home.escudo} alt={home.nome} className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex flex-col items-center">
                       <span className="text-xl md:text-2xl font-black italic uppercase text-primary leading-none">{home.abrev}</span>
                       <span className="text-[7px] md:text-[8px] font-bold text-muted-foreground uppercase leading-tight line-clamp-1">{home.nome}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center w-1/3 gap-4">
                    {isAdmin && (
                      <div className="flex flex-col items-center gap-1.5 p-2 bg-primary/5 rounded-2xl border border-dashed border-primary/20 w-full">
                         <div className="flex items-center gap-1 text-[7px] font-black uppercase text-primary">
                            <ShieldCheck className="h-2 w-2" /> Oficial
                         </div>
                         <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={match.homeScore ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                                updateMatchManual(idx, { homeScore: val });
                              }}
                              className="w-8 h-8 text-center rounded-lg p-0 font-black text-sm border-primary/20 bg-background dark:bg-slate-900 focus-visible:ring-primary/20"
                              placeholder="-"
                            />
                            <span className="font-black text-primary/30 italic text-[10px]">X</span>
                            <Input
                              type="number"
                              value={match.awayScore ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                                updateMatchManual(idx, { awayScore: val });
                              }}
                              className="w-8 h-8 text-center rounded-lg p-0 font-black text-sm border-primary/20 bg-background dark:bg-slate-900 focus-visible:ring-primary/20"
                              placeholder="-"
                            />
                         </div>
                      </div>
                    )}

                    {(isFinished || isLive) && !isAdmin ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 md:gap-4 relative">
                          {isLive && (
                            <Zap className="h-3 w-3 text-red-600 dark:text-red-400 absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce fill-current" />
                          )}
                          <span className={cn(
                            "text-3xl md:text-4xl font-black italic",
                            isLive ? "text-red-600 dark:text-red-400" : "text-primary"
                          )}>{match.homeScore ?? 0}</span>
                          <div className="h-6 md:h-8 w-[2px] bg-muted/50 rotate-12" />
                          <span className={cn(
                            "text-3xl md:text-4xl font-black italic",
                            isLive ? "text-red-600 dark:text-red-400" : "text-primary"
                          )}>{match.awayScore ?? 0}</span>
                        </div>
                        
                        <div className="flex flex-col items-center bg-primary/5 px-3 py-1 rounded-xl border border-primary/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                           <div className="flex items-center gap-1 text-[7px] font-black uppercase text-muted-foreground/70 tracking-widest">
                              <User className="h-2 w-2" /> Meu Palpite
                           </div>
                           <div className="flex items-center gap-1.5 font-black italic text-xs text-primary/70 tabular-nums">
                              <span>{currentPred.homeScore || "0"}</span>
                              <span className="text-[8px] opacity-30">X</span>
                              <span>{currentPred.awayScore || "0"}</span>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                         {!isAdmin && (
                           <div className="flex items-center gap-1 text-[7px] font-black uppercase text-muted-foreground">
                              <User className="h-2 w-2" /> {isLocked ? "Palpite Encerrado" : "Meu Palpite"}
                           </div>
                         )}
                         <div className="flex items-center gap-1.5">
                            <Input
                              id={`cal-input-${idx}-home`}
                              type="number"
                              value={currentPred.homeScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'home', e.target.value)}
                              className={cn(
                                "w-9 h-9 md:w-10 md:h-10 text-center rounded-xl p-0 font-black text-lg border-primary/20 shadow-inner",
                                isLocked && "bg-muted/30 opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                            <span className="font-black text-primary/40 italic text-xs">X</span>
                            <Input
                              id={`cal-input-${idx}-away`}
                              type="number"
                              value={currentPred.awayScore}
                              onChange={(e) => handlePredictionChange(idx, originalIdx, 'away', e.target.value)}
                              className={cn(
                                "w-9 h-9 md:w-10 md:h-10 text-center rounded-xl p-0 font-black text-lg border-primary/20 shadow-inner",
                                isLocked && "bg-muted/30 opacity-50 cursor-not-allowed"
                              )}
                              disabled={isFinished || isCancelled || isOutOfWindow || isLive || isLocked}
                            />
                         </div>
                         {!isLocked && (
                           <div className="flex items-center gap-1 mt-1">
                              <CheckCircle2 className="h-2 w-2 text-secondary opacity-70" />
                              <span className="text-[6px] font-black uppercase text-primary/70 dark:text-primary/90 tracking-widest">Auto-Save Ativo</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-2 w-1/3 text-center">
                    <img src={away.escudo} alt={away.nome} className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex flex-col items-center">
                       <span className="text-xl md:text-2xl font-black italic uppercase text-primary leading-none">{away.abrev}</span>
                       <span className="text-[7px] md:text-[8px] font-bold text-muted-foreground uppercase leading-tight line-clamp-1">{away.nome}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "px-6 py-4 flex flex-col items-center gap-1",
                  isEffectivelyInvalid ? "bg-destructive/5" : "bg-primary/5"
                )}>
                   <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-primary/40" />
                      <span className="text-[10px] font-black italic text-primary/60">
                        {formatTime(match.utcDate)} {isLive ? "" : `• ${isFinished ? "RESULTADO FINAL" : isCancelled ? "PARTIDA ADIADA" : isLocked ? "PALPITES ENCERRADOS" : "QUILA EM ANDAMENTO"}`}
                      </span>
                   </div>
                   {isEffectivelyInvalid && (
                     <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-black text-[9px] uppercase tracking-wider text-center px-4">
                        <AlertTriangle className="h-3 w-3" /> 
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
            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6 fill-current" />}
            {isSaving ? "Sincronizando..." : "CONFIRMAR QUILA"}
          </Button>
        </div>
      )}

      {isLocked && !isAdmin && (
        <div className="flex justify-center pt-8">
           <div className="flex items-center gap-3 bg-muted/50 px-8 py-4 rounded-3xl border border-dashed border-primary/20 text-muted-foreground animate-in fade-in zoom-in duration-500">
              <Lock className="h-5 w-5 opacity-40" />
              <span className="text-sm font-black italic uppercase tracking-widest">Os palpites para esta rodada foram encerrados</span>
           </div>
        </div>
      )}
    </div>
  );
}
