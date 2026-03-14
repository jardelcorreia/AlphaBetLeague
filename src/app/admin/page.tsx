
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from "@/firebase";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Match, MatchStatus, ChampionshipWinner, PlayerPredictions } from "@/lib/types";
import { getBrasileiraoMatches, getBrasileiraoCurrentMatchday } from "@/lib/football-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Settings2,
  DollarSign,
  Table,
  Trash2,
  Zap,
  CheckCircle2,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeamAbrev, cn, determineMatchValidity } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RoundCardDialog } from "@/components/round-card-dialog";

export default function AdminPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [apiMatches, setApiMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placaresOcultos, setPlacaresOcultos] = useState(true);
  const [roundName, setRoundName] = useState("");

  const [turn1Value, setTurn1Value] = useState(6);
  const [turn2Value, setTurn2Value] = useState(6);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [roundWinners, setRoundWinners] = useState<ChampionshipWinner[]>(
    Array.from({ length: 38 }, (_, i) => ({
      round: i + 1,
      winners: "",
      value: 6,
      pointsMap: {}
    }))
  );

  const isAdmin = user?.email === "jardel@alphabet.com";
  const roundId = currentRound ? `round_${currentRound}` : null;
  const roundDocRef = useMemoFirebase(() => (roundId && user) ? doc(db, "rounds", roundId) : null, [db, roundId, user]);
  const { data: roundData } = useDoc(roundDocRef);

  const settingsDocRef = useMemoFirebase(() => user ? doc(db, "app_settings", "championship") : null, [db, user]);
  const { data: settingsData, isLoading: isLoadingSettings } = useDoc(settingsDocRef);

  const usersCollectionRef = useMemoFirebase(() => user ? collection(db, "users") : null, [db, user]);
  const { data: allUsers } = useCollection(usersCollectionRef);

  const betsCollectionRef = useMemoFirebase(() => {
    if (!roundId || !user) return null;
    return collection(db, "rounds", roundId, "bets");
  }, [db, roundId, user]);
  const { data: allBets } = useCollection(betsCollectionRef);

  const predictions = useMemo((): PlayerPredictions => {
    if (!allBets || !allUsers) return {};
    const next: PlayerPredictions = {};
    const uniqueUsersMap = new Map();
    allUsers.forEach(u => uniqueUsersMap.set(u.id, u));
    
    Array.from(uniqueUsersMap.values()).forEach(u => { 
      next[u.id] = Array(10).fill({ homeScore: "", awayScore: "" }); 
    });

    allBets.forEach(bet => {
      const parts = bet.id.split('_');
      const matchIdx = parseInt(parts[parts.length - 1]);
      const bUserId = bet.userId;
      if (bUserId && next[bUserId] && matchIdx >= 0 && matchIdx < 10) {
        next[bUserId][matchIdx] = { 
          homeScore: bet.homeScorePrediction?.toString() || "", 
          awayScore: bet.awayScorePrediction?.toString() || "" 
        };
      }
    });
    return next;
  }, [allBets, allUsers]);

  useEffect(() => {
    if (!isUserLoading && !isAdmin) {
      router.push("/");
    }
  }, [isAdmin, isUserLoading, router]);

  useEffect(() => {
    async function init() {
      const matchday = await getBrasileiraoCurrentMatchday();
      setCurrentRound(matchday);
    }
    init();
  }, []);

  useEffect(() => {
    if (settingsData?.history) {
      setRoundWinners(settingsData.history);
      setHasLoadedHistory(true);
    }
  }, [settingsData]);

  useEffect(() => {
    if (roundData) {
      if (roundData.name) setRoundName(roundData.name);
      if (roundData.isScoresHidden !== undefined) setPlacaresOcultos(roundData.isScoresHidden);
    } else if (currentRound) {
      setRoundName(`Rodada ${currentRound}`);
    }
  }, [roundData, currentRound]);

  useEffect(() => {
    if (currentRound === null) return;
    
    async function loadApiMatches() {
      setLoading(true);
      try {
        const rawData = await getBrasileiraoMatches(currentRound!);
        setApiMatches(rawData);
      } catch (error) {
        console.error("Falha ao carregar jogos oficiais:", error);
      } finally {
        setLoading(false);
      }
    }

    loadApiMatches();
    const interval = setInterval(loadApiMatches, 60000);
    return () => clearInterval(interval);
  }, [currentRound]);

  useEffect(() => {
    if (apiMatches.length === 0) return;
    let merged = determineMatchValidity(apiMatches);
    if (roundData?.matches && Array.isArray(roundData.matches)) {
      merged = merged.map(m => {
        const override = roundData.matches.find((o: any) => o.id === m.id);
        if (override) {
          const hasDifference = 
            override.isManual === true ||
            (override.homeScore !== undefined && override.homeScore !== m.homeScore) ||
            (override.awayScore !== undefined && override.awayScore !== m.awayScore) ||
            (override.status !== undefined && override.status !== m.status);

          return {
            ...m,
            homeScore: (override.homeScore !== undefined && override.homeScore !== null) ? override.homeScore : m.homeScore,
            awayScore: (override.awayScore !== undefined && override.awayScore !== null) ? override.awayScore : m.awayScore,
            status: override.status || m.status,
            isManual: hasDifference
          };
        }
        return m;
      });
    }
    setMatches(merged);
  }, [apiMatches, roundData?.matches]);

  const persistRoundChanges = (updatedMatches: Match[]) => {
    if (!currentRound || !roundId) return;
    
    const fullMatchList = updatedMatches.map(m => ({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: (m.homeScore !== undefined && m.homeScore !== null) ? m.homeScore : null,
      awayScore: (m.awayScore !== undefined && m.awayScore !== null) ? m.awayScore : null,
      status: m.status || 'upcoming',
      utcDate: m.utcDate,
      isManual: m.isManual || false,
      matchday: m.matchday
    }));

    const roundRef = doc(db, "rounds", roundId);
    setDocumentNonBlocking(roundRef, {
      id: roundId,
      roundNumber: currentRound,
      name: roundName,
      isScoresHidden: placaresOcultos,
      autoRevealProcessed: roundData?.autoRevealProcessed || false,
      matches: fullMatchList,
      dateUpdated: serverTimestamp(),
      dateCreated: roundData?.dateCreated || serverTimestamp(),
    }, { merge: true });
  };

  const updateMatch = (idx: number, updates: Partial<Match>) => {
    setMatches(prev => {
      const next = prev.map((m, i) => i === idx ? { ...m, ...updates, isManual: true } : m);
      persistRoundChanges(next);
      return next;
    });
  };

  const resetMatch = (idx: number) => {
    const apiMatch = apiMatches[idx];
    if (!apiMatch) return;
    setMatches(prev => {
      const next = prev.map((m, i) => i === idx ? { ...apiMatch, isManual: false } : m);
      persistRoundChanges(next);
      return next;
    });
    toast({ title: "Modo API Ativado", description: "O jogo agora segue os dados automáticos." });
  };

  const handleSaveLeagueSettings = async () => {
    if (!hasLoadedHistory || isLoadingSettings) return;
    setSaving(true);
    try {
      const settingsRef = doc(db, "app_settings", "championship");
      setDocumentNonBlocking(settingsRef, {
        history: roundWinners,
        dateUpdated: serverTimestamp(),
      }, { merge: true });
      toast({ title: "Configurações Salvas!", description: "Valores e vencedores sincronizados." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao salvar configurações." });
    } finally {
      setSaving(false);
    }
  };

  const applyTurnValues = () => {
    const nextWinners = roundWinners.map((rw) => ({
      ...rw,
      value: rw.round <= 19 ? turn1Value : turn2Value
    }));
    setRoundWinners(nextWinners);
    toast({ title: "Valores Aplicados", description: "Clique em salvar para confirmar." });
  };

  const updateRoundWinnerValue = (roundIdx: number, val: number) => {
    setRoundWinners(prev => prev.map((rw, i) => i === roundIdx ? { ...rw, value: val } : rw));
  };

  const toggleVisibility = () => {
    if (!roundId) return;
    const newState = !placaresOcultos;
    setPlacaresOcultos(newState);
    
    const roundRef = doc(db, "rounds", roundId);
    const updateData: any = {
      isScoresHidden: newState,
      dateUpdated: serverTimestamp(),
    };

    // Se o admin está revelando manualmente, marcamos como processado para que o servidor não tente interferir
    if (newState === false) {
      updateData.autoRevealProcessed = true;
    }

    setDocumentNonBlocking(roundRef, updateData, { merge: true });
    
    toast({ 
      title: newState ? "Palpites Ocultos" : "Palpites Revelados", 
      description: newState ? "Ninguém vê os palpites alheios." : "Todos agora veem tudo." 
    });
  };

  if (isUserLoading || !isAdmin) {
    return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 glass-card border-none rounded-none shadow-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><Button variant="ghost" size="icon" className="rounded-xl h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h1 className="text-[10px] font-black italic uppercase text-primary tracking-widest">Painel ADM</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-7 px-3 rounded-lg border-primary/10 bg-primary/5 text-primary text-[8px] font-black uppercase italic gap-1.5">
              <CheckCircle2 className="h-2.5 w-2.5" /> Automação Ativa
            </Badge>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <Tabs defaultValue="rodada" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/50 rounded-xl p-1 mb-4">
            <TabsTrigger value="rodada" className="rounded-lg font-black italic uppercase text-[8px] gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"><Table className="h-3 w-3" />Controle de Jogos</TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-lg font-black italic uppercase text-[8px] gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"><DollarSign className="h-3 w-3" />Financeiro Liga</TabsTrigger>
          </TabsList>
          
          <TabsContent value="rodada" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <section className="flex flex-col sm:flex-row items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/10 gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentRound(prev => Math.max(1, prev! - 1))} className="h-7 w-7 rounded-lg border-primary/10"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="text-center min-w-[50px]"><h2 className="text-sm font-black italic uppercase text-primary leading-tight">#{currentRound}</h2></div>
                <Button variant="outline" size="icon" onClick={() => setCurrentRound(prev => Math.min(38, prev! + 1))} className="h-7 w-7 rounded-lg border-primary/10"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <RoundCardDialog 
                  roundName={roundName}
                  matches={matches}
                  predictions={predictions}
                  allUsers={allUsers || []}
                  buttonLabel="Gerar Card"
                  triggerClassName="h-7 px-3 text-[8px]"
                />
                <Button variant={placaresOcultos ? "destructive" : "secondary"} onClick={toggleVisibility} size="sm" className="rounded-lg h-7 px-4 gap-2 font-black italic uppercase text-[8px] shadow-md transition-all active:scale-95">{placaresOcultos ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{placaresOcultos ? "Revelar Palpites" : "Ocultar Palpites"}</Button>
              </div>
            </section>

            <div className="bg-primary/10 p-3 rounded-lg flex items-center gap-3 border border-primary/20">
              <Zap className="h-5 w-5 text-primary shrink-0 animate-pulse" />
              <div className="flex flex-col">
                <p className="text-[9px] font-black uppercase text-primary leading-none">Auto-Save Ativado</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight mt-1">Todas as alterações de placar ou status são salvas instantaneamente e o ranking recalculado no servidor.</p>
              </div>
            </div>

            <section className="space-y-1">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                  <span className="text-[10px] font-black uppercase italic text-muted-foreground">Sincronizando com API...</span>
                </div>
              ) : matches.map((match, idx) => (
                <Card key={match.id} className={cn("glass-card border-none rounded-xl overflow-hidden group transition-all", match.isManual && "ring-1 ring-primary/20 bg-primary/[0.02]")}>
                  <CardContent className="p-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 justify-center">
                      <span className="text-[11px] font-black italic uppercase text-primary w-8 text-right">{getTeamAbrev(match.homeTeam)}</span>
                      <div className="flex items-center gap-1 px-2 py-1 bg-muted/20 rounded-lg border border-primary/5">
                        <input 
                          type="number" 
                          value={match.homeScore ?? ""} 
                          onChange={(e) => updateMatch(idx, { homeScore: e.target.value === "" ? undefined : parseInt(e.target.value) })} 
                          className="w-6 h-6 text-center rounded font-black text-xs bg-background border border-primary/10 focus:outline-none focus:ring-1 focus:ring-primary/20" 
                          placeholder="-" 
                        />
                        <span className="font-black text-primary/20 italic text-[9px]">X</span>
                        <input 
                          type="number" 
                          value={match.awayScore ?? ""} 
                          onChange={(e) => updateMatch(idx, { awayScore: e.target.value === "" ? undefined : parseInt(e.target.value) })} 
                          className="w-6 h-6 text-center rounded font-black text-xs bg-background border border-primary/10 focus:outline-none focus:ring-1 focus:ring-primary/20" 
                          placeholder="-" 
                        />
                      </div>
                      <span className="text-[11px] font-black italic uppercase text-primary w-8 text-left">{getTeamAbrev(match.awayTeam)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select value={match.status} onValueChange={(val: MatchStatus) => updateMatch(idx, { status: val })}>
                        <SelectTrigger className="h-7 w-20 rounded-lg font-black italic uppercase text-[7px] border-primary/5 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="upcoming" className="text-[8px] font-black italic uppercase">Agendado</SelectItem>
                          <SelectItem value="live" className="text-[8px] font-black italic uppercase text-destructive">Ao Vivo</SelectItem>
                          <SelectItem value="finished" className="text-[8px] font-black italic uppercase text-secondary">Fim</SelectItem>
                          <SelectItem value="cancelled" className="text-[8px] font-black italic uppercase text-muted-foreground">Adiado</SelectItem>
                        </SelectContent>
                      </Select>
                      {match.isManual ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => resetMatch(idx)} className="h-7 w-7 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p className="text-[10px] font-bold">Voltar para Modo API</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="w-7 flex justify-center"><RefreshCw className="h-2.5 w-2.5 text-primary/20" /></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Card className="glass-card border-none rounded-2xl overflow-hidden">
              <CardHeader className="bg-primary/5 p-3 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5 text-primary" /><CardTitle className="text-[9px] font-black italic uppercase text-primary">Configurações Liga</CardTitle></div>
                <Button onClick={handleSaveLeagueSettings} disabled={saving || isLoadingSettings} size="sm" className="rounded-lg h-7 px-3 font-black italic uppercase gap-2 text-[8px]">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar Valores
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Turno 1</label><div className="flex items-center gap-1.5 bg-muted/20 p-2 rounded-xl border border-primary/5"><span className="text-[10px] font-black text-primary/40">R$</span><input type="number" value={turn1Value} onChange={(e) => setTurn1Value(parseFloat(e.target.value) || 0)} className="border-none bg-transparent font-black text-base focus:outline-none w-full" /></div></div>
                  <div className="space-y-1"><label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Turno 2</label><div className="flex items-center gap-1.5 bg-muted/20 p-2 rounded-xl border border-primary/5"><span className="text-[10px] font-black text-primary/40">R$</span><input type="number" value={turn2Value} onChange={(e) => setTurn2Value(parseFloat(e.target.value) || 0)} className="border-none bg-transparent font-black text-base focus:outline-none w-full" /></div></div>
                </div>
                <Button onClick={applyTurnValues} variant="outline" className="w-full rounded-xl h-8 font-black italic uppercase gap-2 text-[8px] border-primary/10 text-primary hover:bg-primary/5"><RefreshCw className="h-3 w-3" />Atualizar 38 Rodadas</Button>
                <div className="pt-3 border-t border-primary/5">
                  {isLoadingSettings && !hasLoadedHistory ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                      {roundWinners.map((rw, idx) => (
                        <div key={idx} className="bg-muted/30 p-1.5 rounded-lg border border-primary/5 flex flex-col items-center gap-0.5">
                          <span className="text-[6px] font-black uppercase text-foreground">R{rw.round}</span>
                          <div className="flex items-center gap-0.5"><span className="text-[6px] font-bold text-primary/40">R$</span><input type="number" value={rw.value} onChange={(e) => updateRoundWinnerValue(idx, parseFloat(e.target.value) || 0)} className="w-6 bg-transparent text-center font-black text-[9px] focus:outline-none" /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
