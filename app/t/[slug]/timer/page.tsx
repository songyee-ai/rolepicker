// S6. 타이머 준비 — 오늘 역할을 안 뽑았으면 켤 수 없다
import { notFound, redirect } from 'next/navigation';
import { isSupabaseConfigured, loadTimerPage } from '@/back/load';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';
import TimerSetupScreen from '@/front/screens/TimerSetupScreen';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const { edit } = await searchParams;
  const page = await loadTimerPage(slug);
  if (!page) notFound();
  if (!page.state) redirect('/t/' + slug);

  // 조원 한 명이 이미 켰다면 다른 조원에게 다이얼을 보여줄 이유가 없다.
  // 돌아가는 시계 앞에서 시간을 다시 정하라고 하는 셈이 된다.
  // 시간을 바꾸러 온 사람은 실행 화면의 '시간 다시 정하기'로 오고,
  // 그 링크에는 ?edit=1 이 붙어 있어 여기 머문다.
  if (page.state.current && edit !== '1') redirect('/t/' + slug + '/timer/run');

  return <TimerSetupScreen team={page.team} plan={page.state.plan} />;
}
