"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";
import { CredentialType } from "@/generated/prisma";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, { 
      message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().optional(),
  botToken: z.string().optional(),
  chatId: z.string().min(1, "Chat ID is required"),
  text: z.string().min(1, "Message text is required"),
  parseMode: z.enum(["HTML", "Markdown", "None"]),
});

export type TelegramFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: Partial<TelegramFormValues>;
}

export const TelegramDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const { 
    data: credentials,
    isLoading: isLoadingCredentials,
  } = useCredentialsByType(CredentialType.TELEGRAM);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "myTelegram",
      credentialId: defaultValues.credentialId || "",
      botToken: defaultValues.botToken || "",
      chatId: defaultValues.chatId || "",
      text: defaultValues.text || "",
      parseMode: defaultValues.parseMode || "HTML",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "myTelegram",
        credentialId: defaultValues.credentialId || "",
        botToken: defaultValues.botToken || "",
        chatId: defaultValues.chatId || "",
        text: defaultValues.text || "",
        parseMode: defaultValues.parseMode || "HTML",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myTelegram";

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Telegram Configuration</DialogTitle>
          <DialogDescription>
            Configure the Telegram bot message and recipient chat settings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 mt-2"
          >
            <FormField
              control={form.control}
              name="variableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="myTelegram"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the Telegram result in other nodes:{" "}
                    {`{{${watchVariableName}.messageId}}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credentialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram Bot Token (Credential)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={
                      isLoadingCredentials
                      || !credentials?.length
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={credentials?.length ? "Select a Telegram bot credential" : "No saved Telegram credentials"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {credentials?.map((credential) => (
                        <SelectItem
                          key={credential.id}
                          value={credential.id}
                        >
                          <div className="flex items-center gap-2">
                            <Image
                              src="/logos/telegram.svg"
                              alt="Telegram"
                              width={16}
                              height={16}
                            />
                            {credential.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select a saved Bot Token credential or provide one below.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!form.watch("credentialId") && (
              <FormField
                control={form.control}
                name="botToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direct Bot Token (Optional if Credential is used)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Get this token from @BotFather on Telegram.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="chatId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chat ID / Channel Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123456789 or @mychannel or {{googleForm.chatId}}"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Telegram Chat ID (e.g. &apos;987654321&apos;) or channel (@channel_name). Supports {"{{variables}}"}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parseMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formatting Mode</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select formatting mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HTML">HTML (&lt;b&gt;, &lt;i&gt;, &lt;code&gt;)</SelectItem>
                      <SelectItem value="Markdown">Markdown (*bold*, _italic_, `code`)</SelectItem>
                      <SelectItem value="None">Plain Text (No formatting)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hello <b>{{googleForm.name}}</b>!\n\nHere is your update:\n{{cook.text}}"
                      className="min-h-[140px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Message to send. Supports Handlebars variables like {"{{googleForm.name}}"} or {"{{json variable}}"}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-4">
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
