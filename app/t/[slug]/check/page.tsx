// 조원 확인 화면. 오늘 배정이 있어도 결과로 넘기지 않고 이 화면을 보여준다.
// 최근 목록에서 들어올 때와 명단을 고치고 저장했을 때 쓴다.
import { notFound } from 'next/navigation';
import { isSupabaseConfigured, loadTeamView } from '@/back/load';
import RosterScreen from '@/front/screens/RosterScreen';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const team = await loadTeamView(slug);
  if (!team) notFound();

  return <RosterScreen team={team} />;
}
