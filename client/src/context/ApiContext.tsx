import { createContext, useState, useContext, ReactNode, useCallback, useEffect } from "react";
import { NotionClient, DatabaseStructure } from "@/lib/notion";
import {
  createLLMClient,
  LLMInterface, 
  LLMProvider, 
  ChatMessage,
  defaultModels 
} from "@/lib/llm-providers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; // Corrected import path based on file structure
import { User } from '@supabase/supabase-js';

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
  connectionError: string | null;
  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  records: NotionRecord[];
  isRecordsLoading: boolean;
  recordsError: string | null;
  dbList: { id: string; title: string }[];
  addDatabase: (dbId: string) => void;
  switchDatabase: (dbId: string) => void;
  clearConnection: () => void;
  currentUser: User | null; // Added currentUser to context type
}

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
  
  const [notionApiKey, setNotionApiKeyInternal] = useState("");
  const [notionDbId, setNotionDbIdInternal] = useState("");
  const [llmProvider, setLlmProviderInternal] = useState<LLMProvider>("openai");
  const [llmApiKey, setLlmApiKeyInternal] = useState("");
  const [llmModel, setLlmModelInternal] = useState(defaultModels.openai);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const [notionClient, setNotionClient] = useState<NotionClient | null>(null);
  const [llmClient, setLlmClient] = useState<LLMInterface | null>(null);
  
  const [dbStructure, setDbStructure] = useState<DatabaseStructure | null>(null);
  const [dbList, setDbList] = useState<{ id: string; title: string }[]>([]);
  const [activelyConnectedDbId, setActivelyConnectedDbId] = useState<string | null>(null);

  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    // Initial check for user session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

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
    } finally {
      setIsRecordsLoading(false);
    }
  }, []);

  const clearConnectionStates = useCallback(() => {
    setIsConnected(false);
    setDbStructure(null);
    setNotionClient(null);
    setLlmClient(null);
    setRecords([]);
    setRecordsError(null);
    setActivelyConnectedDbId(null);
    setDbList(prev => prev.filter(db => db.id !== notionDbId));
  }, [notionDbId]);
  
  const clearConnection = useCallback(() => {
    setNotionApiKeyInternal("");
    setNotionDbIdInternal("");
    clearConnectionStates();
    setConnectionError(null);
    toast({ title: "Disconnected", description: "Connection details have been cleared." });
  }, [clearConnectionStates, toast]);

  const connect = useCallback(async () => {
    if (isConnecting) return;

    if (!notionApiKey || !notionDbId || !llmApiKey) {
      setConnectionError("Missing API Keys or Database ID.");
      if (isConnected) clearConnectionStates();
      return;
    }
    
    if (isConnected && notionDbId === activelyConnectedDbId && notionClient && llmClient) {
    }

    setIsConnecting(true);
    setConnectionError(null);

    if ((isConnected && notionDbId !== activelyConnectedDbId) || !isConnected) {
      clearConnectionStates();
      setIsConnected(false);
    }
    
    try {
      const newNotionClient = new NotionClient(notionApiKey, notionDbId);
      const structure = await newNotionClient.getDatabaseStructure();
      
      const newLlmClient = createLLMClient(llmProvider, llmApiKey, llmModel);
      
      setNotionClient(newNotionClient);
      setLlmClient(newLlmClient);
      setDbStructure(structure);
      
      setDbList(prevDbList => {
        const exists = prevDbList.some(db => db.id === notionDbId);
        if (structure.title && !exists) {
          return [...prevDbList, { id: notionDbId, title: structure.title }];
        }
        return prevDbList;
      });
      
      await fetchRecords(newNotionClient);
      
      setIsConnected(true);
      setActivelyConnectedDbId(notionDbId);

      // Nudge logic after successful connection - remove setTimeout
      if (!currentUser) {
        toast({
          title: "Save Your Connection!",
          description: "Sign up or log in to save these Notion details for quick access next time.",
          duration: 10000,
        });
      } else {
        // TODO: In the future, check if this specific connection is already saved for this user.
        toast({
          title: "Connection Active!",
          description: "You can save or update these Notion details in your account using the 'Manage Saved Connection' button in the sidebar.",
          duration: 10000,
        });
      }

    } catch (error) {
      console.error("Connection error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to Notion or LLM provider";
      setConnectionError(errorMessage);
      clearConnectionStates();
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [
    notionApiKey, notionDbId, llmApiKey, llmProvider, llmModel, 
    isConnected, isConnecting, activelyConnectedDbId, notionClient, llmClient,
    fetchRecords, toast, clearConnectionStates
  ]);

  useEffect(() => {
    if (!notionDbId || !notionApiKey || !llmApiKey) {
      if (isConnected) {
        clearConnectionStates();
        setConnectionError("Configuration became invalid. Disconnected.");
         toast({ title: "Disconnected", description: "Connection configuration became invalid." });
      }
      return;
    }

    if ((notionDbId && notionDbId !== activelyConnectedDbId) || (!isConnected && notionDbId)) {
      connect();
    } else if (isConnected && notionDbId === activelyConnectedDbId) {
    }
  }, [notionDbId, notionApiKey, llmApiKey, connect, isConnected, activelyConnectedDbId, clearConnectionStates, toast]);

  const setNotionApiKey = useCallback((key: string) => {
    setNotionApiKeyInternal(key);
    if (!key && isConnected) {
        clearConnectionStates();
        setConnectionError("Notion API Key cleared. Disconnected.");
        toast({ title: "Disconnected", description: "Notion API Key was cleared." });
    }
  }, [isConnected, clearConnectionStates, toast]);

  const setLlmApiKey = useCallback((key: string) => {
    setLlmApiKeyInternal(key);
     if (!key && isConnected) {
        if (llmClient) {
        }
     }
  }, [isConnected, llmClient]);

  const addDatabase = useCallback((dbId: string) => {
    setNotionDbIdInternal(dbId);
  }, []);

  const switchDatabase = useCallback((dbId: string) => {
    if (dbId === notionDbId && isConnected) return; 
    setNotionDbIdInternal(dbId);
  }, [notionDbId, isConnected]);
  
  const setLlmProvider = useCallback((provider: LLMProvider) => {
    setLlmProviderInternal(provider);
    setLlmModelInternal(defaultModels[provider]);
  }, []);

  const setLlmModel = useCallback((model: string) => {
    setLlmModelInternal(model);
    if (llmClient) {
        llmClient.setModel(model);
    }
  }, [llmClient]);

  const refreshData = useCallback(async () => {
    if (!notionClient || !isConnected || isRefreshing) return;

    setIsRefreshing(true);
    setRecordsError(null);
    try {
      const structure = await notionClient.getDatabaseStructure();
      setDbStructure(structure);
      await fetchRecords(notionClient);
      toast({
        title: "Database Refreshed",
        description: "Database structure and records have been updated.",
      });
    } catch (error) {
      console.error("DB structure refresh error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh database structure";
      setConnectionError(`Refresh Failed: ${errorMessage}`);
      toast({
        title: "Refresh Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [notionClient, isConnected, isRefreshing, fetchRecords, toast]);

  const chatWithLLM = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    if (!llmClient || !isConnected) {
      throw new Error("LLM client not initialized or not connected.");
    }
    setIsProcessing(true);
    try {
      const response = await llmClient.chat(messages);
      return response;
    } finally {
      setIsProcessing(false);
    }
  }, [llmClient, isConnected]);

  return (
    <ApiContext.Provider
      value={{
        notionApiKey,
        setNotionApiKey,
        notionDbId,
        setNotionDbId: setNotionDbIdInternal,
        llmProvider,
        setLlmProvider,
        llmApiKey,
        setLlmApiKey,
        llmModel,
        setLlmModel,
        isConnecting,
        isConnected,
        connect,
        dbStructure,
        chatWithLLM,
        isProcessing,
        notionClient,
        connectionError,
        isRefreshing,
        refreshData,
        records,
        isRecordsLoading,
        recordsError,
        dbList,
        addDatabase,
        switchDatabase,
        clearConnection,
        currentUser // Provide currentUser in context
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
