/**
 * sepolia-addresses.ts — WebFetch-backed Zama Sepolia address registry
 * with a 24-hour file cache (DEPLOY-03).
 *
 * Source: https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses
 *
 * The actual WebFetch call belongs to the skill body (Claude). This
 * module exposes:
 *   - `parseAddressesFromHtml(html)` — pure parser used by tests
 *   - `getSepoliaAddresses({ cacheDir, fetcher })` — orchestrator with
 *     cache read, TTL check, refetch on stale, write-back. The `fetcher`
 *     is injected so unit tests don't hit the network.
 *
 * Hard rule: NO Sepolia address is ever pinned in this file's source.
 *
 * Confidential Token Registry: as of 2026-05 there is NO generic
 * ConfidentialTokenRegistry on Sepolia. The protocol-apps page lists
 * a "Wrappers Registry" (0x2f0750…) which is for confidential ERC-20
 * wrappers only. Generic confidential token registration is manual via
 * the Zama developer program / discord. Step 5 of /zama-deploy is
 * therefore advisory rather than automated — see deploy/SKILL.md.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { argv, cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

export interface Addresses {
  ACL?: string;
  KMSVerifier?: string;
  InputVerifier?: string;
  FHEVMExecutor?: string;
  HCULimit?: string;
  DecryptionOracle?: string;
  InputVerification?: string;
  RelayerUrl?: string;
  GatewayChainId?: string;
}

export interface CacheShape {
  fetchedAt: string;
  ttlHours: number;
  addresses: Addresses;
}

export interface GetOptions {
  cacheDir?: string;
  /** TTL override (hours). Default 24. */
  ttlHours?: number;
  /** Fetcher fn — must return the docs page HTML. */
  fetcher?: () => Promise<string>;
  /** Force a refetch (skip cache). */
  force?: boolean;
}

export const REGISTRY_URL =
  "https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses";

/**
 * Map from {AddressKey → upstream label name on docs.zama.org}.
 * Upstream labels follow the pattern <NAME>_CONTRACT or <NAME>_ADDRESS.
 * RELAYER_URL and GATEWAY_CHAIN_ID are not 0x addresses but live on the
 * same page and matter for deploy-time config.
 */
const LABEL_MAP: ReadonlyArray<{ key: keyof Addresses; upstream: string; isAddress: boolean }> = [
  { key: "ACL",                upstream: "ACL_CONTRACT",                isAddress: true  },
  { key: "FHEVMExecutor",      upstream: "FHEVM_EXECUTOR_CONTRACT",     isAddress: true  },
  { key: "HCULimit",           upstream: "HCU_LIMIT_CONTRACT",          isAddress: true  },
  { key: "KMSVerifier",        upstream: "KMS_VERIFIER_CONTRACT",       isAddress: true  },
  { key: "InputVerifier",      upstream: "INPUT_VERIFIER_CONTRACT",     isAddress: true  },
  { key: "DecryptionOracle",   upstream: "DECRYPTION_ADDRESS",          isAddress: true  },
  { key: "InputVerification",  upstream: "INPUT_VERIFICATION_ADDRESS",  isAddress: true  },
  { key: "RelayerUrl",         upstream: "RELAYER_URL",                 isAddress: false },
  { key: "GatewayChainId",     upstream: "GATEWAY_CHAIN_ID",            isAddress: false },
];

const HEX = /0x[a-fA-F0-9]{40}/;
const URL_RE = /https?:\/\/[^\s<"'`)]+/;
const NUM_RE = /\b\d{2,}\b/;

/**
 * Pure parser. For each known upstream label, find its first occurrence
 * in the HTML and capture the next address / URL / chain id that follows
 * within a reasonable window (1024 chars). Resilient to extra markup.
 */
export function parseAddressesFromHtml(html: string): Addresses {
  const out: Addresses = {};
  for (const { key, upstream, isAddress } of LABEL_MAP) {
    const labelIdx = html.indexOf(upstream);
    if (labelIdx < 0) continue;
    const window = html.slice(labelIdx, labelIdx + 1024);
    if (isAddress) {
      const m = window.match(HEX);
      if (m) out[key] = m[0];
    } else if (key === "RelayerUrl") {
      const m = window.match(URL_RE);
      if (m) out[key] = m[0];
    } else if (key === "GatewayChainId") {
      const m = window.match(NUM_RE);
      if (m) out[key] = m[0];
    }
  }
  return out;
}

function readCache(path: string): CacheShape | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as CacheShape;
    if (
      typeof parsed.fetchedAt === "string" &&
      typeof parsed.ttlHours === "number" &&
      parsed.addresses
    ) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

function isStale(cache: CacheShape, ttlHours: number): boolean {
  const fetched = Date.parse(cache.fetchedAt);
  if (!Number.isFinite(fetched)) return true;
  const ageMs = Date.now() - fetched;
  const ttlMs = (cache.ttlHours ?? ttlHours) * 3600 * 1000;
  return ageMs >= ttlMs;
}

export async function getSepoliaAddresses(
  opts: GetOptions = {},
): Promise<Addresses> {
  const cacheDir = opts.cacheDir ?? join(cwd(), ".cache");
  const ttlHours = opts.ttlHours ?? 24;
  const cachePath = join(cacheDir, "zama-addresses.json");

  if (!opts.force) {
    const cached = readCache(cachePath);
    if (cached && !isStale(cached, ttlHours)) {
      return cached.addresses;
    }
  }

  if (!opts.fetcher) {
    throw new Error(
      `Zama Sepolia address registry: cold fetch required but no fetcher provided. ` +
        `In skill runtime, WebFetch ${REGISTRY_URL} and pass the HTML via fetcher().`,
    );
  }

  let html: string;
  try {
    html = await opts.fetcher();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Zama Sepolia address registry fetch failed (${msg}). ` +
        `Verify network access to ${REGISTRY_URL} and retry.`,
    );
  }

  const addresses = parseAddressesFromHtml(html);
  // Required minimum: ACL + KMSVerifier + RelayerUrl. Without these no FHE
  // operation works on Sepolia. Other entries are nice-to-have.
  const missing = (
    ["ACL", "KMSVerifier", "RelayerUrl"] as Array<keyof Addresses>
  ).filter((k) => !addresses[k]);
  if (missing.length > 0) {
    throw new Error(
      `Zama Sepolia address registry parse failed: missing ${missing.join(", ")}. ` +
        `The docs page format may have changed — check ${REGISTRY_URL}.`,
    );
  }

  mkdirSync(cacheDir, { recursive: true });
  const cache: CacheShape = {
    fetchedAt: new Date().toISOString(),
    ttlHours,
    addresses,
  };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return addresses;
}

// CLI shim — when invoked from the skill body, expects the WebFetch'd
// HTML to be supplied via stdin (skill writes it to a temp file and
// passes --html-file). Without input, prints usage.
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  const args = argv.slice(2);
  const htmlFileIdx = args.indexOf("--html-file");
  if (htmlFileIdx >= 0 && args[htmlFileIdx + 1]) {
    const htmlPath = args[htmlFileIdx + 1] as string;
    const html = readFileSync(htmlPath, "utf8");
    void getSepoliaAddresses({ fetcher: async () => html, force: true })
      .then((addrs) => {
        stdout.write(JSON.stringify(addrs, null, 2) + "\n");
        exit(0);
      })
      .catch((e) => {
        stderr.write(`✗ ${e instanceof Error ? e.message : String(e)}\n`);
        exit(1);
      });
  } else {
    // Try cache-only mode.
    void getSepoliaAddresses({})
      .then((addrs) => {
        stdout.write(JSON.stringify(addrs, null, 2) + "\n");
        exit(0);
      })
      .catch((e) => {
        stderr.write(
          `✗ sepolia-addresses: ${e instanceof Error ? e.message : String(e)}\n` +
            `Usage: sepolia-addresses.ts --html-file <path>  (after WebFetch ${REGISTRY_URL})\n`,
        );
        exit(1);
      });
  }
}
