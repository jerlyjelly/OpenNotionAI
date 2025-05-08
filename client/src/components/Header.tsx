import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { useTranslation } from "@/i18n";
import { Sun, Moon, PanelLeftClose, PanelRightOpen } from "lucide-react";

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
      </div>
    </header>
  );
}
