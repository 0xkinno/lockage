import { PageHead } from "@/components/ui";
import { KeeperView } from "@/components/KeeperView";

export const metadata = { title: "Keeper · LOCKAGE" };

export default function Page() {
  return (
    <>
      <PageHead label="Keeper · builders" title={<>It runs while you sleep, and <em>speaks only when the books stop matching.</em></>} sub="The Lockkeeper reconciles every sealed token's escrow against its mirror supply and pending messages. Your wallet signs any decision, bound to the finding on screen." />
      <KeeperView />
    </>
  );
}
