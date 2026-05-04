/**
 * templates.ts — pure renderers for the /zama-design blueprint files.
 *
 * Given a normalized `DesignInputs` object, produce the per-category
 * substitutions consumed by `assets/templates/DESIGN.md.tpl` and
 * `UI-WIREFRAME.md.tpl`. No I/O — kept pure so unit tests don't need
 * a tmpdir.
 *
 * Recommendations are sourced from CLAUDE.md "Stack Patterns by Variant"
 * + the live context7 sources cited in SKILL.md. Treat the static maps
 * here as the FALLBACK shape; the skill runtime cross-checks against
 * /zama-ai/fhevm + /websites/openzeppelin_confidential-contracts.
 */

export type Category =
  | "confidential-token"
  | "voting"
  | "auction"
  | "payroll"
  | "prediction-market"
  | "custom";

export type Confidential =
  | "amounts"
  | "identities"
  | "outcome-until-reveal"
  | "metadata";

export type Decryption =
  | "each-user-sees-own"
  | "public-after-trigger"
  | "oracle-callback"
  | "mixed";

export interface DesignInputs {
  slug: string;
  category: Category;
  confidential: Confidential;
  decryption: Decryption;
  oneLiner: string;
}

export interface DesignSubstitutions {
  ONE_LINER: string;
  SLUG: string;
  CATEGORY: string;
  DATE: string;
  BASE_CHOICE: string;
  BASE_RATIONALE: string;
  SOL_IMPORTS: string;
  INHERITANCE: string;
  STATE_SCHEMA_TABLE: string;
  PLAINTEXT_SLOTS: string;
  ACL_TABLE: string;
  DECRYPTION_PATH: string;
  DECRYPTION_TABLE: string;
  FLOWS_BLOCK: string;
  INIT_USE_CASE: string;
  OPEN_QUESTIONS: string;
}

export interface WireframeSubstitutions {
  ONE_LINER: string;
  DATE: string;
  COMPONENT_TREE: string;
  USER_FLOWS: string;
  SCREEN_STATES: string;
  OUT_OF_SCOPE: string;
}

const CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  "confidential-token",
  "voting",
  "auction",
  "payroll",
  "prediction-market",
  "custom",
]);

const CONFIDENTIAL: ReadonlySet<Confidential> = new Set<Confidential>([
  "amounts",
  "identities",
  "outcome-until-reveal",
  "metadata",
]);

const DECRYPTION: ReadonlySet<Decryption> = new Set<Decryption>([
  "each-user-sees-own",
  "public-after-trigger",
  "oracle-callback",
  "mixed",
]);

const SLUG_RE = /^[a-z][a-z0-9-]{1,47}[a-z0-9]$/;

export function validateInputs(inputs: DesignInputs): void {
  if (!SLUG_RE.test(inputs.slug)) {
    throw new Error(
      `Slug "${inputs.slug}" must match ${SLUG_RE} (kebab-case, 3–48 chars). Refusing path-traversal or non-identifier names.`,
    );
  }
  if (!CATEGORIES.has(inputs.category)) {
    throw new Error(`Unknown category: ${inputs.category}`);
  }
  if (!CONFIDENTIAL.has(inputs.confidential)) {
    throw new Error(`Unknown confidential dimension: ${inputs.confidential}`);
  }
  if (!DECRYPTION.has(inputs.decryption)) {
    throw new Error(`Unknown decryption strategy: ${inputs.decryption}`);
  }
  if (!inputs.oneLiner || inputs.oneLiner.trim().length < 4) {
    throw new Error(`oneLiner must be a non-trivial sentence (>= 4 chars).`);
  }
}

interface BaseRecommendation {
  base: string;
  rationale: string;
  imports: string;
  inheritance: string;
  initUseCase: string;
}

function recommendBase(category: Category): BaseRecommendation {
  switch (category) {
    case "confidential-token":
      return {
        base: "ERC7984 (OpenZeppelin Confidential Contracts)",
        rationale:
          "Standardized confidential token (ERC-7984) with hidden balances and transfer amounts. Pair with ERC7984ERC20Wrapper if wrapping an existing ERC-20.",
        imports: `import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";\nimport {FHESafeMath} from "@openzeppelin/confidential-contracts/utils/FHESafeMath.sol";\nimport {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "MyToken is ERC7984",
        initUseCase: "confidential-token",
      };
    case "voting":
      return {
        base: "VotesConfidential (OpenZeppelin Confidential Contracts)",
        rationale:
          "Confidential ballots with snapshot-based tallying. Pair with CheckpointsConfidential if you need historical vote weight.",
        imports: `import {VotesConfidential} from "@openzeppelin/confidential-contracts/governance/VotesConfidential.sol";\nimport {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "MyPoll is VotesConfidential",
        initUseCase: "voting",
      };
    case "auction":
      return {
        base: "Custom (no OZ primitive — euint64 + FHE.le + FHE.select)",
        rationale:
          "Sealed-bid auctions need encrypted comparison (FHE.le / FHE.lt) and conditional selection (FHE.select). No OZ primitive exists; reference Zama's auction example via context7 /zama-ai/fhevm topic=\"auction\".",
        imports: `import {FHE, euint64, ebool, externalEuint64, eaddress} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "SealedBidAuction (no inheritance)",
        initUseCase: "auction",
      };
    case "payroll":
      return {
        base: "ERC7984 (OpenZeppelin Confidential Contracts) + scheduler",
        rationale:
          "Recurring confidential transfers between known parties. Use ERC7984 for the value-transfer primitive; layer a small scheduler contract that calls confidentialTransfer() on a cadence.",
        imports: `import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";\nimport {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "PayrollToken is ERC7984",
        initUseCase: "confidential-token",
      };
    case "prediction-market":
      return {
        base: "Custom (euint64 positions + FHE.requestDecryption for settlement)",
        rationale:
          "Encrypted positions during the open phase, oracle-driven settlement at close. Use FHE.requestDecryption for the resolution callback path and keep position deltas client-encrypted.",
        imports: `import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "PredictionMarket (no inheritance)",
        initUseCase: "custom",
      };
    case "custom":
    default:
      return {
        base: "Custom (skeleton with @fhevm/solidity primitives)",
        rationale:
          "No matching OZ primitive — design from scratch using euint*, ebool, eaddress, and the ACL grants documented in §3.",
        imports: `import {FHE, euint64, ebool, eaddress, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`,
        inheritance: "MyContract (no inheritance)",
        initUseCase: "custom",
      };
  }
}

interface SchemaRow {
  slot: string;
  type: string;
  mappingKey: string;
  purpose: string;
}

function schemaFor(category: Category, confidential: Confidential): SchemaRow[] {
  const rows: SchemaRow[] = [];
  switch (category) {
    case "confidential-token":
    case "payroll":
      rows.push({
        slot: "balances",
        type: "euint64",
        mappingKey: "address",
        purpose: "Per-account confidential balance.",
      });
      rows.push({
        slot: "totalSupply",
        type: "euint64",
        mappingKey: "—",
        purpose: "Aggregate supply (encrypted; only contract reads it).",
      });
      break;
    case "voting":
      rows.push({
        slot: "ballots",
        type: "euint64",
        mappingKey: "address",
        purpose: "Per-voter encrypted ballot weight.",
      });
      rows.push({
        slot: "tally",
        type: "euint64",
        mappingKey: "uint256 (option index)",
        purpose: "Running encrypted tally per option.",
      });
      break;
    case "auction":
      rows.push({
        slot: "bids",
        type: "euint64",
        mappingKey: "address",
        purpose: "Sealed bid per participant.",
      });
      rows.push({
        slot: "highestBid",
        type: "euint64",
        mappingKey: "—",
        purpose: "Running max via FHE.le + FHE.select.",
      });
      rows.push({
        slot: "winner",
        type: "eaddress",
        mappingKey: "—",
        purpose: "Encrypted winner address until reveal.",
      });
      break;
    case "prediction-market":
      rows.push({
        slot: "positions",
        type: "euint64",
        mappingKey: "address",
        purpose: "Encrypted position size per trader.",
      });
      rows.push({
        slot: "outcome",
        type: "ebool",
        mappingKey: "—",
        purpose: "Final outcome — decrypted via oracle at settlement.",
      });
      break;
    case "custom":
    default:
      rows.push({
        slot: "value",
        type: "euint64",
        mappingKey: "—",
        purpose: "Placeholder encrypted slot — replace with your domain.",
      });
      break;
  }

  if (confidential === "identities" && !rows.find((r) => r.type === "eaddress")) {
    rows.push({
      slot: "participants",
      type: "eaddress",
      mappingKey: "uint256",
      purpose: "Encrypted participant identity (hidden roster).",
    });
  }
  return rows;
}

function plaintextSlotsFor(category: Category): string {
  switch (category) {
    case "confidential-token":
    case "payroll":
      return "`name`, `symbol`, `decimals`, `confidentialTokenRegistry` registration record.";
    case "voting":
      return "`pollId`, `optionLabels[]`, `snapshotBlock`, `voterRegistry`.";
    case "auction":
      return "`auctionEndsAt`, `tokenAddress`, `seller`, `bidderRegistry` (addresses public, bid amounts encrypted).";
    case "prediction-market":
      return "`marketId`, `question`, `closesAt`, `oracleAddress`.";
    case "custom":
    default:
      return "Define per-domain — addresses + counters can usually stay plaintext.";
  }
}

function aclTableFor(category: Category): string {
  const rows: string[][] = [];
  switch (category) {
    case "confidential-token":
    case "payroll":
      rows.push([
        "Account holder",
        "own `balances[msg.sender]`",
        "`FHE.allow(balances[msg.sender], msg.sender)` after every transfer.",
      ]);
      rows.push([
        "Contract",
        "all encrypted slots",
        "`FHE.allowThis(handle)` after every encrypted write.",
      ]);
      break;
    case "voting":
      rows.push([
        "Voter",
        "own `ballots[msg.sender]`",
        "`FHE.allow(ballots[msg.sender], msg.sender)` on cast.",
      ]);
      rows.push([
        "Public (after close)",
        "`tally[*]`",
        "`FHE.makePubliclyDecryptable(tally[i])` once `block.number > snapshotBlock`.",
      ]);
      rows.push([
        "Contract",
        "all encrypted slots",
        "`FHE.allowThis(handle)` after every encrypted write.",
      ]);
      break;
    case "auction":
      rows.push([
        "Bidder",
        "own `bids[msg.sender]`",
        "`FHE.allow(bids[msg.sender], msg.sender)` on bid.",
      ]);
      rows.push([
        "Public (after end)",
        "`winner`, `highestBid`",
        "`FHE.makePubliclyDecryptable(winner)` after `auctionEndsAt`.",
      ]);
      rows.push([
        "Contract",
        "all encrypted slots",
        "`FHE.allowThis(handle)` after every encrypted write.",
      ]);
      break;
    case "prediction-market":
      rows.push([
        "Trader",
        "own `positions[msg.sender]`",
        "`FHE.allow(positions[msg.sender], msg.sender)` on entry.",
      ]);
      rows.push([
        "Oracle (callback)",
        "`outcome`",
        "`FHE.requestDecryption(toBytes32(outcome), this.callbackResolve.selector)`.",
      ]);
      rows.push([
        "Contract",
        "all encrypted slots",
        "`FHE.allowThis(handle)` after every encrypted write.",
      ]);
      break;
    case "custom":
    default:
      rows.push([
        "User",
        "own slot",
        "`FHE.allow(handle, msg.sender)` on write.",
      ]);
      rows.push([
        "Contract",
        "all encrypted slots",
        "`FHE.allowThis(handle)` after every encrypted write.",
      ]);
      break;
  }
  return rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
}

function decryptionTableFor(
  inputs: DesignInputs,
  schema: SchemaRow[],
): string {
  const path = inputs.decryption;
  return schema
    .map((row) => {
      let p = path;
      // Heuristics for `mixed`: amounts → user; outcome → oracle/public.
      if (path === "mixed") {
        if (
          row.slot === "tally" ||
          row.slot === "winner" ||
          row.slot === "highestBid"
        ) {
          p = "public-after-trigger";
        } else if (row.slot === "outcome") {
          p = "oracle-callback";
        } else {
          p = "each-user-sees-own";
        }
      }
      const trigger =
        p === "each-user-sees-own"
          ? "User clicks 'Reveal' in UI"
          : p === "public-after-trigger"
            ? "Time/state condition met (`auctionEndsAt`, `snapshotBlock`)"
            : "Oracle callback fires";
      const sdk =
        p === "each-user-sees-own"
          ? "`relayerSdk.userDecrypt(handle, signer)`"
          : p === "public-after-trigger"
            ? "`relayerSdk.publicDecrypt(handle)`"
            : "Frontend reads emitted plaintext event after callback.";
      return `| \`${row.slot}\` | \`${p}\` | ${trigger} | ${sdk} |`;
    })
    .join("\n");
}

function flowsFor(category: Category): string {
  switch (category) {
    case "confidential-token":
    case "payroll":
      return "1. **Mint / fund** — admin calls `confidentialMint(to, encryptedAmount, inputProof)`.\n2. **Transfer** — sender calls `confidentialTransfer(to, encryptedAmount, inputProof)`.\n3. **Read balance** — user clicks 'Reveal balance' → `relayerSdk.userDecrypt(balances[me], signer)`.";
    case "voting":
      return "1. **Open poll** — admin posts `optionLabels[]` + `snapshotBlock`.\n2. **Cast ballot** — voter encrypts choice client-side, sends `castBallot(encryptedChoice, inputProof)`.\n3. **Snapshot** — at `snapshotBlock`, anyone calls `closePoll()` which makes each `tally[i]` publicly decryptable.\n4. **Display tally** — frontend calls `relayerSdk.publicDecrypt(tally[i])` per option.";
    case "auction":
      return "1. **Open auction** — seller posts item + `auctionEndsAt`.\n2. **Place bid** — bidder calls `placeBid(encryptedBid, inputProof)`. Contract updates `highestBid` via `FHE.le` + `FHE.select`.\n3. **End** — anyone calls `endAuction()` after `auctionEndsAt`; `winner` and `highestBid` become publicly decryptable.\n4. **Settle** — winner pays, item transfers.";
    case "prediction-market":
      return "1. **Open market** — operator posts `question`, `closesAt`, `oracleAddress`.\n2. **Take position** — trader sends `enterPosition(encryptedSize, inputProof)`.\n3. **Close & resolve** — at `closesAt`, oracle calls `resolve(outcome)` which triggers `FHE.requestDecryption`.\n4. **Payout** — callback fires; contract emits plaintext outcome; users withdraw.";
    case "custom":
    default:
      return "1. **User action** — encrypted input → `FHE.fromExternal(...)` → store with `FHE.allowThis(...)`.\n2. **Read** — per ACL strategy in §3.\n3. **Settle** — per decryption path in §4.";
  }
}

function openQuestionsFor(category: Category): string {
  const generic = [
    "- Who is the deployer / admin? (impacts ACL grants for privileged operations.)",
    "- What is the data-retention story for off-chain encrypted blobs (if any)?",
    "- Will you publish a Confidential Token Registry record? (only relevant for ERC-7984 deployments.)",
  ];
  switch (category) {
    case "voting":
      generic.unshift("- Single-choice or ranked? (ranked needs euint8[] tally array — 3× HCU cost.)");
      break;
    case "auction":
      generic.unshift("- First-price or second-price (Vickrey)? (Vickrey needs an extra encrypted comparison pass.)");
      break;
    case "prediction-market":
      generic.unshift("- Binary outcome or scalar? (scalar needs euint64 outcome; binary uses ebool.)");
      break;
    default:
      break;
  }
  return generic.join("\n");
}

export function renderDesignSubs(inputs: DesignInputs, now: Date): DesignSubstitutions {
  validateInputs(inputs);
  const rec = recommendBase(inputs.category);
  const schema = schemaFor(inputs.category, inputs.confidential);
  return {
    ONE_LINER: inputs.oneLiner.trim(),
    SLUG: inputs.slug,
    CATEGORY: inputs.category,
    DATE: now.toISOString().slice(0, 10),
    BASE_CHOICE: rec.base,
    BASE_RATIONALE: rec.rationale,
    SOL_IMPORTS: rec.imports,
    INHERITANCE: rec.inheritance,
    STATE_SCHEMA_TABLE: schema
      .map(
        (r) =>
          `| \`${r.slot}\` | \`${r.type}\` | ${r.mappingKey === "—" ? "—" : `\`${r.mappingKey}\``} | ${r.purpose} |`,
      )
      .join("\n"),
    PLAINTEXT_SLOTS: plaintextSlotsFor(inputs.category),
    ACL_TABLE: aclTableFor(inputs.category),
    DECRYPTION_PATH: inputs.decryption,
    DECRYPTION_TABLE: decryptionTableFor(inputs, schema),
    FLOWS_BLOCK: flowsFor(inputs.category),
    INIT_USE_CASE: rec.initUseCase,
    OPEN_QUESTIONS: openQuestionsFor(inputs.category),
  };
}

function componentTreeFor(category: Category): string {
  switch (category) {
    case "confidential-token":
    case "payroll":
      return "├── <BalanceCard />                — encrypted balance with 'Reveal' (4-state)\n├── <SendForm />                   — recipient + encrypted amount (4-state)\n├── <TxHistory />                  — past transfers (amounts blurred unless decrypted)\n├── <MintAdmin />                  — admin-only confidential mint (4-state)";
    case "voting":
      return "├── <PollHeader />                — question + options + countdown to snapshot\n├── <CastBallotForm />             — encrypted choice submission (4-state)\n├── <TallyView />                  — public-decrypt tally after close (4-state)\n├── <VoterReceipt />               — user-side decrypt of own ballot (4-state)";
    case "auction":
      return "├── <AuctionHeader />             — item + countdown + (encrypted) leader\n├── <BidForm />                    — encrypted bid submission (4-state)\n├── <BidHistory />                 — own bids (decrypted) + public bid count\n├── <SettlePanel />                — post-close winner reveal (4-state)";
    case "prediction-market":
      return "├── <MarketHeader />              — question + close time + oracle address\n├── <PositionForm />               — encrypted position entry (4-state)\n├── <MyPositions />                — user-side decrypt of own positions (4-state)\n├── <SettlementBanner />           — post-resolution payout state (4-state)";
    case "custom":
    default:
      return "├── <FeatureA />                  — replace with domain-specific component (4-state)\n├── <FeatureB />                  — replace with domain-specific component (4-state)";
  }
}

function userFlowsFor(category: Category): string {
  switch (category) {
    case "confidential-token":
    case "payroll":
      return "**Send confidential transfer**\n\n1. User opens `<SendForm />`, types recipient + amount.\n2. Click **Send** → state `encrypting`: relayer SDK encrypts amount client-side.\n3. Tx broadcast → state `pending`: explorer link visible.\n4. Tx mined → state `decrypted` (no decryption needed for sender) → form resets to `idle`.\n\n**Reveal own balance**\n\n1. User opens `<BalanceCard />` showing 'Encrypted'.\n2. Click **Reveal** → state `encrypting` → SDK signs decryption request.\n3. Relayer responds → state `decrypted`: balance shown.";
    case "voting":
      return "**Cast ballot**\n\n1. Voter selects option in `<CastBallotForm />`.\n2. Click **Cast** → `encrypting` → `pending` → `decrypted` (vote receipt).\n\n**View tally (post-close)**\n\n1. Page transitions to `<TallyView />` after `snapshotBlock`.\n2. For each option: `encrypting` (request public decrypt) → `decrypted` (count rendered).";
    case "auction":
      return "**Place bid**\n\n1. Bidder enters amount in `<BidForm />`.\n2. **Bid** → `encrypting` → `pending` → `decrypted` (bid receipt).\n\n**Settle (post-close)**\n\n1. After `auctionEndsAt`, anyone can trigger `endAuction()`.\n2. `<SettlePanel />` calls `publicDecrypt(winner)` → `decrypted` (winner address shown).";
    case "prediction-market":
      return "**Take position**\n\n1. Trader enters size in `<PositionForm />`.\n2. **Enter** → `encrypting` → `pending` → `decrypted` (position receipt).\n\n**Settle**\n\n1. At close, oracle invokes `resolve(outcome)`; contract requests decryption.\n2. `<SettlementBanner />` listens for the plaintext event → `decrypted` (payout flow unlocked).";
    case "custom":
    default:
      return "**Primary flow** — describe per-domain. Every encrypted action MUST traverse `idle → encrypting → pending → decrypted`.";
  }
}

function screenStatesFor(category: Category): string {
  const lines: string[] = [];
  lines.push("### Connect screen\n\n- `idle`: 'Connect MetaMask' button.\n- `pending`: 'Connecting…' spinner.\n- `decrypted` (success): wallet address pill + Sepolia chain badge.\n- Error: 'Wrong network — switch to Sepolia' CTA.");
  switch (category) {
    case "confidential-token":
    case "payroll":
      lines.push("\n### Balance card\n\n- `idle`: 'Encrypted — click Reveal'.\n- `encrypting`: spinner + 'Decrypting your balance…'.\n- `pending`: (skipped — no on-chain tx for user-decrypt).\n- `decrypted`: balance value + 'Hide' toggle.");
      lines.push("\n### Send form\n\n- `idle`: enabled inputs.\n- `encrypting`: button locked, 'Encrypting amount…'.\n- `pending`: tx hash link.\n- `decrypted`: 'Sent ✓' confirmation; form resets.");
      break;
    case "voting":
      lines.push("\n### Ballot form\n\n- `idle`: option radio group.\n- `encrypting`: 'Encrypting your choice…'.\n- `pending`: tx hash.\n- `decrypted`: 'Vote cast ✓ — receipt: <handle>'.");
      lines.push("\n### Tally view\n\n- `idle`: 'Tally locked until <snapshotBlock>'.\n- `encrypting`: 'Decrypting tallies…'.\n- `decrypted`: bar chart per option.");
      break;
    case "auction":
      lines.push("\n### Bid form\n\n- `idle`: amount input.\n- `encrypting`: 'Sealing your bid…'.\n- `pending`: tx hash.\n- `decrypted`: 'Bid recorded ✓'.");
      lines.push("\n### Settle panel\n\n- `idle` (pre-close): countdown.\n- `idle` (post-close, pre-trigger): 'End auction' button.\n- `encrypting`: 'Revealing winner…'.\n- `decrypted`: winner address + clearing price.");
      break;
    case "prediction-market":
      lines.push("\n### Position form\n\n- `idle`: size input + side selector.\n- `encrypting`: 'Encrypting position…'.\n- `pending`: tx hash.\n- `decrypted`: 'Position open ✓'.");
      lines.push("\n### Settlement banner\n\n- `idle` (pre-close): countdown to `closesAt`.\n- `pending` (post-close): 'Awaiting oracle…'.\n- `decrypted`: 'Resolved: YES/NO — claim payout'.");
      break;
    case "custom":
    default:
      lines.push("\n### Primary action screen\n\n- Document per-state UI per domain. Always include all four states.");
      break;
  }
  return lines.join("\n");
}

function outOfScopeFor(category: Category): string {
  const generic = [
    "- Mainnet deploy (Sepolia testnet only in v1).",
    "- Mobile-native app (web Vite + React only).",
    "- Off-chain indexer (use direct RPC reads + relayer events).",
  ];
  switch (category) {
    case "voting":
      generic.unshift("- Quadratic / weighted voting (use plain VotesConfidential single-choice in v1).");
      break;
    case "auction":
      generic.unshift("- Multi-round / Dutch auctions (sealed-bid single-round only in v1).");
      break;
    default:
      break;
  }
  return generic.join("\n");
}

export function renderWireframeSubs(
  inputs: DesignInputs,
  now: Date,
): WireframeSubstitutions {
  validateInputs(inputs);
  return {
    ONE_LINER: inputs.oneLiner.trim(),
    DATE: now.toISOString().slice(0, 10),
    COMPONENT_TREE: componentTreeFor(inputs.category),
    USER_FLOWS: userFlowsFor(inputs.category),
    SCREEN_STATES: screenStatesFor(inputs.category),
    OUT_OF_SCOPE: outOfScopeFor(inputs.category),
  };
}

/**
 * Apply a `{{KEY}}`-style substitution map to a template string.
 * Unknown placeholders are LEFT IN PLACE so missing data is visible
 * in output (matches the closing-summary renderer convention).
 */
export function applySubs(
  template: string,
  subs: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(subs, key)) {
      return subs[key] ?? match;
    }
    return match;
  });
}
