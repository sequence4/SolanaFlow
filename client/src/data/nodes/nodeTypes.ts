import React from "react";
import { InstructionGroupNode } from "@/components/main/nodes/onChain/instruction/InstructionNode";
import { EnhancedInstructionNode } from "@/components/main/nodes/onChain/instruction/EnhancedInstructionNode";
import { InstructionNodeWrapper } from "@/components/main/nodes/onChain/instruction/InstructionNodeWrapper";
import { InputNode } from "@/components/main/nodes/onChain/inputs/inputNode";
import { OutputNode } from "@/components/main/nodes/onChain/outputs/outPutNode";
import { AccountNode } from "@/components/main/nodes/onChain/accounts/AccountNode";
import { ContextNode } from "@/components/main/nodes/onChain/context/ContextNode";
import { ErrorCodesNode } from "@/components/main/nodes/onChain/errorCodes/errorCodesNode";
import { EventsNode } from "@/components/main/nodes/onChain/events/EventsNode";
import { OffChainFunctionNode } from "@/components/main/nodes/offChain/OffChainFunctionNode";

// Feature flag for enhanced nodes - can be toggled for gradual rollout
const ENABLE_ENHANCED_NODES = true; // Enabled globally for all instructions

// Create a wrapper component that automatically uses enhanced version when enabled
const AutoInstructionNode = (props: any) => {
  return React.createElement(InstructionNodeWrapper, { ...props, useEnhanced: ENABLE_ENHANCED_NODES });
};

export const workflowNodeTypes = {
    inputNode: InputNode,
    instructionGroupNode: AutoInstructionNode, // Smart wrapper that adapts based on feature flag
    enhancedInstructionNode: EnhancedInstructionNode, // Direct enhanced type
    legacyInstructionNode: InstructionGroupNode, // Direct legacy type
    accountNode: AccountNode,
    outputNode: OutputNode,
    contextNode: ContextNode,
    errorCodesNode: ErrorCodesNode,
    eventsNode: EventsNode,

    uploadMetadataNode: OffChainFunctionNode,
    createNftNode: OffChainFunctionNode,
    mintNftNode: OffChainFunctionNode,
};
