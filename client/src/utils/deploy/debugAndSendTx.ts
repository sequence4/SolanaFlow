import { Connection, PublicKey, Transaction, TransactionMessage, VersionedTransaction, Commitment } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { rpcWithRetry } from "@/utils/rpcRetry";

export async function debugAndSendTransaction(
    tx: Transaction,
    connection: Connection,
    sendTransaction: (tx: Transaction, connection: Connection, options: { 
      signers?: Keypair[];
      preflightCommitment?: Commitment;
    }) => Promise<string>,
    signers?: Keypair[],
    walletPublicKey?: PublicKey,
) {
    // Get blockhash with retry in case of rate limit
    const { value: blockhashInfo } = await rpcWithRetry<{
      value: { blockhash: string; lastValidBlockHeight: number }
    }>(
      connection, 
      "getLatestBlockhash", 
      [{ commitment: "confirmed" }], 
      "confirmed"
    );

    // Set transaction blockhash to ensure we simulate exactly what we'll send
    tx.recentBlockhash = blockhashInfo.blockhash;
    tx.lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;

    const messageV0 = new TransactionMessage({
        payerKey: walletPublicKey ?? (() => { 
          throw new Error('walletPublicKey missing when building VersionedTx'); 
        })(),
        recentBlockhash: blockhashInfo.blockhash,
        instructions: tx.instructions,
      }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);

    const simulateConfig = {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: {
        addresses: [
          "9YqR7rJEHQx6BiboMhUNz9QdPrk6nHwov2TvSGhvwppK"
        ] as string[],
        encoding: "base64" as const, 
      },
    };

    // Simulate with retry for rate limits
    const simResult = await rpcWithRetry<{
      value: { err?: any; logs?: string[] }
    }>(
      connection, 
      "simulateTransaction", 
      [versionedTx, simulateConfig]
    );
    console.log('Simulation logs:', simResult.value?.logs);

    if (simResult.value.err) {
        console.error('Simulation error:', simResult.value.err);
    }

    const signature = await sendTransaction(
      tx, 
      connection, 
      { 
        signers, 
        preflightCommitment: 'confirmed' 
      }
    );
    console.log('Signature:', signature);

    // Get latest blockhash with retry
    const { value: latestBlockhash } = await rpcWithRetry<{
      value: { blockhash: string; lastValidBlockHeight: number }
    }>(
      connection, 
      "getLatestBlockhash", 
      [{ commitment: "confirmed" }], 
      "confirmed"
    );
    
    await connection.confirmTransaction(
        {
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature,
        },
        'confirmed'
    );

  return signature;
}
