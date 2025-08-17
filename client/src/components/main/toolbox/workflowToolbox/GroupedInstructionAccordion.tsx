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
    <div className="bg-sidebar-accent/10 p-0">
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
                className="border-b accordion-item overflow-hidden border-sidebar-border"
              >
                <AccordionItemTrigger
                  className="group flex items-center justify-between w-full px-3 py-2 text-sm font-medium transition-all duration-300 backdrop-blur-sm relative hover:bg-sidebar-accent/5 bg-transparent"
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${categoryInfo.gradient}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="h-6 w-6 rounded-md flex items-center justify-center bg-sidebar-accent border border-sidebar-border"
                    >
                      {categoryInfo.icon}
                    </motion.div>
                    <span 
                      className="text-xs font-medium transition-colors duration-200 text-foreground"
                    >
                      {group.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 relative z-10">
                    <motion.span 
                      whileHover={{ scale: 1.05 }}
                      className="px-1.5 py-0.5 text-[10px] rounded-md border bg-sidebar-accent border-sidebar-border text-muted-foreground"
                    >
                      {group.items.length}
                    </motion.span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <ChevronDown 
                        className="h-3 w-3 transition-colors duration-200 text-muted-foreground" 
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
                        className="border-l-2 ml-4 border-sidebar-border"
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