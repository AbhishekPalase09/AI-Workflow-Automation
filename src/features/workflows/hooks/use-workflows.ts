"use client";
import { useTRPC } from "@/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner";
import { useWorkflowsParams } from "./use-workflows-params";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/unstable-core-do-not-import";

export const useSuspenseWorkflows = () =>{

    const trpc = useTRPC()
    const [params]= useWorkflowsParams();

    return useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
}

export const useCreateWorkflows = () =>{
    const queryClient = useQueryClient()
    const trpc = useTRPC()

    return useMutation(
        trpc.workflows.create.mutationOptions({
            onSuccess:(data) => {
                toast.success(`Workflow ${data.name} created`)
                queryClient.invalidateQueries(
                    trpc.workflows.getMany.queryOptions({}),
                );
            },
            onError: (error) =>{
                toast.error(`Failed to create workflow: ${error.message}`)
            }
        })
    )
}

export const useRemoveWrokflow = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    return useMutation(
        trpc.workflows.remove.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" removed`);
                queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions
                    ({})
                );
                queryClient.invalidateQueries(
                    trpc.workflows.getOne.queryFilter({ id: data.id }),
                );
            }
        })
    )
}