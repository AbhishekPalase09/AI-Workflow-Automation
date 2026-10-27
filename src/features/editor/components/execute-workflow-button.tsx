import { FlaskConicalIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useExecuteWorkflow } from "@/features/workflows/hooks/use-workflows";
import { useFlowDiagnostics } from "../hooks/use-flow-diagnostics";

export const ExecuteWorkflowButton = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const { errorCount } = useFlowDiagnostics();
  const executeWorkflow = useExecuteWorkflow();

  const handleExecute = () => {
    if (errorCount > 0) {
      toast.error(
        `Cannot execute workflow: ${errorCount} error(s) must be fixed first.`,
      );
      return;
    }
    executeWorkflow.mutate({ id: workflowId });
  };

  const isDisabled = executeWorkflow.isPending || errorCount > 0;

  return (
    <Button
      size="lg"
      onClick={handleExecute}
      disabled={isDisabled}
      title={
        errorCount > 0
          ? `Workflow contains ${errorCount} error(s). Please fix before executing.`
          : undefined
      }
    >
      <FlaskConicalIcon className="size-4" />
      Execute workflow
    </Button>
  );
};
