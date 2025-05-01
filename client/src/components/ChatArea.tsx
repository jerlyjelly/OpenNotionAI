import { useState, useRef, useEffect } from "react"; // Removed useCallback
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
// ChatMessage might not be needed if chatHistory is removed, but keep for now if Message uses it indirectly
// import { ChatMessage } from "@/lib/llm-providers";
import { MessageCircle, Send, Loader2, Download, RefreshCw, Copy, Database, ChevronDown, ChevronUp } from "lucide-react"; // Removed Check, X, Added ChevronDown, ChevronUp
import { useToast } from "@/hooks/use-toast";
import { DBRecordManager } from "./DBRecordManager";
import { DBStructure } from "./DBStructure"; // Import DBStructure
// Removed NotionClient and DatabaseProperty as they are no longer used for direct interaction
import { DatabaseStructure as NotionDBStructure } from "@/lib/notion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  // Removed fields related to confirmation UI
}

// Removed types related to client-side action handling and confirmation
// interface NotionActionPayload { ... }
// interface NotionUpdatePayload { ... }
// interface NotionAction { ... }
// interface PendingAction { ... }


export function ChatArea() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    isConnected,
    dbStructure,
    isProcessing, // Keep isProcessing for loading states
    notionApiKey,
    notionDbId,   // Corrected name
    llmApiKey,    // Add llmApiKey
    llmProvider,  // Add llmProvider
    // Removed chatWithLLM and notionClient
  } = useApiContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [showDbStructure, setShowDbStructure] = useState<boolean>(false); // State to toggle DB structure visibility - Default to hidden
  // Removed pendingAction state
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep isProcessing state, but rename the setter if needed (or keep if context provides it)
  const [isLoading, setIsLoading] = useState(false); // Local loading state for fetch

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Add welcome message when connected
  useEffect(() => {
    if (isConnected && dbStructure && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcome-message"),
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, [isConnected, dbStructure, messages.length, t]);

  // Removed findTitlePropertyName, handleConfirmAction, handleCancelAction


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use local isLoading state, remove pendingAction check
    // Use correct variable name notionDbId
    // Add checks for llmApiKey and llmProvider
    if (!input.trim() || isLoading || !notionApiKey || !notionDbId || !llmApiKey || !llmProvider) {
        toast({ // Inform user if required config is missing
            title: "Missing Configuration",
            description: "Please ensure Notion API Key, Database ID, LLM Provider, and LLM API Key are set in Settings.",
            variant: "destructive",
        });
        return;
    }

    const userMessageContent = input; // Store content before clearing
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true); // Start loading

    // Removed chat history creation and LLM call logic

    try {
      // Call the backend endpoint
      const response = await fetch('/api/chat-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: userMessageContent, // Correct field name: userMessage
          notionApiKey: notionApiKey,
          databaseId: notionDbId,
          llmApiKey: llmApiKey,       // Add llmApiKey
          llmProvider: llmProvider,   // Add llmProvider
          // Optionally send previous messages if backend needs context,
          // but for now, just send the current message as per simplified goal.
          // chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        // Handle HTTP errors (e.g., 4xx, 5xx)
        const errorData = await response.json().catch(() => ({ message: response.statusText })); // Try to parse error JSON
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();

      // Add assistant message from backend response
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: result.message || t("empty-response"), // Use message from backend or a fallback
          timestamp: new Date().toISOString()
        }
      ]);

      // If backend indicates success, maybe show a toast? (Optional)
      if (result.success) {
         // toast({ title: t("action-successful") }); // Example toast
      }


    } catch (error) {
      console.error("Error calling backend chat action:", error);
      toast({
        title: t("error-occurred"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `${t("error-message")}: ${error instanceof Error ? error.message : String(error)}`, // Show specific error
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
       setIsLoading(false); // Stop loading regardless of outcome
    }
  };

  const handleClearChat = () => {
    if (window.confirm(t("confirm-clear-chat"))) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: t("welcome-message"),
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleExportChat = () => {
    const chatHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || new Date().toISOString()
    }));

    // Create exportable content
    const exportContent = {
      title: "Notion AI Chat Export",
      timestamp: new Date().toISOString(),
      messages: chatHistory,
      dbStructure: dbStructure
    };

    // Create blob and download link
    const blob = new Blob([JSON.stringify(exportContent, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notion-ai-chat-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t("export-successful"),
      description: t("conversation-exported"),
    });
  };

  const handleCopyToClipboard = () => {
    const chatText = messages.map(msg => 
      `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`
    ).join("\n\n");
    
    navigator.clipboard.writeText(chatText);
    
    toast({
      title: t("copy-successful"),
      description: t("conversation-copied"),
    });
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 mb-6 text-primary">
          <MessageCircle className="h-full w-full" />
        </div>
        <h3 className="text-xl font-medium mb-2">{t("welcome")}</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          {t("start-description")}
        </p>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>{t("keys-secure")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Move Tabs component to wrap everything */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
        <div className="border-b p-2">
          {/* TabsList remains here */}
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat" className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              {t("chat")}
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center">
              <Database className="h-4 w-4 mr-2" />
              {t("database")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TabsContent for chat now inside Tabs */}
        <TabsContent value="chat" className="flex-1 flex flex-col relative mt-0 p-0 overflow-hidden">
          {/* Flex container for DB structure toggle and icons */}
          <div className="flex items-center justify-between px-4 py-2">
            {/* Button to toggle DB structure visibility */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDbStructure(!showDbStructure)}
              className="flex items-center space-x-1"
            >
              {/* Use dbStructure.title if available, fallback to translation. Added truncate and title attribute for long names */}
              <span className="text-sm font-medium truncate max-w-[200px]" title={dbStructure?.title || t("database-structure")}>
                {dbStructure?.title || t("database-structure")}
              </span>
              {showDbStructure ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {/* Icons */}
            <div className="flex space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleClearChat}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("clear-chat")}</TooltipContent>
            </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("copy-to-clipboard")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleExportChat}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("export-conversation")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Render DBStructure with animation */}
      {dbStructure && (
        <div
          className={`overflow-hidden transition-max-height duration-500 ease-in-out ${
            showDbStructure ? "max-h-screen" : "max-h-0"
          }`}
        >
          <div className="px-4">
            <DBStructure dbStructure={dbStructure} />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 px-4 pb-4 pt-2"> {/* Adjusted pt */}
        <div className="space-y-4">
          {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-4 py-2 rounded-lg max-w-[75%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {/* Confirmation UI Rendering Logic is fully removed */}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {/* Always show timestamp if available */}
                  {message.timestamp && (
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat-placeholder")}
              disabled={isLoading} // Use local isLoading state
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}> {/* Use local isLoading state */}
              {isLoading ? ( // Use local isLoading state
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          {/* Removed pending action indicator */}
        </div>
      </TabsContent>

        {/* TabsContent for database now inside Tabs */}
        <TabsContent value="database" className="flex-10 p-4 mt-0 overflow-hidden">
          <DBRecordManager />
        </TabsContent>
      </Tabs> {/* Tabs component now correctly closes here */}
    </div>
  );
}
