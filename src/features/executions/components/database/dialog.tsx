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
  connectionString: z.string().optional(),
  query: z.string().min(1, "SQL query is required"),
  ssl: z.enum(["require", "disable"]),//HERE I AM
});

export type DatabaseFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DatabaseFormValues) => void;
  defaultValues?: Partial<DatabaseFormValues>;
}

export const DatabaseDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const { 
    data: credentials,
    isLoading: isLoadingCredentials,
  } = useCredentialsByType(CredentialType.DATABASE);

  const form = useForm<DatabaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variableName: defaultValues.variableName || "db",
      credentialId: defaultValues.credentialId || "",
      connectionString: defaultValues.connectionString || "",
      query: defaultValues.query || "SELECT * FROM users LIMIT 10;",
      ssl: defaultValues.ssl || "require",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variableName: defaultValues.variableName || "db",
        credentialId: defaultValues.credentialId || "",
        connectionString: defaultValues.connectionString || "",
        query: defaultValues.query || "SELECT * FROM users LIMIT 10;",
        ssl: defaultValues.ssl || "require",
      });
    }
  }, [open, defaultValues, form]);

  const watchVariableName = form.watch("variableName") || "db";

  const handleSubmit = (values: DatabaseFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Database (PostgreSQL) Configuration</DialogTitle>
          <DialogDescription>
            Execute SQL queries on any PostgreSQL database (Neon, Supabase, AWS RDS, Render, self-hosted, etc.).
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
                      placeholder="db"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Reference query output in other nodes:{" "}
                    <code>{`{{${watchVariableName}.rows}}`}</code>,{" "}
                    <code>{`{{${watchVariableName}.rowCount}}`}</code>, or{" "}
                    <code>{`{{${watchVariableName}.firstRow.id}}`}</code>
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
                  <FormLabel>Database Credential</FormLabel>
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
                        <SelectValue placeholder={credentials?.length ? "Select a saved Database credential" : "No saved Database credentials"} />
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
                              src="/logos/database.svg"
                              alt="Database"
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
                    Select a saved connection string credential or provide one below.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!form.watch("credentialId") && (
              <FormField
                control={form.control}
                name="connectionString"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection URL (Postgres)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="postgresql://username:password@host:5432/dbname?sslmode=require"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Postgres connection URI. Supports Handlebars variables like <code>{`{{env.DB_URL}}`}</code>.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="ssl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SSL Mode</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select SSL mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="require">Require SSL (Cloud DBs: Neon, Supabase, RDS)</SelectItem>
                      <SelectItem value="disable">Disable SSL (Localhost / Docker)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Recommended: <b>Require SSL</b> for Neon, Supabase, Timescale, Render, and AWS RDS.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SQL Query</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="SELECT * FROM students WHERE attendance < {{googleForm.responses.Attendance}};"
                      className="min-h-[160px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Supports standard SQL (<code>SELECT</code>, <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>) with Handlebars variables like <code>{`{{googleForm.name}}`}</code>.
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
