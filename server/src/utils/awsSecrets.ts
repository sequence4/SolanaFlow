import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';

/** ─────────────────────────  ENV helpers  ───────────────────────── */
const SKIP = process.env.SKIP_AWS_SECRETS === '1';

export function awsSecretsEnabled(): boolean {
  if (SKIP) return false;
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

/**
 * A singleton SecretsManager client.  Region is taken from AWS_REGION
 * environment variable with a fallback to 'us-east-1'.
 */
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Persist a program keypair secret in AWS Secrets Manager.  If the secret
 * already exists, it updates the value.
 * @param programId Program ID (Base58) used as part of the secret name.
 * @param secretKey Uint8Array containing the 64‑byte secret key.
 */
export async function saveProgramSecret(
  programId: string,
  secretKey: Uint8Array,
): Promise<void> {
  if (!awsSecretsEnabled()) {
    console.warn('[awsSecrets] AWS secrets disabled – skipping saveProgramSecret');
    return;
  }
  const secretName = `solana/program/${programId}/keypair`;
  const secretString = JSON.stringify(Array.from(secretKey));
  try {
    await secretsClient.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
      }),
    );
  } catch (err: any) {
    // Token/cred problems → warn and continue (dev mode)
    if (
      err?.name === 'UnrecognizedClientException' ||
      err?.name === 'InvalidClientTokenId'
    ) {
      console.warn(`[awsSecrets] ${err.name}: skipping saveProgramSecret`);
      return;
    }
    // If the secret exists, update it; otherwise rethrow.
    if (err.name === 'ResourceExistsException') {
      await secretsClient.send(
        new PutSecretValueCommand({
          SecretId: secretName,
          SecretString: secretString,
        }),
      );
    } else {
      throw err;
    }
  }
}

/**
 * Retrieve a program keypair from AWS Secrets Manager.
 * @param programId Program ID whose secret was saved with saveProgramSecret().
 * @returns Uint8Array of the secret key.
 */
export async function getProgramSecret(programId: string): Promise<Uint8Array> {
  const secretName = `solana/program/${programId}/keypair`;
  if (!awsSecretsEnabled()) {
    throw new Error('AWS credentials not configured or SKIP_AWS_SECRETS=1');
  }
  try {
    const resp = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      }),
    );
    if (!resp.SecretString) {
      throw new Error(`Secret ${secretName} returned no SecretString`);
    }
    const arr = JSON.parse(resp.SecretString);
    return Uint8Array.from(arr);
  } catch (err) {
    if (
      (err as any)?.name === 'UnrecognizedClientException' ||
      (err as any)?.name === 'InvalidClientTokenId'
    ) {
      throw new Error('AWS credentials invalid');
    }
    if (err instanceof ResourceNotFoundException) {
      throw new Error(`Secret ${secretName} not found in AWS Secrets Manager`);
    }
    throw err;
  }
} 