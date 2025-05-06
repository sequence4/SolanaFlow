import { mintToCode } from "./code/mintToCode";
import { createFlowNode } from "../../../utils/nodeFactory";
import { mintToEvents } from "./mintToEvents";

export const mintTo = createFlowNode({
    id: 'mint-to',
    type: 'instructionGroupNode',
    position: { x: 400, y: 0 },
    data: {
      label: 'Mint To',
      description: 'Mints new tokens to a specified token account',
      accounts: [
        { 
          label: 'Mint Authority', 
          type: 'Signer', 
          description: 'The account authorized to mint new tokens' 
        },
        { 
          label: 'Token Mint', 
          type: 'AccountInfo', 
          description: 'The mint account from which to mint new tokens' 
        },
        { 
          label: 'Destination Token Account', 
          type: 'AccountInfo', 
          description: 'The token account receiving the newly minted tokens' 
        },
        { 
          label: 'Token Program', 
          type: 'Program', 
          description: 'The SPL Token program ID' 
        },
      ],
      parameters: [
        { 
          label: 'Amount', 
          type: 'u64', 
          value: '1000000' 
        },
      ],
      context: [
        { label: 'Mint Account', type: 'Pubkey', value: 'Pubkey', nodeId: 'mint-account_mint-to' },
        { label: 'Associated Token Account', type: 'Pubkey', value: 'Pubkey', nodeId: 'ata_mint-to' },
        { label: 'Mint Authority', type: 'Pubkey', value: 'Pubkey', nodeId: 'mint-auth-account_mint-to' },
        { label: 'Token Program', type: 'Pubkey', value: 'Pubkey', nodeId: 'token-program_mint-to' },
      ],
      inputs: [
        { label: 'Mint Amount', type: 'u64', value: 'u64', nodeId: 'mint-to-input-node' },
      ],
      outputs: [
      ],
      errorCodes: [
        { name: 'MintNotOwnedByTokenProgram', message: 'Mint account is not owned by the Token Program.' },
        { name: 'DestinationNotOwnedByTokenProgram', message: 'Destination account is not owned by the Token Program.' }
      ],
      events: mintToEvents.data.events,
      code: mintToCode,
    },
  });
  