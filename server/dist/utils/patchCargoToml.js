"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.patchCargoToml = patchCargoToml;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function patchCargoToml(cargoTomlPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs.existsSync(cargoTomlPath)) {
            throw new Error(`Cargo.toml not found at: ${cargoTomlPath}`);
        }
        const originalToml = fs.readFileSync(cargoTomlPath, "utf8");
        const alreadyHasPatch = originalToml.includes("[patch.crates-io]") &&
            originalToml.includes("bytemuck_derive =");
        if (alreadyHasPatch) {
            console.log(`[INFO] bytemuck_derive override already found in ${cargoTomlPath}. No change needed.`);
            return;
        }
        if (originalToml.includes("[patch.crates-io]")) {
            const patchedToml = originalToml.replace(/\[patch\.crates-io\]/, `[patch.crates-io]\nbytemuck_derive = "=1.8.1"`);
            fs.writeFileSync(cargoTomlPath, patchedToml, "utf8");
            console.log(`[INFO] Inserted bytemuck_derive override in existing [patch.crates-io] block.`);
        }
        else {
            const appendedToml = `${originalToml.trim()}

[patch.crates-io]
bytemuck_derive = "=1.8.1"
`;
            fs.writeFileSync(cargoTomlPath, appendedToml, "utf8");
            console.log(`[INFO] Added new [patch.crates-io] block with bytemuck_derive override.`);
        }
    });
}
if (require.main === module) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const cargoTomlPath = process.argv[2];
            if (!cargoTomlPath) {
                throw new Error("Usage: ts-node patchCargoToml.ts /path/to/Cargo.toml");
            }
            yield patchCargoToml(path.resolve(cargoTomlPath));
            console.log("[SUCCESS] Cargo.toml patched successfully.");
        }
        catch (err) {
            console.error("[ERROR]", err.message || err);
            process.exit(1);
        }
    }))();
}
