import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  // ‼️ BPF_UPGRADE_LOADER_ID is **not** exported in web3.js v1.x
} from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Upgradeable‑loader program‑ID (hard‑coded; same constant the CLI uses)
// https://explorer.solana.com/address/BPFLoaderUpgradeab1e11111111111111111111111
// ---------------------------------------------------------------------------
const BPF_UPGRADE_LOADER_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

const CHUNK = 900;                 // safe write size

function u32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; }
function u64(n: bigint) { const b = Buffer.alloc(8); b.writeBigUInt64LE(n, 0); return b; }

export async function deployOrUpgradeUpgradeable(
  conn: Connection,
  feePayer: Keypair,               // also the upgrade authority
  soBytes: Uint8Array,
  /**
   *  • `null`  → fresh deploy (a new Keypair is created and returned)  
   *  • `Keypair` → fresh deploy with deterministic pubkey  
   *  • `PublicKey` → upgrade that existing program
   */
  program: Keypair | PublicKey | null,
  /**
   * Wallet public key to set as the final upgrade authority
   */
  walletPubkey: PublicKey,
  /**
   * Buffer authority keypair provided by the client
   */
  bufferAuthorityKp: Keypair,
): Promise<PublicKey> {
  // -------------------------------- account prep --------------------------------
  const bufferKp = Keypair.generate();
  const programKp = program instanceof Keypair
    ? program
    : program === null
      ? Keypair.generate()
      : null;
  const programPk = programKp ? programKp.publicKey : program as PublicKey;

  const [programDataPk] = PublicKey.findProgramAddressSync(
    [programPk.toBuffer()],
    BPF_UPGRADE_LOADER_ID,
  );

  const bufferRent = await conn.getMinimumBalanceForRentExemption(soBytes.length + 37);
  const progRent   = await conn.getMinimumBalanceForRentExemption(36);

  // fee‑payer is the already‑funded buffer‑authority keypair – no airdrop

  // ──────────────────────────────────────────────────────────────────
  // 1️⃣  CREATE & INIT BUFFER  (tx1)
  // ------------------------------------------------------------------
  const createBufferIx = SystemProgram.createAccount({
    fromPubkey: feePayer.publicKey,
    newAccountPubkey: bufferKp.publicKey,
    lamports: bufferRent,
    space: soBytes.length + 37,
    programId: BPF_UPGRADE_LOADER_ID,
  });
  
  const initBufferIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,                 // InitializeBuffer
    keys: [
      { pubkey: bufferKp.publicKey, isSigner: false, isWritable: true },
      { pubkey: bufferAuthorityKp.publicKey, isSigner: true,  isWritable: false },
    ],
    data: u32(0),
  });
  
  const tx1 = new Transaction().add(createBufferIx, initBufferIx);
  
  /* The helper will inject a recent block‑hash and sign with the
     provided signers – no manual partialSign() needed here. */
  const sigCreate = await sendAndConfirmTransaction(
    conn,
    tx1,
    [feePayer, bufferKp, bufferAuthorityKp],
  );

  // -------------------------------- step 2 – write chunks ------------------------
  for (let off = 0; off < soBytes.length; off += CHUNK) {
    const chunk = soBytes.slice(off, off + CHUNK);
    const writeIx = new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: bufferKp.publicKey, isSigner: false, isWritable: true },
        { pubkey: bufferAuthorityKp.publicKey, isSigner: true,  isWritable: false },
      ],
      data: Buffer.concat([u32(1), u32(off), u64(BigInt(chunk.length)), Buffer.from(chunk)]),
    });
    const t = new Transaction().add(writeIx);
    t.feePayer = feePayer.publicKey;
    await sendAndConfirmTransaction(conn, t, [feePayer, bufferAuthorityKp]);
  }

  // -------------- final deploy / upgrade ------------------
  const deployOrUpIx =
    program instanceof PublicKey
      ? new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,             // Upgrade
          keys: [
            { pubkey: programDataPk,   isSigner: false, isWritable: true },
            { pubkey: programPk,       isSigner: false, isWritable: true },
            { pubkey: bufferKp.publicKey, isSigner: false, isWritable: true },
            { pubkey: feePayer.publicKey, isSigner: false, isWritable: true }, // spill
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: bufferAuthorityKp.publicKey,  isSigner: true,  isWritable: false },
          ],
          data: u32(3),
        })
      : new TransactionInstruction({
          programId: BPF_UPGRADE_LOADER_ID,             // DeployWithMaxDataLen
          keys: [
            { pubkey: feePayer.publicKey, isSigner: true,  isWritable: true },
            { pubkey: programDataPk,      isSigner: false, isWritable: true },
            { pubkey: programPk,          isSigner: true,  isWritable: true },
            { pubkey: bufferKp.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY,isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: bufferAuthorityKp.publicKey, isSigner: true,  isWritable: false },
          ],
          data: Buffer.concat([u32(2), u64(BigInt(soBytes.length))]),
        });

  const txFinal = new Transaction();

  // fresh deploy → create the Program account first
  if (!(program instanceof PublicKey)) {
    txFinal.add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey,
        newAccountPubkey: programPk,
        lamports: progRent,
        space: 36,
        programId: BPF_UPGRADE_LOADER_ID,
      }),
    );
  }

  txFinal.add(deployOrUpIx);

  // 1️⃣  Fetch fresh block‑hash *before* the first signature
  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  txFinal.recentBlockhash = blockhash;

  // 2️⃣  Set fee‑payer and collect *all* required signatures
  txFinal.feePayer = feePayer.publicKey;
  const signers: Keypair[] = [feePayer, bufferAuthorityKp];
  if (programKp) signers.push(programKp);

  // 3️⃣  Send & confirm in one step (no wallet signature needed here)
  await sendAndConfirmTransaction(conn, txFinal, signers, { skipPreflight: true });

  // Hand upgrade authority from buffer‑auth → wallet
  const setAuthIx = new TransactionInstruction({
    programId: BPF_UPGRADE_LOADER_ID,
    keys: [
      { pubkey: programDataPk,     isSigner: false, isWritable: true },
      { pubkey: bufferAuthorityKp.publicKey, isSigner: true,  isWritable: false },
      { pubkey: walletPubkey,      isSigner: false, isWritable: false },
    ],
    data: Buffer.from([4, 0, 0, 0]),   // LoaderIx::SetAuthority (u32 LE)
  });
  const txAuth = new Transaction().add(setAuthIx);
  txAuth.feePayer = feePayer.publicKey;
  const { blockhash: h2 } = await conn.getLatestBlockhash('confirmed');
  txAuth.recentBlockhash = h2;
  await sendAndConfirmTransaction(conn, txAuth, [feePayer, bufferAuthorityKp], { skipPreflight: true });

  return programPk;
} 