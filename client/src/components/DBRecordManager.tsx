import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useApiContext } from "@/context/ApiContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        // Search in all property values
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
    // Initialize empty property values based on database structure
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
    
    // Extract editable property values
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
      // In Notion API, a page is "deleted" by archiving it
      await notionClient.updatePage(record.id, { archived: true });
      await fetchRecords(); // Refresh list
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
      // Format properties for Notion API
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
      await fetchRecords(); // Refresh list
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
      // Format properties for Notion API
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
      await fetchRecords(); // Refresh list
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
    // Remove the outer Tabs component wrapper
    <div className="w-full space-y-4">
      {/* Keep the search bar */}
      <div className="flex items-center space-x-2">
        <Search className="text-muted-foreground h-4 w-4" />
        <Input
              placeholder={t("search-records")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex justify-center items-center h-full text-muted-foreground">
                {t("no-records-found")}
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 border rounded-md hover:bg-accent"
                  >
                    {/* Display first title or rich_text property as main title */}
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
                    
                    {/* Display other important properties */}
                    <div className="mt-2 text-sm text-muted-foreground">
                      {Object.entries(record.properties)
                        .filter(([_, value]) => !value.title) // Skip title properties
                        .slice(0, 3) // Only show first 3 properties
                        .map(([key, value]) => {
                          const propName = dbStructure?.properties.find(p => p.id === key)?.name || key;
                          let displayValue = "";
                          
                          if (value.rich_text && value.rich_text.length > 0) {
                            displayValue = value.rich_text.map((t: any) => t.plain_text).join("");
                          } else if (value.select && value.select.name) {
                            displayValue = value.select.name;
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
                ))}
              </div>
            )}
          </ScrollArea>
      {/* Keep the "View" content's ScrollArea */}
      <ScrollArea className="h-[300px] rounded-md border">
        {/* ... (Keep the isLoading / no records / records list logic from the "view" tab) ... */}
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            {t("no-records-found")}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="p-3 border rounded-md hover:bg-accent"
              >
                {/* Display first title or rich_text property as main title */}
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
                
                {/* Display other important properties */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {Object.entries(record.properties)
                    .filter(([_, value]) => !value.title) // Skip title properties
                    .slice(0, 3) // Only show first 3 properties
                    .map(([key, value]) => {
                      const propName = dbStructure?.properties.find(p => p.id === key)?.name || key;
                      let displayValue = "";
                      
                      if (value.rich_text && value.rich_text.length > 0) {
                        displayValue = value.rich_text.map((t: any) => t.plain_text).join("");
                      } else if (value.select && value.select.name) {
                        displayValue = value.select.name;
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
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Keep the "Manage" section header and button */}
      <div className="flex justify-between items-center pt-4">
        <h3 className="text-lg font-medium">{t("database-records")}</h3>
        <Button onClick={handleCreateRecord} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              {t("new-record")}
            </Button>
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : records.length === 0 ? (
              <div className="flex justify-center items-center h-full text-muted-foreground">
                {t("no-records")}
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 border rounded-md hover:bg-accent flex justify-between items-center"
                  >
                    <div>
                      {/* Display first title property as main title */}
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
                      
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.lastEditedTime).toLocaleString()}
                      </p>
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
          </ScrollArea>
      {/* Keep the "Manage" content's ScrollArea */}
      <ScrollArea className="h-[300px] rounded-md border">
        {/* ... (Keep the isLoading / no records / records list logic from the "manage" tab) ... */}
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            {t("no-records")}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="p-3 border rounded-md hover:bg-accent flex justify-between items-center"
              >
                <div>
                  {/* Display first title property as main title */}
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
                  
                  <p className="text-xs text-muted-foreground">
                    {new Date(record.lastEditedTime).toLocaleString()}
                  </p>
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
      </ScrollArea>
      
      {/* Keep the Create/Edit Record Dialog */}
      <Dialog open={isCreating || isEditing} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false);
          setIsEditing(false);
          setSelectedRecord(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? t("create-record") : t("edit-record")}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4 mt-2">
              {dbStructure && dbStructure.properties.map((prop) => {
                const propId = prop.id;
                const propName = prop.name;
                const propType = prop.type;
                const propValue = selectedProperties[propId] || "";
                
                // Skip system properties
                if (propName === "Created time" || propName === "Last edited time" || propName === "Created by" || propName === "Last edited by") {
                  return null;
                }
                
                return (
                  <div key={propId} className="space-y-2">
                    <label className="text-sm font-medium">{propName}</label>
                    
                    {propType === "title" || propType === "rich_text" ? (
                      <Input
                        value={propValue}
                        onChange={(e) => handlePropertyChange(propId, e.target.value)}
                        placeholder={`Enter ${propName}`}
                      />
                    ) : propType === "select" && prop.options ? (
                      <Select
                        value={String(propValue)}
                        onValueChange={(value) => handlePropertyChange(propId, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${propName}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {prop.options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.name}>
                              {opt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : propType === "checkbox" ? (
                      <Checkbox
                        checked={Boolean(propValue)}
                        onCheckedChange={(checked) => handlePropertyChange(propId, checked)}
                      />
                    ) : propType === "number" ? (
                      <Input
                        type="number"
                        value={propValue}
                        onChange={(e) => handlePropertyChange(propId, e.target.value)}
                        placeholder={`Enter ${propName}`}
                      />
                    ) : (
                      <Input
                        value={propValue}
                        onChange={(e) => handlePropertyChange(propId, e.target.value)}
                        placeholder={`Enter ${propName}`}
                        disabled={true}
                        className="text-muted-foreground"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreating(false);
              setIsEditing(false);
              setSelectedRecord(null);
            }}>
              {t("cancel")}
            </Button>
            <Button
              onClick={isCreating ? handleSubmitCreate : handleSubmitEdit}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isCreating ? t("create") : t("update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}