export const createMetadataEvents = {
  data: {
    label: "Create Metadata Events",
    events: [
      {
        name: "MetadataCreated",
        description: "Emitted when the metadata account is created for the token mint",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "metadata", type: "pubkey" },
        ],
      },
    ],
  },
}; 