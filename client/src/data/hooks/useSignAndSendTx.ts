import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { debugAndSendTransaction } from '../../utils/deploy/debugAndSendTx';
import { connection } from "@/utils/connection";

export function useSignAndSendTx() {
  const { publicKey, sendTransaction } = useWallet();

  const signAndSendTransaction = async (
    tx: Transaction,
  ): Promise<string> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    const signature = await debugAndSendTransaction(tx, connection, sendTransaction, undefined, publicKey);

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature,
      },
      'confirmed'
    );

    return signature;
  };

  return signAndSendTransaction;
}
