import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NotionClient } from "@/lib/notion";

type NotionRecord = {
  id: string;
  properties: Record<string, any>;
  url: string;
  createdTime: string;
  lastEditedTime: string;
};

export function DBRecordManager() {
  const { t } = useTranslation();
  const { 
    isConnected, 
    dbStructure, 
    notionClient,
    isProcessing: isApiProcessing 
  } = useApiContext();

  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<NotionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<NotionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, any>>({});

  useEffect(() => {
    if (isConnected && dbStructure && notionClient) {
      fetchRecords();
    }
  }, [isConnected, dbStructure, notionClient]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredRecords(records);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = records.filter(record => {
        return Object.values(record.properties).some(prop => {
          if (prop.title) {
            return prop.title.some((t: any) => t.plain_text.toLowerCase().includes(term));
          } else if (prop.rich_text) {
            return prop.rich_text.some((t: any) => t.plain_text.toLowerCase().includes(term));
          } else if (prop.select && prop.select.name) {
            return prop.select.name.toLowerCase().includes(term);
          } else if (prop.multi_select) {
            return prop.multi_select.some((s: any) => s.name.toLowerCase().includes(term));
          } else if (prop.name) {
            return prop.name.toLowerCase().includes(term);
          }
          return false;
        });
      });
      setFilteredRecords(filtered);
    }
  }, [searchTerm, records]);

  const fetchRecords = async () => {
    if (!notionClient) return;
    
    setIsLoading(true);
    try {
      const results = await notionClient.queryDatabase();
      setRecords(results);
      setFilteredRecords(results);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecord = () => {
    const initialProperties: Record<string, any> = {};
    if (dbStructure) {
      dbStructure.properties.forEach(prop => {
        initialProperties[prop.id] = "";
      });
    }
    setSelectedProperties(initialProperties);
    setIsCreating(true);
  };

  const handleEditRecord = (record: NotionRecord) => {
    setSelectedRecord(record);
    
    const editableProps: Record<string, any> = {};
    Object.entries(record.properties).forEach(([key, value]) => {
      if (value.title) {
        editableProps[key] = value.title.map((t: any) => t.plain_text).join("");
      } else if (value.rich_text) {
        editableProps[key] = value.rich_text.map((t: any) => t.plain_text).join("");
      } else if (value.select && value.select.name) {
        editableProps[key] = value.select.name;
      } else if (value.checkbox !== undefined) {
        editableProps[key] = value.checkbox;
      } else if (value.number !== undefined) {
        editableProps[key] = value.number;
      } else if (value.multi_select) {
        editableProps[key] = value.multi_select.map((s: any) => s.name);
      } else {
        editableProps[key] = "";
      }
    });
    
    setSelectedProperties(editableProps);
    setIsEditing(true);
  };

  const handleDeleteRecord = async (record: NotionRecord) => {
    if (!notionClient || !window.confirm(t("confirm-delete"))) return;
    
    setIsLoading(true);
    try {
      await notionClient.updatePage(record.id, { archived: true });
      await fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePropertyChange = (propertyId: string, value: any) => {
    setSelectedProperties(prev => ({
      ...prev,
      [propertyId]: value
    }));
  };

  const handleSubmitCreate = async () => {
    if (!notionClient) return;
    
    setIsLoading(true);
    try {
      const formattedProperties: Record<string, any> = {};
      
      Object.entries(selectedProperties).forEach(([key, value]) => {
        const propType = dbStructure?.properties.find(p => p.id === key)?.type;
        
        if (propType === "title" || propType === "rich_text") {
          formattedProperties[key] = {
            [propType]: [{ text: { content: value.toString() } }]
          };
        } else if (propType === "select") {
          formattedProperties[key] = {
            select: { name: value }
          };
        } else if (propType === "status") {
          formattedProperties[key] = {
            status: { name: value }
          };
        } else if (propType === "multi_select") {
          formattedProperties[key] = {
            multi_select: Array.isArray(value)
              ? value.map(name => ({ name }))
              : [{ name: value }]
          };
        } else if (propType === "checkbox") {
          formattedProperties[key] = {
            checkbox: Boolean(value)
          };
        } else if (propType === "number") {
          formattedProperties[key] = {
            number: Number(value)
          };
        }
      });
      
      await notionClient.createPage(formattedProperties);
      setIsCreating(false);
      await fetchRecords();
    } catch (error) {
      console.error("Error creating record:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!notionClient || !selectedRecord) return;
    
    setIsLoading(true);
    try {
      const formattedProperties: Record<string, any> = {};
      
      Object.entries(selectedProperties).forEach(([key, value]) => {
        const propType = dbStructure?.properties.find(p => p.id === key)?.type;
        
        if (propType === "title" || propType === "rich_text") {
          formattedProperties[key] = {
            [propType]: [{ text: { content: value.toString() } }]
          };
        } else if (propType === "select") {
          formattedProperties[key] = {
            select: { name: value }
          };
        } else if (propType === "status") {
          formattedProperties[key] = {
            status: { name: value }
          };
        } else if (propType === "multi_select") {
          formattedProperties[key] = {
            multi_select: Array.isArray(value)
              ? value.map(name => ({ name }))
              : [{ name: value }]
          };
        } else if (propType === "checkbox") {
          formattedProperties[key] = {
            checkbox: Boolean(value)
          };
        } else if (propType === "number") {
          formattedProperties[key] = {
            number: Number(value)
          };
        }
      });
      
      await notionClient.updatePage(selectedRecord.id, formattedProperties);
      setIsEditing(false);
      setSelectedRecord(null);
      await fetchRecords();
    } catch (error) {
      console.error("Error updating record:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <ScrollArea className="flex-1 flex flex-col h-full">
      <div className="w-full space-y-4">
        <div className="flex items-center space-x-2">
          <Search className="text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t("search-records")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            {t("no-records-found")}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="p-3 border rounded-md hover:bg-accent flex justify-between items-center"
              >
                <div>
                  {Object.entries(record.properties).map(([key, value]) => {
                    if (value.title && value.title.length > 0) {
                      return (
                        <h3 key={key} className="font-medium">
                          {value.title.map((t: any) => t.plain_text).join("")}
                        </h3>
                      );
                    }
                    return null;
                  })}
                  
                  <div className="mt-2 text-sm text-muted-foreground">
                    {Object.entries(record.properties)
                      .filter(([_, value]) => !value.title)
                      .slice(0, 3)
                      .map(([key, value]) => {
                        const propName = dbStructure?.properties.find(p => p.id === key)?.name || key;
                        let displayValue = "";
                        
                        if (value.rich_text && value.rich_text.length > 0) {
                          displayValue = value.rich_text.map((t: any) => t.plain_text).join("");
                        } else if (value.select && value.select.name) {
                          displayValue = value.select.name;
                        } else if (value.status && value.status.name) {
                          displayValue = value.status.name;
                        } else if (value.checkbox !== undefined) {
                          displayValue = value.checkbox ? "Yes" : "No";
                        } else if (value.number !== undefined) {
                          displayValue = value.number.toString();
                        } else if (value.multi_select) {
                          displayValue = value.multi_select.map((s: any) => s.name).join(", ");
                        } else if (value.date) {
                          displayValue = value.date.start;
                        }
                        
                        if (displayValue) {
                          return (
                            <div key={key} className="flex justify-between">
                              <span>{propName}:</span>
                              <span>{displayValue}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditRecord(record)}
                    disabled={isLoading || isApiProcessing}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRecord(record)}
                    disabled={isLoading || isApiProcessing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        
        
      </div>
    </ScrollArea>
  );
}
