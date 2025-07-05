import { useCallback, useContext } from "react";
import UxContext from "../context/ux/UxContext";
import { runDeployPipelineWithLogs } from "../utils/deploy/deployPipeline";

/**
 * Custom hook that runs the deploy pipeline and automatically
 * focuses the Deploy tab so users can follow live logs.
 *
 * Moving useContext into a hook keeps React‑hook rules intact
 * and prevents "Invalid hook call" runtime errors.
 */
export function useDeployPipelineWithLogs() {
  const { activeTab, setActiveTab } = useContext(UxContext);

  return useCallback(
    async (...args: Parameters<typeof runDeployPipelineWithLogs>) => {
      if (activeTab !== "interface") {
        setActiveTab("interface");
      }
      return runDeployPipelineWithLogs(...args);
    },
    [activeTab, setActiveTab],
  );
} 