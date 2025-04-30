import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { LLMProvider, availableModels } from "@/lib/llm-providers";
import { DBStructure } from "./DBStructure";

export function Sidebar() {
  const { t } = useTranslation();
  const { 
    notionApiKey, setNotionApiKey,
    notionDbId, setNotionDbId,
    llmProvider, setLlmProvider,
    llmApiKey, setLlmApiKey,
    llmModel, setLlmModel,
    connect, isConnecting, isConnected,
    dbStructure
  } = useApiContext();

  const [showNotionApiKey, setShowNotionApiKey] = useState(false);
  const [showNotionDbId, setShowNotionDbId] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);

  return (
    <div className="w-80 border-r p-4 flex flex-col h-full">
      <div className="space-y-4">
        <h2 className="text-lg font-medium">{t("settings")}</h2>
        
        {/* API Keys Section */}
        <div className="space-y-4">
          {/* Notion API Key */}
          <div className="space-y-2">
            <Label htmlFor="notion-api">{t("notion-api-key")}</Label>
            <div className="relative">
              <Input
                id="notion-api"
                type={showNotionApiKey ? "text" : "password"}
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                className="pr-10"
                placeholder={t("enter-notion-api-key")}
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
            <Label htmlFor="notion-db">{t("notion-db-key")}</Label>
            <div className="relative">
              <Input
                id="notion-db"
                type={showNotionDbId ? "text" : "password"}
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                className="pr-10"
                placeholder={t("enter-notion-db-key")}
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
            <Select value={llmModel} onValueChange={(value) => setLlmModel(value)}>
              <SelectTrigger id="llm-model">
                <SelectValue placeholder={t("select-llm-model")} />
              </SelectTrigger>
              <SelectContent>
                {availableModels[llmProvider].map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
      </div>
      
      {/* Database Structure */}
      {dbStructure && <DBStructure dbStructure={dbStructure} />}
    </div>
  );
}
