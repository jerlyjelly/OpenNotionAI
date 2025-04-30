import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { ChatMessage } from "@/lib/llm-providers";
import { MessageCircle, Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatArea() {
  const { t } = useTranslation();
  const { 
    isConnected, 
    dbStructure,
    chatWithLLM,
    isProcessing
  } = useApiContext();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message when connected
  useEffect(() => {
    if (isConnected && dbStructure && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcome-message")
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
      content: input
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
          content: response
        }
      ]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setMessages(prev => [
        ...prev, 
        {
          id: Date.now().toString(),
          role: "assistant",
          content: t("error-message")
        }
      ]);
    }
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
      <ScrollArea className="flex-1 p-4">
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
    </div>
  );
}
