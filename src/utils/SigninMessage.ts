import bs58 from "bs58";
import nacl from "tweetnacl";

interface SignMessage {
  domain: string;
  publicKey: string;
  nonce: string;
  statement: string;
  username: string;
}

export class SigninMessage {
  private readonly domain: string;
  private readonly publicKey: string;
  private readonly nonce: string;
  private readonly username: string;
  private readonly statement: string;

  constructor({ domain, publicKey, nonce, statement, username }: SignMessage) {
    this.domain = domain;
    this.publicKey = publicKey;
    this.nonce = nonce;
    this.statement = statement;
    this.username = username;
  }

  prepare(): string {
    return `${this.statement}${this.nonce}`;
  }

  async validate(signature: string): Promise<boolean> {
    
    const msg = this.prepare();
    const signatureUint8 = bs58.decode(signature);
    const msgUint8 = new TextEncoder().encode(msg);
    const pubKeyUint8 = bs58.decode(this.publicKey);

    return nacl.sign.detached.verify(msgUint8, signatureUint8, pubKeyUint8);
  }

  // Getter methods for private properties
  getDomain(): string {
    return this.domain;
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getNonce(): string {
    return this.nonce;
  }

  getStatement(): string {
    return this.statement;
  }
}