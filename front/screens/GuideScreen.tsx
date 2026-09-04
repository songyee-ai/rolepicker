/**
 * S1. 사용법 — /guide (PRD §6 S1)
 *
 * **한 화면에 담는다.** 스크롤 세 번 넘어가는 매뉴얼은 읽히지 않는다.
 * 그래서 네 항목뿐이고, 각 항목은 두세 줄이다.
 *
 * 항목을 고른 기준은 "안 읽으면 잘못 쓰게 되는 것"이다.
 *   빈자리 — 지우지 말고 토글하라는 게 이 서비스에서 가장 오해받기 쉽다
 *   랜덤이 아니다 — 안 그러면 "왜 또 쟤야"가 된다
 *   링크가 열쇠 — 기록이 링크 안에서만 쌓인다는 걸 모르면 조를 다시 만든다
 */

import { BackLink, ButtonLink, Screen, Title, TopBar } from '@/front/ui/kit';
import { DEFAULT_ROLE_GUIDE } from '@/shared/content';

export default function GuideScreen() {
  return (
    <Screen>
      <TopBar left={<BackLink href="/">처음으로</BackLink>} right={<span>사용법</span>} />

      <Title>이렇게 씁니다</Title>

      <section className="mt-3 pb-[11px]">
        <h2 className="text-[12.5px] font-semibold">역할은 두 개예요</h2>
        <div className="mt-2 flex gap-[7px]">
          {DEFAULT_ROLE_GUIDE.map((role) => (
            <div key={role.name} className="flex-1 rounded-[10px] border border-rule bg-white p-2">
              <b className="block text-[11px] font-semibold">
                {role.emoji} {role.name}
              </b>
              <small className="mt-[3px] block text-[10px] font-light leading-[1.45] text-ink-60">
                {role.short}
              </small>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] font-light leading-[1.65] text-ink-60">
          나머지 그루는 특별한 임무가 없어요.
        </p>
      </section>

      <Section title="못 온 그루는 빈자리로">
        명단에서 지우지 마세요. <b className="font-semibold text-ink">빈자리</b>를 누르면 그날
        뽑기에서만 빠지고, 지금까지 맡은 기록은 그대로 남아요. 다음날 다시 참여로 바꾸면 돼요.
      </Section>

      <Section title="완전한 랜덤이 아니에요">
        최근에 맡은 그루는 뽑힐 확률이 낮아지고,{' '}
        <b className="font-semibold text-ink">한 번도 안 맡은 그루가 먼저</b> 후보가 돼요. 얼마나
        고루 돌았는지는 <b className="font-semibold text-ink">지난 기록</b> 화면에서 볼 수 있어요.
      </Section>

      <Section title="링크가 열쇠예요">
        비밀번호가 없어요. 링크를 아는 그루는 누구나 뽑고 고칠 수 있어요. 조가 새로 편성되면 새
        링크를 만드세요. 기록은 <b className="font-semibold text-ink">링크 안에서만</b> 쌓여요.
      </Section>

      <div className="mt-auto pt-4">
        <ButtonLink href="/new" tone="lime">
          새 조 만들기
        </ButtonLink>
        <ButtonLink href="/" tone="quiet" className="mt-[6px]">
          돌아가기
        </ButtonLink>
      </div>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule py-[11px]">
      <h2 className="text-[12.5px] font-semibold">{title}</h2>
      <p className="mt-1 text-[11.5px] font-light leading-[1.65] text-ink-60">{children}</p>
    </section>
  );
}
