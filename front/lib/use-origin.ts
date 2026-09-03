'use client';

/**
 * 현재 사이트 주소(예: https://groo.app)를 읽는다.
 *
 * 서버에는 window가 없다. 그래서 `typeof window === 'undefined'` 로 갈라
 * 서로 다른 글자를 그리면, 브라우저가 서버가 보낸 화면을 이어받을 때
 * "글자가 다르다"는 하이드레이션 오류가 난다.
 *
 * useSyncExternalStore 는 그 상황을 위해 있는 도구다. 화면을 이어받는
 * 동안에는 서버와 같은 값('')을 쓰고, 이어받은 뒤에 실제 주소로 한 번
 * 다시 그린다.
 */

import { useSyncExternalStore } from 'react';

/** 주소는 페이지가 살아 있는 동안 바뀌지 않으므로 구독할 것이 없다 */
const subscribe = () => () => {};
const clientSnapshot = () => window.location.origin;
const serverSnapshot = () => '';

export function useOrigin(): string {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
