"use client"
import { boolean } from "better-auth";
import { formatDistanceToNow } from "date-fns";
import { useCreateWorkflows, useRemoveWrokflow, useSuspenseWorkflows } from "../hooks/use-workflows"
import { EntityItem, EntityList, EntityContainer, EntityHeader, EntityPagination, EntitySearch, LoadingView, ErrorView, EmptyView } from "@/components/entity-components";
import { error } from "console";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { useRouter } from "next/navigation";
import { useWorkflowsParams } from "../hooks/use-workflows-params";
import { useEntitySearch } from "@/hooks/use-entity-search";
import type { Workflow } from "@/generated/prisma";
import { WorkflowIcon } from "lucide-react";

export const WorkflowsSearch = () => {
      const [params, setParams] = useWorkflowsParams();
    
      const {searchValue , onSearchChange}= useEntitySearch({
        params,
        setParams
      })

    return(
        <EntitySearch
            value={searchValue}
            onChange={onSearchChange} 
            placeholder="Search workflows"


        />
    );
}

export const WorkflowsList = () =>{

    const workflows = useSuspenseWorkflows()
    
    return (
        <EntityList 
        items={workflows.data.items}
        getKey={(workflow) => workflow.id}
        renderItem={(workflow) => <WorkflowItem data={workflow} />}
        emptyView={<WorkflowsEmpty />}
        />
    )
};

export const WorkflowsHeader = ({disabled}: {disabled?:boolean})=>{

    const createWorkflow = useCreateWorkflows()
    const { handleError,modal } = useUpgradeModal()
    const router=useRouter()

    const handleCreate = ()=>{
        createWorkflow.mutate(undefined,{
            onSuccess: (data)=>{
                router.push(`/workflows/${data.id}`)
            },
            onError: (error) =>{
                handleError(error)
            }
        })
    }

    return(
        <>
            {modal}
            <EntityHeader
                title="Workflows"
                description="create and manage workflows"
                onNew={handleCreate}
                newButtonLabel="New Workflow"
                disabled={disabled}
                isCreating={createWorkflow.isPending}
            />
        </>
    )
}  

export const WorkflowsPagination = () => {
    const workflows = useSuspenseWorkflows();
    const [params, setParams] = useWorkflowsParams();

    return(
        <EntityPagination
            disabled={workflows.isFetching}
            totalPages={workflows.data.totalPages}
            page={workflows.data.page}
            onPageChange={(page) => setParams({ ...params, page })}

        />
    );
};



export const WorkflowsContainer = ({
    children
}:{
    children: React.ReactNode
})=>{
    return (
        <EntityContainer header={<WorkflowsHeader/>} search={<WorkflowsSearch />} pagination={<WorkflowsPagination/>} >
            {children}
        </EntityContainer>
    )
} 

export const WorkflowsLoading = () => {
    return <LoadingView message="Loading workflows..." />;
};

export const WorkflowsError = () => {
    return <ErrorView message="Error loading workflows" />;
};

export const WorkflowsEmpty = () => {
    const createWorkflow = useCreateWorkflows();
    const { handleError, modal } = useUpgradeModal();
    const router = useRouter();
    
    const handleCreate = () => {
        createWorkflow.mutate(undefined, {
            onError: (error) => {
                handleError(error);
            },
            onSuccess: (data) => {
                router.push(`/workflows/${data.id}`);
            }
        });
    };

    return (
        <>
        {modal}
        <EmptyView
        onNew={handleCreate}
        message="You haven't created any workflows yet. Get started by creating your first workflow"
        />
        </>
    )
}

export const WorkflowItem = ({
    data,
}: {
    data: Workflow
}) => {

    const removeWorkflow = useRemoveWrokflow();

    const handleRemove = () => {
        removeWorkflow.mutate({ id: data.id });
    }
    return (
        <EntityItem
            href={`/workflows/${data.id}`}
            title={data.name}
            subtitle={
                <>
                Updated {formatDistanceToNow(data.updatedAt, {addSuffix: true})}{" "}
                &bull; Created{" "}
                {formatDistanceToNow(data.createdAt, {addSuffix: true})}
                </>
            }
            image={
                <div className="size-8 flex items-center justify">
                    <WorkflowIcon className="size-5 text-muted-foreground" /> 
                </div>
            }
            onRemove={handleRemove}
            isRemoving={removeWorkflow.isPending}
            />
        
    )
}