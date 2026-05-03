/**
 * zama-addresses.ts
 *
 * Fetches Zama Sepolia infrastructure addresses LIVE from the official docs
 * (per CLAUDE.md "fetch live, do not pin"). Caches the parsed result on disk
 * with a 24h TTL so re-runs don't hammer docs.zama.org.
 *
 * Source of truth:
 *   https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md
 *
 * NO Sepolia address is ever hardcoded in this module's source.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ZamaAddresses {
  /** Wrappers Registry (registers ERC-20 ↔ ERC-7984 confidential wrapper pairs). */
  WrappersRegistry?: string;
  /** Zama Token (governance). */
  ZamaToken?: string;
  /** Zama OFT Adapter. */
  ZamaOFTAdapter?: string;
  /** Protocol DAO (governance). */
  ProtocolDAO?: string;
  /** Pauser Set. */
  PauserSet?: string;
  /** Protocol fees burner. */
  ProtocolFeesBurner?: string;
}

interface CacheShape {
  fetchedAt: string;
  ttlHours: number;
  addresses: ZamaAddresses;
  source: string;
}

const SOURCE_URL =
  "https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md";

/** Pure parser exposed for tests. Looks up label → next 0x[40 hex]. */
export function parseAddressesFromMarkdown(md: string): ZamaAddresses {
  const lookup = (label: RegExp): string | undefined => {
    const m = md.match(label);
    if (!m) return undefined;
    const tail = md.slice(m.index ?? 0);
    const hex = tail.match(/0x[a-fA-F0-9]{40}/);
    return hex?.[0];
  };
  return {
    WrappersRegistry: lookup(/Wrappers Registry/),
    ZamaToken: lookup(/Zama Token\b/),
    ZamaOFTAdapter: lookup(/Zama OFT Adapter/),
    ProtocolDAO: lookup(/Protocol DAO/),
    PauserSet: lookup(/Pauser Set\s*\|/),
    ProtocolFeesBurner: lookup(/ProtocolFeesBurner/),
  };
}

function isStale(fetchedAt: string, ttlHours: number): boolean {
  const t = Date.parse(fetchedAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t >= ttlHours * 3600 * 1000;
}

export interface GetAddressesOptions {
  /** Defaults to <contracts-pkg>/cache/zama-addresses.sepolia.json */
  cachePath?: string;
  /** Default 24h. */
  ttlHours?: number;
  /** Skip cache. */
  force?: boolean;
}

/**
 * Resolve Sepolia infra addresses, preferring fresh cache, falling back to
 * a network fetch. Returns the parsed addresses object.
 */
export async function getZamaAddresses(
  opts: GetAddressesOptions = {},
): Promise<ZamaAddresses> {
  const cachePath =
    opts.cachePath ??
    join(process.cwd(), "addresses-cache", "zama-addresses.sepolia.json");
  const ttlHours = opts.ttlHours ?? 24;

  if (!opts.force && existsSync(cachePath)) {
    try {
      const cache = JSON.parse(readFileSync(cachePath, "utf8")) as CacheShape;
      if (!isStale(cache.fetchedAt, ttlHours) && cache.addresses) {
        return cache.addresses;
      }
    } catch {
      // fall through to refetch
    }
  }

  let md: string;
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    md = await res.text();
  } catch (err) {
    // Network failed — try stale cache as a last resort.
    if (existsSync(cachePath)) {
      const cache = JSON.parse(readFileSync(cachePath, "utf8")) as CacheShape;
      console.warn(
        `[zama-addresses] live fetch failed (${(err as Error).message}); using stale cache from ${cache.fetchedAt}`,
      );
      return cache.addresses;
    }
    throw new Error(
      `[zama-addresses] live fetch failed and no cache available. Verify network access to ${SOURCE_URL}. (${(err as Error).message})`,
    );
  }

  const addresses = parseAddressesFromMarkdown(md);
  if (!addresses.WrappersRegistry) {
    throw new Error(
      `[zama-addresses] parse failed: 'Wrappers Registry' missing. Docs page format may have changed — check ${SOURCE_URL}`,
    );
  }

  mkdirSync(dirname(cachePath), { recursive: true });
  const cache: CacheShape = {
    fetchedAt: new Date().toISOString(),
    ttlHours,
    addresses,
    source: SOURCE_URL,
  };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  return addresses;
}
