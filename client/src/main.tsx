import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { LanguageProvider } from "@/context/LanguageContext";
import { ApiProvider } from "@/context/ApiContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="ui-theme">
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider>
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </ApiProvider>
      </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);
