// Import all available SPL Token Program flows
import { initMintFlow } from "../nodes/onChain/instructions/spl-token-program/initializeMint/initMintFlow";
import { mintToFlow } from "../nodes/onChain/instructions/spl-token-program/mintTo/mintToFlow";


import { transferFlow } from "../nodes/onChain/instructions/spl-token-program/transfer/transferFlow";
import { burnFlow } from "../nodes/onChain/instructions/spl-token-program/burn/burnFlow";
import { approveFlow } from "../nodes/onChain/instructions/spl-token-program/approve/approveFlow";
import { revokeFlow } from "../nodes/onChain/instructions/spl-token-program/revoke/revokeFlow";
import { setAuthorityFlow } from "../nodes/onChain/instructions/spl-token-program/setAuthority/setAuthorityFlow";
import { closeAccountFlow } from "../nodes/onChain/instructions/spl-token-program/closeAccount/closeAccountFlow";
import { freezeAccountFlow } from "../nodes/onChain/instructions/spl-token-program/freezeAccount/freezeAccountFlow";
import { thawAccountFlow } from "../nodes/onChain/instructions/spl-token-program/thawAccount/thawAccountFlow";
import { initAccountFlow } from "../nodes/onChain/instructions/spl-token-program/initializeAccount/initAccountFlow";
import { amountToUiAmountFlow } from "../nodes/onChain/instructions/spl-token-program/amountToUiAmount/amountToUiAmountFlow";
import { approveCheckedFlow } from "../nodes/onChain/instructions/spl-token-program/approvedChecked/approveCheckedFlow";
import { burnCheckedFlow } from "../nodes/onChain/instructions/spl-token-program/burnChecked/burnCheckedFlow";
import { getAccountDataSizeFlow } from "../nodes/onChain/instructions/spl-token-program/getAccountDataSize/getAccountDataSizeFlow";
import { initializeAccount2Flow } from "../nodes/onChain/instructions/spl-token-program/initializeAccount2/initAccount2Flow";
import { initializeAccount3Flow } from "../nodes/onChain/instructions/spl-token-program/initializeAccount3/initializeAccount3Flow";
import { initializeImmutableOwnerFlow } from "../nodes/onChain/instructions/spl-token-program/initializeImmutableOwner/initializeImmutableOwnerFlow";
import { initializeMint2Flow } from "../nodes/onChain/instructions/spl-token-program/initializeMint2/initializeMint2Flow";
import { initializeMultisigFlow } from "../nodes/onChain/instructions/spl-token-program/initializeMultisig/initializeMultisigFlow";
import { initializeMultisig2Flow } from "../nodes/onChain/instructions/spl-token-program/initializeMultisig2/initializeMultisig2Flow";
import { isValidSignerIndexFlow } from "../nodes/onChain/instructions/spl-token-program/isValidSignerIndex/isValidSignerIndexFlow";
import { mintToCheckedFlow } from "../nodes/onChain/instructions/spl-token-program/mintToChecked/mintToCheckedFlow";
import { syncNativeFlow } from "../nodes/onChain/instructions/spl-token-program/syncNative/syncNativeFlow";
import { transferCheckedFlow } from "../nodes/onChain/instructions/spl-token-program/transferChecked/transferCheckedFlow";
import { uiAmountToAmountFlow } from "../nodes/onChain/instructions/spl-token-program/uiAmountToAmount/uiAmountToAmountFlow"; 

// NFT/Metaplex instructions
import { createMetadataFlow } from "../nodes/onChain/instructions/metaplex-token-metadata/createMetadata/createMetadataFlow";

// Debug: Verify flows are loaded correctly - only in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log("🔍 SPL Token Flows Verification:");
  [
    { name: "Initialize Mint", flow: initMintFlow },
    { name: "Mint Tokens", flow: mintToFlow },
    { name: "Transfer Tokens", flow: transferFlow },
    { name: "Burn Tokens", flow: burnFlow },
    { name: "Approve Delegate", flow: approveFlow },
  ].forEach(({ name, flow }) => {
    console.log(`${name}:`, {
      exists: !!flow,
      hasNodes: !!flow?.nodes,
      nodesCount: flow?.nodes?.length,
      firstNodeLabel: flow?.nodes?.[0]?.data?.label,
      accountsCount: flow?.nodes?.[0]?.data?.accounts?.length,
      parametersCount: flow?.nodes?.[0]?.data?.parameters?.length,
      errorCodesCount: flow?.nodes?.[0]?.data?.errorCodes?.length,
      eventsCount: flow?.nodes?.[0]?.data?.events?.length
    });
  });
}


export const groupedInstructions = [
    {
      label: "SPL Token Instructions",
      items: [
        // Core Token Operations
        { name: "Initialize Mint", flow: initMintFlow },
        { name: "Mint Tokens", flow: mintToFlow },
        { name: "Transfer Tokens", flow: transferFlow },
        { name: "Burn Tokens", flow: burnFlow },
        
        // Account Management
        { name: "Initialize Account", flow: initAccountFlow },
        { name: "Close Account", flow: closeAccountFlow },
        { name: "Initialize Account V2", flow: initializeAccount2Flow },
        { name: "Initialize Account V3", flow: initializeAccount3Flow },
        
        // Authorization & Approval
        { name: "Approve Delegate", flow: approveFlow },
        { name: "Revoke Approval", flow: revokeFlow },
        { name: "Set Authority", flow: setAuthorityFlow },
        
        // Account Control
        { name: "Freeze Account", flow: freezeAccountFlow },
        { name: "Thaw Account", flow: thawAccountFlow },
        
        // Multisig Operations
        { name: "Initialize Multisig", flow: initializeMultisigFlow },
        { name: "Initialize Multisig V2", flow: initializeMultisig2Flow },
        
        // Advanced Operations
        { name: "Initialize Mint V2", flow: initializeMint2Flow },
        { name: "Mint Tokens (Checked)", flow: mintToCheckedFlow },
        { name: "Transfer (Checked)", flow: transferCheckedFlow },
        { name: "Burn (Checked)", flow: burnCheckedFlow },
        { name: "Approve (Checked)", flow: approveCheckedFlow },
        
        // Utility Operations
        { name: "Amount to UI Amount", flow: amountToUiAmountFlow },
        { name: "UI Amount to Amount", flow: uiAmountToAmountFlow },
        { name: "Get Account Data Size", flow: getAccountDataSizeFlow },
        { name: "Sync Native", flow: syncNativeFlow },
        { name: "Initialize Immutable Owner", flow: initializeImmutableOwnerFlow },
        { name: "Is Valid Signer Index", flow: isValidSignerIndexFlow },
      ],
    },
    {
      label: "NFT Instructions",
      items: [
        { name: "Create Metadata", flow: createMetadataFlow },
        { name: "Update Metadata", flow: initMintFlow },
        { name: "Create Master Edition", flow: initMintFlow },
      ],
    },
    {
      label: "DAO / Governance",
      items: [
        { name: "Create Proposal", flow: initMintFlow },
        { name: "Cast Vote", flow: initMintFlow },
        { name: "Execute Proposal", flow: initMintFlow },
      ],
    },
    {
      label: "Liquidity / DeFi",
      items: [
        { name: "Initialize Swap", flow: initMintFlow },
        { name: "Swap", flow: initMintFlow },
        { name: "Deposit Liquidity", flow: initMintFlow },
        { name: "Withdraw Liquidity", flow: initMintFlow },
      ],
    },
  ];
  