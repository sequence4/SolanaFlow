"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.functionDefs = void 0;
exports.getWalletBalanceSol = getWalletBalanceSol;
const web3_js_1 = require("@solana/web3.js");
function getWalletBalanceSol(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = new web3_js_1.Connection("https://api.devnet.solana.com");
        const pubKey = new web3_js_1.PublicKey(address);
        const lamports = yield connection.getBalance(pubKey);
        const sol = lamports / 1000000000;
        return sol;
    });
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
            strict: true
        }
    }
];
