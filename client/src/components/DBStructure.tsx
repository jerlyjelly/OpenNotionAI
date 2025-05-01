import { useTranslation } from "@/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseStructure, DatabaseProperty } from "@/lib/notion";
import React from "react";

interface DBStructureProps {
  dbStructure: DatabaseStructure;
}

export function DBStructure({ dbStructure }: DBStructureProps) {
  const { t } = useTranslation();

  if (!dbStructure) return null;

  return (
    <div className="mt-6 border-t pt-4 flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="border rounded-md overflow-hidden">
          {dbStructure.properties.map((prop) => (
            <div
              key={prop.id}
              className="flex justify-between items-center p-2 hover:bg-accent"
            >
              <span className="font-medium">{prop.name}</span>
              <div className="flex flex-wrap gap-1">
                {prop.options && prop.options.length > 0 ? (
                  prop.options.map((option, index) => (
                    <React.Fragment key={option.id}>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {option.name}
                      </span>
                      {index < prop.options!.length - 1 && <span className="text-xs text-muted-foreground">,</span>}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {prop.type}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
