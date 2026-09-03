// S3 조원 확인 / S5 결과 — 오늘 배정이 있으면 결과로 바로 간다 (PRD §6 S3)
import { notFound } from 'next/navigation';
import { isSupabaseConfigured, loadTeamView } from '@/back/load';
import ResultScreen from '@/front/screens/ResultScreen';
import RosterScreen from '@/front/screens/RosterScreen';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const team = await loadTeamView(slug);
  if (!team) notFound();

  return team.today ? (
    <ResultScreen team={{ ...team, today: team.today }} />
  ) : (
    <RosterScreen team={team} />
  );
}
