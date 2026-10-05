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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FileFormat = {
  CSV: "CSV",
  JSON: "JSON",
  TXT: "TXT",
  HTML: "HTML",
  MARKDOWN: "MARKDOWN",
} as const;

export type FileFormatType = keyof typeof FileFormat;

const fileFormatOptions = [
  { value: "CSV", label: "CSV (.csv) - Spreadsheets & Tables", ext: ".csv" },
  { value: "JSON", label: "JSON (.json) - Structured Data", ext: ".json" },
  { value: "TXT", label: "Plain Text (.txt) - Text & Notes", ext: ".txt" },
  { value: "MARKDOWN", label: "Markdown (.md) - Formatted Docs", ext: ".md" },
  { value: "HTML", label: "HTML (.html) - Web Pages & Reports", ext: ".html" },
];

const formSchema = z.object({
  variableName: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, { 
      message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
    }),
  format: z.enum(["CSV", "JSON", "TXT", "HTML", "MARKDOWN"]),
  filename: z.string().min(1, "Filename is required"),
  content: z.string().min(1, "File content is required"),
});

export type FileGeneratorFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: Partial<FileGeneratorFormValues>;
}

export const FileGeneratorDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "myFile",
      format: (defaultValues.format as FileFormatType) || "CSV",
      filename: defaultValues.filename || "export.csv",
      content: defaultValues.content || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "myFile",
        format: (defaultValues.format as FileFormatType) || "CSV",
        filename: defaultValues.filename || "export.csv",
        content: defaultValues.content || "",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "myFile";
  const watchFormat = form.watch("format") || "CSV";

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const getPlaceholder = (format: string) => {
    switch (format) {
      case "CSV":
        return "{{json studentList}}\n\n# Or comma-separated headers & rows:\nName,Email,Attendance\n{{googleForm.name}},{{googleForm.email}},{{googleForm.attendance}}";
      case "JSON":
        return '{{json myGemini}}\n\n# Or raw JSON:\n{\n  "status": "success",\n  "result": "{{myGemini.text}}"\n}';
      case "HTML":
        return "<h1>Report for {{googleForm.name}}</h1>\n<p>{{myGemini.text}}</p>";
      case "MARKDOWN":
        return "# Attendance Summary\n\n- **Student:** {{googleForm.name}}\n- **Score:** {{googleForm.attendance}}%\n\n### AI Review\n{{myGemini.text}}";
      case "TXT":
      default:
        return "Export content:\n{{myGemini.text}}";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File Generator Configuration</DialogTitle>
          <DialogDescription>
            Generate and format files (CSV, JSON, Markdown, HTML, TXT) from workflow data.
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
                      placeholder="myFile"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Reference the generated file in downstream nodes:{" "}
                    {`{{${watchVariableName}.filename}}`} or {`{{${watchVariableName}.content}}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Export Format</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Auto-update filename extension if standard
                      const currentFilename = form.getValues("filename");
                      const extMap: Record<string, string> = {
                        CSV: ".csv",
                        JSON: ".json",
                        TXT: ".txt",
                        MARKDOWN: ".md",
                        HTML: ".html",
                      };
                      const newExt = extMap[val] || ".txt";
                      if (currentFilename && !currentFilename.includes("{{")) {
                        const base = currentFilename.replace(/\.[^/.]+$/, "");
                        form.setValue("filename", `${base}${newExt}`);
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select file format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fileFormatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name="filename"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filename</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="report.csv"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Supports Handlebars templating (e.g. &apos;report_{"{{googleForm.name}}"}.csv&apos;)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Content Template</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={getPlaceholder(watchFormat)}
                      className="min-h-[140px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Input data or template. For CSV/JSON, you can pass arrays via {"{{json arrayVar}}"} or manual headers/rows.
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
