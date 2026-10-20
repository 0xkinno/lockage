import { PageHead } from "@/components/ui";
import { CrossView } from "@/components/CrossView";

export const metadata = { title: "Cross · LOCKAGE" };

export default function Page() {
  return (
    <>
      <PageHead label="Cross · holders" title={<>Cross only on the route that is still <em>real</em>.</>} sub="Five live checks, an approval, and a crossing through LockGate. If the route has drifted from the seal, the call is refused before any funds move." />
      <CrossView />
    </>
  );
}
