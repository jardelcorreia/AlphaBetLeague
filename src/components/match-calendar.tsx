"use client";

import React from "react";
import { Match, Prediction } from "@/lib/types";
import { TEAMS } from "@/lib/constants";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles, AlertTriangle, Zap } from "lucide-react";
import { cn, cleanTeamName } from "@/lib/utils";
import { Button } from "./ui/button";

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
  matches, round, systemCurrentRound, totalRounds, predictions, setPrediction, onPrev, onNext, onSave, isSaving, isLocked = false
}: MatchCalendarProps) {
  const getTeamInfo = (name: string) => {
    if (TEAMS[name]) return TEAMS[name];
    const cleaned = cleanTeamName(name);
    return { abrev: cleaned.substring(0, 3).toUpperCase(), nome: cleaned, escudo: "https://logodetimes.com/imagens/generico-256.png" };
  };

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return "--:--"; }
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }); } catch { return "---"; }
  };

  const getMatchPoints = (match: Match, pred: Prediction) => {
    if (!match || (match.status !== 'finished' && match.status !== 'live')) return null;
    if (match.homeScore === undefined || match.awayScore === undefined || match.homeScore === null || match.awayScore === null) return null;
    if (!pred.homeScore || !pred.awayScore) return null;
    const rh = match.homeScore, ra = match.awayScore;
    const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
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
      const nextId = type === 'home' ? `cal-input-${idx}-away` : `cal-input-${idx + 1}-home`;
      document.getElementById(nextId)?.focus();
    }
  };

  if (!matches || matches.length === 0) {
    return <div className="h-64 flex flex-col items-center justify-center glass-card rounded-2xl border-dashed border-2 gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /><span className="text-sm font-black italic uppercase text-muted-foreground">Sincronizando...</span></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between glass-card p-3 rounded-xl shadow-md border-none">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={round <= 1} className="h-8 w-8 hover:bg-primary/10"><ChevronLeft className="h-5 w-5" /></Button>
        <div className="flex flex-col items-center">
          <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase px-2 h-4 mb-0.5">Série A 2026</Badge>
          <div className="flex items-baseline gap-1.5"><span className="text-[10px] font-bold text-muted-foreground uppercase">Rodada</span><span className={cn("text-xl font-black italic leading-none", systemCurrentRound === round ? "text-primary" : "opacity-60")}>#{round}</span></div>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={round >= totalRounds} className="h-8 w-8 hover:bg-primary/10"><ChevronRight className="h-5 w-5" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {matches.map((match, idx) => {
          const home = getTeamInfo(match.homeTeam), away = getTeamInfo(match.awayTeam);
          const isFinished = match.status === 'finished', isLive = match.status === 'live', isCancelled = match.status === 'cancelled';
          const originalIdx = match.originalIndex ?? idx;
          const currentPred = predictions[originalIdx] || { homeScore: "", awayScore: "" };
          const points = getMatchPoints(match, currentPred);

          return (
            <Card key={match.id || idx} className={cn("glass-card border-none rounded-xl overflow-hidden hover:ring-1 hover:ring-primary/20 transition-all", (match.isValidForPoints === false || isCancelled) && "opacity-80")}>
              <CardContent className="p-0">
                <div className="px-3 py-1.5 bg-muted/20 flex justify-between items-center border-b border-white/5">
                   <div className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 text-muted-foreground" /><span className="text-[9px] font-black uppercase text-muted-foreground">{formatDate(match.utcDate)}</span></div>
                   <div className="flex items-center gap-2">{isLive ? <Badge className="rounded-full px-1.5 text-[8px] font-black uppercase bg-red-600 text-white animate-pulse h-4 gap-1"><Zap className="h-2 w-2 fill-current" /> Ao Vivo</Badge> : isFinished ? <Badge className="bg-primary/20 text-primary rounded-full px-1.5 text-[8px] font-black uppercase h-4">Fim</Badge> : <span className="text-[8px] font-black uppercase text-primary/40">{formatTime(match.utcDate)}</span>}</div>
                </div>
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="flex flex-col items-center gap-1.5 w-1/3 text-center"><img src={home.escudo} alt={home.nome} className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" /><span className="text-sm md:text-base font-black italic uppercase text-primary truncate w-full">{home.abrev}</span></div>
                  <div className="flex flex-col items-center justify-center w-1/3 gap-2">
                    {(isFinished || isLive) ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2"><span className={cn("text-2xl md:text-3xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{match.homeScore ?? 0}</span><span className="text-muted-foreground/20 font-black italic text-sm">X</span><span className={cn("text-2xl md:text-3xl font-black italic tabular-nums", isLive ? "text-red-600" : "text-primary")}>{match.awayScore ?? 0}</span></div>
                        <div className="bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 relative">
                           {points !== null && <div className={cn("absolute -top-2 -right-2 rounded-md text-[8px] font-black italic shadow-md h-4 px-1.5 flex items-center", points === 3 ? "bg-secondary text-white" : points === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{points === 3 ? "+3" : points === 1 ? "+1" : "0"}</div>}
                           <div className="flex items-center gap-1.5 font-black italic text-[10px] text-primary/70 tabular-nums"><span>{currentPred.homeScore || "0"}</span><span className="opacity-20">-</span><span>{currentPred.awayScore || "0"}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input id={`cal-input-${idx}-home`} type="number" value={currentPred.homeScore} onChange={(e) => handlePredictionChange(idx, originalIdx, 'home', e.target.value)} className="w-8 h-8 md:w-10 md:h-10 text-center rounded-lg p-0 font-black text-lg border-primary/20" disabled={isLocked} />
                        <span className="font-black text-primary/20 italic text-xs">X</span>
                        <Input id={`cal-input-${idx}-away`} type="number" value={currentPred.awayScore} onChange={(e) => handlePredictionChange(idx, originalIdx, 'away', e.target.value)} className="w-8 h-8 md:w-10 md:h-10 text-center rounded-lg p-0 font-black text-lg border-primary/20" disabled={isLocked} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 w-1/3 text-center"><img src={away.escudo} alt={away.nome} className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" /><span className="text-sm md:text-base font-black italic uppercase text-primary truncate w-full">{away.abrev}</span></div>
                </div>
                {(match.isValidForPoints === false || isCancelled) && <div className="bg-destructive/10 px-3 py-1 flex items-center justify-center gap-2"><AlertTriangle className="h-2.5 w-2.5 text-destructive" /><span className="text-[8px] font-black uppercase text-destructive tracking-widest">{isCancelled ? 'Adiado' : 'Fora da Janela'}</span></div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!isLocked && <div className="flex justify-center pt-4"><Button onClick={onSave} disabled={isSaving} className="h-12 px-8 rounded-xl gap-2 font-black italic uppercase text-base sports-gradient shadow-lg shadow-primary/20 active:scale-95 transition-all">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 fill-current" />}{isSaving ? "Sincronizando..." : "Confirmar Quila"}</Button></div>}
    </div>
  );
}
