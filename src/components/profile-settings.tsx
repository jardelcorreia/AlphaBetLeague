
"use client"

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useFirebase } from "@/firebase";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Camera, Loader2, Save, User as UserIcon, Check, Trash2, Crop as CropIcon, ZoomIn, ZoomOut, AlertTriangle, X, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFcm } from "@/hooks/use-fcm";
import { Switch } from "./ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Slider } from "./ui/slider";
import Cropper, { Area } from "react-easy-crop";
import { cn } from "@/lib/utils";

export function ProfileSettings() {
  const { user, storage, firestore, refreshUser } = useFirebase();
  const { toast } = useToast();
  const { permission, requestPermission, disableNotifications, isSupported } = useFcm();
  
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_extendedArea: Area, _croppedAreaPixels: Area) => {
    setCroppedAreaPixels(_croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.8);
    });
  };

  const handleUpdateName = async () => {
    if (!user || !displayName.trim()) return;

    const trimmedName = displayName.trim();
    
    // Validação de Tamanho (3 a 12 caracteres)
    if (trimmedName.length < 3) {
      toast({
        variant: "destructive",
        title: "Nome muito curto",
        description: "O seu nome de exibição deve ter pelo menos 3 caracteres."
      });
      return;
    }
    
    if (trimmedName.length > 12) {
      toast({
        variant: "destructive",
        title: "Nome muito longo",
        description: "O seu nome de exibição não pode ultrapassar 12 caracteres."
      });
      return;
    }

    setLoading(true);
    try {
      await updateProfile(user, { displayName: trimmedName });
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, { username: trimmedName });
      await refreshUser();
      toast({ title: "Perfil Atualizado!", description: "Seu nome de exibição foi alterado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o nome." });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleUploadCroppedImage = async () => {
    if (!imageToCrop || !croppedAreaPixels || !user) return;
    setUploading(true);
    const tempImageToCrop = imageToCrop;
    setImageToCrop(null); 
    try {
      const croppedBlob = await getCroppedImg(tempImageToCrop, croppedAreaPixels);
      if (!croppedBlob) throw new Error("Erro ao processar imagem");
      const storageRef = ref(storage, `avatars/${user.uid}`);
      const snapshot = await uploadBytes(storageRef, croppedBlob);
      const url = await getDownloadURL(snapshot.ref);
      await updateProfile(user, { photoURL: url });
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, { photoUrl: url });
      await refreshUser();
      toast({ title: "Foto Atualizada!", description: "Sua foto de perfil foi salva." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro no Upload", description: "Não foi possível salvar a imagem." });
    } finally {
      setUploading(false);
      setZoom(1);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    setUploading(true);
    setShowDeleteConfirm(false);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      try { await deleteObject(storageRef); } catch (e) {}
      await updateProfile(user, { photoURL: "" });
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, { photoUrl: "" });
      await refreshUser();
      toast({ title: "Foto Removida", description: "Seu avatar voltou ao padrão." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível remover a foto." });
    } finally {
      setUploading(false);
    }
  };

  const toggleNotifications = (checked: boolean) => {
    if (checked) {
      requestPermission();
    } else {
      disableNotifications();
    }
  };

  if (imageToCrop) {
    return (
      <Card className="glass-card border-none rounded-3xl overflow-hidden shadow-2xl w-full max-w-xl mx-auto">
        <div className="p-6 bg-primary text-white flex justify-between items-center">
          <div>
            <h3 className="font-black italic uppercase flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              Ajustar Foto
            </h3>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Enquadre sua imagem</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setImageToCrop(null)} className="text-white hover:bg-white/10 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative h-[350px] md:h-[400px] w-full bg-black">
          <Cropper
            image={imageToCrop}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              <span>Nível de Zoom</span>
              <span className="text-primary">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-4">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(vals) => setZoom(vals[0])}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImageToCrop(null)} className="flex-1 rounded-2xl font-bold uppercase text-xs h-12">
              Cancelar
            </Button>
            <Button onClick={handleUploadCroppedImage} disabled={uploading} className="flex-[2] rounded-2xl font-black italic uppercase text-xs gap-2 h-12 shadow-lg shadow-primary/20">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar Alteração
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="glass-card border-none rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-32 sports-gradient relative">
           <div className="absolute -bottom-16 left-8 flex items-end gap-6">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background rounded-3xl shadow-xl bg-muted overflow-hidden flex items-center justify-center">
                  <AvatarImage src={user?.photoURL || ""} className="object-cover w-full h-full" />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-black italic w-full h-full flex items-center justify-center">
                    {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "AL"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -right-2 -bottom-2 flex flex-col gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-10 w-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                    title="Alterar Foto"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  </button>
                  {user?.photoURL && (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={uploading}
                      className="h-10 w-10 bg-destructive text-destructive-foreground rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                      title="Remover Foto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
           </div>
        </div>
        
        <CardHeader className="pt-20 pb-4">
          <CardTitle className="text-2xl font-black italic uppercase text-primary">Configurações de Perfil</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Personalize sua identidade na AlphaBet League</CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-4">
          <div className="space-y-2">
            <div className="flex justify-between items-end ml-1">
              <Label htmlFor="display-name" className="text-[10px] font-black uppercase text-muted-foreground">Nome de Exibição</Label>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter transition-colors",
                (displayName.trim().length < 3 || displayName.trim().length > 12) 
                  ? "text-destructive" 
                  : "text-primary/60 dark:text-primary/80"
              )}>
                {displayName.trim().length}/12
              </span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 z-10" />
                <Input 
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome no jogo"
                  maxLength={12}
                  className="h-12 pl-12 rounded-2xl border-primary/10 bg-primary/5 font-bold focus:ring-primary/20"
                />
              </div>
              <Button 
                onClick={handleUpdateName} 
                disabled={loading || !displayName.trim() || displayName === user?.displayName}
                className="h-12 w-12 rounded-2xl p-0 shrink-0 shadow-lg shadow-primary/20"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase ml-1 italic">Mínimo 3 e máximo 12 caracteres.</p>
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Notificações Inteligentes</Label>
            <div className={cn(
              "p-4 rounded-3xl border transition-all",
              permission === 'granted' ? "bg-secondary/5 border-secondary/20" : "bg-muted/30 border-primary/5"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                    permission === 'granted' ? "bg-secondary text-white" : "bg-primary/10 text-primary"
                  )}>
                    {permission === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase italic leading-tight">Alertas da Liga</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Placares, rankings e lembretes push.</p>
                  </div>
                </div>
                <Switch 
                  checked={permission === 'granted'} 
                  onCheckedChange={toggleNotifications}
                  disabled={!isSupported}
                />
              </div>
              {!isSupported && (
                <p className="mt-3 text-[9px] font-bold text-destructive uppercase tracking-tighter flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Este navegador não suporta notificações push.
                </p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
             <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Check className="h-4 w-4" />
             </div>
             <div>
                <p className="text-xs font-bold text-primary uppercase italic">Sincronização em tempo real</p>
                <p className="text-[10px] text-muted-foreground">Suas alterações serão refletidas em todos os rankings da liga.</p>
             </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl glass-card">
          <AlertDialogHeader>
            <div className="h-12 w-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="font-black italic uppercase text-primary">Remover Foto?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed">
              Sua foto de perfil será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Manter Foto</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemovePhoto}
              className="rounded-xl font-black italic uppercase text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Foto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
