import React, { useContext, useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import '@/styles/interface/interfaceStyle.css';
import ProjectContext from "@/context/project/ProjectContext";
import { projectApi } from '@/api/projectApi';
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import UxContext from "@/context/ux/UxContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { enablePhantomWalletExtension } from "phantom-iframe-connector";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { Transaction } from "@solana/web3.js";

const Interface = () => {
    const { projectContext, setProjectContext } = useContext(ProjectContext);
    const { activeTab, containerUrlRefreshTrigger } = useContext(UxContext);
    const { id: projectId, containerUrl } = projectContext;
    // ⟶ pull IDLs out of context once so we can forward them to the iframe
    const {
        idl:  primaryIdl,
        idls: allIdls = []
    } = projectContext.details?.projectState ?? {};

    const { publicKey, connected, connect, disconnect, signTransaction, select } = useWallet();

    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [iframeKey, setIframeKey]   = useState(0);    // forces remount
    const [manualUrl, setManualUrl] = useState<string>("");

    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1");
    const activeUrl = manualUrl || containerUrl || "";

    useEffect(() => {
        if (activeUrl) {
            try {
                const url = new URL(activeUrl);
                enablePhantomWalletExtension({ iframeOrigin: url.origin });
            } catch (error) {
                console.error("Error enabling Phantom in iframe:", error);
            }
        }
    }, [activeUrl]);

    const skipFirstTrigger = useRef(true);
    useEffect(() => {
        if (skipFirstTrigger.current) {
            skipFirstTrigger.current = false;
            return; 
        }
        if (containerUrlRefreshTrigger > 0 && activeUrl) {
            setIframeKey(prev => prev + 1);          
        }
    }, [containerUrlRefreshTrigger, activeUrl]);

    useEffect(() => {
        if (!activeUrl) return;
        
        const handleMessage = async (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            
            if (event.data?.type === "wallet_state_request") {
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: !!connected,
                    publicKey: connected && publicKey ? publicKey.toString() : null
                }, "*");
            }
            
            if (event.data?.type === "wallet_connect_request") {
                if (!connected) {
                    try {
                        await select(PhantomWalletName);
                        await connect();
                    } catch (error) {
                        console.error("Error connecting wallet:", error);
                    }
                }
                
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: !!connected,
                    publicKey: connected && publicKey ? publicKey.toString() : null
                }, "*");
            }
            
            if (event.data?.type === "wallet_disconnect_request") {
                if (connected) {
                    try {
                        await disconnect();
                    } catch (error) {
                        console.error("Error disconnecting wallet:", error);
                    }
                }
                
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: false,
                    publicKey: null
                }, "*");
            }
            
            if (event.data?.type === "sign_transaction") {
                try {
                    if (!connected || !signTransaction) throw new Error("Wallet not connected or doesn't support signing");
                    
                    const txBytes = new Uint8Array(event.data.transaction);
                    const tx = Transaction.from(txBytes);
                                        
                    const signedTx = await signTransaction(tx);
                    
                    const hasSignature = signedTx.signatures.some(sig => 
                        sig.publicKey.equals(publicKey!) && sig.signature !== null
                    );
                    
                    if (!hasSignature) throw new Error("Transaction was not properly signed");
                    
                    const serializedTx = signedTx.serialize();
                    iframeRef.current?.contentWindow?.postMessage({
                        type: "sign_transaction_response",
                        signedTransaction: Array.from(serializedTx),
                        success: true
                    }, "*");
                    
                } catch (error: any) {
                    let errorMessage = error?.message || String(error);
                    if (errorMessage.includes("User rejected")) {
                        errorMessage = "Transaction was rejected by user";
                    } else if (errorMessage.includes("not connected")) {
                        errorMessage = "Wallet is not connected. Please connect your wallet first";
                    }
                    
                    iframeRef.current?.contentWindow?.postMessage({
                        type: "sign_transaction_response",
                        error: errorMessage,
                        success: false
                    }, "*");
                }
            }
            
            if (event.data?.type === "idl_request") {
                if (primaryIdl) {
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: "PROGRAM_IDL", idl: primaryIdl, idls: allIdls },
                      "*"
                    );
                }
            }
        };
        
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [
        activeUrl,
        connected,
        publicKey,
        connect,
        disconnect,
        signTransaction,
        select,
        primaryIdl,
        allIdls
    ]);

    useEffect(() => {
        if (!activeUrl || !iframeRef.current?.contentWindow) return;
        
        iframeRef.current.contentWindow.postMessage({
            type: "wallet_state_response",
            connected: !!connected,
            publicKey: connected && publicKey ? publicKey.toString() : null
        }, "*");
    }, [activeUrl, connected, publicKey]);

    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (connected && publicKey) {
            iframeRef.current.contentWindow.postMessage(
                { type: "WALLET_CONNECTED", publicKey: publicKey.toString() },
                "*"
            );
        }
    }, [connected, publicKey]);

    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (projectContext.details?.programId) {
            iframeRef.current.contentWindow.postMessage(
                { type: "PROGRAM_ID", programId: projectContext.details.programId },
                "*"
            );
        }
    }, [projectContext.details?.programId, iframeKey]);

    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (!primaryIdl) return;

        iframeRef.current.contentWindow.postMessage(
          { type: "PROGRAM_IDL", idl: primaryIdl, idls: allIdls },
          "*"
        );
    }, [primaryIdl, allIdls, iframeKey]);

    useEffect(() => {
        function handleIframeMsg(event: MessageEvent) {
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (event.data?.type === "REQUEST_WALLET_CONNECT") {
                if (!connected) connect();
            }
        }
        window.addEventListener("message", handleIframeMsg);
        return () => window.removeEventListener("message", handleIframeMsg);
    }, [connected, connect]);

    useEffect(() => {
        const handleProgramIdRequest = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            
            if (event.data?.type === "REQUEST_PROGRAM_ID") {
                
                const currentPid = projectContext.details?.projectState?.programId || 
                                  projectContext.details?.programId;
                const envPid = process.env.NEXT_PUBLIC_PROGRAM_ID;
                const replyPid = currentPid && currentPid !== "" ? currentPid :
                               envPid && envPid !== "" ? envPid :
                               "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                
                if (event.source) {
                    event.source.postMessage(
                        { type: "PROGRAM_ID", programId: replyPid },
                        "*"
                    );
                }
            }
        };
        
        window.addEventListener("message", handleProgramIdRequest);
        return () => window.removeEventListener("message", handleProgramIdRequest);
    }, [projectContext.details]);

    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        
        const programId = projectContext.details?.projectState?.programId || 
                         projectContext.details?.programId;
        
        if (programId && programId !== "") {
            iframeRef.current.contentWindow.postMessage(
                { type: "PROGRAM_ID", programId },
                "*"
            );
        }
    }, [projectContext.details?.projectState?.programId, projectContext.details?.programId]);

    const handleRefreshContainerUrl = async () => {
        if (!projectId || isRefreshing) return;
        
        setIsRefreshing(true);
        try {
            const { containerUrl: updatedContainerUrl } = await projectApi.fetchContainerUrl(projectId);
            
            if (updatedContainerUrl) {
                if (updatedContainerUrl !== projectContext.containerUrl) {
                    setProjectContext({ ...projectContext, containerUrl: updatedContainerUrl });
                } else {
                    setIframeKey(prev => prev + 1);
                }
            } else {
                if (process.env.NODE_ENV === 'development') {
                    console.warn("No containerUrl found after refresh attempt");
                }
            }
        } catch (error) {
            console.error("Error refreshing container URL:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const iframeSrc = React.useMemo(() => {
        if (!activeUrl) return "";
        
        // Get program ID and cluster info from context
        const programId = projectContext.details?.programId || 
                         projectContext.details?.projectState?.programId;
        const deployNetwork = projectContext.deployNetwork || 'devnet';
        
        // Build query params
        const params = new URLSearchParams();
        params.set('v', String(iframeKey)); // version key for refresh
        
        if (programId) {
            params.set('programId', programId);
        }
        
        if (deployNetwork === 'local') {
            params.set('cluster', 'local');
            // Use standard local validator port
            const rpcPort = 28899;
            params.set('rpcUrl', `http://localhost:${rpcPort}`);
        } else {
            params.set('cluster', deployNetwork);
        }
        
        const delim = activeUrl.includes('?') ? '&' : '?';
        return `${activeUrl}${delim}${params.toString()}`;
    }, [activeUrl, iframeKey, projectContext.details, projectContext.deployNetwork]);

    const openInNewTab = () => activeUrl && window.open(activeUrl, "_blank");

    useEffect(() => {
        if (!projectId || activeTab !== "interface") return;

        const id = setInterval(async () => {
            try {
                const { containerUrl: newUrl } = await projectApi.fetchContainerUrl(projectId);
                if (newUrl && newUrl !== containerUrl) {
                    setProjectContext({ ...projectContext, containerUrl: newUrl });
                }
            } catch (err) {
                console.warn("[Interface] auto-refresh failed:", err);
            }
        }, 30_000);            // every 30 s

        return () => clearInterval(id);
    }, [projectId, containerUrl, projectContext, setProjectContext, activeTab]);

    useEffect(() => { setManualUrl(""); }, [containerUrl]);

    useEffect(() => {
        if (containerUrl || !isLocalDev) return;

        (async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/local-port`);
                const { hostPort } = await res.json();
                if (hostPort) setManualUrl(`http://localhost:${hostPort}/dapp/${projectId}`);
            } catch (e) {
                console.warn("[Interface] WSL auto-port probe failed:", e);
            }
        })();
    }, [isLocalDev, projectId, containerUrl]);

    return (
        <div className="flex flex-col w-full h-full bg-card text-foreground">
            <div className="flex items-center justify-between p-2 border-b border-border">
                <div className="flex-1 px-2">
                    <input
                        type="text"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        placeholder={containerUrl || "Enter URL manually..."}
                        className="w-full px-2 py-1 bg-background text-foreground border border-border rounded"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        onClick={handleRefreshContainerUrl}
                        disabled={isRefreshing}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                    </Button>
                </div>
            </div>

            <div className="flex-1 w-full h-full">
                {activeUrl ? (
                    <iframe
                        ref={iframeRef}
                        key={`${iframeKey}-${activeUrl}`}
                        src={iframeSrc}
                        className="w-full h-full overflow-y-auto"
                        style={{ border: "none" }}
                        allow="clipboard-read; clipboard-write"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                        title="Ephemeral Container"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full space-y-4">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-muted-foreground">
                            Waiting for container URL… or paste one above.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Interface;