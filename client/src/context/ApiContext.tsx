import { createContext, useState, useContext, ReactNode } from "react";
import { NotionClient, DatabaseStructure } from "@/lib/notion";
import { 
  createLLMClient, 
  LLMInterface, 
  LLMProvider, 
  ChatMessage,
  defaultModels 
} from "@/lib/llm-providers";
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
  llmModel: string;
  setLlmModel: (model: string) => void;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  dbStructure: DatabaseStructure | null;
  chatWithLLM: (messages: ChatMessage[]) => Promise<string>;
  isProcessing: boolean;
  notionClient: NotionClient | null;
  reconnect: () => Promise<void>;
  connectionError: string | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // API states
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("openai");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState(defaultModels.openai);
  
  // Connection states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Client instances
  const [notionClient, setNotionClient] = useState<NotionClient | null>(null);
  const [llmClient, setLlmClient] = useState<LLMInterface | null>(null);
  
  // Database structure
  const [dbStructure, setDbStructure] = useState<DatabaseStructure | null>(null);

  // Connect to Notion and LLM
  const connect = async () => {
    if (isConnecting || isConnected) return;
    
    if (!notionApiKey || !notionDbId || !llmApiKey) {
      setConnectionError("Missing API Keys");
      toast({
        title: "Missing API Keys",
        description: "Please provide all required API keys and database ID.",
        variant: "destructive",
      });
      return;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Create Notion client
      const newNotionClient = new NotionClient(notionApiKey, notionDbId);
      
      // Test connection by fetching database structure
      const structure = await newNotionClient.getDatabaseStructure();
      
      // Create LLM client with the selected model
      const newLlmClient = createLLMClient(llmProvider, llmApiKey, llmModel);
      
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
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to Notion or LLM provider";
      setConnectionError(errorMessage);
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Reconnect with current settings
  const reconnect = async () => {
    if (isConnected) {
      setIsConnected(false);
      setDbStructure(null);
    }
    return connect();
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

  // Handle provider change to update default model
  const handleProviderChange = (newProvider: LLMProvider) => {
    setLlmProvider(newProvider);
    setLlmModel(defaultModels[newProvider]);
  };
  
  // Update model for the current LLM client
  const updateLlmModel = (model: string) => {
    setLlmModel(model);
    if (llmClient) {
      llmClient.setModel(model);
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
        setLlmProvider: handleProviderChange,
        llmApiKey,
        setLlmApiKey,
        llmModel,
        setLlmModel: updateLlmModel,
        isConnecting,
        isConnected,
        connect,
        reconnect,
        dbStructure,
        chatWithLLM,
        isProcessing,
        notionClient,
        connectionError
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
