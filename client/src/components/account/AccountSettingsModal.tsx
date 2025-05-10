import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AccountSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSettingsModal({ open, onOpenChange }: AccountSettingsModalProps) {
  const { t } = useTranslation();
  const { user, deleteUserAccount, updateUserPassword } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // States for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordUpdateError(null);
    setPasswordUpdateSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordUpdateError(t('account-settings.password-mismatch', { defaultValue: "New passwords do not match."}));
      return;
    }
    if (newPassword.length < 8) { // Basic validation, align with Supabase rules
        setPasswordUpdateError(t('account-settings.password-too-short', { defaultValue: "Password must be at least 8 characters long."}));
        return;
    }

    setIsUpdatingPassword(true);
    try {
      // In Supabase, if the user is already authenticated, 
      // you typically only need to provide the new password.
      // The `currentPassword` field is often not required by `updateUser`.
      await updateUserPassword(newPassword); 
      setPasswordUpdateSuccess(t('account-settings.password-update-success', { defaultValue: "Password updated successfully!"}));
      setNewPassword('');
      setConfirmNewPassword('');
      setCurrentPassword(''); // Clear current password if you were using it
    } catch (error: any) {
      console.error("Failed to update password:", error);
      setPasswordUpdateError(error.message || t('account-settings.password-update-error-generic', {defaultValue: 'Failed to update password. Please try again.'}));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // We'll need to implement deleteUserAccount in AuthContext
      // This is a placeholder for now.
      await deleteUserAccount(); 
      // console.log("Account deletion requested for user:", user.id);
      // For now, let's simulate success and close the modal.
      // In a real scenario, you'd call an API and handle signOut on success.
      // signOut(); // This would also be part of AuthContext
      onOpenChange(false); // Close modal on success
      setShowConfirmDelete(false); // Hide confirmation section
    } catch (error: any) {
      console.error("Failed to delete account:", error);
      setDeleteError(error.message || t('account-settings.delete-error-generic', {defaultValue: 'Failed to delete account. Please try again.'}));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting || isUpdatingPassword) return; // Prevent close during operations
    onOpenChange(false);
    setShowConfirmDelete(false);
    setDeleteError(null);
    // Reset password fields on close
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordUpdateError(null);
    setPasswordUpdateSuccess(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('account-settings.title', { defaultValue: 'Account Settings' })}</DialogTitle>
        </DialogHeader>
        {!showConfirmDelete ? (
          <div className="grid gap-4 py-4">
            
            {/* Change Password Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('account-settings.change-password-title', { defaultValue: 'Change Password' })}</h3>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                {/* Current Password (Optional based on your Supabase setup)
                <div className="space-y-1">
                  <label htmlFor="currentPassword">{t('account-settings.current-password', { defaultValue: 'Current Password' })}</label>
                  <Input 
                    id="currentPassword" 
                    type="password" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    disabled={isUpdatingPassword}
                  />
                </div>
                */}
                <div className="space-y-1">
                  <label htmlFor="newPassword">{t('account-settings.new-password', { defaultValue: 'New Password' })}</label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required 
                    disabled={isUpdatingPassword}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirmNewPassword">{t('account-settings.confirm-new-password', { defaultValue: 'Confirm New Password' })}</label>
                  <Input 
                    id="confirmNewPassword" 
                    type="password" 
                    value={confirmNewPassword} 
                    onChange={(e) => setConfirmNewPassword(e.target.value)} 
                    required 
                    disabled={isUpdatingPassword}
                  />
                </div>
                {passwordUpdateError && <p className="text-sm text-red-500">{passwordUpdateError}</p>}
                {passwordUpdateSuccess && <p className="text-sm text-green-500">{passwordUpdateSuccess}</p>}
                <Button type="submit" className="w-full" disabled={isUpdatingPassword}>
                  {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('account-settings.update-password-button', { defaultValue: 'Update Password' })}
                </Button>
              </form>
            </div>

            {/* Add other account settings here in the future */}
            <div className="pt-6">
              <h3 className="text-lg font-medium mb-2">{t('account-settings.danger-zone', { defaultValue: 'Danger Zone' })}</h3>
              <Button
                variant="destructive"
                onClick={() => setShowConfirmDelete(true)}
                className="w-full"
              >
                {t('account-settings.delete-account-button', { defaultValue: 'Delete My Account' })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center text-amber-600">
                <AlertTriangle className="mr-2 h-5 w-5" />
                {t('account-settings.confirm-delete-title', { defaultValue: 'Confirm Account Deletion' })}
              </DialogTitle>
              <DialogDescription>
                {t('account-settings.confirm-delete-warning', { defaultValue: 'This action is irreversible and will permanently delete your account and all associated data. Are you sure you want to proceed?' })}
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
                <p className="text-sm text-red-500 mt-2 mb-2 text-center">{deleteError}</p>
            )}
            <DialogFooter className="mt-6 sm:justify-between">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('account-settings.confirm-delete-button', { defaultValue: 'Yes, Delete My Account' })}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 