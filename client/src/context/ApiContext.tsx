import { createContext, useState, useContext, ReactNode } from "react";
import { NotionClient, DatabaseStructure } from "@/lib/notion";
import { createLLMClient, LLMInterface, LLMProvider, ChatMessage } from "@/lib/llm-providers";
import { useToast } from "@/hooks/use-toast";

interface ApiContextType {
  notionApiKey: string;
  setNotionApiKey: (key: string) => void;
  notionDbId: string;
  setNotionDbId: (id: string) => void;
  llmProvider: LLMProvider;
  setLlmProvider: (provider: LLMProvider) => void;
  llmApiKey: string;
  setLlmApiKey: (key: string) => void;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  dbStructure: DatabaseStructure | null;
  chatWithLLM: (messages: ChatMessage[]) => Promise<string>;
  isProcessing: boolean;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // API states
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("openai");
  const [llmApiKey, setLlmApiKey] = useState("");
  
  // Connection states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Client instances
  const [notionClient, setNotionClient] = useState<NotionClient | null>(null);
  const [llmClient, setLlmClient] = useState<LLMInterface | null>(null);
  
  // Database structure
  const [dbStructure, setDbStructure] = useState<DatabaseStructure | null>(null);

  // Connect to Notion and LLM
  const connect = async () => {
    if (isConnecting || isConnected) return;
    
    if (!notionApiKey || !notionDbId || !llmApiKey) {
      toast({
        title: "Missing API Keys",
        description: "Please provide all required API keys and database ID.",
        variant: "destructive",
      });
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Create Notion client
      const newNotionClient = new NotionClient(notionApiKey, notionDbId);
      
      // Test connection by fetching database structure
      const structure = await newNotionClient.getDatabaseStructure();
      
      // Create LLM client
      const newLlmClient = createLLMClient(llmProvider, llmApiKey);
      
      // Save clients and data
      setNotionClient(newNotionClient);
      setLlmClient(newLlmClient);
      setDbStructure(structure);
      setIsConnected(true);
      
      toast({
        title: "Connected Successfully",
        description: "You can now chat with your Notion database.",
      });
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Notion or LLM provider",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Chat with LLM
  const chatWithLLM = async (messages: ChatMessage[]): Promise<string> => {
    if (!llmClient) {
      throw new Error("LLM client not initialized");
    }
    
    setIsProcessing(true);
    try {
      const response = await llmClient.chat(messages);
      return response;
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ApiContext.Provider
      value={{
        notionApiKey,
        setNotionApiKey,
        notionDbId,
        setNotionDbId,
        llmProvider,
        setLlmProvider,
        llmApiKey,
        setLlmApiKey,
        isConnecting,
        isConnected,
        connect,
        dbStructure,
        chatWithLLM,
        isProcessing
      }}
    >
      {children}
    </ApiContext.Provider>
  );
}

export function useApiContext() {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error("useApiContext must be used within an ApiProvider");
  }
  return context;
}
