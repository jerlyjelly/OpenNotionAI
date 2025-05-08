import { useState, useRef, useEffect } from "react"; // Removed useCallback
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
// ChatMessage might not be needed if chatHistory is removed, but keep for now if Message uses it indirectly
// import { ChatMessage } from "@/lib/llm-providers";
import { MessageCircle, Send, Loader2, Download, RefreshCw, Copy, Database, ChevronDown, ChevronUp, ExternalLink, ChevronRight, XSquare } from "lucide-react"; // Removed Check, X, Added ChevronDown, ChevronUp, ExternalLink, ChevronRight, XSquare
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components

// Helper function to extract title from Notion page properties
const getNotionPageTitle = (properties: Record<string, any>): string => {
  if (!properties) return "Untitled";
  // Iterate over property names (e.g., "Name", "Task Name")
  for (const propName in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, propName)) {
      const property = properties[propName];
      // Check if this property is of type 'title'
      if (property && property.type === 'title' && property.title && property.title.length > 0) {
        return property.title.map((textObj: any) => textObj.plain_text || textObj.text?.content || '').join('');
      }
    }
  }
  return "Untitled"; // Fallback if no title property found
};

// Define the structure for individual query result items
interface NotionQueryResultItem {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>; // This will hold the raw properties from Notion
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  links?: Array<{ title: string, url: string }>;
  data?: NotionQueryResultItem[]; // To hold structured data like query results
  intent?: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPEND' | 'QUERY' | 'SUMMARIZE'; // Add intent to Message interface
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
  const abortControllerRef = useRef<AbortController | null>(null); // Added AbortController ref

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
    if (!input.trim() || !notionApiKey || !notionDbId || !llmApiKey || !llmProvider) { // Removed isLoading from this check
        toast({ // Inform user if required config is missing
            title: "Missing Configuration",
            description: "Please ensure Notion Integration Secret, Database ID, LLM Provider, and LLM API Key are set in Settings.",
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

    abortControllerRef.current = new AbortController(); // Create a new AbortController

    const thinkingMessageId = "thinking-message";
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      role: "assistant",
      content: t("thinking-message-content", { defaultValue: "Thinking..." }),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, thinkingMessage]);

    // Removed chat history creation and LLM call logic

    try {
      // Call the backend endpoint

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
          userTimezone: userTimezone, // Add userTimezone
          // Optionally send previous messages if backend needs context,
          // but for now, just send the current message as per simplified goal.
          // chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortControllerRef.current.signal, // Pass the signal to fetch
      });

      if (!response.ok) {
        // Handle HTTP errors (e.g., 4xx, 5xx)
        const errorData = await response.json().catch(() => ({ message: response.statusText })); // Try to parse error JSON
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();

      // Remove thinking message
      setMessages(prev => prev.filter(m => m.id !== thinkingMessageId));

      let assistantMessageContent = result.message; // Default to the generic message from backend
      let assistantDataLinks: Array<{ title: string, url: string }> = [];
      let assistantMessageData: NotionQueryResultItem[] | undefined = undefined; // For QUERY results to be rendered as blocks

      if (result.success) {
        if (result.intent === 'SUMMARIZE') {
          if (result.data && result.data.summary) {
            assistantMessageContent = result.data.summary; // Summary text becomes the main content
          } else {
            // If summary data is missing, stick with the generic message from backend
            assistantMessageContent = result.message || "Summary data was not found.";
          }
          // No separate links for SUMMARIZE intent usually, the content is the summary itself
        } else if (result.intent === 'QUERY') {
          // Generic message is already set as default for assistantMessageContent
          if (result.data && Array.isArray(result.data)) {
            if (result.data.length > 0) {
                // Populate assistantDataLinks for rendering as clickable links below the message
                // The detailed rendering of these items as blocks is handled by the JSX using message.data
                assistantMessageData = result.data as NotionQueryResultItem[]; // Pass the raw data for block rendering
                result.data.forEach((page: any) => {
                    let pageTitle = page.id; // Default to page.id
                    if (page.properties) {
                        const titleProperty = Object.values(page.properties).find((prop: any) => prop.type === 'title') as any;
                        if (titleProperty && titleProperty.title && Array.isArray(titleProperty.title) && titleProperty.title.length > 0) {
                            if (titleProperty.title[0].plain_text) {
                                pageTitle = titleProperty.title[0].plain_text;
                            } else if (titleProperty.title[0].text && titleProperty.title[0].text.content) {
                                pageTitle = titleProperty.title[0].text.content;
                            }
                        }
                    }
                    assistantDataLinks.push({ title: pageTitle, url: page.url });
                });
            } else {
                 // message already says "Successfully queried 0 records" or similar, or "No records found..."
            }
          } else {
            // Stick with the generic message if data is not as expected
          }
        } else if (result.intent === 'CREATE' || result.intent === 'UPDATE' || result.intent === 'APPEND') {
            // Generic message is already set as default
            if (result.data) {
                const itemsToProcess = Array.isArray(result.data) ? result.data : [result.data];

                itemsToProcess.forEach(item => {
                    if (item && item.url) { // Each item must have a URL to be linked
                        let pageTitle = getNotionPageTitle(item.properties); // Use the helper

                        // For single UPDATE/APPEND, if title from properties is "Untitled",
                        // and result.identifier exists (which it should for these intents), use it.
                        if ((pageTitle === "Untitled" || !pageTitle) && 
                            (result.intent === 'UPDATE' || result.intent === 'APPEND') && 
                            result.identifier && 
                            !Array.isArray(result.data)) {
                            pageTitle = result.identifier;
                        }
                        
                        // If still no good title (e.g. "Untitled" from getNotionPageTitle or no title from identifier), provide a fallback
                        if (pageTitle === "Untitled" || !pageTitle) {
                            pageTitle = item.id ? `Item ${item.id.substring(0, 8)}...` : "View Item";
                        }

                        assistantDataLinks.push({ title: pageTitle, url: item.url });
                    }
                });
            }
        } else {
          // Default handling: generic message is already set
        }
      } else {
        assistantMessageContent = result.error || result.message || "An unknown error occurred.";
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: assistantMessageContent,
        timestamp: new Date().toISOString(),
        links: assistantDataLinks.length > 0 ? assistantDataLinks : undefined,
        data: assistantMessageData, // Assign data for QUERY results
        intent: result.intent, // Pass the intent to the message object
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Fetch aborted by user.");
        setMessages(prev => prev.filter(m => m.id !== thinkingMessageId)); // Remove thinking message
        // Optionally add a message indicating the stop, or just silently stop
        toast({
            title: "Request Cancelled",
            description: "The request was cancelled by the user.",
        });
      } else {
        console.error("Error calling backend chat action:", error);
        toast({
          title: t("error-occurred"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
        setMessages(prev => {
          const newMessages = [...prev];
          const thinkingMsgIndex = newMessages.findIndex(m => m.id === thinkingMessageId);
          if (thinkingMsgIndex !== -1) {
            newMessages[thinkingMsgIndex] = {
              ...newMessages[thinkingMsgIndex],
              id: Date.now().toString(),
              content: `${t("error-message")}: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date().toISOString()
            };
            return newMessages;
          }
          // Fallback if thinking message was somehow removed
          return [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `${t("error-message")}: ${error instanceof Error ? error.message : String(error)}`, // Show specific error
              timestamp: new Date().toISOString()
            }
          ];
        });
      }
    } finally {
       setIsLoading(false); // Stop loading regardless of outcome
       abortControllerRef.current = null; // Clear the AbortController
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // setIsLoading(false); // isLoading will be set to false in the finally block of handleSubmit
      // No need to remove thinking message here, it's handled in the catch block of handleSubmit
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
                className={`flex flex-col mb-1 ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* Chat bubble for text content */}
                <div
                  className={`px-4 py-2 rounded-lg max-w-[75%] flex items-center space-x-2 ${ 
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {message.id === "thinking-message" && <Loader2 className="h-4 w-4 animate-spin" />}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.timestamp && message.id !== "thinking-message" && (
                    <p className="text-xs opacity-70 mt-1 self-end">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Render query results if available (OUTSIDE and BELOW the bubble) */}
                {/* This section specifically renders message.data for QUERY results as blocks */}
                {message.role === 'assistant' && message.intent === 'QUERY' && message.data && message.data.length > 0 && (
                  <div className="mt-2 self-start inline-grid grid-cols-auto max-w-[75%] gap-y-1">
                    {message.data.map((item) => {
                      const title = getNotionPageTitle(item.properties);
                      return (
                        <a 
                          key={item.id} 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 h-10 bg-transparent hover:bg-accent hover:text-accent-foreground rounded-md border border-input text-sm font-medium text-foreground transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group w-full"
                        >
                          <span className="truncate flex-grow mr-2">{title}</span>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Render general links if available (e.g., for CREATE, UPDATE, APPEND) and not a QUERY intent */}
                {message.role === 'assistant' && message.links && message.links.length > 0 && message.intent !== 'QUERY' && (
                  <div className="mt-2 self-start inline-grid grid-cols-auto max-w-[75%] gap-y-1">
                    {message.links.map((link) => (
                      <a 
                        key={link.url} // Assuming URL is unique enough for a key here, or use index if necessary
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 h-10 bg-transparent hover:bg-accent hover:text-accent-foreground rounded-md border border-input text-sm font-medium text-foreground transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group w-full"
                      >
                        <span className="truncate flex-grow mr-2">{link.title}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
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
              disabled={isLoading} // Input remains disabled during loading
              className="flex-1"
            />
            <Button 
              type={isLoading ? "button" : "submit"} 
              onClick={isLoading ? handleStop : undefined}
              disabled={!isLoading && !input.trim()} // Disabled if not loading AND input is empty
            >
              {isLoading ? (
                <XSquare className="h-4 w-4" /> // Stop icon
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
