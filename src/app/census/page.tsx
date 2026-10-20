import { PageHead } from "@/components/ui";
import { CensusView } from "@/components/CensusView";

export const metadata = { title: "Census · LOCKAGE" };

export default function Page() {
  return (
    <>
      <PageHead label="Census · data we did not choose" title={<>Every ERC-20 on Elysium testnet, <em>surveyed.</em></>} sub="How many can graduate as they stand, how many are blocked by supply, how many can be renamed or minted, and where the heuristic is wrong." />
      <CensusView />
    </>
  );
}
