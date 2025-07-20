import { SecretsManagerClient, CreateSecretCommand, PutSecretValueCommand, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

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
} 