'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ChevronDownIcon,
  GlobeIcon, // Using Globe for "Configured"
  WarningIcon, // Using Warning for "Not Configured"
  InfoIcon, // Assuming this icon exists in './icons'
} from './icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'; // For icon tooltip

const NOTION_TOKEN_LOCAL_STORAGE_KEY = 'notionIntegrationSecret';

export function NotionConnector({
  chatId,
  className,
  // initialIsConfigured, // True if Notion is considered configured for this chat initially
}: {
  chatId: string;
  // initialIsConfigured: boolean;
} & Omit<React.ComponentProps<typeof Button>, 'children'>) {
  const [open, setOpen] = useState(false);
  const [secretInputValue, setSecretInputValue] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(NOTION_TOKEN_LOCAL_STORAGE_KEY);
    if (storedToken) {
      setIsConfigured(true);
      // We don't set secretInputValue to the stored token for security.
      // The input field is for entering a new/updated token.
    } else {
      setIsConfigured(false);
      setSecretInputValue(''); // Clear input if no token is found
    }
  }, []);

  const handleSaveSecret = () => {
    if (secretInputValue.trim()) {
      localStorage.setItem(
        NOTION_TOKEN_LOCAL_STORAGE_KEY,
        secretInputValue.trim(),
      );
      console.log(
        `Saved Notion Integration Secret for chat ${chatId} to local storage.`,
      );
      setIsConfigured(true);
      // setSecretInputValue(''); // Optionally clear input after successful save
      setOpen(false);
    }
  };

  const handleSaveOnCloud = () => {
    // In a real application, this would trigger a cloud save mechanism.
    if (secretInputValue.trim()) {
      console.log(
        `Simulating save on cloud for Notion Integration Secret for chat ${chatId}: ${secretInputValue.substring(0, 5)}...`,
      );
      // setIsConfigured(true); // Assuming cloud save also means it's configured
      // setOpen(false); // Close dropdown after action
    }
  };

  const handleClearSecret = () => {
    localStorage.removeItem(NOTION_TOKEN_LOCAL_STORAGE_KEY);
    console.log(
      `Cleared Notion Integration Secret for chat ${chatId} from local storage.`,
    );
    setSecretInputValue('');
    setIsConfigured(false);
    // setOpen(false); // Optionally close dropdown, or keep open for new input
  };

  const buttonLabel = isConfigured ? 'Notion Connected' : 'Connect Notion';
  const buttonIcon = isConfigured ? <GlobeIcon /> : <WarningIcon />;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="notion-connector"
          variant="outline"
          // Apply h-[34px] only from md breakpoint upwards.
          // On smaller screens, height will be default, matching other buttons like "New Chat".
          className="flex items-center px-2 md:h-[34px]"
        >
          {buttonIcon}
          {buttonLabel}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="min-w-[320px] p-4 space-y-4"
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor={`notion-secret-input-${chatId}`}
              className="block text-sm font-medium text-foreground"
            >
              Notion Integration Secret
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://developers.notion.com/docs/create-a-notion-integration#getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Learn more about Notion Integration Secrets"
                >
                  <InfoIcon size={16} />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>How to get your Notion Integration Secret.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id={`notion-secret-input-${chatId}`}
            type="password"
            placeholder="Paste your secret here"
            value={secretInputValue}
            onChange={(e) => setSecretInputValue(e.target.value)}
            className="w-full"
          />
          {!isConfigured && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter your Notion integration token to connect this chat.
            </p>
          )}
          {isConfigured && secretInputValue && (
            <p className="text-xs text-orange-500 dark:text-orange-400 mt-1.5">
              {' '}
              {/* Using a warning color */}
              You are about to update the existing configuration.
            </p>
          )}
          {isConfigured && !secretInputValue && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Notion is configured. Enter a new secret to update.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-1">
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSecret}
              className="w-full sm:w-auto"
            >
              Disconnect
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveSecret}
            disabled={!secretInputValue.trim()}
            className="w-full sm:w-auto"
          >
            {isConfigured ? 'Update Secret' : 'Save Secret'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveOnCloud}
            disabled={!secretInputValue.trim()}
            className="w-full sm:w-auto"
          >
            Save on Cloud
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Your integration secret is handled securely.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
