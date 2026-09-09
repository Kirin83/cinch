export const CHAIN_ID = 4663;
export const RPC_URL =
  process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER = "https://robinhoodchain.blockscout.com";
export const ASSETS_URL = "https://api.robinhood.com/rhj/assets";
export const PRICES_URL = "https://api.robinhood.com/rhj/prices";
export const FEEDS_URL =
  "https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json";

export const ZERO = "0x0000000000000000000000000000000000000000";
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
/** Coinbase Wrapped BTC on Hood (Chainlink CCIP / Blockscout). */
export const CBBTC = "0xcec185eb182c47d1ba1efc84e6959e18cd620be4";
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const PONS_V2_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
export const PONS_V2_HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";
export const PONS_V2_LOCKER = "0x267444d099b10fb5ed7c3cc7b7c767adca574952";
export const UNI_V4_POOL_MANAGER = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
export const UNI_V4_STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";

/** Long.xyz factory (LaunchCreated) + Airlock on Hood. */
export const LONG_FACTORY = "0x22e99278308b393ea1260859b181ad7e78f5eeed";
export const LONG_AIRLOCK = "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862";
/** Uniswap v4 dynamic-fee flag used by Doppler/Long hooks. */
export const LONG_V4_FEE = 8_388_608;
export const LONG_V4_TICK_SPACING = 8;

export const PONS_APP = "https://www.ponsfamily.com";
export const PONS_LAUNCH_URL = `${PONS_APP}/launchpad/create`;
export const LONG_APP = "https://app.long.xyz";

export function ponsTokenUrl(token: string): string {
  return `${PONS_APP}/launchpad/${token.toLowerCase()}`;
}

export function longTokenUrl(token: string): string {
  return `${LONG_APP}/?token=${token.toLowerCase()}`;
}

export function dexScreenerPairUrl(poolId: string | null | undefined): string | null {
  if (!poolId) return null;
  const id = poolId.toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(id)) return null;
  return `https://dexscreener.com/robinhood/${id}`;
}

export function explorerAddress(hex: string): string {
  return `${EXPLORER}/address/${hex}`;
}

export function isSpotQuote(addr: string): boolean {
  const a = addr.toLowerCase();
  return a === USDG || a === WETH || a === ZERO || a === CBBTC;
}
