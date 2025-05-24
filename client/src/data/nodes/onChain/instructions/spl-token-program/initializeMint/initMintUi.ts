export const initMintUi = {
    widget: "InstructionCard",
    sections: [
      {
        slot: "form",
        fields: {
          decimals: {
            "ui:widget": "NumberInput",
            minimum: 0,
            maximum: 9,
            designToken: "$size-control"
          },
          mintAuthority: {
            "ui:widget": "PubkeyAutocomplete",
            designToken: "$field-accent"
          },
          freezeAuthority: {
            "ui:widget": "PubkeyAutocomplete",
            allowNull: true
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
  