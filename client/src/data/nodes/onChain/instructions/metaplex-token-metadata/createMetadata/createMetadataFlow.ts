import { createMetadataCode } from "./code/createMetadataCode";
import { createMetadataContext } from "./createMetadataContext";
import { createMetadataInput } from "./createMetadataInput";
import { createMetadataEvents } from "./createMetadataEvents";

const contextData = createMetadataContext.data.accounts || [];
const inputsData = createMetadataInput.data.fields || [];
const eventsData = createMetadataEvents.data.events || [];

export const createMetadataFlow = {
  name: "Create Metadata Flow",
  description: "Creates an on-chain metadata account for an SPL token (Metaplex Token Metadata)",
  nodes: [
    {
      id: "create-metadata-instruction",
      type: "instructionGroupNode",
      position: { x: 0, y: 0 },
      data: {
        label: "Create Metadata",
        description: "Invoke Metaplex Token Metadata program to attach name, symbol, URI to a mint",
        code: createMetadataCode,
        accounts: contextData,
        parameters: inputsData,
        events: eventsData,
      },
    },
  ],
  edges: [],
}; 