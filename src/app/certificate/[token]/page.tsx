import { CertificateView } from "@/components/CertificateView";

export const metadata = { title: "Lock Certificate · LOCKAGE" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CertificateView token={token} />;
}
