export const transferContext = {
  id: "transfer-context",
  type: "contextNode",
  position: { x: -600, y: 0 },
  data: {
    label: "Transfer Tokens Context",
    accounts: [
      {
        label: "Source",
        type: "TokenAccount",
        description: "Source token account",
        isWritable: true,
        isSigner: false,
      },
      {
        label: "Destination",
        type: "TokenAccount",
        description: "Destination token account",
        isWritable: true,
        isSigner: false,
      },
      {
        label: "Authority",
        type: "Signer",
        description: "Authority allowed to transfer",
        isWritable: false,
        isSigner: true,
      },
      {
        label: "Token Program",
        type: "Program",
        description: "SPL Token program",
      },
    ],
  },
};
