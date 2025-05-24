export const mintToUi = {
    widget: "InstructionCard",
    sections: [
      {
        slot: "form",
        fields: {
          amount: {
            "ui:widget": "NumberInput",
            minimum: 1,
            designToken: "$size-control"
          },
          destination: {
            "ui:widget": "PubkeyAutocomplete",
            designToken: "$field-accent"
          }
        }
      },
      {
        slot: "success",
        view: {
          widget: "ExplorerLink",
          props: { cluster: "devnet" }
        }
      }
    ],
    styleTokens: ["$brand-primary", "$radius-md"]
  } as const;
  