import { useState, useEffect } from "react"; // Import useEffect
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Info, Loader2, Settings2 } from 'lucide-react'; // Added Settings2 for manage connection button
import { useApiContext } from '@/context/ApiContext';
import { LLMProvider, defaultModels, availableModels } from "@/lib/llm-providers"; // Import directly & add availableModels
import { InfoModal } from './InfoModal';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import { User } from '@supabase/supabase-js'; // Import User type
import { NotionSecretDialog } from '@/components/notion/notionsecretdialog'; // Import the new dialog

export function Sidebar({ isCollapsed }: { isCollapsed: boolean }) {
  const { t } = useTranslation();
  const { 
    notionApiKey, setNotionApiKey,
    notionDbId, setNotionDbId,
    llmProvider, setLlmProvider,
    llmApiKey, setLlmApiKey,
    llmModel, setLlmModel,
    connect, isConnecting, isConnected
  } = useApiContext();

  const [showNotionApiKey, setShowNotionApiKey] = useState(false);
  const [showNotionDbId, setShowNotionDbId] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false); // State for the info modal
  const [isDbIdInfoModalOpen, setIsDbIdInfoModalOpen] = useState(false); // State for DB ID info modal
  const [isNotionSecretDialogOpen, setIsNotionSecretDialogOpen] = useState(false); // State for Notion Secret Dialog
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const notionSecretGuideContent = (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        {t("notion-secret-guide-step1-prefix")}
        <a
          href="https://developers.notion.com/docs/create-a-notion-integration#getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          developers.notion.com/docs/create-a-notion-integration#getting-started
        </a>
      </p>
      <p>
        {t("notion-secret-guide-step2-prefix")}
        <span className="block font-medium pt-1">{t("notion-secret-guide-step2-actions")}</span>
      </p>
    </div>
  );

  const notionDbIdGuideContent = (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>{t("notion-db-id-guide-step1")}</p>
      <p>{t("notion-db-id-guide-step2")}</p>
      <p>
        {t("notion-db-id-guide-step3-prefix")}
        <a
          href="https://developers.notion.com/reference/retrieve-a-database"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          developers.notion.com/reference/retrieve-a-database
        </a>
        {t("notion-db-id-guide-step3-suffix")}
      </p>
    </div>
  );

  return (
    <div className={`border-r flex flex-col h-full transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-80'}`}>
      {/* Main content area - conditionally rendered based on collapsed state */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isCollapsed ? 'hidden' : 'block'}`}>
        {/* Settings Title */}
        {/* <h2 className="text-lg font-medium">{t("settings")}</h2> */}
        
        {/* API Keys Section */}
        <div className="space-y-4">
          {/* Notion Integration Secret */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="notion-api">{t("notion-integration-secret")}</Label>
              <Button variant="ghost" size="icon" onClick={() => setIsInfoModalOpen(true)} className="h-6 w-6 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="relative">
              <Input
                id="notion-api"
                type={showNotionApiKey ? "text" : "password"}
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                className="pr-10"
                placeholder={t("enter-notion-integration-secret")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full"
                onClick={() => setShowNotionApiKey(!showNotionApiKey)}
              >
                {showNotionApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Notion DB Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="notion-db">{t("notion-db-id")}</Label>
              <Button variant="ghost" size="icon" onClick={() => setIsDbIdInfoModalOpen(true)} className="h-6 w-6 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="relative">
              <Input
                id="notion-db"
                type={showNotionDbId ? "text" : "password"}
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                className="pr-10"
                placeholder={t("enter-notion-db-id")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full"
                onClick={() => setShowNotionDbId(!showNotionDbId)}
              >
                {showNotionDbId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* LLM Provider */}
          <div className="space-y-2">
            <Label htmlFor="llm-provider">{t("llm-provider")}</Label>
            <Select value={llmProvider} onValueChange={(value) => setLlmProvider(value as LLMProvider)}>
              <SelectTrigger id="llm-provider">
                <SelectValue placeholder={t("select-llm-provider")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* LLM Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="llm-model">{t("llm-model")}</Label>
            {llmProvider === "openrouter" ? (
              <>
                <Input
                  id="llm-model" // Same ID for the label to point to
                  type="text"
                  value={llmModel} // llmModel will be "openrouter/auto" by default or custom value
                  onChange={(e) => {
                    // If input is empty, set model to default, otherwise use input value
                    setLlmModel(e.target.value.trim() || defaultModels.openrouter);
                  }}
                  placeholder={t("openrouter-model-placeholder")}
                />
              </>
            ) : (
              <Select value={llmModel} onValueChange={(value) => setLlmModel(value)}>
                <SelectTrigger id="llm-model">
                  <SelectValue placeholder={t("select-llm-model")} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels[llmProvider].map((model) => ( // Remove ModelOption type, it will be inferred
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* LLM API Key */}
          <div className="space-y-2">
            <Label htmlFor="llm-api">{t("llm-api-key")}</Label>
            <div className="relative">
              <Input
                id="llm-api"
                type={showLlmApiKey ? "text" : "password"}
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                className="pr-10"
                placeholder={t("enter-llm-api-key")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full"
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
              >
                {showLlmApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Connect Button */}
          <Button
            onClick={connect}
            disabled={isConnecting || isConnected || !notionApiKey || !notionDbId || !llmApiKey}
            className="w-full"
            variant={isConnected ? "secondary" : "default"}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("connecting")}
              </>
            ) : isConnected ? (
              t("connected")
            ) : (
              t("connect")
            )}
          </Button>

          {/* Manage Saved Notion Connection Button - Only show if user is logged in */}
          {currentUser && (
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setIsNotionSecretDialogOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {t("manage-notion-connection-button", { defaultValue: "Manage Saved Connection"})}
            </Button>
          )}
        </div>
      </div>

      <InfoModal
        isOpen={isInfoModalOpen}
        onOpenChange={setIsInfoModalOpen}
        titleKey="notion-secret-guide-title"
        content={notionSecretGuideContent}
        buttonKey="close-button"
      />

      <InfoModal
        isOpen={isDbIdInfoModalOpen}
        onOpenChange={setIsDbIdInfoModalOpen}
        titleKey="notion-db-id-guide-title"
        content={notionDbIdGuideContent}
        buttonKey="close-button"
      />

      {/* Notion Secret Dialog - Render if currentUser exists to allow interaction */}
      {currentUser && (
        <NotionSecretDialog 
          open={isNotionSecretDialogOpen} 
          onOpenChange={setIsNotionSecretDialogOpen} 
        />
      )}
    </div>
  );
}
