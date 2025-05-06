export const transferInput = {
  id: "transfer-input",
  type: "inputNode",
  position: { x: -800, y: 200 },
  data: {
    label: "Inputs",
    fields: [
      {
        label: "Amount",
        type: "u64",
        value: "1000000",
        description: "The amount of tokens to transfer",
      },
    ],
  },
};
