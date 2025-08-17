import React, { useState } from "react";
import {
    AccordionRoot,
    AccordionItem,
    AccordionItemTrigger,
    AccordionItemContent,
} from "@/components/ui/accordion";
import { InstructionCard } from "./ToolboxInstructions";
import { createNftNode } from "../../../../data/nodes/offChain/nftMetaplex/createNftNodeData";
import { mintNftNode } from "../../../../data/nodes/offChain/nftMetaplex/mintNftNodeData";
import { 
    ChevronDown, 
    ChevronUp, 
    Package, 
    Layers, 
    Briefcase, 
    Droplet, 
    Coins
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { theme } from "../../../../styles/theme";

// Add styles for the accordion
const accordionStyles = `
  .accordion-item[data-state="open"] .chevron-icon {
    transform: rotate(180deg);
  }
`;

const offChainInstructions = [
    {
        label: "Fungible Tokens",
        icon: <Coins className="h-4 w-4 text-white" />,
        color: "blue",
        gradient: "from-blue-500 to-cyan-500",
        items: [
            { name: "Create a Token Mint", flow: "off-chain" },
            { name: "Mint a Token", flow: "off-chain" },
            { name: "Transfer a Token", flow: "off-chain" },
            { name: "Burn a Token", flow: "off-chain" },
            { name: "Create Associated Token Account", flow: "off-chain" },
            { name: "Freeze a Token Account", flow: "off-chain" },
            { name: "Thaw a Frozen Token Account", flow: "off-chain" },
            { name: "Set Token Authority", flow: "off-chain" },
            { name: "Close a Token Account", flow: "off-chain" },
        ]
    },
    {
        label: "NFTs (Metaplex)",
        icon: <Layers className="h-4 w-4 text-white" />,
        color: "purple",
        gradient: "from-purple-500 to-pink-500",
        items: [
            { name: "Mint an NFT", flow: "off-chain", nodeDefinition: createNftNode },
            { name: "Transfer an NFT", flow: "off-chain" },
            { name: "Burn an NFT", flow: "off-chain" },
            { name: "Create Candy Machine", flow: "off-chain" },
            { name: "Add Items to Candy Machine", flow: "off-chain" },
            { name: "Mint from Candy Machine", flow: "off-chain", nodeDefinition: mintNftNode },
            { name: "Update Candy Machine", flow: "off-chain" },
            { name: "Delete Candy Machine", flow: "off-chain" },
        ]
    },
    {
        label: "Auction House (Metaplex)",
        icon: <Package className="h-4 w-4 text-white" />,
        color: "amber",
        gradient: "from-orange-500 to-amber-500",
        items: [
            { name: "Create Auction", flow: "off-chain" },
            { name: "Place Bid", flow: "off-chain" },
            { name: "Cancel Auction", flow: "off-chain" },
        ]
    },
    {
        label: "Governance",
        icon: <Briefcase className="h-4 w-4 text-white" />,
        color: "green",
        gradient: "from-emerald-500 to-teal-500",
        items: [
            { name: "Create Proposal", flow: "off-chain" },
            { name: "Cast Vote", flow: "off-chain" },
            { name: "Execute Proposal", flow: "off-chain" },
        ]
    },
];

export function GroupedOffChainAccordion() {
    const [openItems, setOpenItems] = useState<string[]>(["Fungible Tokens"]);

    return (
        <div className="bg-sidebar-accent/10 p-0">
            <style>{accordionStyles}</style>
            <AccordionRoot 
                type="multiple" 
                defaultValue={["Fungible Tokens"]}
            >
                {offChainInstructions.map((group, index) => {
                    const isOpen = openItems.includes(group.label);
                    
                    return (
                        <motion.div
                            key={group.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                            <AccordionItem
                                value={group.label}
                                className="border-b accordion-item overflow-hidden"
                                style={{ borderColor: theme.colors.border.primary }}
                            >
                                <AccordionItemTrigger
                                    className="group flex items-center justify-between w-full px-3 py-2 text-sm font-medium transition-all duration-300 backdrop-blur-sm relative hover:bg-opacity-5"
                                    style={{
                                        backgroundColor: 'transparent',
                                    }}
                                >
                                    {/* Gradient background on hover */}
                                    <div className={`absolute inset-0 bg-gradient-to-r ${group.gradient}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                                    
                                    <div className="flex items-center gap-2 relative z-10">
                                        <motion.div
                                            whileHover={{ scale: 1.1, rotate: 5 }}
                                            className="h-6 w-6 rounded-md flex items-center justify-center"
                                            style={{
                                                background: `linear-gradient(to right, ${group.color === 'blue' ? theme.colors.accent.primary : group.color === 'purple' ? theme.colors.accent.purple : group.color === 'green' ? theme.colors.accent.success : theme.colors.accent.warning}20, ${group.color === 'blue' ? theme.colors.accent.primary : group.color === 'purple' ? theme.colors.accent.purple : group.color === 'green' ? theme.colors.accent.success : theme.colors.accent.warning}20)`,
                                                borderWidth: '1px',
                                                borderStyle: 'solid',
                                                borderColor: theme.colors.border.primary,
                                            }}
                                        >
                                            {group.icon}
                                        </motion.div>
                                        <span 
                                            className="text-xs font-medium transition-colors duration-200"
                                            style={{ color: theme.colors.text.primary }}
                                        >
                                            {group.label}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 relative z-10">
                                        <motion.span 
                                            whileHover={{ scale: 1.05 }}
                                            className="px-1.5 py-0.5 text-[10px] rounded-md border"
                                            style={{
                                                backgroundColor: theme.colors.bg.tertiary,
                                                borderColor: theme.colors.border.primary,
                                                color: theme.colors.text.secondary,
                                            }}
                                        >
                                            {group.items.length}
                                        </motion.span>
                                        <motion.div
                                            animate={{ rotate: isOpen ? 180 : 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                        >
                                            <ChevronDown 
                                                className="h-3 w-3 transition-colors duration-200" 
                                                style={{ color: theme.colors.text.tertiary }}
                                            />
                                        </motion.div>
                                    </div>
                                </AccordionItemTrigger>

                                <AccordionItemContent className="overflow-hidden">
                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                                className="border-l-2 ml-4"
                                                style={{
                                                    borderColor: theme.colors.border.secondary,
                                                }}
                                            >
                                                <div className="pl-4 pr-3 pb-1 space-y-0.5">
                                                    {group.items.map((instruction, itemIndex) => (
                                                        <motion.div
                                                            key={instruction.name}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ 
                                                                duration: 0.2, 
                                                                delay: itemIndex * 0.03,
                                                                ease: "easeOut"
                                                            }}
                                                            className="text-sm w-full"
                                                        >
                                                            <InstructionCard
                                                                key={instruction.name}
                                                                name={instruction.name}
                                                                flow={instruction.flow}
                                                                nodeDefinition={instruction.nodeDefinition}
                                                                isNew={itemIndex < 1 && index === 0} // Mark first item of first group as new
                                                                isFavorite={itemIndex === 0 && index === 1} // Mark first item of second group as favorite
                                                            />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </AccordionItemContent>
                            </AccordionItem>
                        </motion.div>
                    );
                })}
            </AccordionRoot>
        </div>
    );
} 