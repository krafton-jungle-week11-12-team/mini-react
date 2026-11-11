// useEffect (docs/design/phase2/use-effect.md)
// - useEffect: 렌더링 중에는 effect를 실행하지 않고, deps가 바뀌었으면 실행 대기 목록에 넣기만 해요 (FR-F01~F07)
// - runEffects: DOM 반영 뒤 목록의 cleanup을 모두 부르고 effect를 실행해요 (FR-F08~F12, FR-L01~L06)
import type { FunctionComponent } from './component';
import { depsChanged, type Deps } from './deps';
import { claimHook } from './use-state';

export type PendingEffect = { i: number; effect: () => unknown };

export function useEffect(effect: () => unknown, deps?: Deps): void {
  const { component, i, slot } = claimHook('effect');
  if (!slot || depsChanged(slot.deps, deps)) component.pendingEffects.push({ i, effect });
  // 칸의 deps는 이번 것으로 바꾸고, cleanup은 그대로 둬요 (FR-F05)
  if (slot) slot.deps = deps;
  else component.hooks[i] = { kind: 'effect', deps, cleanup: undefined };
}

export function runEffects(component: FunctionComponent<any>): void {
  const list = component.pendingEffects;
  component.pendingEffects = []; // 실행을 시작하면 목록을 비워요 (FR-F12)

  // cleanup을 모두 부른 뒤 effect를 실행해요. 둘 다 호출 순서대로예요 (FR-L03~L05)
  for (const { i } of list) {
    const slot = component.hooks[i] as { cleanup: (() => void) | undefined };
    const cleanup = slot.cleanup;
    slot.cleanup = undefined; // 부른 cleanup을 다시 부르지 않아요
    cleanup?.();
  }
  for (const { i, effect } of list) {
    const result = effect();
    // 함수만 cleanup으로 저장해요. 숫자나 Promise는 버려요 (FR-L01, L02)
    (component.hooks[i] as { cleanup: (() => void) | undefined }).cleanup =
      typeof result === 'function' ? (result as () => void) : undefined;
  }
}
