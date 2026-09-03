/**
 * 조를 만들 때 넣어주는 기본 역할 세트. (PRD §4)
 *
 * 역할은 하드코딩하지 않고 roles 테이블로 관리한다. v1에서 UI로 편집하지는
 * 않지만, 인원이 많아지면 역할 추가가 해법이므로 (PRD §11) 구조를 열어둔다.
 * 그래서 이 배열은 "새 조의 초기값"일 뿐이고, 배정은 항상 DB에서 읽은
 * 역할 목록으로 돌아간다.
 *
 * 설명 문구는 목업 06번 화면의 것을 그대로 쓴다.
 */

import 'server-only';

export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  emoji: string;
  priority: number;
  isDefault: boolean;
}

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    key: 'lead',
    name: '이끄미',
    description:
      '범위와 쉬는시간, 학습법을 정하고 토의를 이끌어요. 조용한 그루에게 고루 기회를 주세요.',
    emoji: '🎯',
    priority: 0,
    isDefault: false,
  },
  {
    key: 'keeper',
    name: '시간지키미',
    description: '학습시간과 쉬는시간을 챙깁니다. 한 세션이 너무 길어지지 않게 해주세요.',
    emoji: '⏱️',
    priority: 1,
    isDefault: false,
  },
  {
    key: 'groo',
    name: '그루',
    description: '특별한 임무는 없어요. 기본 포지션이에요.',
    emoji: '🙋',
    priority: 2,
    isDefault: true, // 뽑지 않는다
  },
];
