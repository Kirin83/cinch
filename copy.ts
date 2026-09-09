export const FOOTER =
  "Stock Tokens are tokenized debt securities issued by Robinhood Assets (Jersey) Limited. They track price, they are not shares, and they are not available in the US and other restricted regions. cinch is a read-only dashboard. Not financial advice.";

export const chrome = {
  wordmark: "cinch",
  tagline: "See how much of each stock is locked in its memes.",
  nav: {
    home: "Home",
    markets: "Markets",
    live: "Live",
    verify: "Verify",
    launch: "Launch",
    docs: "Docs",
  },
  searchPlaceholder: "NVDA, HIMS, or 0x…",
  indexSynced: (lagSeconds: number) => `Synced · ${lagSeconds}s lag`,
  indexBehind: (lagSeconds: number) => `Indexer behind · ${lagSeconds}s`,
} as const;

export const buttons = {
  openStock: (ticker: string) => `Open ${ticker}`,
  shareCard: "Share card",
  shareOnX: "Share on X",
  shareTweet: (ticker: string, locked: string) =>
    `${ticker} is ${locked} locked in meme LPs on Hood`,
  copied: "Copied",
  explorer: "Explorer",
  swap: "Swap ↗",
  launchCta: "Continue to Pons ↗",
  pin: "Pin",
  pinned: "Pinned",
  swapDisabled: "Swap disabled",
  whyThisGrade: "Why this grade",
} as const;

export const pager = {
  prev: "Prev",
  next: "Next",
  of: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
} as const;

export const markets = {
  title: "Canonical meme-stock pairs on Hood",
  subtitle: "Ranked by volume. Fake tickers hidden.",
  sort: {
    floatLocked: "Float locked",
    memeVol: "Meme vol",
    premium: "Premium",
    pairs: "Pairs",
  },
  filter: {
    all: "All",
    mega: "Mega",
    memeStocks: "Meme stocks",
    ai: "AI",
    etf: "ETF",
  },
  hideEmpty: "Hide empty",
  hideDead: "Hide dead",
  columns: {
    stock: "Stock",
    pair: "Pair",
    oracle: "Oracle",
    dex: "DEX",
    premium: "Premium",
    floatLocked: "Float locked",
    memePairs: "Meme pairs",
    memeVol24h: "Meme vol 24h",
    pressure: "Pressure",
    dexUsdg: "DEX USDG",
    stockUsdg: "Stock USDG",
    vol24h: "Vol 24h",
    meme: "Meme",
    price: "Price",
    marketcap: "Marketcap",
  },
  tabs: {
    pair: "Pair",
    stock: "Stock",
    meme: "Meme",
  },
  stage: {
    all: "All",
    curve: "Bonding curve",
    graduated: "Graduated",
  },
  stageChip: {
    curve: "CURVE",
    graduated: "GRADUATED",
  },
  graduatedQuiet: "Quiet v4 pools stay listed.",
  emptyFilter: "No Stock Tokens match. Clear filters.",
  emptyStage: "No names on this stage. Try All.",
  emptyChain: "Registry loaded. No canonical meme pools indexed yet.",
  emptyMemes: "No meme tokens indexed yet.",
  copySnapshotTitle: "Copy snapshot",
  homeTopVol: "Top 3 volume",
  homeTopVolStock: "Top 3 volume · Stock",
  homeTopVolMeme: "Top 3 volume · Meme",
  homeTop25: "Top 20 by volume",
} as const;

export const stockPage = {
  official: "Official Stock Token",
  canonical: "CANONICAL",
  floatLocked: "Float locked",
  lockedInMemeLps: "Locked in meme LPs",
  onchainSupply: "On-chain supply",
  oracle: "Oracle",
  dex: "DEX",
  premium: "Premium",
  memePressure: "Meme pressure",
  floatLockedHelper:
    "Share of this Stock Token’s on-chain supply held by pools whose other side is a meme. USDG/WETH pools are excluded.",
  premiumHelper:
    "DEX price vs oracle. Chainlink when a feed exists, else the Robinhood quote. Positive = on-chain richer.",
  tabs: {
    memePairs: (n: number) => `Meme pairs (${n})`,
    spotPools: "Spot pools",
    holders: "Holders",
  },
  pairColumns: {
    token: "Token",
    age: "Age",
    fdv: "FDV",
    stockInLp: "Stock in LP",
    pctOfStock: (ticker: string) => `% of ${ticker}`,
    vol24h: "Vol 24h",
    risk: "Risk",
    pair: "Pair",
  },
  openCoin: "Open coin",
  chart: "Chart",
  pager: {
    prev: "Prev",
    next: "Next",
    of: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
  },
  emptyPairs: (ticker: string) =>
    `No canonical meme pairs on ${ticker} yet. Watch Live for the first one.`,
  extraDisclaimer: (ticker: string) =>
    `Holding this token is not owning ${ticker} shares. No voting rights.`,
} as const;

export const tokenPage = {
  fakeBannerTitle: "FAKE UNDERLYING",
  fakeBannerBody: (ticker: string) =>
    `This pool uses a token named ${ticker} that is not the official Robinhood Stock Token.`,
  fakeOfficial: (ticker: string) => `Official ${ticker}:`,
  fakeThisContract: "This contract:",
  fakeSwapNote: "Swap is disabled here on purpose.",
  canonicalPair: (ticker: string) => `CANONICAL PAIR · ${ticker}`,
  canonicalMeta: "Quote asset matches Robinhood registry.",
  pairedWith: (ticker: string, age: string, launchpad: string) =>
    `Paired with official ${ticker} · launched ${age} ago on ${launchpad}`,
  underlying: "Underlying",
  quote: "Quote",
  quality: "Quality",
  inThisLp: (ticker: string) => `${ticker} in this LP`,
  pctOfSupply: (ticker: string) => `% of ${ticker} supply`,
  risk: "Risk",
  riskNotRating: "Not a safety rating. Read the reasons.",
  market: "Market",
  vol24h: "Vol 24h",
  price: "Price",
  marketcap: "Marketcap",
  pools: "Pools",
  people: "People",
  creator: "Creator",
  priorLaunches: (n: number) => `${n} prior launches`,
  topHolders: "Top holders",
  tradeOnPons: "Trade on Pons ↗",
  tradeOnLong: "Trade on Long ↗",
  uniswap: "Uniswap ↗",
  dexscreener: "DexScreener ↗",
  noRoute: "cinch does not route your swap.",
  fakeSwapHidden:
    "Swap links hidden until the quote asset is an official Stock Token.",
} as const;

export const live = {
  title: "New stock-paired memes",
  subtitle:
    "Pools where one side is an official Stock Token. Everything else is noise.",
  allStocks: "All stocks",
  canonicalOnly: "Canonical only",
  notOfficial: "Not official. Hidden from Markets.",
  empty: "Waiting for the next canonical pair. Indexer is live.",
  paused: (age: string) =>
    `Live feed delayed. Last pair ${age} ago. See /status.`,
  open: "Open",
} as const;

export const launch = {
  title: "Launch against a real stock",
  subtitle:
    "We lock the quote asset to the official Stock Token. You still launch on Pons. We never hold funds.",
  step1: "Stock",
  step2: "Token",
  step3: "Confirm",
  searchLabel: "Search official Stock Tokens",
  searchPlaceholder: "NVDA",
  notInList: "If it is not in this list, it is not a Robinhood Stock Token.",
  name: "Name",
  ticker: "Ticker",
  image: "Image",
  confirmLine: (ticker: string) => `You will pair with official ${ticker}`,
  confirmOpens: "Opens Pons with this quote token prefilled.",
  walletNote: "Connect a wallet only if Pons asks. cinch does not need it to browse.",
} as const;

export const watch = {
  noAccount: "Watchlist lives in this browser. No account.",
  empty: "Pin a stock from Markets. You will see lock % and new pairs here.",
} as const;

export const docs = {
  title: "Docs",
  eyebrow: "How cinch works",
  lede:
    "cinch is a read-only dashboard for official Robinhood Stock Tokens on Hood (Robinhood Chain). It answers the question the rest of the chain will not: how much of each real stock is locked in its memes — and whether the quote in front of you is the registry contract, or a fake wearing the same ticker.",
  pillars: [
    {
      title: "Registry is truth",
      body: "A ticker string never marks a token official. Only the Robinhood Stock Token registry CA does. Names, logos, and pool labels are cheap.",
    },
    {
      title: "Float locked",
      body: "Share of each Stock Token’s on-chain supply sitting in meme/stock LPs. That percentage is the product. Spot and stock/stock pools do not count.",
    },
    {
      title: "Noise stays off the board",
      body: "Fake underlyings, zero-volume rows, and USDG/WETH/cbBTC spot are not the Markets default. You see canonical meme-stock, ranked by live 24h volume.",
    },
  ],
  why: {
    title: "Why this exists",
    paragraphs: [
      "Hood lets anyone launch a token against a stock-looking ticker. Wallets, charts, and launchpads will happily display NVDA. Only one contract is in the Robinhood registry.",
      "Without a registry-first board, spot USDG/WETH volume, impersonator CAs, and real meme/stock LPs collapse into one tape. You cannot tell how much official inventory is actually locked in memes.",
      "cinch is that board. We do not route swaps, hold funds, or take a cut. We classify every pool against the registry, measure lock, and keep fakes from looking like the market.",
    ],
  },
  start: {
    title: "Start here",
    lead: "Five minutes. This is the whole product.",
    steps: [
      {
        n: "1",
        title: "Open Home",
        body: "Read live canonical count and 24h meme-stock volume. That is the tape. If the indexer is behind, the lag label next to search turns caution-yellow.",
      },
      {
        n: "2",
        title: "Search a ticker or 0x",
        body: "NVDA, HIMS, or a contract. Official stocks open the stock page. Memes open the token page. A registry CA in search redirects to its ticker.",
      },
      {
        n: "3",
        title: "Read float locked",
        body: "That percentage is the share of official on-chain supply sitting in meme LPs right now. Open the stock to see the amount, the pairs, and the 24h change.",
      },
      {
        n: "4",
        title: "Open a pair",
        body: "CANONICAL means the quote CA matches the registry. FAKE UNDERLYING means the ticker is a costume. Swap links stay hidden on fakes here on purpose.",
      },
      {
        n: "5",
        title: "Verify before you leave",
        body: "Paste any 0x someone sent you. cinch returns official, impersonator, or spot. We still do not route your swap.",
      },
    ],
  },
  tour: {
    title: "Where to click",
    lead: "Each screen answers a different question.",
    items: [
      {
        id: "home",
        title: "Home",
        body: "Snapshot of Hood: live canonical pairs, 24h volume, top names by pair, stock, and meme. The stage filter splits bonding-curve names from graduated Uniswap v4 pools.",
      },
      {
        id: "markets",
        title: "Markets",
        body: "The full board. Pair is each meme/stock pool. Stock rolls up lock % and meme volume per ticker. Meme lists tokens. Hide dead (on by default) drops 24h volume of 0.",
      },
      {
        id: "live",
        title: "Live",
        body: "New pools where one side is an official Stock Token. Canonical only is on by default. Everything else is noise.",
      },
      {
        id: "stock",
        title: "Stock page",
        body: "Official CA, float locked, stock in meme LPs, on-chain supply, oracle vs DEX premium, meme pressure. Tabs: meme pairs, spot pools, holders. Pin a ticker to Watch.",
      },
      {
        id: "token",
        title: "Token page",
        body: "The meme: quote asset, launchpad (Pons or Long), curve vs graduated, volume, holders. Outbound trade links only appear when the quote is official.",
      },
      {
        id: "verify",
        title: "Verify",
        body: "One field. Registry CA is truth. Use this on any contract from a chat, a tweet, or a launchpad screen.",
      },
      {
        id: "launch",
        title: "Launch",
        body: "Opens Pons. Pair against the official Stock Token CA from the stock page — not a ticker you typed from memory. cinch never holds funds and never needs your wallet to browse.",
      },
      {
        id: "watch",
        title: "Watch",
        body: "Pins live in this browser. No account. Lock % and new pairs for the tickers you care about.",
      },
      {
        id: "status",
        title: "Status",
        body: "Indexer head versus Pons, Long, Uniswap v4, and the registry. If Live looks empty, check lag here first.",
      },
    ],
  },
  numbers: {
    title: "How to read the numbers",
    lead: "These are measurements, not scores. None of them is a reason to buy.",
    items: [
      {
        term: "Float locked",
        def: "Official Stock Tokens in canonical meme LPs ÷ on-chain supply of that Stock Token. USDG, WETH, and cbBTC pools are excluded.",
      },
      {
        term: "Locked in meme LPs",
        def: "Absolute amount of the official Stock Token sitting in those meme pools.",
      },
      {
        term: "On-chain supply",
        def: "Amount of the Stock Token cinch reads on Hood.",
      },
      {
        term: "Oracle",
        def: "Reference price. Chainlink when a feed exists, else the Robinhood quote.",
      },
      {
        term: "DEX",
        def: "On-chain price from indexed pools.",
      },
      {
        term: "Premium",
        def: "DEX versus oracle. Positive means on-chain is richer than the reference.",
      },
      {
        term: "Meme pressure",
        def: "24h meme-pair volume ÷ 24h spot volume for that stock. High means memes are doing more of the tape than USDG/WETH.",
      },
      {
        term: "Vol 24h",
        def: "Sum of indexed swap USD notionals in the last 24 hours — live from swaps, not a stale snapshot.",
      },
      {
        term: "Dead",
        def: "24h volume is 0. Hidden on Markets by default. Turn Hide dead off to see them.",
      },
      {
        term: "Marketcap",
        def: "Meme FDV from the indexed pool price. A screen number, not a fundamental.",
      },
    ],
  },
  quality: {
    title: "Canonical, fake, spot",
    lead: "The chip on a row is the whole classification. Ticker text is never enough.",
    items: [
      {
        term: "CANONICAL",
        def: "One side is a meme. The other side is the official Stock Token CA from the Robinhood registry.",
      },
      {
        term: "FAKE UNDERLYING",
        def: "The quote uses a ticker that exists in the registry, but the contract is not that registry CA. Swap links stay hidden.",
      },
      {
        term: "SPOT",
        def: "Official Stock Token versus USDG, WETH, or cbBTC. Real market, not a meme-stock pair. Lives under Spot pools on the stock page, not on Markets.",
      },
      {
        term: "STOCK/STOCK",
        def: "Two official Stock Tokens. Not a meme pair.",
      },
      {
        term: "IMPERSONATOR",
        def: "A token whose symbol claims a registry ticker and whose CA is not in the registry.",
      },
      {
        term: "REGISTRY CA",
        def: "This contract is the official Stock Token. Search sends you to the stock page.",
      },
    ],
  },
  stages: {
    title: "Bonding curve and graduated",
    paragraphs: [
      "Pons V2 launches on a bonding curve. While it is on the curve, cinch labels it CURVE. After the launch is swept and the Uniswap v4 pool is registered, it is GRADUATED.",
      "Long launches into Uniswap v4 from the start, so those names show as graduated once the pool id is known.",
      "Quiet graduated pools stay listed. Dead (zero 24h volume) is a separate filter — graduation is not the same as activity.",
    ],
  },
  risk: {
    title: "Risk chips",
    body: "Clear / caution / danger are labels on contract facts we can see: mint still enabled, blacklist, owner still in control, LP unlocked, concentrated holders, a sell that reverted in simulation. They are not a rating and not a recommendation. Read the reasons on the token page.",
  },
  method: {
    title: "How the numbers are made",
    lead: "Indexer on Hood. Registry first. Then pools, then swaps.",
    items: [
      "Robinhood Stock Token registry contract address is truth. A ticker string is never enough to mark a token official.",
      "We index Pons V2 (bonding curve, then Uniswap v4 on graduation) and Long (Uniswap v4). Pool ids come from on-chain Initialize / PoolRegistered events — they are not guessed from token addresses.",
      "WETH, USDG, and cbBTC pairs with an official Stock Token are spot, not meme-stock.",
      "Two official Stock Tokens in one pool are stock/stock, not meme-stock.",
      "24h volume is the sum of indexed Swap USD notionals in the last 24 hours.",
      "Float locked uses canonical meme/stock pool balances only.",
      "Dead means 24h volume is 0; those rows are hidden on the canonical board by default.",
      "The lag label next to search is indexer head versus chain head. Status breaks it down by Pons, Long, Uniswap v4, and registry.",
    ],
  },
  limits: {
    title: "What cinch is not",
    items: [
      "Not a DEX. Trade links open Pons, Long, Uniswap, or DexScreener. We do not route, custody, or execute.",
      "Not affiliated with Robinhood Markets.",
      "Stock Tokens are tokenized debt securities. They track price. They are not shares and have no voting rights.",
      "Some Robinhood Chain products are geo-restricted. Do not use this site to trade if you are a US person or otherwise restricted.",
      "Most meme tokens go to zero. Past lock % is not a reason to buy.",
      "cinch is read-only. We never need your wallet to browse.",
    ],
  },
  toc: [
    { id: "why", label: "Why cinch" },
    { id: "start", label: "Start here" },
    { id: "tour", label: "Where to click" },
    { id: "numbers", label: "Read the numbers" },
    { id: "quality", label: "Canonical vs fake" },
    { id: "stages", label: "Curve and graduated" },
    { id: "risk", label: "Risk chips" },
    { id: "method", label: "How numbers are made" },
    { id: "limits", label: "What cinch is not" },
  ],
  onThisPage: "On this page",
  disclaimerCta: "Full disclaimer",
  tryHome: "Open Home",
  tryMarkets: "Open Markets",
  tryVerify: "Verify a contract",
} as const;

export const methodology = {
  title: docs.method.title,
  sentences: docs.method.items,
} as const;

export const verify = {
  title: "Verify a contract",
  subtitle: "Registry CA is truth. Ticker string is not. Not a buy.",
  placeholder: "0x…",
  submit: "Verify",
  badAddress: "Need a 0x address, 40 hex chars.",
  officialCa: "Official CA:",
  thisCa: "This CA:",
} as const;

export const disclaimer = {
  title: "Read this",
  lines: [
    "cinch is not affiliated with Robinhood Markets.",
    "Stock Tokens are not equity.",
    "Some features of Robinhood Chain products are geo-restricted.",
    "Do not use this site to trade if you are a US person or otherwise restricted.",
    "Most meme tokens go to zero.",
    "Past lock % is not a reason to buy.",
  ],
} as const;

export const statusPage = {
  head: "Head",
  pons: "Pons",
  long: "Long",
  uniswapV4: "Uniswap v4",
  registry: "Registry",
} as const;

export const bannedWords = [
  "Safe",
  "Audited",
  "Guaranteed",
  "Moon",
  "100x",
  "Official pair",
  "APE NOW",
  "SAFE",
] as const;
