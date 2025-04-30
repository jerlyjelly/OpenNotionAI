import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useTranslation();

  // Check if the user has seen the onboarding modal before
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (hasSeenOnboarding) {
      setIsOpen(false);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("welcome-to-oss")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-muted-foreground">
          <p>{t("intro-1")}</p>
          <p>{t("intro-2")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("feature-1")}</li>
            <li>{t("feature-2")}</li>
            <li>{t("feature-3")}</li>
          </ul>
          <p>{t("intro-3")}</p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            {t("get-started")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
