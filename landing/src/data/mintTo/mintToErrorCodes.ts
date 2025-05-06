export const mintToErrorCodes = {
  id: "mint-to-error-codes",
  type: "errorCodesNode",
  position: { x: 400, y: 0 },
  data: {
    label: "Mint To Error Codes",
    codes: [
      {
        name: "MintNotOwnedByTokenProgram",
        message: "Mint account is not owned by the Token Program.",
      },
      {
        name: "DestinationNotOwnedByTokenProgram",
        message: "Destination account is not owned by the Token Program.",
      },
    ],
  },
};
