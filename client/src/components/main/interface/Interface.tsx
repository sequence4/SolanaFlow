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
    
    /* ───── DEBUG ───────────────────────────────────────────────
     *  Log once on every React render so we know whether the IDL
     *  ever makes it into React context before any messaging.
     *  primaryIdl  – first / active program IDL (or null)
     *  allIdls     – array of every IDL we've collected so far
     * ───────────────────────────────────────────────────────────*/
    console.log('[Interface] render → primaryIdl =', primaryIdl,
                'allIdls.length =', allIdls.length);
    
    /* ── wallet from the host app ── */
    const { publicKey, connected, connect, disconnect, signTransaction, select } = useWallet();

    /* iframe handle so we can postMessage downwards */
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [iframeKey, setIframeKey]   = useState(0);    // forces remount
    // manual override typed by the user
    const [manualUrl, setManualUrl] = useState<string>("");

    // Treat "localhost" as "dev / Docker-Desktop" so we can probe the high port.
    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1");

    // helper: pick manual first, then backend, otherwise blank
    const activeUrl = manualUrl || containerUrl || "";

    /* ───────── Enable Phantom wallet extension in iframe ───────── */
    useEffect(() => {
        if (activeUrl) {
            try {
                const url = new URL(activeUrl);
                enablePhantomWalletExtension({ iframeOrigin: url.origin });
                console.log("[Interface] Phantom injection enabled for origin:", url.origin);
            } catch (error) {
                console.error("Error enabling Phantom in iframe:", error);
            }
        }
    }, [activeUrl]);

    // Listen for containerUrlRefreshTrigger changes to force iframe refresh
    // Skip the *very first* render so we don't reload immediately when the tab is activated.
    const skipFirstTrigger = useRef(true);
    useEffect(() => {
        if (skipFirstTrigger.current) {
            skipFirstTrigger.current = false;
            return;                                  // <-- ignore the initial run
        }
        if (containerUrlRefreshTrigger > 0 && activeUrl) {
            console.log("[Interface] Container URL refresh triggered by external event");
            setIframeKey(prev => prev + 1);          // now it's a real external change
        }
    }, [containerUrlRefreshTrigger, activeUrl]);

    /* ───────── Listen for wallet messages from iframe ───────── */
    useEffect(() => {
        if (!activeUrl) return;
        
        const handleMessage = async (event: MessageEvent) => {
            // Skip messages not from our iframe
            if (event.source !== iframeRef.current?.contentWindow) return;
            
            // Handle wallet state request
            if (event.data?.type === "wallet_state_request") {
                console.log("[Interface] Received wallet state request from iframe");
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: !!connected,
                    publicKey: connected && publicKey ? publicKey.toString() : null
                }, "*");
            }
            
            // Handle wallet connect request
            if (event.data?.type === "wallet_connect_request") {
                console.log("[Interface] Received wallet connect request from iframe");
                if (!connected) {
                    try {
                        await select(PhantomWalletName);
                        await connect();
                    } catch (error) {
                        console.error("Error connecting wallet:", error);
                    }
                }
                
                // Send updated wallet state back to iframe
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: !!connected,
                    publicKey: connected && publicKey ? publicKey.toString() : null
                }, "*");
            }
            
            // Handle wallet disconnect request
            if (event.data?.type === "wallet_disconnect_request") {
                console.log("[Interface] Received wallet disconnect request from iframe");
                if (connected) {
                    try {
                        await disconnect();
                    } catch (error) {
                        console.error("Error disconnecting wallet:", error);
                    }
                }
                
                // Send updated wallet state back to iframe
                iframeRef.current?.contentWindow?.postMessage({
                    type: "wallet_state_response",
                    connected: false,
                    publicKey: null
                }, "*");
            }
            
            // Handle transaction signing request
            if (event.data?.type === "sign_transaction") {
                console.log("[Interface] Received transaction signing request from iframe");
                try {
                    if (!connected || !signTransaction) {
                        throw new Error("Wallet not connected");
                    }
                    
                    // Deserialize the transaction
                    const txBytes = new Uint8Array(event.data.transaction);
                    const tx = Transaction.from(txBytes);
                    
                    // Sign the transaction
                    const signedTx = await signTransaction(tx);
                    
                    // Serialize and return the signed transaction
                    const serializedTx = signedTx.serialize();
                    iframeRef.current?.contentWindow?.postMessage({
                        type: "sign_transaction_response",
                        signedTransaction: Array.from(serializedTx)
                    }, "*");
                } catch (error: any) {
                    console.error("Error signing transaction:", error);
                    iframeRef.current?.contentWindow?.postMessage({
                        type: "sign_transaction_response",
                        error: error?.message || String(error)
                    }, "*");
                }
            }
            
            /* ───────── iframe ⇒ parent : request IDL(s) ───────── */
            if (event.data?.type === "idl_request") {
                console.log("[Interface] iframe requested PROGRAM_IDL");
                if (primaryIdl) {
                    /* DEBUG: show exactly what we're about to post */
                    console.log('[Interface] ↪ sending PROGRAM_IDL',
                                { idl: primaryIdl, idls: allIdls });
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

    // Update iframe with wallet state when connection changes
    useEffect(() => {
        if (!activeUrl || !iframeRef.current?.contentWindow) return;
        
        console.log("[Interface] Wallet state changed, updating iframe:", connected);
        iframeRef.current.contentWindow.postMessage({
            type: "wallet_state_response",
            connected: !!connected,
            publicKey: connected && publicKey ? publicKey.toString() : null
        }, "*");
    }, [activeUrl, connected, publicKey]);

    /* ───────── parent ⇒ iframe : push wallet once connected ───────── */
    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (connected && publicKey) {
            iframeRef.current.contentWindow.postMessage(
                { type: "WALLET_CONNECTED", publicKey: publicKey.toString() },
                "*"                                       // use stricter origin in prod
            );
        }
    }, [connected, publicKey]);

    /* ───────── parent ⇒ iframe : push Program ID if available ───────── */
    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (projectContext.details?.programId) {
            iframeRef.current.contentWindow.postMessage(
                { type: "PROGRAM_ID", programId: projectContext.details.programId },
                "*"
            );
            console.log("[Interface] Sent Program ID to iframe:", projectContext.details.programId);
        }
    }, [projectContext.details?.programId, iframeKey]);

    /* ───────── parent ⇒ iframe : push IDL(s) once we have them ───────── */
    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        if (!primaryIdl) return;                 // nothing to send yet

        console.log('[Interface] effect → pushing PROGRAM_IDL to iframe',
                    { idl: primaryIdl, idls: allIdls });

        iframeRef.current.contentWindow.postMessage(
          { type: "PROGRAM_IDL", idl: primaryIdl, idls: allIdls },
          "*"
        );
    }, [primaryIdl, allIdls, iframeKey /* re-post on manual refresh */]);

    /* ───────── iframe ⇒ parent : handle connect requests ───────── */
    useEffect(() => {
        function handleIframeMsg(event: MessageEvent) {
            if (event.source !== iframeRef.current?.contentWindow) return;  // only our iframe
            if (event.data?.type === "REQUEST_WALLET_CONNECT") {
                if (!connected) connect();
            }
        }
        window.addEventListener("message", handleIframeMsg);
        return () => window.removeEventListener("message", handleIframeMsg);
    }, [connected, connect]);

    /* ───────── parent ⇒ iframe : handle Program ID requests ───────── */
    useEffect(() => {
        const handleProgramIdRequest = (event: MessageEvent) => {
            // Skip messages not from our iframe
            if (event.source !== iframeRef.current?.contentWindow) return;
            
            // Handle Program ID request
            if (event.data?.type === "REQUEST_PROGRAM_ID") {
                console.log("[Interface] Received Program ID request from iframe");
                
                // Determine the best Program ID to send
                const currentPid = projectContext.details?.projectState?.programId || 
                                  projectContext.details?.programId;
                const envPid = process.env.NEXT_PUBLIC_PROGRAM_ID;
                const replyPid = currentPid && currentPid !== "" ? currentPid :
                               envPid && envPid !== "" ? envPid :
                               "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
                
                // Send the Program ID back to the iframe
                if (event.source) {
                    event.source.postMessage(
                        { type: "PROGRAM_ID", programId: replyPid },
                        "*" // In production, use a specific origin
                    );
                    console.log("[Interface] Sent Program ID to iframe:", replyPid);
                }
            }
        };
        
        window.addEventListener("message", handleProgramIdRequest);
        return () => window.removeEventListener("message", handleProgramIdRequest);
    }, [projectContext.details]);

    /* ───────── parent ⇒ iframe : push Program ID when it changes ───────── */
    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;
        
        const programId = projectContext.details?.projectState?.programId || 
                         projectContext.details?.programId;
        
        if (programId && programId !== "") {
            console.log("[Interface] Proactively sending updated Program ID to iframe:", programId);
            iframeRef.current.contentWindow.postMessage(
                { type: "PROGRAM_ID", programId },
                "*" // In production, use a specific origin
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
                    // new URL → update context ⟶ iframe reloads automatically
                    setProjectContext({ ...projectContext, containerUrl: updatedContainerUrl });
                    console.log(`Container URL refreshed: ${updatedContainerUrl}`);
                } else {
                    // same URL → force iframe reload
                    setIframeKey(prev => prev + 1);
                    console.log("Container URL unchanged – iframe reloading");
                }
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

    /* add a cache-buster so each "Refresh" forces the browser to re-request
       the page and kick the Next.js dev-server if it was asleep */
    const iframeSrc = React.useMemo(() => {
        if (!activeUrl) return "";
        const delim = activeUrl.includes('?') ? '&' : '?';
        return `${activeUrl}${delim}v=${iframeKey}`;
    }, [activeUrl, iframeKey]);

    const openInNewTab = () => activeUrl && window.open(activeUrl, "_blank");

    /* ───────── periodic health-check ───────── */
    useEffect(() => {
        if (!projectId || activeTab !== "interface") return;

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
    }, [projectId, containerUrl, projectContext, setProjectContext, activeTab]);

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
        <div className="flex flex-col w-full h-full bg-[#111827] text-white">
            {/* ───── URL bar ───── */}
            <div className="flex items-center justify-between p-2 border-b border-gray-700">
                <div className="flex-1 px-2">
                    <input
                        type="text"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        placeholder={containerUrl || "Enter URL manually..."}
                        className="w-full px-2 py-1 bg-[#1F2937] text-white border border-gray-600 rounded"
                    />
                </div>

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
            {/* flex-child grows to fill the rest of the column */}
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