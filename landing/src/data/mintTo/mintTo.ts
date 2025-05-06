import { mintToCode } from "./code/mintToCode";
import { mintToContext } from "./mintToContext";
import { mintToInputNode } from "./mintToInputNode";
import { mintToErrorCodes } from "./mintToErrorCodes";
import { mintToEvents } from "./mintToEvents";

const contextData = mintToContext.data.accounts || [];
const inputsData = mintToInputNode.data.inputs || [];
const errorCodesData = mintToErrorCodes.data.codes || [];
const eventsData = mintToEvents.data.events || [];

export const mintTo = {
  name: "Mint To Flow",
  nodes: [
    {
      id: "mint-to-instruction",
      type: "instructionGroupNode",
      position: { x: 400, y: 0 },
      data: {
        label: "Mint To",
        description: "Mints new tokens to a specified token account.",
        code: mintToCode,
        accounts: contextData,
        parameters: inputsData,
        errorCodes: errorCodesData,
        events: eventsData,
      },
    },
  ],
  edges: [],
};
  