export const initMintErrorCodesNode = {
  id: "init-mint-error-codes",
  type: "errorCodesNode",
  position: { x: 400, y: 0 },
  data: {
    label: "Initialize Mint Error Codes",
    description: "Error variants for mint initialisation",
    codes: [
      {
        name: "MintNotOwnedByTokenProgram",
        message: "Mint account is not owned by the Token Program.",
      },
      {
        name: "DestinationNotOwnedByTokenProgram",
        message: "Destination account is not owned by the Token Program.",
      },
      {
        name: "InvalidDecimalsValue",
        message: "Decimals value must be between 0 and 9",
      },
    ],
  },
};
