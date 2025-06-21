import React, { useContext, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import '@/styles/interface/interfaceStyle.css';
import ProjectContext from "@/context/project/ProjectContext";
import { projectApi } from '@/api/projectApi';
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";

const Interface = () => {
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { id: projectId, containerUrl } = projectContext;
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    // manual override typed by the user
    const [manualUrl, setManualUrl] = useState<string>("");

    // Treat "localhost" as "dev / Docker-Desktop" so we can probe the high port.
    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1");

    // helper: pick manual first, then backend, otherwise blank
    const activeUrl = manualUrl || containerUrl || "";

    const handleRefreshContainerUrl = async () => {
        if (!projectId || isRefreshing) return;
        
        setIsRefreshing(true);
        try {
            const { containerUrl: updatedContainerUrl } = await projectApi.fetchContainerUrl(projectId);
            
            if (updatedContainerUrl) {
                const updatedContext = {
                    ...projectContext,
                    containerUrl: updatedContainerUrl
                };
                
                setProjectContext(updatedContext);
                console.log(`Container URL refreshed: ${updatedContainerUrl}`);
            } else {
                console.warn("No containerUrl found after refresh attempt");
            }
        } catch (error) {
            console.error("Error refreshing container URL:", error);
        } finally {
            console.log(`Container URL refresh completed`);
            setIsRefreshing(false);
        }
    };

    const iframeSrc = React.useMemo(() => {
        if (!activeUrl) return "";
        return activeUrl;
    }, [activeUrl]);

    const openInNewTab = () => activeUrl && window.open(activeUrl, "_blank");

    /* ───────── periodic health-check ───────── */
    useEffect(() => {
        if (!projectId) return;

        const id = setInterval(async () => {
            try {
                const { containerUrl: newUrl } = await projectApi.fetchContainerUrl(projectId);
                if (newUrl && newUrl !== containerUrl) {
                    setProjectContext({ ...projectContext, containerUrl: newUrl });
                    console.log("[Interface] container URL auto-updated →", newUrl);
                }
            } catch (err) {
                console.warn("[Interface] auto-refresh failed:", err);
            }
        }, 30_000);            // every 30 s

        return () => clearInterval(id);
    }, [projectId, containerUrl, projectContext, setProjectContext]);

    // Reset any manual override when the backend pushes a fresh containerUrl
    useEffect(() => { setManualUrl(""); }, [containerUrl]);

    // Auto-open the local high-port when running on WSL / Docker-Desktop
    useEffect(() => {
        // auto-fallback only if no backend url yet
        if (containerUrl || !isLocalDev) return;

        // quick probe: pick the first published host-port for this container
        (async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/local-port`);
                const { hostPort } = await res.json();          // backend returns {"hostPort":32776}
                if (hostPort) setManualUrl(`http://localhost:${hostPort}`);
            } catch (e) {
                console.warn("[Interface] WSL auto-port probe failed:", e);
            }
        })();
    }, [isLocalDev, projectId, containerUrl]);

    return (
      <div className="relative w-full h-full">
        {/* ───── top toolbar – always visible ───── */}
        <div className="flex items-center justify-between p-2 bg-[#0F1119] border-b border-[#1F2937]">
          <div className="flex items-center space-x-2">
            {/* status dot – green when we have a URL, red otherwise  */}
            <div
              className={`h-3 w-3 rounded-full ${
                activeUrl ? "bg-green-500" : "bg-red-500"
              }`}
            />
            {/* editable address bar */}
            <div className="relative">
              {/* small "pencil" overlay – just a visual cue */}
              <svg
                viewBox="0 0 24 24"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
              >
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21.41 6.34c.39-.39.39-1.02 0-1.41L19.07 2.59a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
              <input
                type="text"
                value={activeUrl}
                onChange={(e) => setManualUrl(e.target.value.trim())}
                placeholder="Paste or type a URL…"
                className="bg-transparent pl-1 pr-6 w-72 truncate font-mono text-sm text-gray-300 focus:outline-none border-b border-transparent focus:border-gray-500"
              />
            </div>
          </div>

          {/* right-side buttons */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleRefreshContainerUrl}
              disabled={isRefreshing}
              variant="ghost"
              size="sm"
              className="h-8 text-gray-400 hover:text-white hover:bg-[#1F2937]"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              onClick={openInNewTab}
              variant="ghost"
              size="sm"
              disabled={!activeUrl}
              className="h-8 text-gray-400 hover:text-white hover:bg-[#1F2937]"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </div>
        </div>

        {/* ───── main panel ───── */}
        <div className="flex-1 w-full">
          {activeUrl ? (
            <iframe
              key={activeUrl} // force reload on change
              src={activeUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="clipboard-read; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title="Ephemeral Container"
            />
          ) : (
            /* fallback when we have no URL yet */
            <div className="flex flex-col items-center justify-center w-full h-full space-y-4">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              <p className="text-gray-400">
                Waiting for container URL… or paste one above.
              </p>
            </div>
          )}
        </div>
      </div>
    );
}

export default Interface;