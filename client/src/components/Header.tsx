import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { useTranslation } from "@/i18n";
import { Sun, Moon, Box } from "lucide-react";

export function Header() {
  const { setLanguage, language } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <header className="border-b h-16 flex items-center justify-between px-4">
      <div className="flex items-center space-x-2">
        <Box className="h-8 w-8" />
        <h1 className="text-lg font-semibold">OSS Notion AI</h1>
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
