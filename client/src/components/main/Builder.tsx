"use client";

import React, { useEffect, useContext } from "react";
import { motion } from "framer-motion";
import Workflow from "@/components/main/workflow/Workflow";
import Interface from "@/components/main/interface/Interface";
import Code from "@/components/main/code/Code";
import Chat from "@/components/main/chat/Chat";
import Header from "@/components/main/Header";
import Filetree from "@/components/main/toolbox/codeToolbox/Filetree";
import { useWallet } from "@solana/wallet-adapter-react";
import ProjectContext from "@/context/project/ProjectContext";
import UxContext from "@/context/ux/UxContext";
import AuthContext from "@/context/auth/AuthContext";
import { ActiveTab } from "@/context/ux/UxContextTypes";
import "@/styles/body/bodyStyles.css";
import "@/styles/layout-fixes.css";
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";
import { ProjectInfo } from "./Toolbar";

const Builder = () => {
    const { projectContext } = useContext(ProjectContext);
    
    const { connected, publicKey, connect, disconnect, select } = useWallet();
    const { user, updateWalletPublicKey } = useContext(AuthContext);

    const { activeTab, setActiveTab, } = useContext(UxContext);
    //const { isChatOpen, setIsChatOpen } = useContext(UxContext);
    //const { fileTree, setFileTree, setSelectedFile } = useContext(FileContext);

    /*
    const handleWalletClick = async () => {
        console.log('handleWalletClick', connected);
        try {
            if (!connected) {
                await select(PhantomWalletName);
                await connect(); 
            } else {
                console.log("disconnecting wallet");
                await disconnect();
            }
        } catch (error) {
            console.error('Wallet connect error:', error);
        }
    };
    */

    useEffect(() => {
        //console.log("connected", connected);
        //console.log("publicKey", publicKey);
        if (connected && publicKey) {
            if (user?.walletPublicKey !== publicKey.toBase58()) {
                //console.log('Wallet is fully connected; publicKey =', publicKey.toBase58());
                updateWalletPublicKey(publicKey.toBase58());
            }
        } else {
            console.log('Wallet is disconnected or no key yet');
        }
    }, [connected, publicKey, user?.walletPublicKey, updateWalletPublicKey]);

    useEffect(() => {
        if (!projectContext.details?.setProjectState) return;

        const walletString = connected && publicKey
            ? publicKey.toBase58()
            : "not set";

        //console.log("Wallet:", walletString);

        projectContext.details.setProjectState((prevState) => {
            let changed = false;

            const newNodes = (prevState.nodes || []).map((node) => {
                if (node.type !== "accountNode" || !node.data?.fields) {
                    return node; 
                }

                const nodeLabel = node.data.label;
                let updatedFields = [...node.data.fields]; 

                if (nodeLabel === "Mint Account") {
                    updatedFields = updatedFields.map((field) => {
                        if (
                            field.label === "Mint Authority" ||
                            field.label === "Freeze Authority"
                        ) {
                            if (field.value === walletString) {
                                return field; // no update
                            }
                            changed = true;
                            return { ...field, value: walletString };
                        }
                        return field;
                    });
                } else if (
                    nodeLabel === "Mint Authority" ||
                    nodeLabel === "Payer Account"
                ) {
                    updatedFields = updatedFields.map((field) => {
                        if (field.label === "Address") {
                            if (field.value === walletString) {
                                return field; 
                            }
                            changed = true;
                            return { ...field, value: walletString };
                        }
                        return field;
                    });
                }

                if (changed) {
                    
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            fields: updatedFields,
                        },
                    };
                }
                return node;
            });

            if (!changed) {
                return prevState;
            }

            return {
                ...prevState,
                nodes: newNodes,
            };
        });
    }, [connected, publicKey]);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative flex-1 h-[98%] p-2 w-full flex flex-col bg-background">
        
            <Header />
            <ProjectInfo />
            
            <div className="builder-layout flex h-full w-full">
                <div className="main-content-60 w-[60%] flex-shrink-0 h-full">
                    <Tabs
                        value={activeTab}
                        onValueChange={(val) => setActiveTab(val as ActiveTab)}
                        className="h-full w-full"
                    >
                        <TabsContent value="workflow" className="tabs-content-container h-full">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="workflow-container w-full h-full"
                            >
                                <Workflow />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="interface" className="tabs-content-container h-full">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="interface-container w-full h-full"
                            >
                                <Interface />
                            </motion.div>
                        </TabsContent>
                        <TabsContent value="code" className="tabs-content-container h-full">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="w-full h-full flex"
                            >
                                <div className="w-64 flex-shrink-0 border-r border-border bg-card">
                                    <div className="p-2 border-b border-border text-sm font-medium">Files</div>
                                    <div className="flex-1 overflow-y-auto">
                                        <Filetree />
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <Code />
                                </div>
                            </motion.div>
                        </TabsContent>
                    </Tabs>
                </div>
                
                <div className="chat-content-40 w-[40%] flex-shrink-0 h-full border-l border-border bg-card">
                    <Chat />
                </div>
            </div>
        </motion.div>
    );
};

export default Builder;