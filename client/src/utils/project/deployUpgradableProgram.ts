import React from 'react';
import { toaster } from '@/components/ui/toaster'; 
import { ProjectContextType } from '@/context/project/ProjectContextTypes';
import { projectApi } from '@/api/projectApi'; 
import { pollTaskStatus3 } from '@/utils/task/taskUtils'; 
import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  Cluster,
  SendTransactionError,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  BPF_UPGRADE_LOADER_ID,
  createInitializeBufferData, 
  createDeployInstructionData, 
  createWriteBufferInstructionData,
  createSetAuthorityInstructionData,
} from './instructionData';
import { checkBufferAuthority } from './checkBufferAuth';

export async function deployUpgradeableProgram(
  connection: Connection,
  phantomPublicKey: PublicKey,
  signAndSendTransaction: (tx: Transaction, signers?: Keypair[]) => Promise<string>,
  programData: Buffer,
  deployControlOption: 'fullWallet' | 'delegated' = 'delegated'
): Promise<PublicKey> {
  console.log('calling deployUpgradeableProgram');

  const bufferAccount = Keypair.generate();
  const bufferSpace = 37 + programData.length;
  console.log('bufferSpace', bufferSpace);
  const rentExemptionAmt = await connection.getMinimumBalanceForRentExemption(bufferSpace);
  console.log('rentExemptionAmt', rentExemptionAmt);

  const createBufferIx = SystemProgram.createAccount({
    fromPubkey: phantomPublicKey,
    lamports: rentExemptionAmt,
    newAccountPubkey: bufferAccount.publicKey,
    space: bufferSpace,
    programId: BPF_UPGRADE_LOADER_ID,
  });
  console.log('createBufferIx', createBufferIx);

  const bufferInitIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { isSigner: false, isWritable: true, pubkey: bufferAccount.publicKey },
      { isSigner: true, isWritable: false, pubkey: phantomPublicKey },
    ],
    data: createInitializeBufferData(),
  });
  console.log('bufferInitIx', bufferInitIx);

  let transaction = new Transaction().add(createBufferIx, bufferInitIx);
  try {
    await signAndSendTransaction(transaction, [bufferAccount]);
    console.log('transaction sent (create & init buffer)');
  } catch (err) {
    if (err instanceof SendTransactionError) {
      console.error('SendTransactionError logs:', err.logs);
    } else {
      console.error('Unknown error:', err);
    }
    throw err;
  }

  console.log('bufferAccount', bufferAccount.publicKey.toBase58());

  let currentBufferAuthority = phantomPublicKey;
  let ephemeralKeypair: Keypair | undefined;

  if (deployControlOption === 'delegated') {
    ephemeralKeypair = Keypair.generate();
    console.log('ephemeralKeypair', ephemeralKeypair.publicKey.toBase58());

    try {
      const airdropSig = await connection.requestAirdrop(
        ephemeralKeypair.publicKey,
        0.1 * LAMPORTS_PER_SOL
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: airdropSig,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );
      console.log('Airdrop to ephemeral key complete');
      const ephemeralBalance = await connection.getBalance(ephemeralKeypair.publicKey);
      console.log(
        'Ephemeral balance after airdrop:',
        ephemeralBalance / LAMPORTS_PER_SOL,
        'SOL'
      );

    } catch (err) {
      console.log('Airdrop failed, or you might be on mainnet. Ensure ephemeralKeypair is funded.');
    }

    const setAuthorityIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey,      isSigner: false, isWritable: true },
        { pubkey: phantomPublicKey,             isSigner: true,  isWritable: false },
        { pubkey: ephemeralKeypair.publicKey,   isSigner: false, isWritable: false },
      ],
      data: createSetAuthorityInstructionData(),
    });

    transaction = new Transaction().add(setAuthorityIx);
    await signAndSendTransaction(transaction);
    console.log('authority transferred to ephemeral key');

    const bufferAuthority = await checkBufferAuthority(connection, bufferAccount.publicKey);
    console.log('Current buffer authority is:', bufferAuthority?.toBase58());
    
    currentBufferAuthority = ephemeralKeypair.publicKey;
  }

  const CHUNK_SIZE = 700;
  let offset = 0;

  while (offset < programData.length) {
    console.log('writing chunk', offset);
    const chunk = programData.slice(offset, offset + CHUNK_SIZE);

    const writeIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: currentBufferAuthority, isSigner: true, isWritable: false },
      ],
      data: createWriteBufferInstructionData(offset, chunk),
    });

    const writeTx = new Transaction().add(writeIx);
    
    try {
      if (deployControlOption === 'delegated' && ephemeralKeypair) {
        writeTx.feePayer = ephemeralKeypair.publicKey;

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        writeTx.recentBlockhash = blockhash;

        writeTx.sign(ephemeralKeypair);

        const txSig = await connection.sendRawTransaction(writeTx.serialize(), {
          skipPreflight: false,
        });

        await connection.confirmTransaction(
          {
            signature: txSig,
            blockhash,
            lastValidBlockHeight,
          },
          'confirmed'
        );

        console.log(`Chunk at offset ${offset} written. Tx sig: ${txSig}`);
      } else {
        await signAndSendTransaction(writeTx);
        console.log(`Chunk at offset ${offset} written with wallet.`);
      }
    } catch (err) {
      if (err instanceof SendTransactionError) {
        console.error('SendTransactionError logs:', err.logs);
      } else {
        console.error('Unknown error:', err);
      }
      throw err;
    }

    offset += CHUNK_SIZE;
  }

  if (deployControlOption === 'delegated' && ephemeralKeypair) {
    const revertAuthorityIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferAccount.publicKey,      isSigner: false, isWritable: true },
        { pubkey: ephemeralKeypair.publicKey,   isSigner: true,  isWritable: false },
        { pubkey: phantomPublicKey,             isSigner: false, isWritable: false },
      ],
      data: createSetAuthorityInstructionData(),
    });

    transaction = new Transaction().add(revertAuthorityIx);
    await signAndSendTransaction(transaction, [ephemeralKeypair]);
    console.log('authority reverted to phantom');

    const bufferAuthority2 = await checkBufferAuthority(connection, bufferAccount.publicKey);
    console.log('Current buffer authority is:', bufferAuthority2?.toBase58());
  }

  const programKeypair = Keypair.generate(); 
  console.log('programKeypair', programKeypair);

  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [programKeypair.publicKey.toBuffer()],
    BPF_UPGRADE_LOADER_ID
  );

  const finalizeIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: phantomPublicKey,         isSigner: true,  isWritable: true },
      { pubkey: programDataAddress,       isSigner: false, isWritable: true },
      { pubkey: programKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: bufferAccount.publicKey,  isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY,       isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
      { pubkey: phantomPublicKey,         isSigner: true,  isWritable: false },
    ],
    data: createDeployInstructionData(bufferSpace),
  });
  console.log('finalizeIx', finalizeIx);

  const neededLamports = await connection.getMinimumBalanceForRentExemption(36);

  transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: phantomPublicKey,
      newAccountPubkey: programKeypair.publicKey,
      lamports: neededLamports,
      space: 36,
      programId: BPF_UPGRADE_LOADER_ID,
    }),
    finalizeIx
  );

  try {
    await signAndSendTransaction(transaction, [programKeypair]);
    console.log('transaction sent (finalize)');
  } catch (err) {
    if (err instanceof SendTransactionError) {
      console.error('SendTransactionError logs:', err.logs);
    } else {
      console.error('Unknown error:', err);
    }
    throw err;
  }

  const deployedPubkey = programKeypair.publicKey;
  console.log('Upgradeable program deployed to:', deployedPubkey.toBase58());
  return deployedPubkey;
}


export const handleDeployProgram = async (
  projectContext: ProjectContextType,
  setProjectContext: React.Dispatch<React.SetStateAction<ProjectContextType>>,
  walletPublicKey: PublicKey,
  signAndSendTransaction: (tx: Transaction, signers?: Keypair[]) => Promise<string>,
  cluster: Cluster,
  deployControlOption: 'fullWallet' | 'delegated' = 'delegated'
) => {
  if (!projectContext.details?.projectState?.fileTree) console.log('no file tree found');

  // Validate wallet connection first
  if (!walletPublicKey || !(walletPublicKey instanceof PublicKey)) {
    console.error('Wallet connection error: Invalid or undefined wallet public key');
    toaster.create({
      title: 'Wallet not properly connected. Please connect your wallet and try again.',
      type: 'error',
    });
    return;
  }

  try {
    const buildResponse = await projectApi.buildProject(projectContext.id ?? '');
    if (!buildResponse?.taskId) { console.log('no task id returned'); return; }
    console.log('buildResponse', buildResponse);

    toaster.create({
      title: 'Building project. This may take a few minutes...',
      type: 'info',
    });

    const connection = new Connection('https://tiniest-smart-putty.solana-devnet.quiknode.pro/31fdf5493679b4c1c854289d95c822094900efc2/', 'confirmed');
    console.log('connection', connection);

    let taskData = await pollTaskStatus3(buildResponse.taskId);
    taskData = taskData.task;
    if (
      taskData.status === 'finished' || 
      taskData.status === 'succeed' ||
      taskData.status === 'warning'
    ) {
      console.log('calling getBuildArtifact');
      const buildArtifact = await projectApi.getBuildArtifact(projectContext.id ?? '');
      if (buildArtifact.status === 'success') {
        console.log('buildArtifact', buildArtifact);
        console.log('Length:', buildArtifact.base64So.length);

        const programData = Buffer.from(buildArtifact.base64So, 'base64');
        console.log('programData raw length', programData.length);
        
        let ephemeralPubkey: PublicKey | undefined;
        if (deployControlOption === 'delegated') {
          try {
            // Verify wallet is on the correct network (devnet)
            const walletOnCorrectNetwork = cluster === 'devnet'; // Ideally check with wallet adapter
            if (!walletOnCorrectNetwork) {
              console.warn('Wallet may not be on devnet network. Deployment might fail.');
            }
            
            const ephemeralResp = await projectApi.createEphemeral(projectContext.id ?? '');
            ephemeralPubkey = new PublicKey(ephemeralResp.ephemeralPubkey);
            console.log('Fetched ephemeral pubkey:', ephemeralPubkey.toBase58());

            // Reference the same chunk size used in deployUpgradeableProgram
            const CHUNK_SIZE = 700; // Must match the chunk size used during deployment
            
            // Calculate buffer rent (for the buffer account holding the program)
            const bufferSpace = 37 + programData.length;
            const bufferRentNeeded = await connection.getMinimumBalanceForRentExemption(bufferSpace);
            console.log(`Buffer space: ${bufferSpace} bytes, rent: ${bufferRentNeeded / LAMPORTS_PER_SOL} SOL`);

            // Calculate program data rent (for the upgradeable program data account)
            const programDataRent = await connection.getMinimumBalanceForRentExemption(36);
            console.log(`Program data rent: ${programDataRent / LAMPORTS_PER_SOL} SOL`);

            // Estimate transaction fees based on number of chunks
            const chunkCount = Math.ceil(programData.length / CHUNK_SIZE);
            const feeEstimate = (chunkCount + 2) * 10000; // 10k lamports each (create buffer, chunk writes, finalize)
            console.log(`Estimated ${chunkCount + 2} transactions, fees: ${feeEstimate / LAMPORTS_PER_SOL} SOL`);

            // Add safety margin
            const marginLamports = 0.02 * LAMPORTS_PER_SOL;
            console.log(`Safety margin: ${marginLamports / LAMPORTS_PER_SOL} SOL`);

            // Calculate total lamports needed
            const lamportsToFund = bufferRentNeeded + programDataRent + feeEstimate + marginLamports;
            console.log(`Total funding needed: ${lamportsToFund / LAMPORTS_PER_SOL} SOL`);

            // Verify wallet has enough balance
            const walletBalance = await connection.getBalance(walletPublicKey);
            if (walletBalance < lamportsToFund) {
              throw new Error(`Insufficient balance. Need ${lamportsToFund / LAMPORTS_PER_SOL} SOL but wallet only has ${walletBalance / LAMPORTS_PER_SOL} SOL`);
            }

            // Create funding transaction
            const fundIx = SystemProgram.transfer({
              fromPubkey: walletPublicKey,
              toPubkey: ephemeralPubkey,
              lamports: lamportsToFund,
            });
            const fundTx = new Transaction().add(fundIx);

            // Send and confirm the funding transaction
            const signature = await signAndSendTransaction(fundTx);
            console.log('Ephemeral funding transaction sent. Sig:', signature);

            const latestBlockhash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
              signature,
              blockhash: latestBlockhash.blockhash,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed');
            console.log(`Ephemeral successfully funded with ${lamportsToFund / LAMPORTS_PER_SOL} SOL`);
            
            // Verify ephemeral account received funds
            const ephemeralBalance = await connection.getBalance(ephemeralPubkey);
            console.log(`Verified ephemeral balance: ${ephemeralBalance / LAMPORTS_PER_SOL} SOL`);
            
            if (ephemeralBalance < lamportsToFund * 0.95) { // Allow 5% tolerance
              console.warn(`Ephemeral account only has ${ephemeralBalance / LAMPORTS_PER_SOL} SOL, less than expected ${lamportsToFund / LAMPORTS_PER_SOL} SOL`);
            }
            
            // Start server-side ephemeral deployment
            const deployResp = await projectApi.deployProjectEphemeral(
              projectContext.id ?? '', 
              ephemeralResp.ephemeralPubkey
            );
            console.log('Backend ephemeral deploy task started. TaskId:', deployResp.taskId);
            
            toaster.create({
              title: 'Deploying program with ephemeral key...',
              type: 'info',
            });
            
            const deployTaskData = await pollTaskStatus3(deployResp.taskId);
            if (deployTaskData.task.status === 'succeed') {
              console.log('Program deployed successfully with ID:', deployTaskData.task.result);
              return new PublicKey(deployTaskData.task.result);
            } else {
              console.error('Deployment failed:', deployTaskData.task.result);
              toaster.create({
                title: 'Deployment failed. Check terminal logs for details.',
                type: 'error',
              });
              return;
            }
          } catch (err: any) {
            // Provide more specific error message based on error type
            if (err.message?.includes('Invalid public key input')) {
              console.error('Wallet connection error:', err);
              toaster.create({ 
                title: 'Wallet connection issue. Please reconnect your wallet and ensure it\'s on devnet.', 
                type: 'error' 
              });
            } else if (err.message?.includes('User rejected')) {
              console.error('User rejected transaction:', err);
              toaster.create({ 
                title: 'Transaction rejected. Please approve the transaction to fund the deployment.', 
                type: 'error' 
              });
            } else if (err.message?.includes('Insufficient balance')) {
              console.error('Insufficient wallet balance:', err);
              toaster.create({ 
                title: err.message, 
                type: 'error' 
              });
            } else {
              console.error('Error funding ephemeral or deploying:', err);
              toaster.create({ 
                title: 'Funding ephemeral key or deployment failed. See logs for details.', 
                type: 'error' 
              });
            }
            return;
          }
        } else {
          const programKey = await deployUpgradeableProgram(
            connection,
            walletPublicKey,
            signAndSendTransaction,
            programData,
            deployControlOption
          );
          console.log('program deployed to:', programKey.toBase58());
          return programKey;
        }
      } else {
        console.log('build artifact retrieval failed');
        toaster.create({
          title: 'Check terminal logs for details.',
          type: 'error',
        });
      }
    } else if (taskData.status === 'failed') {
      console.log('build failed');
      toaster.create({
        title: 'Build failed. Check terminal logs for details.',
        type: 'error',
      });
    }
  } catch (err: any) {
    console.error('Build/deploy error:', err);
    toaster.create({
      title: `Error during project build: ${err?.message ?? err}`,
      type: 'error',
    });
  }
};
