"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth, useFirestore } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { 
  Shield, 
  Loader2, 
  AlertCircle, 
  Lock, 
  ChevronRight, 
  User,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Mail,
  UserPlus,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import placeholderData from "@/app/lib/placeholder-images.json";
import { cn } from "@/lib/utils";

interface LoginScreenProps {
  onPasswordChangeRequired?: () => void;
  onPasswordChanged?: () => void;
  forcePasswordChange?: boolean;
}

type AuthMode = "login" | "register" | "forgot-password";

export function LoginScreen({ onPasswordChangeRequired, onPasswordChanged, forcePasswordChange }: LoginScreenProps) {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [mode, setAuthMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const stadiumImage = placeholderData.placeholderImages.find(img => img.id === "soccer-stadium");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Bem-vindo à Arena!",
        description: "Acesso autorizado com sucesso.",
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("E-mail ou senha incorretos.");
      } else {
        setError("Erro ao conectar. Verifique sua internet.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (username.length < 3 || username.length > 12) {
      setError("O nome de usuário deve ter entre 3 e 12 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Atualiza Perfil no Auth
      await updateProfile(user, { displayName: username });

      // Cria Documento no Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        id: user.uid,
        username: username,
        email: email,
        isAdmin: false,
        photoUrl: "",
        dateCreated: serverTimestamp(),
        dateUpdated: serverTimestamp()
      }, { merge: true });

      toast({
        title: "Conta Criada!",
        description: `Bem-vindo à AlphaBet League, ${username}!`,
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso por outro jogador.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Falha ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Informe seu e-mail para receber o link.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "E-mail Enviado!",
        description: "Verifique sua caixa de entrada para trocar a senha.",
      });
      setAuthMode("login");
    } catch (err: any) {
      setError("E-mail não encontrado ou erro no servidor.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setAuthMode(mode === "login" ? "register" : "login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
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

        <div className="relative z-10 w-full max-w-md space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative h-20 w-20 animate-float">
              <Image src="/icons/android-chrome-512x512.png?v=3" alt="AlphaBet Logo" fill className="object-contain" />
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary leading-none">
                AlphaBet <span className="text-foreground">League</span>
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Brasileirão 2026</p>
            </div>
          </div>

          <Card className="glass-card border-none rounded-[2.5rem] shadow-2xl overflow-hidden">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-black italic uppercase text-primary">
                {mode === "login" ? "Entrar na Arena" : mode === "register" ? "Novo Recruta" : "Recuperar Acesso"}
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {mode === "login" ? "Identifique-se para palpitar" : mode === "register" ? "Crie seu perfil oficial" : "Enviaremos um link para seu e-mail"}
              </CardDescription>
            </CardHeader>

            <form onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgotPassword}>
              <CardContent className="p-8 space-y-4">
                {mode === "register" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nome de Jogador</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                      <Input 
                        placeholder="Ex: Jardel Alpha" 
                        className="h-12 pl-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required={mode === "register"}
                        maxLength={12}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Seu E-mail Real</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                    <Input 
                      type="email"
                      placeholder="seu@email.com" 
                      className="h-12 pl-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {mode !== "forgot-password" && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Sua Chave</Label>
                        {mode === "login" && (
                          <button 
                            type="button" 
                            onClick={() => setAuthMode("forgot-password")}
                            className="text-[9px] font-bold text-primary uppercase hover:underline"
                          >
                            Esqueceu?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-12 pl-12 pr-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {mode === "register" && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Repetir Chave</Label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-12 pl-12 pr-12 rounded-2xl border-primary/10 bg-primary/5 font-bold"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required={mode === "register"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div className="bg-destructive/10 text-destructive text-[10px] font-black uppercase p-4 rounded-2xl flex items-center gap-3 border border-destructive/20 animate-in shake duration-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
              </CardContent>

              <CardFooter className="px-8 pb-10 flex flex-col gap-4">
                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-2xl text-lg font-black italic uppercase gap-3 sports-gradient shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all group" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      {mode === "login" ? "Entrar na Liga" : mode === "register" ? "Criar Perfil" : "Enviar Link"}
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2">
                  <div className="h-px w-8 bg-muted" />
                  <button 
                    type="button" 
                    onClick={mode === "forgot-password" ? () => setAuthMode("login") : toggleMode}
                    className="text-[10px] font-black uppercase text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                  >
                    {mode === "login" ? (
                      <><UserPlus className="h-3 w-3" /> Não tem conta? Cadastre-se</>
                    ) : mode === "register" ? (
                      <><ArrowLeft className="h-3 w-3" /> Já é da liga? Faça login</>
                    ) : (
                      <><ArrowLeft className="h-3 w-3" /> Voltar para o login</>
                    )}
                  </button>
                  <div className="h-px w-8 bg-muted" />
                </div>
              </CardFooter>
            </form>
          </Card>

          <footer className="text-center space-y-4 opacity-40">
            <div className="flex justify-center items-center gap-2">
              <div className="h-px w-12 bg-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">AlphaBet League</span>
              <div className="h-px w-12 bg-primary" />
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
