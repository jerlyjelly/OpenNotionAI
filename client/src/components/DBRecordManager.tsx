import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
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
    isProcessing: isApiProcessing,
    refreshData, // Use correct renamed function from context
    isRefreshing, // Use correct renamed state from context
    records, // Use records from context
    isRecordsLoading, // Use loading state from context
    recordsError, // Use error state from context
  } = useApiContext();

  // Local state for filtering, UI interaction, and editing
  const [filteredRecords, setFilteredRecords] = useState<NotionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<NotionRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false); // Keep for modal state
  const [isEditing, setIsEditing] = useState(false); // Keep for modal state
  const [selectedProperties, setSelectedProperties] = useState<Record<string, any>>({}); // Keep for edit/create form
  const [isSubmitting, setIsSubmitting] = useState(false); // Local state for create/edit submission

  // Update filtered records when context records or search term change
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredRecords(records); // Use records from context
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = records.filter(record => { // Use records from context
        // ... (filtering logic remains the same)
        return Object.values(record.properties).some(prop => {
          if (prop.title) {
            return prop.title.some((t: any) => t.plain_text.toLowerCase().includes(term));
          } else if (prop.rich_text) {
            return prop.rich_text.some((t: any) => t.plain_text.toLowerCase().includes(term));
          } else if (prop.select && prop.select.name) {
            return prop.select.name.toLowerCase().includes(term);
          } else if (prop.multi_select) {
            return prop.multi_select.some((s: any) => s.name.toLowerCase().includes(term));
          } else if (prop.name) { // Assuming 'name' might be another property type
            return prop.name.toLowerCase().includes(term);
          }
          return false;
        });
      });
      setFilteredRecords(filtered);
    }
  }, [searchTerm, records]); // Depend on context records

  // No need for fetchRecords function or related useEffects anymore

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

  // Need to trigger context refresh after delete
  const handleDeleteRecord = async (record: NotionRecord) => {
    if (!notionClient || !window.confirm(t("confirm-delete"))) return;

    setIsSubmitting(true); // Use local submitting state for this action
    try {
      await notionClient.updatePage(record.id, { archived: true });
      await refreshData(); // Refresh data from context after delete
    } catch (error) {
      console.error("Error deleting record:", error);
      // TODO: Add toast notification for delete error?
      // Add toast notification for delete error?
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePropertyChange = (propertyId: string, value: any) => {
    setSelectedProperties(prev => ({
      ...prev,
      [propertyId]: value
    }));
  };

  // Need to trigger context refresh after create
  const handleSubmitCreate = async () => {
    if (!notionClient) return;

    setIsSubmitting(true);
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
      await refreshData(); // Refresh data from context after create
    } catch (error) {
      console.error("Error creating record:", error);
      // TODO: Add toast notification for create error?
      // Add toast notification for create error?
    } finally {
      setIsSubmitting(false);
    }
  };

  // Need to trigger context refresh after edit
  const handleSubmitEdit = async () => {
    if (!notionClient || !selectedRecord) return;

    setIsSubmitting(true);
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
      await refreshData(); // Refresh data from context after edit
    } catch (error) {
      console.error("Error updating record:", error);
      // TODO: Add toast notification for edit error?
      // Add toast notification for edit error?
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  // Render based on context loading/error states
  return (
    <ScrollArea className="flex-1 flex flex-col h-full">
      <div className="w-full space-y-4">
        {/* Search and Refresh Row - Show even while loading records initially? Maybe hide input? */}
        <div className="flex items-center space-x-2">
          <Search className="text-muted-foreground h-4 w-4" />
          <Input
              placeholder={t("search-records")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshData} // Use renamed function
                    disabled={isRefreshing || isApiProcessing || isRecordsLoading || isSubmitting} // Disable during context refresh, API processing, record loading, or local submissions
                    aria-label={t("refresh-database")}
                  >
                    {isRefreshing ? ( // Show spinner during context refresh
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("refresh-database")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          {/* This closing div was misplaced in the previous attempt */}
        </div>

        {/* Loading State */}
        {isRecordsLoading && !isRefreshing && ( // Show initial loading spinner, but not if manual refresh is happening
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {!isRecordsLoading && recordsError && (
          <div className="flex justify-center items-center h-40 text-destructive">
            {t("error-loading-records")}: {recordsError} 
          </div>
        )}

        {/* No Records State */}
        {!isRecordsLoading && !recordsError && records.length === 0 && (
           <div className="flex justify-center items-center h-40 text-muted-foreground">
             {t("no-records-found")}
           </div>
        )}

        {/* Records List - Use filteredRecords derived from context records */}
        {!isRecordsLoading && !recordsError && records.length > 0 && (
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
                          try {
                            displayValue = format(new Date(value.date.start), 'yyyy-MM-dd HH:mm');
                          } catch (e) {
                            console.error("Error formatting date:", e, value.date.start);
                            displayValue = value.date.start; // Fallback to original if formatting fails
                          }
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
                
                {/* <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditRecord(record)}
                    disabled={isRefreshing || isApiProcessing || isRecordsLoading || isSubmitting} // Disable during various loading states
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRecord(record)}
                    disabled={isRefreshing || isApiProcessing || isRecordsLoading || isSubmitting} // Disable during various loading states
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div> */}
              </div>
            ))}
          </div>
        )}

        
        
      </div>
    </ScrollArea>
  );
}
