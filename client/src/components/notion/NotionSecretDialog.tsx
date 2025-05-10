import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';
// import { supabase } from '@/lib/supabase'; // Assuming supabase client is set up
// import { User } from '@supabase/supabase-js'; // Assuming you might need user type

// Define LLMProvider type locally for this component or import if available globally
type LLMProvider = "openai" | "anthropic" | "gemini" | "openrouter";
const llmProviders: LLMProvider[] = ["openai", "anthropic", "gemini", "openrouter"];

interface NotionSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // onSecretSaved?: () => void; // Callback after secret is saved/updated
  // existingSecret?: { notionApiKey: string; notionDbId: string }; // To prefill if updating
}

export function NotionSecretDialog({ open, onOpenChange }: NotionSecretDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [showNotionApiKey, setShowNotionApiKey] = useState(false);
  const [showNotionDbId, setShowNotionDbId] = useState(false);

  // State for multiple LLM API keys
  const [llmApiKeys, setLlmApiKeys] = useState<Record<LLMProvider, string>>(
    llmProviders.reduce((acc, provider) => ({ ...acc, [provider]: '' }), {} as Record<LLMProvider, string>)
  );
  const [showLlmApiKeys, setShowLlmApiKeys] = useState<Record<LLMProvider, boolean>>(
    llmProviders.reduce((acc, provider) => ({ ...acc, [provider]: false }), {} as Record<LLMProvider, boolean>)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingSecret, setHasExistingSecret] = useState(false); // Placeholder

  // Placeholder: Fetch existing secret if user is logged in and has one
  useEffect(() => {
    if (open) {
      // const fetchSecret = async () => {
      //   // const { data: { user } } = await supabase.auth.getUser();
      //   // if (user) {
      //   //   // TODO: Fetch secret for this user from your backend
      //   //   // e.g., const { data, error } = await supabase.from('user_notion_secrets').select('*').eq('user_id', user.id).single();
      //   //   // if (data) {
      //   //   //   setNotionApiKey(data.notion_api_key);
      //   //   //   setNotionDbId(data.notion_db_id);
      //   //   //   // TODO: Fetch and set LLM API keys for each provider
      //   //   //   // e.g., setLlmApiKeys({ openai: data.openai_key, ... });
      //   //   //   setHasExistingSecret(true);
      //   //   // }
      //   // }
      // };
      // fetchSecret();
      // For now, let's assume no existing secret for UI dev
      setNotionApiKey('');
      setNotionDbId('');
      setLlmApiKeys(llmProviders.reduce((acc, provider) => ({ ...acc, [provider]: '' }), {} as Record<LLMProvider, string>));
      setHasExistingSecret(false);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // TODO: Implement save/update logic
      // const { data: { user } } = await supabase.auth.getUser();
      // if (!user) throw new Error('User not authenticated');
      // const secretData = { 
      //   user_id: user.id, 
      //   notion_api_key: notionApiKey, 
      //   notion_db_id: notionDbId,
      //   // Add LLM API keys to secretData
      //   openai_api_key: llmApiKeys.openai,
      //   anthropic_api_key: llmApiKeys.anthropic,
      //   gemini_api_key: llmApiKeys.gemini,
      //   openrouter_api_key: llmApiKeys.openrouter,
      // };
      // if (hasExistingSecret) {
      //   // Update
      //   // const { error } = await supabase.from('user_notion_secrets').update(secretData).eq('user_id', user.id);
      //   // if (error) throw error;
      // } else {
      //   // Insert
      //   // const { error } = await supabase.from('user_notion_secrets').insert(secretData);
      //   // if (error) throw error;
      // }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast({ title: t('secret-saved-title', { defaultValue: 'Connection Saved' }), description: t('secret-saved-desc', { defaultValue: 'Your Notion connection details have been saved.' }) });
      setHasExistingSecret(true);
      // onOpenChange(false); // Optionally close dialog on success
    } catch (err: any) {
      const errorMessage = err.message || t('secret-save-failed-default', { defaultValue: 'Failed to save connection details.' });
      setError(errorMessage);
      toast({ title: t('secret-save-failed-title', { defaultValue: 'Save Failed' }), description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      // TODO: Implement delete logic
      // const { data: { user } } = await supabase.auth.getUser();
      // if (!user) throw new Error('User not authenticated');
      // const { error } = await supabase.from('user_notion_secrets').delete().eq('user_id', user.id);
      // if (error) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast({ title: t('secret-deleted-title', { defaultValue: 'Connection Deleted' }), description: t('secret-deleted-desc', { defaultValue: 'Your Notion connection details have been removed.' }) });
      setNotionApiKey('');
      setNotionDbId('');
      setLlmApiKeys(llmProviders.reduce((acc, provider) => ({ ...acc, [provider]: '' }), {} as Record<LLMProvider, string>)); // Reset LLM keys
      setHasExistingSecret(false);
      // onOpenChange(false); // Optionally close dialog on success
    } catch (err: any) {
      const errorMessage = err.message || t('secret-delete-failed-default', { defaultValue: 'Failed to delete connection details.' });
      setError(errorMessage);
      toast({ title: t('secret-delete-failed-title', { defaultValue: 'Delete Failed' }), description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('manage-notion-connection-title', { defaultValue: 'Manage Notion Connection' })}</DialogTitle>
          <DialogDescription>
            {t('manage-notion-connection-desc', { defaultValue: 'Save or update your Notion API Key and Database ID. These will be stored securely.' })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="notion-api-key">{t('notion-integration-secret')}</Label>
            <div className="relative">
              <Input
                id="notion-api-key"
                type={showNotionApiKey ? 'text' : 'password'}
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                placeholder={t('enter-notion-integration-secret')}
                className="pr-10"
                disabled={isSaving || isDeleting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full"
                onClick={() => setShowNotionApiKey(!showNotionApiKey)}
                disabled={isSaving || isDeleting}
              >
                {showNotionApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notion-db-id">{t('notion-db-id')}</Label>
            <div className="relative">
              <Input
                id="notion-db-id"
                type={showNotionDbId ? 'text' : 'password'}
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                placeholder={t('enter-notion-db-id')}
                className="pr-10"
                disabled={isSaving || isDeleting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full"
                onClick={() => setShowNotionDbId(!showNotionDbId)}
                disabled={isSaving || isDeleting}
              >
                {showNotionDbId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* LLM API Key Inputs */}
          {llmProviders.map((provider) => (
            <div className="space-y-2" key={provider}>
              <Label htmlFor={`llm-api-key-${provider}`}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)} {t('llm-api-key-suffix', { defaultValue: 'API Key' })}
              </Label>
              <div className="relative">
                <Input
                  id={`llm-api-key-${provider}`}
                  type={showLlmApiKeys[provider] ? 'text' : 'password'}
                  value={llmApiKeys[provider]}
                  onChange={(e) => setLlmApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={t('enter-llm-api-key-placeholder', { provider: provider.charAt(0).toUpperCase() + provider.slice(1), defaultValue: `Enter ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key` })}
                  className="pr-10"
                  disabled={isSaving || isDeleting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full"
                  onClick={() => setShowLlmApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))}
                  disabled={isSaving || isDeleting}
                >
                  {showLlmApiKeys[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="sm:justify-between pt-4">
          <div>
            {hasExistingSecret && (
              <Button variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting} className="mr-2">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {t('delete-button', { defaultValue: 'Delete' })}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {/* <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving || isDeleting}>{t('cancel')}</Button>
            </DialogClose> */}
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={isSaving || isDeleting || !notionApiKey || !notionDbId /* Consider if LLM keys should also gate saving */}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null }
              {hasExistingSecret ? t('update') : t('save-button', { defaultValue: 'Save' })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}