// S6. 타이머 준비 — M2에서 만든다
import ComingSoonScreen from '@/front/screens/ComingSoonScreen';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ComingSoonScreen slug={slug} kind="timer" />;
}
