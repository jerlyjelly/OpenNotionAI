import { createContext, useState, useContext, ReactNode, useCallback } from "react";
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
  isRefreshing: boolean; // Renamed from isDbLoading
  refreshData: () => Promise<void>; // Renamed from refreshDbStructure
  records: NotionRecord[];
  isRecordsLoading: boolean;
  recordsError: string | null;
}

// Define NotionRecord type here or import if moved
type NotionRecord = {
  id: string;
  properties: Record<string, any>;
  url: string;
  createdTime: string;
  lastEditedTime: string;
};

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
  
  // Database records
  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // Combined refresh state
  const [isRefreshing, setIsRefreshing] = useState(false); // Renamed from isDbLoading

  // Internal function to fetch records
  const fetchRecords = useCallback(async (client: NotionClient) => {
    if (!client) return;
    setIsRecordsLoading(true);
    setRecordsError(null);
    try {
      const results = await client.queryDatabase();
      setRecords(results);
    } catch (error) {
      console.error("Error fetching records:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch records";
      setRecordsError(errorMessage);
      // Optionally show toast for record fetch errors
      // toast({ title: "Record Fetch Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsRecordsLoading(false);
    }
  }, []); // Empty dependency array as it uses the passed client

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
      // Save clients and structure
      setNotionClient(newNotionClient);
      setLlmClient(newLlmClient);
      setDbStructure(structure);
      
      // Fetch initial records
      await fetchRecords(newNotionClient); 
      
      setIsConnected(true); // Set connected only after structure AND records are attempted

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

  // Refresh database structure and records manually
  const refreshData = async () => {
    if (!notionClient || !isConnected || isRefreshing) return;

    setIsRefreshing(true);
    setRecordsError(null); // Clear previous errors

    try {
      // Fetch structure first
      const structure = await notionClient.getDatabaseStructure();
      setDbStructure(structure);
      
      // Then fetch records
      await fetchRecords(notionClient); 

      toast({
        title: "Database Refreshed",
        description: "Database structure and records have been updated.",
      });
    } catch (error) {
      // Error handling for structure fetch (record fetch errors handled in fetchRecords)
      console.error("DB structure refresh error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh database structure";
      // Decide if this error should be shown differently or combined with recordsError
      setRecordsError(errorMessage); // Temporarily using recordsError for structure errors too
      toast({
        title: "Refresh Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Reconnect with current settings
  const reconnect = async () => {
    if (isConnected) {
      setIsConnected(false);
      setDbStructure(null);
      setRecords([]); // Clear records on disconnect
      setRecordsError(null);
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
        connectionError,
        isRefreshing, // Renamed
        refreshData, // Renamed
        records,
        isRecordsLoading,
        recordsError
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
