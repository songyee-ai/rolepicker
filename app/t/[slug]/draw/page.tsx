// S4. 뽑는 순간 — 결과는 이미 서버에 저장돼 있고 여기서는 연출만 한다
import DrawScreen from '@/front/screens/DrawScreen';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DrawScreen slug={slug} />;
}
