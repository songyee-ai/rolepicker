/**
 * Supabase를 아직 연결하지 않았을 때. (개발 중에만 보인다)
 *
 * 여기서 오류로 죽게 두면 원인을 알 수 없는 흰 화면이 뜬다.
 * 무엇이 없고 어떻게 하면 되는지 알려준다 (PRD §17).
 */

import { ButtonLink, Lede, Screen, Title, TopBar } from '@/front/ui/kit';

export default function SetupNoticeScreen() {
  return (
    <Screen>
      <TopBar left="설정 필요" />
      <Title>DB를 아직 연결하지 않았어요</Title>
      <Lede>
        조를 만들고 역할을 뽑으려면 Supabase 연결이 필요해요.
        <br />
        첫 화면과 화면 모양은 지금도 볼 수 있어요.
      </Lede>

      <ol className="mt-4">
        {[
          'supabase.com 에서 프로젝트를 만들어요 (지역은 Seoul)',
          'SQL Editor 에 supabase/migrations/0001_init.sql 을 붙여넣고 Run',
          'Project Settings → API 에서 Project URL 과 service_role 값을 복사',
          '프로젝트 폴더에 .env.local 파일을 만들어 두 값을 넣어요',
        ].map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-[9px] border-t border-rule py-[7px] last:border-b"
          >
            <b className="flex-none pt-px font-mono text-[11px] font-semibold text-lime-deep">
              {index + 1}
            </b>
            <span className="text-[11.5px] leading-[1.55]">{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] font-light leading-[1.6] text-ink-60">
        자세한 순서는 프로젝트의 <code className="font-mono">supabase/README.md</code> 에
        적어뒀어요. 복사·붙여넣기만 하면 됩니다.
      </p>

      <div className="mt-auto pt-4">
        <ButtonLink href="/" tone="quiet">
          처음으로
        </ButtonLink>
      </div>
    </Screen>
  );
}
