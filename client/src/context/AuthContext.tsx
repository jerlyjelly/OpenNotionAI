import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isGoogleLoading: boolean;
  deleteUserAccount: () => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true);
    console.log("Attempting Google Sign-In...");
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    console.log("Google Sign-In placeholder complete.");
    setIsGoogleLoading(false);
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
  };

  const deleteUserAccount = async () => {
    if (!user) throw new Error("User not authenticated.");

    // Call the Supabase Edge Function
    const { error: functionError } = await supabase.functions.invoke('delete-user-account');

    if (functionError) {
      console.error("Error deleting user account via Edge Function:", functionError);
      throw new Error(functionError.message || "Failed to delete account data.");
    }

    // If the function call is successful, then sign out
    await signOut();
    // Optionally, you can add a success message or redirect the user
    console.log("User account deleted and signed out successfully.");
  };

  const updateUserPassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Error updating password:", error.message);
      // You might want to map Supabase errors to more user-friendly messages
      if (error.message.includes("Password should be at least 6 characters")) {
        throw new Error("Password must be at least 8 characters long."); // Or use a locale key
      }
      throw new Error(error.message || "Failed to update password.");
    }
    // Password updated successfully, Supabase handles session refresh.
    // Optionally, update local user state if needed, though Supabase usually manages this.
    if (data.user) {
        setUser(data.user); // Update user state with potentially new metadata
    }
    console.log("Password updated successfully for user:", data.user?.id);
  };

  const value = {
    session,
    user,
    isLoading,
    signOut,
    signInWithGoogle,
    isGoogleLoading,
    deleteUserAccount,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 