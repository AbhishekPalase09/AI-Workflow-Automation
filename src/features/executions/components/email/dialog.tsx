"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCredentialsByType } from "@/features/credentials/hooks/use-credentials";
import { CredentialType } from "@/generated/prisma";

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
      message:
        "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  credentialId: z.string().optional(),
  from: z.string().min(1, "Sender email is required"),
  to: z.string().min(1, "Recipient email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body content is required"),
  attachmentVariableName: z.string().optional(),
});

export type EmailFormValues = z.infer<typeof formSchema>;

import {
  applyVariableQuickFix,
  FieldDiagnostics,
} from "@/features/editor/components/field-diagnostics";
import { useSyncDraftNode } from "@/features/editor/hooks/use-flow-diagnostics";

interface Props {
  nodeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: Partial<EmailFormValues>;
}

export const EmailDialog = ({
  nodeId,
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const { data: credentials, isLoading: isLoadingCredentials } =
    useCredentialsByType(CredentialType.RESEND);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "myEmail",
      credentialId: defaultValues.credentialId || "",
      from: defaultValues.from || "Acme <onboarding@resend.dev>",
      to: defaultValues.to || "",
      subject: defaultValues.subject || "",
      body: defaultValues.body || "",
      attachmentVariableName: defaultValues.attachmentVariableName || "",
    },
  });

  // Keep Flowcheck static analysis reactively updated from draft values while typing before Save
  useSyncDraftNode(nodeId, form.watch(), open);

  // Reset form values when dialog opens with new defaults
  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "myEmail",
        credentialId: defaultValues.credentialId || "",
        from: defaultValues.from || "Acme <onboarding@resend.dev>",
        to: defaultValues.to || "",
        subject: defaultValues.subject || "",
        body: defaultValues.body || "",
        attachmentVariableName: defaultValues.attachmentVariableName || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myEmail";

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email (Resend) Configuration</DialogTitle>
          <DialogDescription>
            Configure the email sending settings and template for this node.
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
                    <Input placeholder="myEmail" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the email result in other nodes:{" "}
                    {`{{${watchVariableName}.id}}`}
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
                  <FormLabel>
                    Resend Credential (Optional if RESEND_API_KEY is set)
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoadingCredentials || !credentials?.length}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            credentials?.length
                              ? "Select a Resend credential"
                              : "No saved Resend credentials (uses env key)"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {credentials?.map((credential) => (
                        <SelectItem key={credential.id} value={credential.id}>
                          <div className="flex items-center gap-2">
                            <Image
                              src="/logos/resend.svg"
                              alt="Resend"
                              width={16}
                              height={16}
                            />
                            {credential.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Acme <onboarding@resend.dev>"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Sender name and email (e.g. &apos;Support
                    &lt;support@yourdomain.com&gt;&apos; or
                    &apos;onboarding@resend.dev&apos;)
                  </FormDescription>
                  <FieldDiagnostics
                    nodeId={nodeId}
                    field="from"
                    value={field.value}
                    onSelectPath={(val) =>
                      form.setValue("from", val, { shouldValidate: true })
                    }
                    onQuickFix={(suggestion) => {
                      form.setValue(
                        "from",
                        applyVariableQuickFix(field.value || "", suggestion),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To (Recipient)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="{{googleForm.email}} or user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Recipient email address. You can use dynamic variables like{" "}
                    {"{{googleForm.email}}"}
                  </FormDescription>
                  <FieldDiagnostics
                    nodeId={nodeId}
                    field="to"
                    value={field.value}
                    onSelectPath={(val) =>
                      form.setValue("to", val, { shouldValidate: true })
                    }
                    onQuickFix={(suggestion) => {
                      form.setValue(
                        "to",
                        applyVariableQuickFix(field.value || "", suggestion),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Attendance Alert for {{googleForm.name}}"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Email subject line. Supports Handlebars variables.
                  </FormDescription>
                  <FieldDiagnostics
                    nodeId={nodeId}
                    field="subject"
                    value={field.value}
                    onSelectPath={(val) =>
                      form.setValue("subject", val, { shouldValidate: true })
                    }
                    onQuickFix={(suggestion) => {
                      form.setValue(
                        "subject",
                        applyVariableQuickFix(field.value || "", suggestion),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Body (HTML / Text)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="<p>Hi {{googleForm.name}},</p><p>Your current attendance is <strong>{{googleForm.attendance}}%</strong>.</p>"
                      className="min-h-[140px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Email body content. Supports HTML and {"{{variables}}"}.
                  </FormDescription>
                  <FieldDiagnostics
                    nodeId={nodeId}
                    field="body"
                    value={field.value}
                    onSelectPath={(val) =>
                      form.setValue("body", val, { shouldValidate: true })
                    }
                    onQuickFix={(suggestion) => {
                      form.setValue(
                        "body",
                        applyVariableQuickFix(field.value || "", suggestion),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attachmentVariableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Attachment Variable (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="myReport or {{myReport}}" {...field} />
                  </FormControl>
                  <FormDescription>
                    Variable name from a File Generator node (e.g.
                    &apos;myReport&apos;) to attach to this email.
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
