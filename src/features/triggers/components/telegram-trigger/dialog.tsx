"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyIcon, CheckCircle2Icon, Loader2Icon, SendIcon, SaveIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";
import { CredentialType } from "@/generated/prisma";
import Image from "next/image";
import { setTelegramWebhookAction } from "./actions";

export type TelegramTriggerFormValues = {
  command?: string;
  credentialId?: string;
  botToken?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (values: TelegramTriggerFormValues) => void;
  defaultValues?: Partial<TelegramTriggerFormValues>;
}

export const TelegramTriggerDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const params = useParams();
  const workflowId = params.workflowId as string;

  const [command, setCommand] = useState(defaultValues.command || "");
  const [botToken, setBotToken] = useState(defaultValues.botToken || "");
  const [selectedCredentialId, setSelectedCredentialId] = useState(
    defaultValues.credentialId || "",
  );
  const [isRegistering, setIsRegistering] = useState(false);

  const { data: credentials, isLoading: isLoadingCredentials } =
    useCredentialsByType(CredentialType.TELEGRAM);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const webhookUrl = `${baseUrl}/api/webhooks/telegram?workflowId=${workflowId}`;

  useEffect(() => {
    if (open) {
      setCommand(defaultValues.command || "");
      setBotToken(defaultValues.botToken || "");
      setSelectedCredentialId(defaultValues.credentialId || "");
    }
  }, [open, defaultValues]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleSaveOnly = () => {
    onSubmit?.({
      command: command.trim(),
      credentialId: selectedCredentialId || undefined,
      botToken: botToken.trim() || undefined,
    });
    toast.success("Trigger configuration saved");
    onOpenChange(false);
  };

  const handleRegisterWebhook = async () => {
    if (!selectedCredentialId && !botToken.trim()) {
      toast.error("Please enter or select a Telegram Bot Token");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await setTelegramWebhookAction({
        botToken: botToken.trim() || undefined,
        credentialId: selectedCredentialId || undefined,
        webhookUrl,
      });

      if (res.success) {
        toast.success(res.message);
        onSubmit?.({
          command: command.trim(),
          credentialId: selectedCredentialId || undefined,
          botToken: botToken.trim() || undefined,
        });
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to set webhook");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image
              src="/logos/telegram.svg"
              alt="Telegram"
              width={20}
              height={20}
            />
            Telegram Trigger Configuration
          </DialogTitle>
          <DialogDescription>
            Triggers this workflow automatically when a user sends a message or command to your Telegram Bot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="command-filter">Trigger Command (Filter)</Label>
            <Input
              id="command-filter"
              placeholder="/summary"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Only trigger when the message starts with this command (e.g. <code>/summary</code>). 
              Leave blank to trigger on all messages. (Ignores <code>/start</code> when set to <code>/summary</code>).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={copyToClipboard}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Telegram sends updates to this endpoint whenever someone messages your bot.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <SendIcon className="size-4 text-primary" />
              1-Click Webhook Registration
            </h4>
            <p className="text-xs text-muted-foreground">
              Register this webhook URL directly with Telegram using your Bot Token.
            </p>

            {credentials && credentials.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Saved Telegram Credential</Label>
                <Select
                  value={selectedCredentialId}
                  onValueChange={(val) => {
                    setSelectedCredentialId(val);
                    setBotToken("");
                  }}
                  disabled={isLoadingCredentials}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select saved bot credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!selectedCredentialId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Or Direct Bot Token</Label>
                <Input
                  type="password"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            )}

            <Button
              type="button"
              className="w-full mt-2"
              onClick={handleRegisterWebhook}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Connecting to Telegram...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4 mr-2" />
                  Register Webhook with Telegram
                </>
              )}
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available Context Variables</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{telegram.text}}"}
                </code>{" "}
                - The message text received (e.g. &quot;/summary&quot;)
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{telegram.chatId}}"}
                </code>{" "}
                - The sender's Chat ID (use in Telegram Action to reply)
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{telegram.sender.name}}"}
                </code>{" "}
                - Sender's display name
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{telegram.sender.username}}"}
                </code>{" "}
                - Sender's @username
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{telegram.chatType}}"}
                </code>{" "}
                - Chat type (<code>private</code>, <code>group</code>, <code>channel</code>)
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono">
                  {"{{json telegram}}"}
                </code>{" "}
                - Full Telegram Update payload
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleSaveOnly}>
            <SaveIcon className="size-4 mr-2" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
