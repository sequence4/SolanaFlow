export const mintToContext = {
  id: "mint-to-context",
  type: "contextNode",
  position: { x: -600, y: 0 },
  data: {
    label: "Mint To Context",
    accounts: [
      {
        label: "Mint Authority",
        type: "AccountInfo",
        description: "Signer authorised to mint",
        isWritable: false,
        isSigner: true,
      },
      {
        label: "Token Mint",
        type: "AccountInfo",
        description: "Existing token mint",
        isWritable: false,
        isSigner: false,
      },
      {
        label: "Destination Token Account",
        type: "AccountInfo",
        description: "Receives newly-minted tokens",
        isWritable: true,
        isSigner: false,
      },
      {
        label: "Token Program",
        type: "Program",
        description: "SPL Token program",
      },
    ],
  },
};
