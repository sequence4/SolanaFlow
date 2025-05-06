export const EMAIL_RE =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const SOL_PUBKEY_RE =
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const HANDLE_RE =
  /^@?[A-Za-z0-9_]{1,32}$/;

export const DISCORD_RE =
  /^[A-Za-z0-9_]{2,32}#[0-9]{4}$/;

export const isEmail         = (v:string) => EMAIL_RE.test(v);
export const isSolPubkey     = (v:string) => SOL_PUBKEY_RE.test(v);
export const isHandle        = (v:string) => HANDLE_RE.test(v);
export const isDiscordHandle = (v:string) => DISCORD_RE.test(v); 