import { hash, verify } from "@node-rs/argon2";

// argon2id med bibliotekets standardparametere - god balanse mellom
// motstand og ytelse for et innloggingsendepunkt.
export function hashPassord(passord: string): Promise<string> {
  return hash(passord);
}

export function verifiserPassord(hashet: string, passord: string): Promise<boolean> {
  return verify(hashet, passord);
}
