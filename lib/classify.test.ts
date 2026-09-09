import assert from "node:assert/strict";
import { test } from "node:test";
import { CBBTC, USDG } from "./chain";
import { classify } from "./classify";

const GME = "0x1111111111111111111111111111111111111111";
const FAKE_GME = "0x2222222222222222222222222222222222222222";
const MEME = "0x3333333333333333333333333333333333333333";
const EOA = "0x4444444444444444444444444444444444444444";

const registry = [{ ticker: "GME", contract_hex: GME }];

function assertCopyLine(line: string) {
  assert.match(line, /Not a buy\.$/);
  assert.equal((line.match(/\bbuy\b/gi) ?? []).length, 1);
  assert.doesNotMatch(line, /\bbacked\b/i);
  assert.doesNotMatch(line, /\bownership\b/i);
  assert.doesNotMatch(line, /\bSAFE\b/);
}

test("registry hit is stock_canonical by CA, not ticker", () => {
  const r = classify({ address: GME, registry });
  assert.equal(r.kind, "stock_canonical");
  assert.equal(r.official?.contract_hex, GME);
  assertCopyLine(r.copy_line);
});

test("same symbol different CA is stock_impersonator, never official", () => {
  const r = classify({
    address: FAKE_GME,
    symbols: { [FAKE_GME]: "GME" },
    registry,
  });
  assert.equal(r.kind, "stock_impersonator");
  assert.equal(r.impersonator?.claimed_ticker, "GME");
  assert.equal(r.impersonator?.this_contract, FAKE_GME);
  assert.equal(r.impersonator?.official.contract_hex, GME);
  assert.notEqual(r.kind, "stock_canonical");
  assertCopyLine(r.copy_line);
});

test("stock/USDG is pair_spot_stock, excluded from meme board", () => {
  const r = classify({ token0: GME, token1: USDG, registry });
  assert.equal(r.kind, "pair_spot_stock");
  assert.equal(r.official?.ticker, "GME");
  assertCopyLine(r.copy_line);
});

test("canonical meme/stock uses registry CA on one leg", () => {
  const r = classify({ token0: MEME, token1: GME, registry });
  assert.equal(r.kind, "pair_canonical");
  assert.equal(r.official?.contract_hex, GME);
  const fakeNamed = classify({
    token0: MEME,
    token1: FAKE_GME,
    symbols: { [FAKE_GME]: "GME" },
    registry,
  });
  assert.equal(fakeNamed.kind, "pair_fake_underlying");
  assertCopyLine(r.copy_line);
});

test("official stock + cbBTC is pair_spot_stock", () => {
  const r = classify({ token0: MEME, token1: CBBTC, registry });
  assert.notEqual(r.kind, "pair_canonical");
  const spot = classify({ token0: GME, token1: CBBTC, registry });
  assert.equal(spot.kind, "pair_spot_stock");
  assertCopyLine(spot.copy_line);
});

test("random EOA is unknown", () => {
  const r = classify({ address: EOA, registry });
  assert.equal(r.kind, "unknown");
  assert.equal(r.official, null);
  assertCopyLine(r.copy_line);
});
