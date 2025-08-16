export const createMetadataContext = {
  data: {
    label: "Create Metadata Context",
    accounts: [
      {
        label: "Metadata Account",
        type: "Pubkey",
        description: "The metadata PDA account (will be created by the Metaplex program)",
        isWritable: true,
        isSigner: false,
      },
      {
        label: "Token Mint",
        type: "Pubkey",
        description: "The token mint for which metadata will be created",
        isWritable: false,
        isSigner: false,
      },
      {
        label: "Mint Authority",
        type: "Pubkey",
        description: "The current mint authority (will also be set as update authority)",
        isWritable: false,
        isSigner: true,
      },
      {
        label: "Payer",
        type: "Pubkey",
        description: "The account paying for the metadata account creation (and signing)",
        isWritable: true,
        isSigner: true,
      },
      {
        label: "Token Metadata Program",
        type: "Program",
        description: "The Metaplex Token Metadata program",
      },
      {
        label: "System Program",
        type: "Program",
        description: "The System program (for account creation)",
      },
      {
        label: "Rent",
        type: "Sysvar",
        description: "Rent sysvar (for rent exemption)",
      },
    ],
  },
}; 