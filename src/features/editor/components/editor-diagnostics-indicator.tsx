"use client";

import { useAtomValue } from "jotai";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { diagnosticsAtom } from "../store/atoms";

export function EditorDiagnosticsIndicator() {
  const { all, errorCount, warningCount } = useAtomValue(diagnosticsAtom);

  const errors = all.filter((d) => d.severity === "error");
  const warnings = all.filter((d) => d.severity === "warning");
  const sortedDiagnostics = [...errors, ...warnings];

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-pointer select-none">
            {errorCount > 0 && warningCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="destructive"
                  className="gap-1 text-xs py-0.5 px-2.5 font-medium shadow-xs hover:bg-destructive/90 transition-colors"
                >
                  <AlertCircle className="size-3.5" />
                  {errorCount} {errorCount === 1 ? "error" : "errors"}
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1 text-xs py-0.5 px-2 font-medium border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 shadow-xs hover:bg-amber-500/20 transition-colors"
                >
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  {warningCount}
                </Badge>
              </div>
            ) : errorCount > 0 ? (
              <Badge
                variant="destructive"
                className="gap-1 text-xs py-0.5 px-2.5 font-medium shadow-xs hover:bg-destructive/90 transition-colors"
              >
                <AlertCircle className="size-3.5" />
                {errorCount} {errorCount === 1 ? "error" : "errors"}
              </Badge>
            ) : warningCount > 0 ? (
              <Badge
                variant="outline"
                className="gap-1 text-xs py-0.5 px-2.5 font-medium border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/10 shadow-xs hover:bg-amber-500/20 transition-colors"
              >
                <AlertTriangle className="size-3.5 text-amber-500" />
                {warningCount} {warningCount === 1 ? "warning" : "warnings"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 text-xs py-0.5 px-2.5 font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 shadow-xs hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Flow Valid
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-[370px] p-0 shadow-xl rounded-lg border border-border bg-popover text-popover-foreground overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/60 border-b border-border">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" /> Flow Diagnostics
            </span>
            <div className="flex items-center gap-1.5">
              {errorCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-mono font-medium">
                  {errorCount} {errorCount === 1 ? "error" : "errors"}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono font-medium">
                  {warningCount} {warningCount === 1 ? "warning" : "warnings"}
                </span>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                  Clean
                </span>
              )}
            </div>
          </div>

          {/* Card Content */}
          {errorCount === 0 && warningCount === 0 ? (
            <div className="p-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">
                  All templates verified
                </p>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  All Handlebars expressions and data paths match output schemas
                  of ancestor nodes.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
                {sortedDiagnostics.slice(0, 8).map((d) => {
                  const isError = d.severity === "error";

                  return (
                    <div
                      key={`${d.code}-${d.nodeId}-${d.field}-${d.message}`}
                      className={cn(
                        "p-2.5 text-xs transition-colors flex items-start gap-2.5",
                        isError
                          ? "bg-destructive/[0.04] hover:bg-destructive/[0.08]"
                          : "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]",
                      )}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isError ? (
                          <AlertCircle className="size-3.5 text-destructive" />
                        ) : (
                          <AlertTriangle className="size-3.5 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "font-mono text-[9px] px-1 py-0.2 rounded font-semibold",
                              isError
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20",
                            )}
                          >
                            {d.code}
                          </span>
                          {d.field && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              field:{" "}
                              <strong className="text-foreground">
                                {d.field}
                              </strong>
                            </span>
                          )}
                          {d.line !== undefined && (
                            <span className="text-[9px] text-muted-foreground font-mono">
                              line {d.line}
                              {d.col !== undefined ? `:${d.col}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-foreground font-normal break-words">
                          {d.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer */}
              <div className="px-3 py-2 bg-muted/40 border-t border-border text-[10px] text-muted-foreground flex justify-between items-center">
                <span>
                  Showing {Math.min(8, sortedDiagnostics.length)} of{" "}
                  {sortedDiagnostics.length}{" "}
                  {sortedDiagnostics.length === 1 ? "issue" : "issues"}
                </span>
                <span>Open node dialog to fix</span>
              </div>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
