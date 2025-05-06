export const mintToEvents = {
  id: "mint-to-events",
  type: "eventsNode",
  position: { x: 400, y: 160 },
  data: {
    label: "Mint To Events",
    events: [
      {
        name: "MintToCompleted",
        description: "Emitted after successful mint to an account",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "destination", type: "pubkey" },
          { name: "amount", type: "u64" },
        ],
      },
    ],
  },
};
