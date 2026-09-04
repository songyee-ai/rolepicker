// S8. 지난 기록
import { notFound } from 'next/navigation';
import { isSupabaseConfigured, loadHistoryPage } from '@/back/load';
import HistoryScreen from '@/front/screens/HistoryScreen';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const page = await loadHistoryPage(slug);
  if (!page) notFound();

  return <HistoryScreen team={page.team} history={page.history} />;
}
