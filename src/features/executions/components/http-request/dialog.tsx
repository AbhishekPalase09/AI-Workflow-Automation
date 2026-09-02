"use client"

import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form,FormControl,FormDescription,FormField,FormItem,FormLabel,FormMessage } from "@/components/ui/form";
import {Input} from "@/components/ui/input"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {useForm } from "react-hook-form"
import { useEffect } from "react";
import { Button } from "@base-ui/react";

const formSchema = z.object({
    endpoint: z.string().url({ message: "Please enter a valid URL",}),
    method: z.enum(["GET" , "POST" ,"PATCH" , "DELETE" , "PUT"]),
    body: z.string().optional()
    //.refine() TODO
})

export type HttpRequestFormValues = z.infer<typeof formSchema>

interface Props{
    open: boolean;
    onOpenChange: (open:boolean) => void;
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    defaultValues?:Partial<HttpRequestFormValues>;
}

export const HttpRequestDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues={},
}: Props)=>{

    const form=useForm<z.infer<typeof formSchema>>({
        resolver:zodResolver(formSchema),
        defaultValues:{
            endpoint: defaultValues.endpoint || "",
            method: defaultValues.method || "GET",
            body: defaultValues.body || "",
        },
    });

    //reset form values when dialog opens with new default
    useEffect(() => {
        if (open) {
        form.reset({
            endpoint: defaultValues.endpoint || "",
            method: defaultValues.method || "GET",
            body: defaultValues.body || "",
        });
        }
    }, [open, defaultValues, form]);

    const watchMethod = form.watch("method")
    const showBodyField = ["POST","PUT","PATCH"].includes(watchMethod)

    const handleSubmit = (values: z.infer<typeof formSchema>)=>{
        onSubmit(values);
        onOpenChange(false)
    }

    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Http Request</DialogTitle>
                    <DialogDescription>Configure the settings for Http Request node</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8 mt-4">
                        <FormField 
                            control={form.control}
                            name="method"
                            render={({field})=>(
                                <FormItem>
                                    <FormLabel>Method</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a method"/>
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
                                    <FormDescription>The HTTP method to use for this request</FormDescription>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />
                        <FormField 
                            control={form.control}
                            name="endpoint"
                            render={({field})=>(
                                <FormItem>
                                    <FormLabel>Endpoint URL</FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="https://api.example.com/users/{{httpResponse.data.id}}"
                                                {...field} 
                                            />
                                        </FormControl>
                                    <FormDescription>Static URL or use {"{{variables}}"} for simple values or {"{{json variable}}"} to stringify objects </FormDescription>
                                    <FormMessage/>
                                </FormItem>
                            )}
                        />
                        {showBodyField && (
                            <FormField name="body" control={form.control} render={({field})=>(
                                <FormItem>
                                    <FormLabel>Request Body</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder={'{\n "userId": "{{ httpResponse.data.id }}",\n "name": "{{ httpResponse.data.name }}",\n  "items": "{{ httpResponse.data.items }}"\n}' 
                                                }
                                                className="min-h-[120px] font-mono text-sm"
                                                {...field} 
                                            />
                                        </FormControl>
                                    <FormDescription>JSON for template variables. Use {"{{variables}}"} for simple values or {"{{json variable}}"} to stringify objects </FormDescription>
                                    <FormMessage/>
                                </FormItem>
                            )}
                            />
                        )}
                        <DialogFooter className="mt-4">
                            <button type="submit" data-slot="button" data-variant="default" data-size="sm" className="inline-flex shrink-0 items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&amp;_svg]:pointer-events-none [&amp;_svg]:shrink-0 [&amp;_svg:not([class*='size-'])]:size-4 bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1.5 rounded-md px-3 has-[&gt;svg]:px-2.5">
                            Save</button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}