import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { polarClient } from "./polar";

export const auth = betterAuth({
     database: prismaAdapter(prisma, {
        provider: "postgresql", 
    }),
    emailAndPassword:{
        enabled:true,
        autoSignIn:true,
    },

    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({ 
                    products: [
                        {
                            productId: "3936fb13-47f5-4196-ba0f-eb3442bb8664",
                            slug: "pro",
                        }
                    ],
                    successUrl: process.env.POLAR_SUCCESS_URL,
                    authenticatedUsersOnly: true,
                }),
                portal(),
                ...(process.env.POLAR_WEBHOOK_SECRET
                    ? [
                        webhooks({
                            secret: process.env.POLAR_WEBHOOK_SECRET,
                        }),
                      ]
                    : []),
            ],
        })
    ]
});
