import { useLanguage } from "@/context/LanguageContext";
import { en } from "./locales/en";
import { ko } from "./locales/ko";

// Translation dictionaries
const translations = {
  en,
  ko
};

export function useTranslation() {
  const { language } = useLanguage();
  
  // Get translation function
  const t = (key: string, params?: Record<string, string>): string => {
    // Get translation from dictionary
    const translation = translations[language][key] || key;
    
    // Replace parameters
    if (params) {
      return Object.entries(params).reduce(
        (str, [key, value]) => str.replace(`{{${key}}}`, value),
        translation
      );
    }
    
    return translation;
  };
  
  return { t, language };
}
