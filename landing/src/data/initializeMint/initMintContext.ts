export const initMintContextNode = {
  id: "init-mint-context",
  type: "contextNode",
  position: { x: -600, y: 0 },
  data: {
    label: "Initialize Mint Context",
    accounts: [
      {
        label: "Mint Account",
        type: "Pubkey",
        description: "New mint account (must sign the tx)",
        isWritable: true,
        isSigner: true,
      },
      {
        label: "Payer",
        type: "Pubkey",
        description: "Pays rent + fees",
        isWritable: true,
        isSigner: true,
      },
      {
        label: "System Program",
        type: "Program",
        description: "System program",
      },
      {
        label: "Token Program",
        type: "Program",
        description: "SPL Token program",
      },
      {
        label: "Rent Sysvar",
        type: "Sysvar",
        description: "Rent sysvar",
      },
    ],
  },
};