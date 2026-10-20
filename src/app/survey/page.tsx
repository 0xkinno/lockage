import { Suspense } from "react";
import { PageHead } from "@/components/ui";
import { SurveyView } from "@/components/SurveyView";

export const metadata = { title: "Survey · LOCKAGE" };

export default function Page() {
  return (
    <>
      <PageHead label="Survey · before launch" title={<>Read it back <em>before</em> you press the button.</>} sub="Type a design and get the HyperCore envelope instantly, no wallet. Or paste a deployed token, read it from the chain, and seal its bridge identity." />
      <Suspense fallback={<div className="wrap">Loading…</div>}>
        <SurveyView />
      </Suspense>
    </>
  );
}
