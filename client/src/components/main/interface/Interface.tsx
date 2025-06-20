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
        if (!containerUrl) return "";
        try {
            const url = new URL(containerUrl);
            // in prod we serve each dApp via NGINX at /dapp/
            if (process.env.NODE_ENV === "production") {
                return `/dapp${url.pathname || "/"}`;
            }
            // local dev keeps the full http://localhost:327xx form
            return containerUrl;
        } catch {
            return containerUrl;
        }
    }, [containerUrl]);

    const openInNewTab = () => {
        if (iframeSrc) window.open(iframeSrc, "_blank");
    };

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

    return (
        <div className="relative w-full h-full">
            {containerUrl ? (
                <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between p-2 bg-[#0F1119] border-b border-[#1F2937]">
                        <div className="flex items-center">
                            <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-sm text-gray-300 font-mono truncate">
                                {containerUrl}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button 
                                onClick={handleRefreshContainerUrl} 
                                disabled={isRefreshing}
                                variant="ghost" 
                                size="sm"
                                className="h-8 text-gray-400 hover:text-white hover:bg-[#1F2937]"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                                {isRefreshing ? "Refreshing..." : "Refresh"}
                            </Button>
                            <Button 
                                onClick={openInNewTab}
                                variant="ghost" 
                                size="sm"
                                className="h-8 text-gray-400 hover:text-white hover:bg-[#1F2937]"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in new tab
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <iframe
                            key={iframeSrc}      /* force reload when URL changes */
                            src={iframeSrc}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="clipboard-read; clipboard-write"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                            title="Ephemeral Container"
                        />
                    </div>
                </div>
            ) : (
                <div
                    className="flex flex-col items-center justify-center w-full h-full"
                    style={{ backgroundColor: "var(--background-dark)" }}
                >
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                    <p className="text-lg text-gray-300 mb-4">
                        Waiting for container URL...
                    </p>
                    <p className="text-sm text-gray-500 mb-6 max-w-[80%] text-center">
                        The container URL will be available after deploying your project.
                        You can deploy your project from the Toolbox panel.
                    </p>
                    <div className="flex space-x-4">
                        <Button 
                            onClick={handleRefreshContainerUrl} 
                            disabled={isRefreshing}
                            variant="outline"
                            className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                            {isRefreshing ? "Refreshing..." : "Refresh Container"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Interface;