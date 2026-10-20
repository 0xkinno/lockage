import Link from "next/link";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="no-print mt-32 border-t border-hairline bg-paper-2">
      <div className="wrap py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[15px] text-ink-2">
            Your token&apos;s future is decided the night you launch it. LOCKAGE reads it back to you before you press the button.
          </p>
        </div>
        <nav aria-label="Footer" className="grid gap-2 text-[15px] content-start">
          <div className="label mb-1">Pages</div>
          <Link href="/survey">Survey</Link>
          <Link href="/cross">Cross</Link>
          <Link href="/keeper">Keeper</Link>
          <Link href="/census">Census</Link>
          <Link href="/proof">Proof</Link>
          <Link href="/judge">For judges</Link>
        </nav>
        <div className="grid gap-2 text-[14px] text-ink-2 content-start">
          <div className="label mb-1">Notices</div>
          <p>Testnet only: Elysium testnet 99801 and HyperEVM testnet 998. No mainnet funds are ever used.</p>
          <p>Ines Moraes and Rahul are fictional personas. The demo tokens are ours.</p>
          <p className="label mt-2">Built by 0xkinno for the Ascend x Elysium Builder Competition</p>
        </div>
      </div>
    </footer>
  );
}
