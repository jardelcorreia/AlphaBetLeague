"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PLAYERS } from "@/lib/constants";
import { Match, PlayerPredictions, Prediction, PlayerScore, StandingEntry, ChampionshipWinner, MatchStatus } from "@/lib/types";
import { RankingSummary } from "@/components/ranking-summary";
import { BettingTable } from "@/components/betting-table";
import { MatchCalendar } from "@/components/match-calendar";
import { LeagueStandings } from "@/components/league-standings";
import { ChampionshipRanking } from "@/components/championship-ranking";
import { ProfileSettings } from "@/components/profile-settings";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Sun,
  Moon,
  Shield,
  Trophy,
  Loader2,
  LayoutDashboard,
  Calendar,
  Radar,
  RefreshCw,
  UserCircle,
  Medal,
  Download,
  Smartphone,
  Bell,
  BellRing,
  CheckCircle2,
  Settings,
  Sparkles,
  ArrowRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getBrasileiraoMatches, getBrasileiraoCurrentMatchday, getLeagueStandings } from "@/lib/football-api";
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { signOut } from "firebase/auth";
import { doc, collection, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn, cleanTeamName, determineMatchValidity } from "@/lib/utils";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useFcm } from "@/hooks/use-fcm";
import { useIsMobile } from "@/hooks/use-mobile";

type TabType = "jogos" | "palpites" | "ranking" | "tabela";

function HomeContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { isInstallable, handleInstall } = usePWAInstall();
  const { permission, requestPermission, isSupported: isFcmSupported } = useFcm();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<TabType>("jogos");
  const [darkMode, setDarkMode] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [systemCurrentRound, setSystemCurrentRound] = useState<number | null>(null);
  const [rawMatches, setRawMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [roundName, setRoundName] = useState("");
  const [predictions, setPredictions] = useState<PlayerPredictions>({});
  const [placaresOcultos, setPlacaresOcultos] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [showNotificationSuccess, setShowNotificationSuccess] = useState(false);

  const initialPermissionRef = useRef<string | null>(null);

  const [roundWinners, setRoundWinners] = useState<ChampionshipWinner[]>(
    Array.from({ length: 38 }, (_, i) => ({
      round: i + 1,
      winners: "",
      value: 6,
      pointsMap: {},
      exactScoresMap: {}
    }))
  );

  const roundId = currentRound ? `round_${currentRound}` : null;

  const roundDocRef = useMemoFirebase(() => (roundId && user) ? doc(db, "rounds", roundId) : null, [db, roundId, user]);
  const { data: roundData } = useDoc(roundDocRef);

  const settingsDocRef = useMemoFirebase(() => user ? doc(db, "app_settings", "championship") : null, [db, user]);
  const { data: settingsData } = useDoc(settingsDocRef);

  const betsCollectionRef = useMemoFirebase(() => {
    if (!roundId || !user) return null;
    return collection(db, "rounds", roundId, "bets");
  }, [db, roundId, user]);
  const { data: allBets, isLoading: isLoadingBets } = useCollection(betsCollectionRef);

  const usersCollectionRef = useMemoFirebase(() => user ? collection(db, "users") : null, [db, user]);
  const { data: allUsers } = useCollection(usersCollectionRef);

  const currentUserFirestore = useMemo(() => {
    return allUsers?.find(u => u.id === user?.uid);
  }, [allUsers, user]);

  const isAdminUser = user?.email === "jardel@alphabet.com";

  const matches = useMemo(() => {
    if (!rawMatches || !rawMatches.length) return [];
    let data = determineMatchValidity(rawMatches);
    if (roundData?.matches && Array.isArray(roundData.matches)) {
      data = data.map(m => {
        const override = roundData.matches.find((o: any) => o.id === m.id);
        if (override) {
          return {
            ...m,
            homeScore: (override.homeScore !== undefined && override.homeScore !== null) ? override.homeScore : m.homeScore,
            awayScore: (override.awayScore !== undefined && override.awayScore !== null) ? override.awayScore : m.awayScore,
            status: override.status || m.status,
          };
        }
        return m;
      });
    }

    let finalMatches = data.map((m, i) => ({ ...m, originalIndex: i }));

    if (isMobile) {
      finalMatches.sort((a, b) => {
        const aLive = a.status === 'live';
        const bLive = b.status === 'live';
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      });
    }

    return finalMatches;
  }, [rawMatches, roundData?.matches, isMobile]);

  const matchDescriptions = useMemo(() => {
    const sorted = [...matches].sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
    return sorted.slice(0, 10).map(m => `${cleanTeamName(m.homeTeam)} x ${cleanTeamName(m.awayTeam)}`);
  }, [matches]);

  const results = useMemo((): Prediction[] => {
    return matches.slice(0, 10).map(m => {
      const hasScore = m.homeScore !== undefined && m.homeScore !== null && m.awayScore !== undefined && m.awayScore !== null;
      const isActive = m.status === 'finished' || m.status === 'live';
      return {
        homeScore: (isActive && hasScore) ? m.homeScore!.toString() : "",
        awayScore: (isActive && hasScore) ? m.awayScore!.toString() : "",
      };
    });
  }, [matches]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ["jogos", "palpites", "ranking", "tabela"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      initialPermissionRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    if (!showProfileDialog) {
      const cleanupBody = () => {
        document.body.style.pointerEvents = "auto";
        document.body.style.overflow = "auto";
      };
      cleanupBody();
      const timer = setTimeout(cleanupBody, 300);
      return () => { clearTimeout(timer); };
    }
  }, [showProfileDialog]);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initialPermissionRef.current !== 'granted' && permission === 'granted' && !isAdminUser) {
      setShowNotificationSuccess(true);
      const timer = setTimeout(() => {
        setShowNotificationSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [permission, isAdminUser]);

  const isEffectivelyHidden = useMemo(() => {
    return placaresOcultos;
  }, [placaresOcultos]);

  const isLocked = useMemo(() => {
    return !placaresOcultos;
  }, [placaresOcultos]);

  const isRoundFinished = useMemo(() => {
    if (matches.length === 0 || loadingMatches) return false;
    return matches.every(m => m.status === 'finished' || m.status === 'cancelled' || m.isValidForPoints === false);
  }, [matches, loadingMatches]);

  const totalValidMatchesCount = useMemo(() => {
    if (matches.length === 0) return 10;
    return matches.slice(0, 10).filter(m => m.isValidForPoints !== false && m.status !== 'cancelled').length;
  }, [matches]);

  const scores = useMemo((): PlayerScore[] => {
    if (!allUsers || allUsers.length === 0) return [];
    
    const uniqueUsersMap = new Map();
    allUsers.forEach(u => {
      if (!uniqueUsersMap.has(u.id)) uniqueUsersMap.set(u.id, u);
    });
    const uniqueUsers = Array.from(uniqueUsersMap.values());

    const sortedOrig = [...matches].sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
    const origResults = sortedOrig.slice(0, 10).map(m => {
      const hasScore = m.homeScore !== undefined && m.homeScore !== null && m.awayScore !== undefined && m.awayScore !== null;
      const isActive = m.status === 'finished' || m.status === 'live';
      return {
        homeScore: (isActive && hasScore) ? m.homeScore!.toString() : "",
        awayScore: (isActive && hasScore) ? m.awayScore!.toString() : "",
      };
    });

    const activeIndices = matchDescriptions.map((d, i) => (d && d !== "" ? i : -1)).filter((i) => i !== -1);
    const unfinishedMatchesCount = activeIndices.filter(idx => {
      const res = origResults[idx];
      const match = sortedOrig[idx];
      const isMatchValid = match?.isValidForPoints !== false && match?.status !== 'cancelled';
      const isFinished = match?.status === 'finished';
      return isMatchValid && !isFinished && (res.homeScore === "" || res.awayScore === "");
    }).length;

    const playerStats = uniqueUsers.map(u => {
      let pts = 0, exs = 0, filledValidCount = 0;
      const userBets = predictions[u.id];
      if (!userBets) return { id: u.id, name: u.username || "Jogador", points: 0, exactScores: 0, betsCompleted: false, betsCount: 0, photoUrl: u.photoUrl, isWinner: false };
      
      activeIndices.forEach(idx => {
        const res = origResults[idx], pred = userBets[idx];
        const hasRes = res.homeScore !== "" && res.awayScore !== "";
        const hasPred = pred.homeScore !== "" && pred.awayScore !== "";
        const match = sortedOrig[idx];
        const isMatchValid = match?.isValidForPoints !== false && match?.status !== 'cancelled';
        if (isMatchValid && hasPred) filledValidCount++;
        if (hasRes && hasPred && isMatchValid) {
          const rh = parseInt(res.homeScore), ra = parseInt(res.awayScore);
          const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
          if (ph === rh && pa === ra) { pts += 3; exs += 1; }
          else if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) { pts += 1; }
        }
      });
      return { id: u.id, name: u.username || "Jogador", points: pts, exactScores: exs, betsCompleted: filledValidCount >= totalValidMatchesCount && totalValidMatchesCount > 0, betsCount: filledValidCount, photoUrl: u.photoUrl, isWinner: false };
    });

    const hasAnyPoints = playerStats.some(s => s.points > 0);
    const sorted = hasAnyPoints ? [...playerStats].sort((a, b) => b.points - a.points || b.exactScores - a.exactScores || (a.name || "").localeCompare(b.name || "")) : [...playerStats].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const finalScoresWithWinner = sorted.map(p => ({ ...p, isWinner: false }));
    const leader = sorted[0];
    const runnerUp = sorted[1];
    
    if (hasAnyPoints) {
      let isDefined = false;
      if (isRoundFinished) isDefined = true;
      else if (runnerUp) {
        const maxPossiblePointsForRunnerUp = runnerUp.points + (unfinishedMatchesCount * 3);
        const maxPossibleExactsForRunnerUp = runnerUp.exactScores + unfinishedMatchesCount;
        if (leader.points > maxPossiblePointsForRunnerUp) isDefined = true;
        else if (leader.points === maxPossiblePointsForRunnerUp && leader.exactScores > maxPossibleExactsForRunnerUp) isDefined = true;
      } else isDefined = true;
      
      if (isDefined) finalScoresWithWinner.forEach(s => { if (s.points === leader.points && s.exactScores === leader.exactScores) s.isWinner = true; });
    }
    return finalScoresWithWinner;
  }, [matchDescriptions, predictions, allUsers, matches, isRoundFinished, totalValidMatchesCount]);

  useEffect(() => {
    async function init() {
      const matchday = await getBrasileiraoCurrentMatchday();
      setCurrentRound(matchday);
      setSystemCurrentRound(matchday);
    }
    init();
  }, []);

  useEffect(() => {
    if (settingsData?.history) {
      setRoundWinners(settingsData.history);
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
    
    async function loadOfficialData() {
      setLoadingMatches(true);
      try {
        const [raw, leagueTable] = await Promise.all([
          getBrasileiraoMatches(currentRound!),
          getLeagueStandings()
        ]);
        setRawMatches(raw);
        setStandings(leagueTable);
      } catch (error) {
        console.error("Erro ao carregar dados oficiais:", error);
      } finally {
        setLoadingMatches(false);
      }
    }

    loadOfficialData();
    const interval = setInterval(loadOfficialData, 60000);
    return () => clearInterval(interval);
  }, [currentRound]);

  useEffect(() => {
    if (!allBets || !allUsers) return;
    setPredictions(prev => {
      const next: PlayerPredictions = {};
      allUsers.forEach(u => { next[u.id] = Array(10).fill({ homeScore: "", awayScore: "" }); });
      allBets.forEach(bet => {
        const parts = bet.id.split('_');
        const matchIdx = parseInt(parts[parts.length - 1]);
        const bUserId = bet.userId;
        if (bUserId && next[bUserId] && matchIdx >= 0 && matchIdx < 10) {
          next[bUserId][matchIdx] = { homeScore: bet.homeScorePrediction?.toString() || "", awayScore: bet.awayScorePrediction?.toString() || "" };
        }
      });
      return next;
    });
  }, [allBets, allUsers]);

  const handleSaveAll = async () => {
    if (!currentRound || !user || !roundId || isLocked) return;
    setIsSaving(true);
    try {
      const myPreds = predictions[user.uid];
      if (myPreds) {
        const currentUsername = currentUserFirestore?.username || user.displayName || "Jogador";
        const sortedOrig = [...matches].sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
        
        myPreds.forEach((pred, idx) => {
          const betId = `${user.uid}_${idx}`;
          const betRef = doc(db, "rounds", roundId, "bets", betId);
          if (pred.homeScore === "" && pred.awayScore === "") {
            deleteDocumentNonBlocking(betRef);
          } else if (pred.homeScore !== "" || pred.awayScore !== "") {
            setDocumentNonBlocking(betRef, {
              id: betId,
              userId: user.uid,
              username: currentUsername,
              matchId: sortedOrig[idx]?.id || idx,
              homeScorePrediction: pred.homeScore !== "" ? parseInt(pred.homeScore) : null,
              awayScorePrediction: pred.awayScore !== "" ? parseInt(pred.awayScore) : null,
              dateSubmitted: serverTimestamp()
            }, { merge: true });
          }
        });
      }
      toast({ title: "Quila Confirmada!", description: "Seus palpites foram registrados com sucesso." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Falha na sincronização." });
    } finally { setIsSaving(false); }
  };

  const handleLogout = () => { setMustChangePassword(false); signOut(auth); };

  const updatePrediction = (userId: string, idx: number, type: 'home' | 'away', value: string) => {
    if (userId !== user?.uid || isLocked) return;
    
    setPredictions(prev => {
      const userPreds = prev[userId] || Array(10).fill({ homeScore: "", awayScore: "" });
      const newPreds = userPreds.map((p, i) => i === idx ? { ...p, [type === 'home' ? 'homeScore' : 'awayScore']: value } : p);
      
      if (roundId && user) {
        const betId = `${user.uid}_${idx}`;
        const betRef = doc(db, "rounds", roundId, "bets", betId);
        const updatedPred = newPreds[idx];
        const currentUsername = currentUserFirestore?.username || user.displayName || "Jogador";
        const sortedOrig = [...matches].sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
        const matchId = sortedOrig[idx]?.id || idx;

        if (updatedPred.homeScore === "" && updatedPred.awayScore === "") {
          deleteDocumentNonBlocking(betRef);
        } else if (updatedPred.homeScore !== "" || updatedPred.awayScore !== "") {
          setDocumentNonBlocking(betRef, {
            id: betId,
            userId: user.uid,
            username: currentUsername,
            matchId: matchId,
            homeScorePrediction: updatedPred.homeScore !== "" ? parseInt(updatedPred.homeScore) : null,
            awayScorePrediction: updatedPred.awayScore !== "" ? parseInt(updatedPred.awayScore) : null,
            dateSubmitted: serverTimestamp()
          }, { merge: true });
        }
      }
      
      return { ...prev, [userId]: newPreds };
    });
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (!user || mustChangePassword) return <LoginScreen forcePasswordChange={mustChangePassword} onPasswordChangeRequired={() => setMustChangePassword(true)} onPasswordChanged={() => setMustChangePassword(false)} />;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="shrink-0 glass-card border-none rounded-none shadow-md z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-transparent dark:bg-slate-900 p-2 flex items-center justify-center -rotate-6 transition-colors">
              <div className="relative h-6 w-6">
                <Image src="/icons/android-chrome-512x512.png?v=3" alt="AlphaBet Logo" fill className="object-contain" priority />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black italic uppercase tracking-tighter text-primary leading-none">AlphaBet</h1>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Brasileirão 2026</span>
            </div>
          </div>
          <div className="hidden md:flex items-center bg-muted/30 rounded-2xl p-1 gap-1 border border-primary/5">
            <button onClick={() => setActiveTab("jogos")} className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2", activeTab === "jogos" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}><Calendar className="h-3 w-3" />QUILA/JOGOS</button>
            <button onClick={() => setActiveTab("palpites")} className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2", activeTab === "palpites" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}><Radar className="h-3 w-3" />Palpites</button>
            <button onClick={() => setActiveTab("ranking")} className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2", activeTab === "ranking" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}><Trophy className="h-3 w-3" />Ranking</button>
            <button onClick={() => setActiveTab("tabela")} className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2", activeTab === "tabela" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-primary/5 hover:text-primary")}><LayoutDashboard className="h-3 w-3" />Tabela</button>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             {isAdminUser && (<Link href="/admin"><Button variant="outline" size="sm" className="rounded-xl h-8 text-[9px] font-black uppercase italic gap-2 border-primary/20 text-primary hover:bg-primary hover:text-white"><Shield className="h-3 w-3" />Painel ADM</Button></Link>)}
             {isInstallable && (<Button variant="outline" size="sm" onClick={handleInstall} className="hidden lg:flex rounded-xl h-8 text-[9px] font-black uppercase italic gap-2 border-primary/20 text-primary hover:bg-primary hover:text-white"><Download className="h-3 w-3" />Instalar App</Button>)}
             <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black italic hidden sm:inline-flex">#{currentRound}</Badge>
             <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <div className="relative group cursor-pointer transition-transform active:scale-95">
                    <div className="h-9 w-9 bg-primary/5 rounded-xl flex items-center justify-center p-[2px] border border-primary/10 shadow-sm">
                      <Avatar className="h-full w-full rounded-lg border border-background shadow-md overflow-hidden bg-muted flex items-center justify-center">
                        <AvatarImage src={currentUserFirestore?.photoUrl || user.photoURL || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">{currentUserFirestore?.username ? currentUserFirestore.username.substring(0,2).toUpperCase() : user.displayName ? user.displayName.substring(0,2).toUpperCase() : "AL"}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border bg-background shadow-2xl p-2 z-[60]">
                  <DropdownMenuLabel className="font-black italic uppercase text-[10px] text-muted-foreground tracking-widest px-3 py-2">Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-primary/5" />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowProfileDialog(true); }} className="rounded-xl gap-2 font-bold cursor-pointer py-3 focus:bg-primary/10"><UserCircle className="h-4 w-4 text-primary" />Editar Perfil</DropdownMenuItem>
                  {isAdminUser && (<Link href="/admin"><DropdownMenuItem className="rounded-xl gap-2 font-bold cursor-pointer py-3 focus:bg-primary/10"><Settings className="h-4 w-4 text-primary" />Área Administrativa</DropdownMenuItem></Link>)}
                  {isInstallable && (<DropdownMenuItem onClick={handleInstall} className="rounded-xl gap-2 font-bold cursor-pointer py-3 focus:bg-primary/10 md:hidden"><Smartphone className="h-4 w-4 text-primary" />Instalar no Celular</DropdownMenuItem>)}
                  <DropdownMenuItem onClick={() => setDarkMode(!darkMode)} className="rounded-xl gap-2 font-bold cursor-pointer py-3 focus:bg-primary/10">{darkMode ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-primary" />}Tema {darkMode ? 'Claro' : 'Escuro'}</DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-primary/5" />
                  <DropdownMenuItem onClick={handleLogout} className="rounded-xl gap-2 font-bold cursor-pointer py-3 text-red-600 dark:text-red-400 focus:bg-red-600/10 dark:focus:bg-red-400/10"><LogOut className="h-4 w-4" />Encerrar Sessão</DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-2xl p-0 border-none bg-background shadow-2xl focus:outline-none z-[70] overflow-hidden rounded-3xl">
          <DialogHeader className="sr-only"><DialogTitle>Configurações de Perfil</DialogTitle><DialogDescription>Personalize seu perfil na AlphaBet League.</DialogDescription></DialogHeader>
          <div className="max-h-[90vh] overflow-y-auto"><ProfileSettings /></div>
        </DialogContent>
      </Dialog>

      <main className="flex-1 relative overflow-hidden">
        <div className={cn("absolute inset-0 overflow-y-auto no-scrollbar pt-1 pb-24 md:pb-8 animate-in fade-in duration-200", activeTab !== "jogos" && "hidden")}>
          <div className="max-w-7xl mx-auto px-4 space-y-4 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {isInstallable && (
                <div className="glass-card border-none rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Smartphone className="h-16 w-16 text-primary" /></div>
                  <div className="flex items-center gap-4 relative z-10 text-center sm:text-left"><div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><Smartphone className="h-6 w-6 text-primary" /></div><div><h4 className="text-sm font-black italic uppercase text-primary leading-tight">Instale o App</h4><p className="text-[10px] font-medium text-muted-foreground">Acesso rápido na tela inicial.</p></div></div>
                  <Button onClick={handleInstall} size="sm" className="rounded-xl h-10 px-6 font-black italic uppercase gap-2 shadow-lg shadow-primary/20 relative z-10 w-full sm:w-auto"><Download className="h-4 w-4" />Instalar</Button>
                </div>
              )}
              {isFcmSupported && permission === 'default' && (
                <div className="glass-card border-none rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BellRing className="h-16 w-16 text-accent" /></div>
                  <div className="flex items-center gap-4 relative z-10 text-center sm:text-left"><div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0"><Bell className="h-6 w-6 text-accent" /></div><div><h4 className="text-sm font-black italic uppercase text-accent leading-tight">Ative Lembretes</h4><p className="text-[10px] font-medium text-muted-foreground">Não perca o prazo de palpitar na rodada.</p></div></div>
                  <Button onClick={requestPermission} size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-10 px-6 font-black italic uppercase gap-2 shadow-lg shadow-accent/20 relative z-10 w-full sm:w-auto"><BellRing className="h-4 w-4" />Ativar</Button>
                </div>
              )}
              {showNotificationSuccess && (
                <div className="glass-card border-none rounded-[2rem] p-6 flex items-center gap-4 overflow-hidden relative group bg-secondary/5 animate-in fade-in slide-in-from-top-4 duration-500"><div className="h-10 w-10 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0"><CheckCircle2 className="h-5 w-5 text-secondary" /></div><div><h4 className="text-[10px] font-black italic uppercase text-secondary">Notificações Ativas</h4><p className="text-[9px] font-medium text-muted-foreground">Lembretes de palpites e resultados ativados.</p></div></div>
              )}
            </div>
            <section className="space-y-4">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Medal className="h-5 w-5 text-accent" /><h2 className="text-lg font-black italic uppercase">Pontuação da Rodada</h2></div>{(loadingMatches || isLoadingBets) && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}</div>
              <RankingSummary scores={scores} isScoresHidden={isEffectivelyHidden} isRoundFinished={isRoundFinished} totalValidMatches={totalValidMatchesCount} />
            </section>
            
            <div className="max-w-5xl mx-auto">
              {currentRound !== null ? (
                <MatchCalendar 
                  matches={matches} 
                  round={currentRound} 
                  systemCurrentRound={systemCurrentRound}
                  totalRounds={38} 
                  predictions={predictions[user?.uid || ""] || Array(10).fill({ homeScore: "", awayScore: "" })} 
                  setPrediction={(idx, type, value) => updatePrediction(user?.uid || "", idx, type, value)} 
                  updateMatchManual={() => {}} 
                  isAdmin={false} 
                  onPrev={() => setCurrentRound(prev => Math.max(1, prev! - 1))} 
                  onNext={() => setCurrentRound(prev => Math.min(38, prev! + 1))} 
                  onSave={handleSaveAll} 
                  isSaving={isSaving} 
                  isLocked={isLocked} 
                />
              ) : (
                <div className="h-96 flex flex-col items-center justify-center glass-card rounded-[2.5rem] border-dashed border-2 gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><span className="text-sm font-black italic uppercase text-muted-foreground">Buscando rodada atual...</span></div>
              )}
            </div>
          </div>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto no-scrollbar pt-4 pb-24 md:pb-8 animate-in fade-in duration-200", activeTab !== "palpites" && "hidden")}>
          <div className="max-w-7xl mx-auto px-4 space-y-6">
            <div className="flex flex-col"><h3 className="font-black italic uppercase text-lg text-primary">{roundName}</h3><p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Comparativo em tempo real</p></div>
            <BettingTable roundName={roundName} matches={matches} predictions={predictions} setPrediction={updatePrediction} results={results} placaresOcultos={isEffectivelyHidden} currentPlayerId={user?.uid || ""} isAdmin={isAdminUser} allUsers={allUsers || []} isLocked={isLocked} />
          </div>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto no-scrollbar pt-4 pb-24 md:pb-8 animate-in fade-in duration-200", activeTab !== "ranking" && "hidden")}>
          <div className="max-w-7xl mx-auto px-4 space-y-6">
            <div className="flex flex-col"><h3 className="font-black italic uppercase text-lg text-primary">Ranking Geral</h3><p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Classificação do Campeonato</p></div>
            <ChampionshipRanking 
              roundWinners={roundWinners} 
              setRoundWinners={setRoundWinners} 
              allUsers={allUsers || []} 
              isAdmin={false} 
              onSave={async () => {}} 
              isSaving={false} 
              currentRoundScores={scores}
              currentRoundNumber={currentRound}
            />
          </div>
        </div>

        <div className={cn("absolute inset-0 overflow-y-auto no-scrollbar pt-4 pb-24 md:pb-8 animate-in fade-in duration-200", activeTab !== "tabela" && "hidden")}>
          <div className="max-w-7xl mx-auto px-4 space-y-6">
            <div className="flex flex-col"><h3 className="font-black italic uppercase text-lg text-primary">Tabela Oficial</h3><p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Classificação Série A</p></div>
            <LeagueStandings standings={standings} />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-primary/10 rounded-none h-20 px-6 pb-2 md:hidden shrink-0">
        <div className="max-w-md mx-auto h-full flex items-center justify-between">
          <button onClick={() => setActiveTab("jogos")} className={cn("flex flex-col items-center gap-1 transition-all", activeTab === "jogos" ? "text-primary scale-110" : "text-muted-foreground opacity-60")}><Calendar className={cn("h-6 w-6", activeTab === "jogos" && "fill-current")} /><span className="text-[9px] font-black uppercase italic text-center">QUILA/JOGOS</span></button>
          <button onClick={() => setActiveTab("palpites")} className={cn("flex flex-col items-center gap-1 transition-all", activeTab === "palpites" ? "text-primary scale-110" : "text-muted-foreground opacity-60")}><Radar className={cn("h-6 w-6", activeTab === "palpites" && "fill-current")} /><span className="text-[9px] font-black uppercase italic text-center">Palpites</span></button>
          <button onClick={() => setActiveTab("ranking")} className={cn("flex flex-col items-center gap-1 transition-all", activeTab === "ranking" ? "text-primary scale-110" : "text-muted-foreground opacity-60")}><Trophy className={cn("h-6 w-6", activeTab === "ranking" && "fill-current")} /><span className="text-[9px) font-black uppercase italic text-center">Ranking</span></button>
          <button onClick={() => setActiveTab("tabela")} className={cn("flex flex-col items-center gap-1 transition-all", activeTab === "tabela" ? "text-primary scale-110" : "text-muted-foreground opacity-60")}><LayoutDashboard className={cn("h-6 w-6", activeTab === "tabela" && "fill-current")} /><span className="text-[9px] font-black uppercase italic text-center">Tabela</span></button>
        </div>
      </nav>
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <HomeContent />
    </React.Suspense>
  );
}
