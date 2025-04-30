import { useTranslation } from "@/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseStructure } from "@/lib/notion";

interface DBStructureProps {
  dbStructure: DatabaseStructure;
}

export function DBStructure({ dbStructure }: DBStructureProps) {
  const { t } = useTranslation();

  if (!dbStructure) return null;

  return (
    <div className="mt-6 border-t pt-4 flex-1 flex flex-col overflow-hidden">
      <h3 className="text-lg font-medium mb-2">{t("db-structure")}</h3>
      <ScrollArea className="flex-1">
        <div className="border rounded-md overflow-hidden">
          {dbStructure.properties.map((prop) => (
            <div
              key={prop.id}
              className="flex justify-between items-center p-2 hover:bg-accent"
            >
              <span className="font-medium">{prop.name}</span>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                {prop.type}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
