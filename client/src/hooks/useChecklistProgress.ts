import { useEffect, useState } from "react";
import eventBus, { ProgressPayload } from "../lib/eventBus";

export interface Step {
  id: number;
  stage: "environment" | "code-gen" | "build" | "done";
  title: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
}

const INITIAL: Step[] = [
  { id: 0, stage: "environment", title: "Environment", description: "", status: "pending" },
  { id: 1, stage: "code-gen"   , title: "Code gen"   , description: "", status: "pending" },
  { id: 2, stage: "build"      , title: "Build"      , description: "", status: "pending" },
  { id: 3, stage: "done"       , title: "Complete"   , description: "", status: "pending" },
];

export function useChecklistProgress() {
  const [steps, setSteps] = useState<Step[]>(INITIAL);

  useEffect(() => {
    const onMsg = (payload: any) => {
      if (!payload.stage) return;
      setSteps(prev =>
        prev.map(s => {
          if (s.stage === payload.stage) {
            const nextStatus =
              payload.status === "completed"
                ? "done"
                : payload.status === "error"
                ? "error"
                : "active";
            return {
              ...s,
              status: nextStatus,
              description: payload.message ?? s.description,
            };
          }
          return s;
        }),
      );
    };
    eventBus.on("progress", onMsg);
    return () => eventBus.off("progress", onMsg);
  }, []);

  return steps;
} 