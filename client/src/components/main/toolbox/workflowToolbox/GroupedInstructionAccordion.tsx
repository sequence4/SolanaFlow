import React, { useState } from "react";
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
} from "../../../ui/accordion";
import { groupedInstructions } from "../../../../data/toolbox/instructionItems";
import { 
  ChevronDown, 
  ChevronUp, 
  Package, 
  Layers, 
  Briefcase, 
  Droplet 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { InstructionCard } from "./ToolboxInstructions";

const accordionStyles = `
  .accordion-item[data-state="open"] .chevron-icon {
    transform: rotate(180deg);
  }
`;

export function GroupedInstructionsAccordion() {
  const [openItems, setOpenItems] = useState<string[]>(["SPL Token Instructions"]);

  // Map of category labels to their icons and colors
  const categoryIcons: Record<string, { icon: any; color: string; gradient: string }> = {
    "SPL Token Instructions": { 
      icon: <Package className="h-4 w-4 text-white" />, 
      color: "blue",
      gradient: "from-blue-500 to-cyan-500"
    },
    "NFT and Metaplex Instructions": { 
      icon: <Layers className="h-4 w-4 text-white" />, 
      color: "purple",
      gradient: "from-purple-500 to-pink-500"
    },
    "Governance Instructions": { 
      icon: <Briefcase className="h-4 w-4 text-white" />, 
      color: "green",
      gradient: "from-emerald-500 to-teal-500"
    },
    "DeFi Instructions": { 
      icon: <Droplet className="h-4 w-4 text-white" />, 
      color: "amber",
      gradient: "from-orange-500 to-amber-500"
    },
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-emerald-500";
      case "purple":
        return "bg-purple-500";
      case "amber":
        return "bg-amber-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="bg-transparent p-0">
      <style>{accordionStyles}</style>
      <AccordionRoot 
        type="multiple" 
        defaultValue={["SPL Token Instructions"]}
      >
        {groupedInstructions.map((group, index) => {
          const categoryInfo = categoryIcons[group.label] || { 
            icon: <Package className="h-4 w-4 text-white" />, 
            color: "blue",
            gradient: "from-blue-500 to-cyan-500"
          };
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
                className="border-b border-white/10 accordion-item overflow-hidden"
              >
                <AccordionItemTrigger
                  className="group flex items-center justify-between w-full p-4 text-sm font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm relative"
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${categoryInfo.gradient}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={`h-6 w-6 rounded-lg bg-gradient-to-r ${categoryInfo.gradient} flex items-center justify-center shadow-lg`}
                      style={{ boxShadow: `0 4px 20px ${categoryInfo.color === 'blue' ? 'rgba(59, 130, 246, 0.3)' : categoryInfo.color === 'purple' ? 'rgba(168, 85, 247, 0.3)' : categoryInfo.color === 'green' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}
                    >
                      {categoryInfo.icon}
                    </motion.div>
                    <span className="font-semibold text-white group-hover:text-white transition-colors duration-200">
                      {group.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <motion.span 
                      whileHover={{ scale: 1.05 }}
                      className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${categoryInfo.gradient}/20 text-white border border-white/10`}
                    >
                      {group.items.length}
                    </motion.span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors duration-200" />
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
                        className="border-l-2 border-gradient-to-b from-transparent via-white/20 to-transparent ml-4"
                      >
                        <div className="pl-6 pr-4 pb-2 space-y-1">
                          {group.items.map((instruction, itemIndex) => (
                            <motion.div
                              key={instruction.name}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ 
                                duration: 0.2, 
                                delay: itemIndex * 0.05,
                                ease: "easeOut"
                              }}
                              className="text-sm w-full"
                            >
                              <InstructionCard
                                key={instruction.name}
                                name={instruction.name}
                                flow={instruction.flow}
                                isNew={itemIndex < 1} // Mark first item as new
                                isFavorite={itemIndex === 0 && index === 0} // Mark first item of first group as favorite
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