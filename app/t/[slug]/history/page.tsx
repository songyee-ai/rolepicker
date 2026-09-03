// S8. 지난 기록 — M3에서 만든다
import ComingSoonScreen from '@/front/screens/ComingSoonScreen';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ComingSoonScreen slug={slug} kind="history" />;
}
