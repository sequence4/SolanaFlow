export const createMetadataInput = {
  data: {
    label: "Create Metadata Inputs",
    fields: [
      { label: "Name", description: "Name of the token", required: true },
      { label: "Symbol", description: "Token symbol (max 10 chars)", required: true },
      { label: "URI", description: "URI of the token metadata JSON", required: true },
    ],
  },
}; 