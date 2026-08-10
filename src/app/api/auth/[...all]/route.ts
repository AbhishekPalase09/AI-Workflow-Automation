import { auth } from "@/lib/auth"; //Path to auth file
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);