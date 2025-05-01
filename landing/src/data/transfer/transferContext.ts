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
          description: "The source token account",
          isWritable: true,
          isSigner: false
        },
        {
          label: "Destination",
          type: "TokenAccount",
          description: "The destination token account",
          isWritable: true,
          isSigner: false
        },
        {
          label: "Authority",
          type: "Keypair",
          description: "The authority who can transfer tokens from the source account",
          isWritable: false,
          isSigner: true
        },
        {
          label: "Token Program",
          type: "Program",
          description: "SPL Token program",
          isWritable: false,
          isSigner: false
        }
      ],
    },
  };
  