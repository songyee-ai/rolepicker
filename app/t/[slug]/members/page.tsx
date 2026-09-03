// 명단 고치기 — 링크와 코드를 상시 노출하는 화면 (PRD §14)
import { notFound } from 'next/navigation';
import { isSupabaseConfigured, loadTeamView } from '@/back/load';
import EditMembersScreen from '@/front/screens/EditMembersScreen';
import SetupNoticeScreen from '@/front/screens/SetupNoticeScreen';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNoticeScreen />;

  const { slug } = await params;
  const team = await loadTeamView(slug);
  if (!team) notFound();

  return <EditMembersScreen team={team} />;
}
