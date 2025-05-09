import React, { useState } from 'react';
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";
import { FcGoogle } from "react-icons/fc";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "login" | "signup";
}

export function AuthDialog({ open, onOpenChange, initialTab = "login" }: AuthDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      console.log("Login successful:", data.user);
      toast({ title: t("login-success-title", {defaultValue: "Login Successful"}), description: t("login-success-description", {defaultValue: "Welcome back!"}) });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Login error:", err.message);
      const errorMessage = err.message || t("login-failed-default", {defaultValue: "Failed to log in."});
      setError(errorMessage);
      toast({ title: t("login-failed-title", {defaultValue: "Login Failed"}), description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      const pwError = t("passwords-do-not-match", {defaultValue: "Passwords do not match"});
      setError(pwError);
      toast({ title: t("signup-failed-title", {defaultValue: "Sign Up Failed"}), description: pwError, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      console.log("Sign up successful, session:", data.session);
      toast({ title: t("signup-success-title", {defaultValue: "Sign Up Successful"}), description: t("signup-success-description", {defaultValue: "Your account has been created."}) });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Sign up error:", err.message);
      const errorMessage = err.message || t("signup-failed-default", {defaultValue: "Failed to sign up."});
      setError(errorMessage);
      toast({ title: t("signup-failed-title", {defaultValue: "Sign Up Failed"}), description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google Sign-In error:", err.message);
      const errorMessage = err.message || t("google-signin-failed-default", {defaultValue: "Failed to sign in with Google."});
      setError(errorMessage);
      toast({ title: t("google-signin-failed-title", {defaultValue: "Google Sign-In Failed"}), description: errorMessage, variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError(null);
      setIsLoading(false);
      setIsGoogleLoading(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Tabs defaultValue={initialTab} className="w-full" onValueChange={() => { setError(null); setIsLoading(false); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("log-in")}</TabsTrigger>
            <TabsTrigger value="signup">{t("sign-up")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <DialogHeader>
              {/* <DialogTitle>{t("log-in")}</DialogTitle> */}
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="login-email" className="text-right">
                  {t("email", { defaultValue: "Email"})}
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="col-span-3"
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="login-password" className="text-right">
                  {t("password", { defaultValue: "Password"})}
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="text-sm text-right pr-1">
              <button 
                onClick={() => setIsForgotPasswordOpen(true)}
                className="underline hover:text-primary"
              >
                {t("forgot-password", { defaultValue: "Forgot Password?" })}
              </button>
            </div>
            <div className="my-4 flex items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="mx-2 text-xs text-muted-foreground">{t("or-continue-with", { defaultValue: "Or continue with"})}</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <Button variant="outline" className="w-full mb-2" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FcGoogle className="mr-2 h-5 w-5" />
              )}
              {t("sign-in-with-google", { defaultValue: "Sign In with Google"})}
            </Button>
            <DialogFooter className="mt-2">
              <Button type="button" onClick={handleLogin} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("log-in")}
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="signup">
            <DialogHeader>
              {/* <DialogTitle>{t("sign-up")}</DialogTitle> */}
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="signup-email" className="text-right">
                  {t("email", { defaultValue: "Email"})}
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="col-span-3"
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="signup-password" className="text-right">
                  {t("password", { defaultValue: "Password"})}
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="confirm-password" className="text-right">
                  {t("confirm-password", { defaultValue: "Confirm Password"})}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="my-4 flex items-center">
              <div className="flex-grow border-t border-muted"></div>
              <span className="mx-2 text-xs text-muted-foreground">{t("or-continue-with", { defaultValue: "Or continue with"})}</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <Button variant="outline" className="w-full mb-2" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FcGoogle className="mr-2 h-5 w-5" />
              )}
              {t("sign-up-with-google", { defaultValue: "Sign Up with Google"})}
            </Button>
            <DialogFooter>
              <Button type="button" onClick={handleSignUp} disabled={isLoading || isGoogleLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("sign-up")}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen} />
    </Dialog>
  );
} 