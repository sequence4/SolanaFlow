"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.functionDefs = void 0;
exports.getWalletBalanceSol = getWalletBalanceSol;
const web3_js_1 = require("@solana/web3.js");
async function getWalletBalanceSol(address) {
    const connection = new web3_js_1.Connection("https://api.devnet.solana.com");
    const pubKey = new web3_js_1.PublicKey(address);
    const lamports = await connection.getBalance(pubKey);
    const sol = lamports / 1_000_000_000;
    return sol;
}
exports.functionDefs = [
    {
        type: 'function',
        function: {
            name: "getWalletBalance",
            description: "Fetches the user's Solana wallet balance in SOL.",
            parameters: {
                type: "object",
                properties: {
                    address: {
                        type: "string",
                        description: "Base58 Solana public key"
                    }
                },
                required: ["address"],
                additionalProperties: false
            },
        }
    }
];
