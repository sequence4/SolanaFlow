/**
 * Shared constants for Solana program deployment
 */

import { PublicKey } from "@solana/web3.js";
import { Step } from "@/context/logs/TaskLogsContext";

// Standard chunk size for Solana BPF loader write operations
// BPF loader accepts writes up to 1232 bytes, but we use a more conservative value
export const BPF_LOADER_CHUNK_SIZE = 900;

// BPF Upgrade Loader program ID
export const BPF_UPGRADE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

// Byte length of the header in the buffer account (tag + discriminant + pubkey)
export const BPF_BUFFER_HEADER_LEN = 40;  // 4 (tag) + 4 (discr) + 32 (pubkey) 


export const projectCreationSteps: Step[] = [
  {
    icon: "Server",
    message: "Preparing container environment...",
    details: "Creating a Docker container and allocating server resources.",
  },
  {
    icon: "Database",
    message: "Saving project metadata...",
    details: "Storing project details (name, description, etc.) in the database.",
  },
  {
    icon: "Code",
    message: "Configuring React App...",
    details: "Running Anchor init and generating the Create React App starter template.",
  },
  {
    icon: "Cpu",
    message: "Initializing Anchor...",
    details: "Running Anchor init and installing dependencies.",
  },
  {
    icon: "HardDrive",
    message: "Verifying environment...",
    details: "Starting the dev server and checking that the project is ready.",
  },
];