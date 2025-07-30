/**
 * Shared constants for Solana program deployment
 */

import { PublicKey } from "@solana/web3.js";

// Standard chunk size for Solana BPF loader write operations
// BPF loader accepts writes up to 1232 bytes, but we use a more conservative value
export const BPF_LOADER_CHUNK_SIZE = 900;

// BPF Upgrade Loader program ID
export const BPF_UPGRADE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab11111111111111111111111111");

// Byte length of the header in the buffer account (tag + discriminant + pubkey)
export const BPF_BUFFER_HEADER_LEN = 40;  // 4 (tag) + 4 (discr) + 32 (pubkey) 