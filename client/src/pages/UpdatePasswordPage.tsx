import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { Loader2 } from 'lucide-react';

export function UpdatePasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isTokenProcessed, setIsTokenProcessed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // Remove #
    const accessToken = params.get('access_token');
    // const refreshToken = params.get('refresh_token'); // Not directly used for updateUser, but good to be aware of

    if (accessToken) {
      // The access token is automatically set by Supabase if it's in the URL
      // when the page loads. We don't need to call setSession manually here for updateUser.
      setIsTokenProcessed(true);
    } else {
      setMessage(t("update-password-invalid-link", {defaultValue: "Invalid or expired password reset link."}))
      toast({ title: t("update-password-failed-title", {defaultValue: "Update Failed"}), description: t("update-password-invalid-link", {defaultValue: "Invalid or expired password reset link."}), variant: "destructive" });
      // Consider redirecting or showing a more permanent error
    }
    // Clear the hash from the URL for security and cleanliness
    if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
        window.location.hash = ''; // Fallback for older browsers
    }
  }, [t, toast]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTokenProcessed) {
        toast({ title: t("update-password-failed-title", {defaultValue: "Update Failed"}), description: t("update-password-no-token", {defaultValue: "No reset token found. Please request a new link."} ), variant: "destructive" });
        return;
    }
    if (password !== confirmPassword) {
      setMessage(t("passwords-do-not-match"));
      toast({ title: t("update-password-failed-title", {defaultValue: "Update Failed"}), description: t("passwords-do-not-match"), variant: "destructive" });
      return;
    }
    if (password.length < 6) { // Supabase default minimum password length
        setMessage(t("password-too-short", {defaultValue: "Password should be at least 6 characters."}))
        toast({ title: t("update-password-failed-title", {defaultValue: "Update Failed"}), description: t("password-too-short", {defaultValue: "Password should be at least 6 characters."} ), variant: "destructive" });
        return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: t("update-password-success-title", {defaultValue: "Password Updated"}), description: t("update-password-success-desc", {defaultValue: "Your password has been updated successfully. Please log in."}) });
      navigate("/"); // Redirect to home/login page
    } catch (err: any) {
      console.error("Update password error:", err);
      setMessage(err.message || t("update-password-failed-general", {defaultValue: "Failed to update password."}))
      toast({ title: t("update-password-failed-title", {defaultValue: "Update Failed"}), description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t("update-password-page-title", {defaultValue: "Update Your Password"})}</h1>
        </div>
        {isTokenProcessed ? (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <Label htmlFor="new-password">{t("new-password", {defaultValue: "New Password"})}</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="confirm-new-password">{t("confirm-new-password", {defaultValue: "Confirm New Password"})}</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
                disabled={isLoading}
              />
            </div>
            {message && <p className={`text-sm text-center ${message.includes("Failed") || message.includes("match") || message.includes("short") ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
            <Button type="submit" className="w-full" disabled={isLoading || !password || !confirmPassword}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("update-password-button", {defaultValue: "Update Password"})}
            </Button>
          </form>
        ) : (
            <div className="text-center space-y-4">
                {message && <p className="text-red-500 text-lg">{message}</p>}
                {!message && <Loader2 className="h-8 w-8 animate-spin mx-auto" />} {/* Show loader while token is processed or if message isn't set yet */}
                <Button onClick={() => navigate("/")}>{t("go-to-home", {defaultValue: "Go to Homepage"})}</Button>
            </div>
        )}
      </div>
    </div>
  );
} 