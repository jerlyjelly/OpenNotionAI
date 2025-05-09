import React, { useState } from 'react';
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { useTranslation } from "@/i18n";
import { Sun, Moon, PanelLeftClose, PanelRightOpen, UserCircle2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useAuth } from "@/context/AuthContext";

export function Header({ 
  isCollapsed, 
  onToggle 
}: { 
  isCollapsed: boolean; 
  onToggle: () => void 
}) {
  const { setLanguage, language } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const { user, signOut, isLoading: isAuthLoading } = useAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogInitialTab, setAuthDialogInitialTab] = useState<"login" | "signup">("login");

  const openAuthDialog = (tab: "login" | "signup") => {
    setAuthDialogInitialTab(tab);
    setIsAuthDialogOpen(true);
  };

  return (
    <header className="h-16 flex items-center justify-between px-4">
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggle}
          className="flex-shrink-0"
        >
          {isCollapsed ? (
            <PanelRightOpen className="h-7 w-7" />
          ) : (
            <PanelLeftClose className="h-7 w-7" />
          )}
        </Button>
        
        {!isCollapsed && (
          <>
            <img src={theme === "dark" ? logoDark : logoLight} alt="Open Notion AI Logo" className="h-8 w-8" />
            <h1 className="text-lg font-semibold">Open Notion AI</h1>
          </>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Language Toggle */}
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[110px] h-8">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ko">한국어</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Theme Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* User Auth Dropdown / Logout Button */}
        {!isAuthLoading && (
          user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label="User menu"
                >
                  {/* Placeholder for avatar - you can replace UserCircle2 with an actual avatar later */}
                  <UserCircle2 className="h-5 w-5" /> 
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user.email && <DropdownMenuItem disabled>{user.email}</DropdownMenuItem>}              
                <DropdownMenuItem onClick={signOut}>
                  {t("log-out", { defaultValue: "Log Out" })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label="User actions"
                >
                  <UserCircle2 className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openAuthDialog("signup")}>
                  {t("sign-up")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAuthDialog("login")}>
                  {t("log-in")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
        {isAuthLoading && (
          <Button variant="ghost" size="icon" disabled>
            <Loader2 className="h-5 w-5 animate-spin" />
          </Button>
        )}
      </div>
      <AuthDialog 
        open={isAuthDialogOpen} 
        onOpenChange={setIsAuthDialogOpen} 
        initialTab={authDialogInitialTab} 
      />
    </header>
  );
}
