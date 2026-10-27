import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNodeDiagnostics } from "../hooks/use-flow-diagnostics";

export function NodeDiagnosticsBadge({ nodeId }: { nodeId: string }) {
  const { diagnostics, errorCount, warningCount } = useNodeDiagnostics(nodeId);

  const hasErrors = errorCount > 0;
  const hasWarnings = warningCount > 0;

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  const count = hasErrors ? errorCount : warningCount;
  const badgeColor = hasErrors
    ? "bg-red-500 text-white hover:bg-red-600"
    : "bg-amber-500 text-white hover:bg-amber-600";

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "absolute -top-2 -right-2 z-20 size-4.5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer pointer-events-auto border-0",
              badgeColor,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {count}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] p-2 text-xs z-50">
          <div className="font-semibold mb-1">
            {hasErrors
              ? `${errorCount} Error(s)`
              : `${warningCount} Warning(s)`}
          </div>
          <ul className="list-disc pl-3 space-y-0.5">
            {diagnostics.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: simple message list
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
