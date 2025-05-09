import React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

interface InfoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  titleKey: string;
  content: React.ReactNode;
  buttonKey?: string;
}

export function InfoModal({
  isOpen,
  onOpenChange,
  titleKey,
  content,
  buttonKey = "close-button",
}: InfoModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
} 