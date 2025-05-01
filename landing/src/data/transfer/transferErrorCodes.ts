export const transferErrorCodes = {
    id: "transfer-error-codes",
    type: "errorCodesNode",
    position: { x: 400, y: 0 },
    data: {
      label: "Transfer Error Codes",
      codes: [
        {
          code: 1001,
          name: "InsufficientFunds",
          msg: "The source account has insufficient funds for this transfer"
        },
        {
          code: 1002,
          name: "InvalidAuthority",
          msg: "The provided authority is not authorized to transfer from this account"
        },
        {
          code: 1003,
          name: "AccountFrozen",
          msg: "The token account is frozen and cannot be used for transfers"
        }
      ],
    },
  };
  