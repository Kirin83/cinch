/** Uniswap v3/v4 tick math — amounts for a full-range position. */

import { encodeAbiParameters, keccak256, type Hex } from "viem";

const Q96 = 2n ** 96n

export function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < -887272 || tick > 887272) throw new Error(`tick ${tick}`)
  const absTick = BigInt(tick < 0 ? -tick : tick)
  let ratio =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n
  if ((absTick & 0x2n) !== 0n) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n
  if ((absTick & 0x4n) !== 0n) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n
  if ((absTick & 0x8n) !== 0n) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n
  if ((absTick & 0x10n) !== 0n) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n
  if ((absTick & 0x20n) !== 0n) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n
  if ((absTick & 0x40n) !== 0n) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n
  if ((absTick & 0x80n) !== 0n) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n
  if ((absTick & 0x100n) !== 0n) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n
  if ((absTick & 0x200n) !== 0n) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n
  if ((absTick & 0x400n) !== 0n) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n
  if ((absTick & 0x800n) !== 0n) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n
  if ((absTick & 0x1000n) !== 0n) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n
  if ((absTick & 0x2000n) !== 0n) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n
  if ((absTick & 0x4000n) !== 0n) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n
  if ((absTick & 0x8000n) !== 0n) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n
  if ((absTick & 0x10000n) !== 0n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc8n) >> 128n
  if ((absTick & 0x20000n) !== 0n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n
  if ((absTick & 0x40000n) !== 0n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n
  if ((absTick & 0x80000n) !== 0n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n
  if (tick > 0) ratio = (1n << 256n) / ratio
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n)
}

function amount0(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  if (sqrtA === 0n) return 0n
  return (liquidity << 96n) * (sqrtB - sqrtA) / sqrtB / sqrtA
}

function amount1(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  return liquidity * (sqrtB - sqrtA) / Q96
}

export function fullRangeTicks(spacing = 200): { lower: number; upper: number } {
  const max = Math.floor(887272 / spacing) * spacing
  return { lower: -max, upper: max }
}

export function amountsAtPrice(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  tickSpacing = 200,
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n || sqrtPriceX96 === 0n) return { amount0: 0n, amount1: 0n }
  const { lower, upper } = fullRangeTicks(tickSpacing)
  const sqrtLower = getSqrtRatioAtTick(lower)
  const sqrtUpper = getSqrtRatioAtTick(upper)
  return {
    amount0: amount0(sqrtPriceX96, sqrtUpper, liquidity),
    amount1: amount1(sqrtLower, sqrtPriceX96, liquidity),
  }
}

/** Amount of `want` in a v4 pool, using in-range L as a full-range position. */
export function v4WantAmount(
  token0: string,
  token1: string,
  want: string,
  sqrt: bigint,
  liq: bigint,
  tickSpacing: number,
): bigint {
  const [c0] = sortedPair(token0, token1)
  const { amount0, amount1 } = amountsAtPrice(sqrt, liq, tickSpacing)
  return c0 === want.toLowerCase() ? amount0 : amount1
}

export function sortedPair(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase()
    ? [a.toLowerCase(), b.toLowerCase()]
    : [b.toLowerCase(), a.toLowerCase()]
}

export function priceToken1PerToken0(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  if (sqrtPriceX96 === 0n) return 0
  const Q192 = 2n ** 192n
  const extra = 18
  const scale = dec0 - dec1 + extra
  const p = sqrtPriceX96 * sqrtPriceX96
  const shifted =
    scale >= 0 ? (p * 10n ** BigInt(scale)) / Q192 : p / (Q192 * 10n ** BigInt(-scale))
  return Number(shifted) / 10 ** extra
}

export function v4PoolId(
  currencyA: string,
  currencyB: string,
  fee: number,
  tickSpacing: number,
  hooks: string,
): Hex {
  const [c0, c1] = sortedPair(currencyA, currencyB)
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [c0 as Hex, c1 as Hex, fee, tickSpacing, hooks as Hex],
    ),
  )
}

export const PONS_V4_FEE = 0
export const PONS_V4_TICK_SPACING = 200
