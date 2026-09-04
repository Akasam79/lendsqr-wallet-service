export const BLACKLIST_PROVIDER = Symbol('BLACKLIST_PROVIDER');

export type BlacklistResult = {
  blacklisted: boolean;
  provider: string;
};

export interface BlacklistProvider {
  check(identity: string): Promise<BlacklistResult>;
}
