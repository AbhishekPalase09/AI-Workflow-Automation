"use client";
// requireAuth();
import { requireAuth } from "@/lib/auth-utils";
import { caller } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";


const Page =  () => {
  // requireAuth();
  const trpc=useTRPC();
  const queryClient=useQueryClient();
  
  const { data }=useQuery(trpc.getWorkflows.queryOptions());

  const testAi = useMutation(trpc.testAi.mutationOptions({
    onSuccess:()=>{
      toast.success("AI Job queued");
    }
  }));



  const create=useMutation(trpc.createWorkflow.
    mutationOptions({
      onSuccess:()=>{
        toast.success("Job queued");
      }
    }))
  return (
    <div  className="min-h-screen 
      min-w-screen flex items-center
      justify-center flex-col gap-y-6">
      
      
      Protected Server Component
      <div>
        {JSON.stringify(data ,null,2)}

      </div>
      <Button disabled={testAi.isPending} onClick={()=>testAi.mutate()}>
        Test AI
      </Button>
      <Button disabled={create.isPending} onClick={()=>create.mutate()}>
        Create Workflow
      </Button>
      <LogoutButton/>
       
    </div>
  );
};

export default Page;