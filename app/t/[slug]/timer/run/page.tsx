// S7. 타이머 실행 — 시간을 정하지 않았으면 준비 화면으로 보낸다
import { notFound, redirect } from 'next/navigation';
import { isSupabaseConfigured, loadTimerPage } from '@/back/load';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';
import TimerRunScreen from '@/front/screens/TimerRunScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const page = await loadTimerPage(slug);
  if (!page) notFound();
  if (!page.state) redirect('/t/' + slug);
  if (!page.state.plan) redirect('/t/' + slug + '/timer');
  if (!page.team.today) redirect('/t/' + slug);

  return (
    <TimerRunScreen
      team={{ ...page.team, today: page.team.today }}
      initial={page.state}
    />
  );
}
