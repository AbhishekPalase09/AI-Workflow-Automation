"use client"

import {zodResolver} from "@hookform/resolvers/zod"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {useForm} from "react-hook-form"
import { toast } from "sonner"
import {z} from "zod"
import { Button } from "@/components/ui/button"
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card"
import {Form,FormControl,FormField,FormItem,FormLabel,FormMessage} from "@/components/ui/form"
import { email } from "better-auth"
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"

const loginSchema = z.object({
    email: z.string().email("Please enter valid email"),
    password: z.string().min(1,"Password is required")
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm(){
    const router = useRouter()
    const form = useForm<LoginFormValues>({
        resolver:zodResolver(loginSchema),
        defaultValues:{
            email:"",
            password:""
        }
    })
 
    const onsubmit = async (values:LoginFormValues) =>{
        await authClient.signIn.email(
            {
                email: values.email,
                password: values.password,
                callbackURL: "/",
            },
            {
                onSuccess: () => {
                    router.push("/");
                },
                onError: (ctx) => {
                    toast.error(ctx.error.message);
                },
            }
        )
    }

    const isPending  = form.formState.isSubmitting

    return(
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="text-center">
                    <CardTitle>Welcome back</CardTitle>
                    <CardDescription>Login to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onsubmit)}>
                            <div className="grid-gap-6">
                                <div className="flex flex-col gap-4">
                                        <Button
                                            variant={"outline"}
                                            className="w-full"
                                            type="button"
                                            disabled={isPending}
                                        >
                                            <Image alt="Github" src="/logos/github.svg" 
                                            width={20} height={20}/>
                                            Continue with Github</Button>
                                        <Button
                                            variant={"outline"}
                                            className="w-full"
                                            type="button"
                                            disabled={isPending}
                                        >
                                            <Image alt="Google" src="/logos/google.svg" 
                                            width={20} height={20}/>
                                            Continue with Google</Button>
                                </div>
                                <div className="grid gap-6">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({field})=>(
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="email"
                                                        placeholder="m@example.com"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({field})=>(
                                            <FormItem>
                                                <FormLabel>Password</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        placeholder="********"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={isPending}>
                                        Login
                                    </Button>
                                </div>
                                <div className="mt-4 text-center text-sm">
                                        Don&apos;t have an Account?{" "}
                                        <Link href="/signup" className="underline underline-offset-4">
                                         Signup
                                         </Link>
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}