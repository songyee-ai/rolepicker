/**
 * 아직 만들지 않은 화면. (타이머 M2, 지난 기록 M3)
 *
 * 링크를 눌렀는데 404가 뜨면 사용자는 자기가 뭘 잘못했다고 생각한다.
 * 무엇이 없고 어디로 돌아가면 되는지 알려준다 (PRD §17 — 빈 화면은 다음 행동을 권한다).
 */

import { ButtonLink, Lede, Screen, Title, TopBar } from '@/front/ui/kit';

const COPY = {
  timer: {
    label: '타이머',
    title: '타이머는 아직 준비 중이에요',
    lede: '학습 40분, 쉬는시간 10분으로 시작하는 타이머가 다음 단계에 붙어요.',
  },
  history: {
    label: '지난 기록',
    title: '지난 기록은 아직 준비 중이에요',
    lede: '역할이 얼마나 고루 돌았는지 보여주는 표가 그다음 단계에 붙어요.',
  },
} as const;

export default function ComingSoonScreen({
  slug,
  kind,
}: {
  slug: string;
  kind: keyof typeof COPY;
}) {
  const copy = COPY[kind];

  return (
    <Screen>
      <TopBar left={copy.label} />
      <Title>{copy.title}</Title>
      <Lede>{copy.lede}</Lede>

      <div className="mt-auto pt-4">
        <ButtonLink href={`/t/${slug}`}>오늘 화면으로</ButtonLink>
      </div>
    </Screen>
  );
}
