import React, { useState } from 'react';
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null); // For success/error messages inside dialog

  const handlePasswordResetRequest = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`, // Important: URL where users will update their password
      });
      if (error) throw error;
      setMessage(t("password-reset-email-sent", {defaultValue: "If an account exists for this email, a password reset link has been sent."}))
      toast({ title: t("password-reset-initiated", {defaultValue: "Password Reset Initiated"}), description: t("check-your-email-for-reset-link", {defaultValue: "Check your email for the reset link."}) });
      // setEmail(""); // Optionally clear email
      // setTimeout(() => onOpenChange(false), 3000); // Optionally close dialog after a delay
    } catch (err: any) {
      console.error("Password reset error:", err.message);
      setMessage(err.message || t("password-reset-failed", {defaultValue: "Failed to initiate password reset."}));
      toast({ title: t("password-reset-failed-title", {defaultValue: "Reset Failed"}), description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setEmail("");
        setMessage(null);
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("reset-password-title", {defaultValue: "Reset Password"})}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reset-email" className="text-right">
              {t("email")}
            </Label>
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="col-span-3"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>
          {message && <p className={`text-sm text-center py-2 ${message.includes("Failed") ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handlePasswordResetRequest} disabled={isLoading || !email}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("send-reset-link", {defaultValue: "Send Reset Link"})}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 