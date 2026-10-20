import { toFunctionSelector, type Hex } from "viem";

/**
 * The Gauger. A selector scan over deployed bytecode. It is a heuristic and the census publishes its misses.
 * It looks for PUSH4 <selector> in the dispatcher, walking opcodes so push data is skipped.
 */
const sig = (s: string) => toFunctionSelector(s).toLowerCase();

export const SELECTORS = {
  mint: [sig("mint(address,uint256)"), sig("mint(uint256)"), sig("mint(address)"), sig("mintTo(address,uint256)"), sig("issue(address,uint256)")],
  rename: [
    sig("setName(string)"),
    sig("setSymbol(string)"),
    sig("updateName(string)"),
    sig("updateSymbol(string)"),
    sig("changeName(string)"),
    sig("changeSymbol(string)"),
    sig("rename(string)"),
    sig("rename(string,string)"),
    sig("setNameAndSymbol(string,string)"),
    sig("setMetadata(string,string)"),
    sig("updateMetadata(string,string)"),
  ],
  owner: [sig("owner()"), sig("getOwner()"), sig("admin()")],
  tax: [
    sig("setTax(uint256)"),
    sig("setTaxFee(uint256)"),
    sig("setFee(uint256)"),
    sig("setFees(uint256,uint256)"),
    sig("setBuyFee(uint256)"),
    sig("setSellFee(uint256)"),
    sig("setBuyTax(uint256)"),
    sig("setSellTax(uint256)"),
    sig("setTransferFee(uint256)"),
    sig("_taxFee()"),
    sig("taxFee()"),
    sig("transferFee()"),
    sig("buyFee()"),
    sig("sellFee()"),
    sig("feeBps()"),
    sig("excludeFromFee(address)"),
    sig("setFeeExempt(address,bool)"),
  ],
  rebase: [sig("rebase(uint256)"), sig("rebase(int256)"), sig("scaledBalanceOf(address)"), sig("sharesOf(address)"), sig("getSharesByPooledEth(uint256)"), sig("gonsPerFragment()")],
  upgrade: [sig("upgradeTo(address)"), sig("upgradeToAndCall(address,bytes)"), sig("implementation()")],
  pause: [sig("pause()"), sig("unpause()")],
  blacklist: [sig("blacklist(address)"), sig("addToBlacklist(address)"), sig("setBlacklist(address,bool)")],
} as const;

export const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

export type Scan = {
  size: number;
  hasDelegatecall: boolean;
  mint: boolean;
  rename: boolean;
  owner: boolean;
  tax: boolean;
  rebase: boolean;
  upgradeable: boolean;
  pause: boolean;
  blacklist: boolean;
  /** true when the code looks like a proxy whose logic we could not read, so every flag above is unreliable */
  unreadableProxy: boolean;
  matched: string[];
};

export function pushedSelectors(code: Hex): Set<string> {
  const hex = code.startsWith("0x") ? code.slice(2) : code;
  const out = new Set<string>();
  let i = 0;
  while (i < hex.length) {
    const op = parseInt(hex.slice(i, i + 2), 16);
    i += 2;
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      if (op === 0x63) out.add("0x" + hex.slice(i, i + 8).toLowerCase());
      i += n * 2;
    }
  }
  return out;
}

export function hasOpcode(code: Hex, target: number): boolean {
  const hex = code.startsWith("0x") ? code.slice(2) : code;
  let i = 0;
  while (i < hex.length) {
    const op = parseInt(hex.slice(i, i + 2), 16);
    i += 2;
    if (op === target) return true;
    if (op >= 0x60 && op <= 0x7f) i += (op - 0x5f) * 2;
  }
  return false;
}

/** Scan a token's code. Pass the implementation code too when the token is a readable proxy. */
export function scan(code: Hex, implCode?: Hex | null): Scan {
  const size = (code.length - 2) / 2;
  const hasDelegatecall = hasOpcode(code, 0xf4);
  const target = implCode ?? code;
  const sels = pushedSelectors(target);
  const own = pushedSelectors(code);
  const matched: string[] = [];
  const has = (list: readonly string[], label: string) => {
    const hit = list.some((s) => sels.has(s) || own.has(s));
    if (hit) matched.push(label);
    return hit;
  };
  const smallProxy = size < 400 && hasDelegatecall;
  const unreadableProxy = smallProxy && !implCode;
  return {
    size,
    hasDelegatecall,
    mint: has(SELECTORS.mint, "mint"),
    rename: has(SELECTORS.rename, "rename"),
    owner: has(SELECTORS.owner, "owner"),
    tax: has(SELECTORS.tax, "tax"),
    rebase: has(SELECTORS.rebase, "rebase"),
    upgradeable: has(SELECTORS.upgrade, "upgrade") || smallProxy,
    pause: has(SELECTORS.pause, "pause"),
    blacklist: has(SELECTORS.blacklist, "blacklist"),
    unreadableProxy,
    matched,
  };
}
