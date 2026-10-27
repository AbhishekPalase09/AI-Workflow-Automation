"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
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

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
      message:
        "Variable name must start with a letter or underscore and container only letters, numbers, and underscores",
    }),
  endpoint: z.string().min(1, { message: "Please enter a valid URL" }),
  method: z.enum(["GET", "POST", "PATCH", "DELETE", "PUT"]),
  body: z.string().optional(),
  //.refine() TODO
});

export type HttpRequestFormValues = z.infer<typeof formSchema> & {
  sampleSchema?: unknown;
};

import { useState } from "react";
import {
  applyVariableQuickFix,
  FieldDiagnostics,
} from "@/features/editor/components/field-diagnostics";
import { useSyncDraftNode } from "@/features/editor/hooks/use-flow-diagnostics";
import { inferSchema } from "@/features/flowcheck";

interface Props {
  nodeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: HttpRequestFormValues) => void;
  defaultValues?: Partial<HttpRequestFormValues>;
}

export const HttpRequestDialog = ({
  nodeId,
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const [sampleSchema, setSampleSchema] = useState<unknown>(
    defaultValues.sampleSchema,
  );
  const [sampleJsonText, setSampleJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showSampleSection, setShowSampleSection] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "",
      endpoint: defaultValues.endpoint || "",
      method: defaultValues.method || "GET",
      body: defaultValues.body || "",
    },
  });

  // Keep Flowcheck static analysis reactively updated from draft values and sampleSchema
  useSyncDraftNode(nodeId, { ...form.watch(), sampleSchema }, open);

  //reset form values when dialog opens with new default
  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "",
        endpoint: defaultValues.endpoint || "",
        method: defaultValues.method || "GET",
        body: defaultValues.body || "",
      });
      setSampleSchema(defaultValues.sampleSchema);
      setSampleJsonText("");
      setJsonError(null);
      setShowSampleSection(false);
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myApiCall";
  const watchMethod = form.watch("method");
  const showBodyField = ["POST", "PUT", "PATCH"].includes(watchMethod);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit({
      ...values,
      sampleSchema,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Http Request</DialogTitle>
          <DialogDescription>
            Configure the settings for Http Request node
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8 mt-4"
          >
            <FormField
              control={form.control}
              name="variableName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input placeholder="myApiCall" {...field} />
                  </FormControl>
                  <FormDescription>
                    Use this name to reference the result in other nodes:{" "}
                    {`{{${watchVariableName}.httpResponse.data}}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The HTTP method to use for this request
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://api.example.com/users/{{httpResponse.data.id}}"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Static URL or use {"{{variables}}"} for simple values or{" "}
                    {"{{json variable}}"} to stringify objects{" "}
                  </FormDescription>
                  <FormMessage />
                  <FieldDiagnostics
                    nodeId={nodeId || ""}
                    field="endpoint"
                    value={field.value}
                    onSelectPath={(val) => form.setValue("endpoint", val)}
                    onApplyQuickFix={(sug) =>
                      form.setValue(
                        "endpoint",
                        applyVariableQuickFix(form.getValues("endpoint"), sug),
                      )
                    }
                  />
                </FormItem>
              )}
            />
            {showBodyField && (
              <FormField
                name="body"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Body</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          '{\n "userId": "{{ httpResponse.data.id }}",\n "name": "{{ httpResponse.data.name }}",\n  "items": "{{ httpResponse.data.items }}"\n}'
                        }
                        className="min-h-[120px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON for template variables. Use {"{{variables}}"} for
                      simple values or {"{{json variable}}"} to stringify
                      objects{" "}
                    </FormDescription>
                    <FormMessage />
                    <FieldDiagnostics
                      nodeId={nodeId || ""}
                      field="body"
                      value={field.value}
                      onSelectPath={(val) => form.setValue("body", val)}
                      onApplyQuickFix={(sug) =>
                        form.setValue(
                          "body",
                          applyVariableQuickFix(form.getValues("body"), sug),
                        )
                      }
                    />
                  </FormItem>
                )}
              />
            )}
            {/* Response Data Schema Refinement Section (Phase 7) */}
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">
                    Response Data Schema
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {sampleSchema
                      ? "Custom schema inferred. Downstream nodes can autocomplete and validate response properties."
                      : "No schema configured. Properties degrade to unverified."}
                  </p>
                </div>
                {sampleSchema ? (
                  <button
                    type="button"
                    onClick={() => setSampleSchema(undefined)}
                    className="text-xs px-2 py-1 text-destructive hover:bg-destructive/10 border border-destructive/20 rounded font-medium transition-colors"
                  >
                    Clear schema
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSampleSection(!showSampleSection)}
                    className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 border rounded font-medium transition-colors"
                  >
                    {showSampleSection ? "Hide" : "Paste sample JSON"}
                  </button>
                )}
              </div>

              {(showSampleSection || !sampleSchema) && showSampleSection && (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder='{"id": 1, "name": "Alice", "email": "alice@example.com"}'
                    value={sampleJsonText}
                    onChange={(e) => {
                      setSampleJsonText(e.target.value);
                      setJsonError(null);
                    }}
                    className="min-h-[80px] font-mono text-xs"
                  />
                  {jsonError && (
                    <p className="text-xs text-destructive">{jsonError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(sampleJsonText);
                        const inferred = inferSchema(parsed);
                        setSampleSchema(inferred);
                        setJsonError(null);
                        setShowSampleSection(false);
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error ? err.message : "Invalid JSON";
                        setJsonError(`Invalid JSON: ${msg}`);
                      }
                    }}
                    disabled={!sampleJsonText.trim()}
                    className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
                  >
                    Infer Schema
                  </button>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <button
                type="submit"
                data-slot="button"
                data-variant="default"
                data-size="sm"
                className="inline-flex shrink-0 items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1.5 rounded-md px-3 has-[&gt;svg]:px-2.5"
              >
                Save
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
