import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Tabs, TabsContent } from "../../../ui/tabs";
import { GroupedInstructionsAccordion } from './GroupedInstructionAccordion';
import { GroupedOffChainAccordion } from './GroupedOffChainAccordion';
import { ToolboxPrograms } from './ToolboxPrograms';
import 'simplebar-react/dist/simplebar.min.css';
import SimpleBar from 'simplebar-react';
import { cn } from '../../../../lib/utils';
import { Star, Clock, Zap, Database, Settings, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NodeItemsProps {
    activeChainTab?: string;
}

export const NodeItems = forwardRef<{ setActiveChainTab: (tab: string) => void }, NodeItemsProps>(
    ({ activeChainTab: initialActiveChainTab = 'onChain' }, ref) => {
        const [activeChainTab, setActiveChainTab] = useState(initialActiveChainTab);
        const [activeSectionTab, setActiveSectionTab] = useState('instructions');

        // Expose setActiveChainTab method to parent via ref
        useImperativeHandle(ref, () => ({
            setActiveChainTab: (tab: string) => {
                setActiveChainTab(tab);
            }
        }));

        // Update state when prop changes
        useEffect(() => {
            if (initialActiveChainTab) {
                setActiveChainTab(initialActiveChainTab);
            }
        }, [initialActiveChainTab]);

        const tabIcons = {
            instructions: <Zap className="h-3 w-3" />,
            programs: <Database className="h-3 w-3" />,
            accounts: <Settings className="h-3 w-3" />,
            inputs: <Play className="h-3 w-3" />
        };

        return (
            <div className="flex flex-col w-full h-full bg-gradient-to-br from-slate-900/50 via-slate-800/30 to-slate-900/50 backdrop-blur-xl"
            >
                <Tabs
                    defaultValue="onChain"
                    value={activeChainTab}
                    style={{ height: "100%", display: "flex", flexDirection: "column" }}
                >
                    {/* We keep the original tabs hidden as they are now controlled by the parent */}
                    <div className="hidden">
                        <button
                            className={cn(
                                "flex-1 py-2.5 text-sm font-medium transition-colors chain-tabs",
                                activeChainTab === "onChain"
                                    ? "bg-[#2A3347] text-[#E9ECEF] border-b-2 border-[#80a3ff]"
                                    : "text-[#A0AEC0] hover:bg-[#2A3347]",
                            )}
                            onClick={() => setActiveChainTab("onChain")}
                        >
                            On-Chain
                        </button>
                        <button
                            className={cn(
                                "flex-1 py-2.5 text-sm font-medium transition-colors chain-tabs",
                                activeChainTab === "offChain"
                                    ? "bg-[#2A3347] text-[#E9ECEF] border-b-2 border-[#80a3ff]"
                                    : "text-[#A0AEC0] hover:bg-[#2A3347]",
                            )}
                            onClick={() => setActiveChainTab("offChain")}
                        >
                            Off-Chain
                        </button>
                    </div>

                    <TabsContent
                        value="onChain"
                        style={{ 
                            flex: 1, 
                            display: activeChainTab === "onChain" ? "flex" : "none", 
                            flexDirection: "column", 
                            overflow: "hidden", 
                            marginTop: 0, 
                            backgroundColor: "#121214" 
                        }}
                    >
                        <Tabs 
                            defaultValue="instructions" 
                            value={activeSectionTab}
                            style={{ height: "100%", display: "flex", flexDirection: "column", width: "100%" }}
                        >
                            <div className="flex border-b border-white/10 bg-white/5 backdrop-blur-sm overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent relative">
                                {/* Sliding indicator */}
                                <motion.div
                                    className="absolute bottom-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"
                                    layoutId="activeTab"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    style={{
                                        left: (() => {
                                            const tabs = ["instructions", "programs", "accounts", "inputs"];
                                            const index = tabs.indexOf(activeSectionTab);
                                            return `${index * 25}%`;
                                        })(),
                                        width: "25%"
                                    }}
                                />
                                
                                {[
                                    { id: "instructions", label: "Instructions", icon: tabIcons.instructions },
                                    { id: "programs", label: "Programs", icon: tabIcons.programs },
                                    { id: "accounts", label: "Accounts", icon: tabIcons.accounts },
                                    { id: "inputs", label: "Inputs", icon: tabIcons.inputs },
                                ].map((tab) => (
                                    <motion.button
                                        key={tab.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-200 whitespace-nowrap h-10 relative ${
                                            activeSectionTab === tab.id 
                                                ? "text-white" 
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                        onClick={() => setActiveSectionTab(tab.id)}
                                    >
                                        <span className={activeSectionTab === tab.id ? "text-blue-400" : ""}>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        {tab.id === "instructions" && (
                                            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                                                12
                                            </span>
                                        )}
                                        {tab.id === "programs" && (
                                            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                                                4
                                            </span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-hidden bg-transparent">
                                <SimpleBar style={{ width: "100%", height: "100%" }}>
                                    {/* Favorites Section */}
                                    {/*}
                                    <div className="border-b border-[#2a2a2d]">
                                        <div className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Star className="h-3 w-3 text-amber-300" />
                                                <span className="text-sm text-gray-300">Favorites</span>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-2 text-xs px-1.5 py-0.5 rounded bg-[#2a2a2d] text-white">3</span>
                                            </div>
                                        </div>
                                    </div>
                                    */}

                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeSectionTab}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <TabsContent 
                                                value="instructions" 
                                                style={{ 
                                                    display: activeSectionTab === "instructions" ? "block" : "none",
                                                    marginTop: 0 
                                                }}
                                            >
                                                <GroupedInstructionsAccordion />
                                            </TabsContent>
                                            <TabsContent 
                                                value="programs" 
                                                style={{ 
                                                    display: activeSectionTab === "programs" ? "block" : "none",
                                                    marginTop: 0,
                                                    padding: "16px" 
                                                }}
                                            >
                                                <ToolboxPrograms />
                                            </TabsContent>
                                            <TabsContent 
                                                value="accounts" 
                                                style={{ 
                                                    display: activeSectionTab === "accounts" ? "block" : "none",
                                                    marginTop: 0 
                                                }}
                                            >
                                                <div className="p-8 text-center">
                                                    <Settings className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                                                    <h3 className="text-sm font-medium text-slate-300 mb-2">Account Templates</h3>
                                                    <p className="text-xs text-slate-500">Pre-configured account structures coming soon</p>
                                                </div>
                                            </TabsContent>
                                            <TabsContent 
                                                value="inputs" 
                                                style={{ 
                                                    display: activeSectionTab === "inputs" ? "block" : "none",
                                                    marginTop: 0 
                                                }}
                                            >
                                                <div className="p-8 text-center">
                                                    <Play className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                                                    <h3 className="text-sm font-medium text-slate-300 mb-2">Input Components</h3>
                                                    <p className="text-xs text-slate-500">Reusable input elements coming soon</p>
                                                </div>
                                            </TabsContent>
                                        </motion.div>
                                    </AnimatePresence>
                                </SimpleBar>
                            </div>
                        </Tabs>
                    </TabsContent>

                    <TabsContent
                        value="offChain"
                        style={{ 
                            flex: 1, 
                            display: activeChainTab === "offChain" ? "flex" : "none",
                            flexDirection: "column", 
                            overflow: "hidden", 
                            marginTop: 0
                        }}
                    >
                        <SimpleBar style={{ width: "100%", height: "100%" }}>
                            <div>
                                {/* Favorites Section */}
                                <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
                                    <div className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4 text-amber-400" />
                                            <span className="font-medium text-white">Favorites</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="mr-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">2</span>
                                        </div>
                                    </div>
                                </div>

                                <GroupedOffChainAccordion />
                            </div>
                        </SimpleBar>
                    </TabsContent>
                </Tabs>
            </div>
        );
    }
);