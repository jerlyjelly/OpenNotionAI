import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { ChatMessage } from "@/lib/llm-providers";
import { MessageCircle, Send, Loader2, Download, RefreshCw, Copy, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DBRecordManager } from "./DBRecordManager";
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
}

export function ChatArea() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { 
    isConnected, 
    dbStructure,
    chatWithLLM,
    isProcessing
  } = useApiContext();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<string>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    // Create chat history for LLM
    const chatHistory: ChatMessage[] = [
      { 
        role: "system", 
        content: `You are an AI assistant that helps users interact with their Notion database. 
        The database has the following structure: ${JSON.stringify(dbStructure)}.
        Be helpful, concise, and accurate. If you don't know something, say so.`
      },
      ...messages.map(msg => ({ 
        role: msg.role as "user" | "assistant", 
        content: msg.content 
      })),
      { role: "user", content: input }
    ];

    try {
      // Get response from LLM
      const response = await chatWithLLM(chatHistory);
      
      // Add AI response to chat
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: "assistant",
          content: t("error-message"),
          timestamp: new Date().toISOString()
        }
      ]);
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
      <div className="border-b p-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
        </Tabs>
      </div>

      <TabsContent value="chat" className="flex-1 flex flex-col relative mt-0 p-0">
        <div className="absolute top-2 right-2 z-10 flex space-x-1">
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

        <ScrollArea className="flex-1 px-4 pb-4 pt-10">
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
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
              disabled={isProcessing}
              className="flex-1"
            />
            <Button type="submit" disabled={isProcessing || !input.trim()}>
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </TabsContent>

      <TabsContent value="database" className="flex-1 p-4 mt-0">
        <DBRecordManager />
      </TabsContent>
    </div>
  );
}
