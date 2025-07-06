/**
 * Defines the Docker image to use for building Solana programs.
 * Uses the pre-baked SolanaFlow toolchain image that already contains
 * the Rust toolchain, Solana CLI, and Anchor CLI.
 */

// Default to the pre-baked SolanaFlow toolchain image for amd64
export const builderImage = process.env.SOLANAFLOW_BUILD_IMAGE
                         ?? 'ghcr.io/sequence4/solana-toolchain:builder-latest-amd64'; 