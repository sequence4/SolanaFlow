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
import { theme } from '../../../../styles/theme';

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
            <div 
                className="flex flex-col w-full h-full backdrop-blur-xl"
                style={{ backgroundColor: theme.colors.bg.secondary }}
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
                            {/* Enhanced Modern Tab Switcher */}
                            <div 
                                className="flex border-b backdrop-blur-sm overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent relative"
                                style={{
                                    borderColor: theme.colors.border.primary,
                                    backgroundColor: theme.colors.bg.hover,
                                }}
                            >
                                {/* Sliding indicator with glow effect */}
                                <motion.div
                                    className="absolute bottom-0 h-0.5"
                                    layoutId="activeTab"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    style={{
                                        left: (() => {
                                            const tabs = ["instructions", "programs", "accounts", "inputs"];
                                            const index = tabs.indexOf(activeSectionTab);
                                            return `${index * 25}%`;
                                        })(),
                                        width: "25%",
                                        background: `linear-gradient(to right, ${theme.colors.accent.primary}, ${theme.colors.accent.purple})`,
                                        boxShadow: `0 0 8px ${theme.colors.accent.primary}50`,
                                    }}
                                />
                                
                                {[
                                    { id: "instructions", label: "Instructions", icon: tabIcons.instructions, count: 12 },
                                    { id: "programs", label: "Programs", icon: tabIcons.programs, count: 4 },
                                    { id: "accounts", label: "Accounts", icon: tabIcons.accounts, count: 0 },
                                    { id: "inputs", label: "Inputs", icon: tabIcons.inputs, count: 0 },
                                ].map((tab) => (
                                    <motion.button
                                        key={tab.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 whitespace-nowrap h-9 relative flex-1"
                                        style={{
                                            color: activeSectionTab === tab.id 
                                                ? theme.colors.text.primary 
                                                : theme.colors.text.secondary,
                                        }}
                                        onClick={() => setActiveSectionTab(tab.id)}
                                        onMouseEnter={(e) => {
                                            if (activeSectionTab !== tab.id) {
                                                e.currentTarget.style.backgroundColor = theme.colors.bg.tertiary;
                                                e.currentTarget.style.color = theme.colors.text.primary;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (activeSectionTab !== tab.id) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = theme.colors.text.secondary;
                                            }
                                        }}
                                    >
                                        <span 
                                            style={{
                                                color: activeSectionTab === tab.id 
                                                    ? theme.colors.accent.primary 
                                                    : theme.colors.text.tertiary
                                            }}
                                        >
                                            {tab.icon}
                                        </span>
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span 
                                                className="ml-1 px-1.5 py-0.5 text-[9px] rounded-full border text-center min-w-[16px]"
                                                style={{
                                                    backgroundColor: activeSectionTab === tab.id 
                                                        ? `${theme.colors.accent.primary}20`
                                                        : `${theme.colors.text.tertiary}10`,
                                                    borderColor: activeSectionTab === tab.id 
                                                        ? `${theme.colors.accent.primary}30`
                                                        : `${theme.colors.text.tertiary}20`,
                                                    color: activeSectionTab === tab.id 
                                                        ? theme.colors.accent.primary
                                                        : theme.colors.text.tertiary,
                                                }}
                                            >
                                                {tab.count}
                                            </span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>

                            <div 
                                className="flex-1 overflow-hidden"
                                style={{ backgroundColor: 'transparent' }}
                            >
                                <SimpleBar style={{ width: "100%", height: "100%" }}>

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
                                                    <Settings 
                                                        className="h-12 w-12 mx-auto mb-4" 
                                                        style={{ color: theme.colors.text.tertiary }}
                                                    />
                                                    <h3 
                                                        className="text-sm font-medium mb-2"
                                                        style={{ color: theme.colors.text.secondary }}
                                                    >
                                                        Account Templates
                                                    </h3>
                                                    <p 
                                                        className="text-xs"
                                                        style={{ color: theme.colors.text.tertiary }}
                                                    >
                                                        Pre-configured account structures coming soon
                                                    </p>
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
                                                    <Play 
                                                        className="h-12 w-12 mx-auto mb-4" 
                                                        style={{ color: theme.colors.text.tertiary }}
                                                    />
                                                    <h3 
                                                        className="text-sm font-medium mb-2"
                                                        style={{ color: theme.colors.text.secondary }}
                                                    >
                                                        Input Components
                                                    </h3>
                                                    <p 
                                                        className="text-xs"
                                                        style={{ color: theme.colors.text.tertiary }}
                                                    >
                                                        Reusable input elements coming soon
                                                    </p>
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
                                <div 
                                    className="border-b backdrop-blur-sm"
                                    style={{
                                        borderColor: theme.colors.border.primary,
                                        backgroundColor: theme.colors.bg.hover,
                                    }}
                                >
                                    <div className="p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4" style={{ color: theme.colors.accent.warning }} />
                                            <span 
                                                className="font-medium"
                                                style={{ color: theme.colors.text.primary }}
                                            >
                                                Favorites
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            <span 
                                                className="mr-2 text-xs px-1.5 py-0.5 rounded-full border"
                                                style={{
                                                    backgroundColor: `${theme.colors.accent.warning}20`,
                                                    color: theme.colors.accent.warning,
                                                    borderColor: `${theme.colors.accent.warning}30`,
                                                }}
                                            >
                                                2
                                            </span>
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