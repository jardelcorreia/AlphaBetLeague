"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword } from "firebase/auth";
import { doc, serverTimestamp } from "firebase/firestore";
import { PLAYERS } from "@/lib/constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { 
  Shield, 
  Loader2, 
  Trophy, 
  AlertCircle, 
  Lock, 
  ChevronRight, 
  User,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import placeholderData from "@/app/lib/placeholder-images.json";

interface LoginScreenProps {
  onPasswordChangeRequired?: () => void;
  onPasswordChanged?: () => void;
  forcePasswordChange?: boolean;
}

export function LoginScreen({ onPasswordChangeRequired, onPasswordChanged, forcePasswordChange }: LoginScreenProps) {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [playerName, setPlayerName] = useState<string>("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const [showPasswordChange, setShowPasswordChange] = useState(forcePasswordChange || false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);

  // States for password visibility
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const stadiumImage = placeholderData.placeholderImages.find(img => img.id === "soccer-stadium");

  useEffect(() => {
    const savedPlayer = localStorage.getItem("alphabet_last_player");
    if (savedPlayer && PLAYERS.includes(savedPlayer)) {
      setPlayerName(savedPlayer);
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (forcePasswordChange) {
      setShowPasswordChange(true);
    }
  }, [forcePasswordChange]);

  const handlePlayerSelect = (val: string) => {
    setPlayerName(val);
    localStorage.setItem("alphabet_last_player", val);
  };

  const scrollToLogin = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatEmail = (name: string) => `${name.toLowerCase().trim().replace(/\s+/g, '')}@alphabet.com`;

  const ensureUserDocument = (uid: string, name: string, email: string, isInitialCreation: boolean = false) => {
    const isAdmin = email === "jardel@alphabet.com";
    const userRef = doc(db, "users", uid);
    
    const userData: any = {
      id: uid,
      isAdmin: isAdmin,
      dateUpdated: serverTimestamp(),
    };

    if (isInitialCreation) {
      userData.username = name;
      userData.photoUrl = "";
      userData.dateCreated = serverTimestamp();
    }
    
    setDocumentNonBlocking(userRef, userData, { merge: true });

    if (isAdmin) {
      const adminRef = doc(db, "roles_admin", uid);
      setDocumentNonBlocking(adminRef, {
        userId: uid,
        grantedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !password) return;

    setLoading(true);
    setError(null);

    const email = formatEmail(playerName);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      ensureUserDocument(userCredential.user.uid, playerName, email, false);

      if (password === "alphabet123") {
        onPasswordChangeRequired?.();
        setShowPasswordChange(true);
      } else {
        toast({
          title: `Bem-vindo de volta, ${playerName}!`,
          description: "Acesso autorizado à arena AlphaBet.",
        });
      }
    } catch (err: any) {
      if ((err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") && password === "alphabet123") {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(userCredential.user, { displayName: playerName });
          ensureUserDocument(userCredential.user.uid, playerName, email, true);

          toast({
            title: "Primeiro Acesso!",
            description: "Agora defina sua senha pessoal para os próximos jogos.",
          });
          onPasswordChangeRequired?.();
          setShowPasswordChange(true);
        } catch (createErr: any) {
          setError("Erro ao inicializar perfil. Verifique sua conexão.");
        }
      } else {
        setError("Senha incorreta ou acesso não autorizado para este perfil.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (newPassword === "alphabet123") {
      setError("Sua nova senha deve ser diferente da padrão.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        toast({
          title: "Segurança Atualizada!",
          description: "Sua conta agora está protegida com a nova senha.",
        });
        onPasswordChanged?.();
      }
    } catch (err: any) {
      setError("Sessão expirada. Faça login novamente para trocar a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (showPasswordChange) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#020617] relative">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Image src={stadiumImage?.imageUrl || ""} alt="" fill className="object-cover" />
        </div>
        <Card className="w-full max-w-md glass-card border border-white/10 rounded-[2.5rem] shadow-2xl relative z-10">
          <CardHeader className="text-center pt-10">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center -rotate-6">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-black italic uppercase text-primary">Segurança</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Personalize sua senha de acesso</CardDescription>
          </CardHeader>
          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4 px-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nova Senha Pessoal</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    className="h-14 pl-12 pr-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    className="h-14 pl-12 pr-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-destructive/10 text-destructive text-[10px] font-black p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="px-8 pb-10 pt-4">
              <Button type="submit" className="w-full h-16 rounded-2xl font-black italic uppercase text-lg sports-gradient shadow-xl" disabled={loading}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Confirmar e Entrar"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image 
            src={stadiumImage?.imageUrl || ""} 
            alt="Estádio" 
            fill 
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/80 to-background" />
        </div>

        <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-in fade-in slide-in-from-top-12 duration-1000">
          <div className="flex justify-center">
            <div className="relative h-20 w-20 sm:h-28 sm:w-28 animate-float">
              <Image 
                src="/icons/android-chrome-512x512.png?v=3" 
                alt="AlphaBet Logo" 
                fill 
                className="object-contain"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic animate-pulse">
              <Shield className="h-3 w-3" /> Território Alpha: Só para os Brutos
            </div>
            <h1 className="text-5xl sm:text-7xl font-black italic uppercase tracking-tighter text-primary leading-[0.9]">
              AlphaBet <br />
              <span className="text-foreground">League</span>
            </h1>
            <p className="text-sm sm:text-lg font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
              Jardel • Nailton • Phillipe • Werbet <br />
              <span className="opacity-60">Quem será o mais Alphabetizado?</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={scrollToLogin} size="lg" className="w-full sm:w-auto h-16 px-10 rounded-2xl text-lg font-black italic uppercase sports-gradient shadow-2xl shadow-primary/40 group">
              Acessar Arena
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer opacity-40" onClick={scrollToLogin}>
          <ChevronDown className="h-8 w-8 text-primary" />
        </div>
      </section>

      {/* Login Form Section */}
      <section ref={formRef} className="py-24 px-4 bg-background relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="max-w-md mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase text-foreground">Acesso à Arena</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">Identifique-se para continuar</p>
          </div>

          <Card className="glass-card border-none rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-700">
            <form onSubmit={handleLogin}>
              <CardContent className="p-8 sm:p-10 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Seu Perfil</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 z-10" />
                    {isReady && (
                      <Select key={playerName || "initial"} onValueChange={handlePlayerSelect} defaultValue={playerName}>
                        <SelectTrigger className="h-16 pl-12 rounded-2xl border-primary/10 bg-primary/5 font-black italic uppercase text-sm focus:ring-primary/20">
                          <SelectValue placeholder="Escolha seu nome" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-primary/10">
                          {PLAYERS.map((player) => (
                            <SelectItem key={player} value={player} className="font-black italic uppercase text-sm focus:bg-primary/10 py-4">
                              {player}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Chave Secreta</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                    <Input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-16 pl-12 pr-12 rounded-2xl border-primary/10 bg-primary/5 font-black text-lg focus:ring-primary/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-medium italic px-1">* Primeiro acesso? Use a senha padrão AlphaBet</p>
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-[10px] font-black uppercase p-4 rounded-2xl flex items-center gap-3 border border-destructive/20 animate-in shake duration-300">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    {error}
                  </div>
                )}
              </CardContent>

              <CardFooter className="px-8 sm:px-10 pb-10">
                <Button 
                  type="submit" 
                  className="w-full h-16 rounded-2xl text-xl font-black italic uppercase gap-3 sports-gradient shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all group" 
                  disabled={loading || !playerName}
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                    <>
                      Entrar na Liga
                      <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </section>

      {/* Footer Minimalista */}
      <footer className="py-12 border-t border-primary/5 text-center space-y-4">
        <div className="flex justify-center items-center gap-2 opacity-30">
          <div className="h-px w-12 bg-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">AlphaBet League © 2026</span>
          <div className="h-px w-12 bg-primary" />
        </div>
        <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">Acesso restrito aos membros autorizados</p>
      </footer>
    </div>
  );
}
