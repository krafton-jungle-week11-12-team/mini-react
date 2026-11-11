// useState (docs/design/phase2/use-state.md)
// - claimHook: 모든 Hook이 같은 규칙으로 자기 칸을 받아요. useMemo, useEffect도 import해요
// - useState: state를 컴포넌트 함수 바깥(FunctionComponent의 hooks 칸)에 보관해 리렌더링 뒤에도 값이 유지되게 해요
import { getCurrentComponent, type FunctionComponent, type HookSlot } from './component';

export type StateSlot = { kind: 'state'; value: unknown };

export type SetStateAction<T> = T | ((prev: T) => T);

export type SetState<T> = (action: SetStateAction<T>) => void;

export type ClaimedHook<K extends HookSlot['kind']> = {
  component: FunctionComponent<any>;
  i: number;
  slot: Extract<HookSlot, { kind: K }> | undefined;
};

/** 지금 렌더링 중인 인스턴스에서 다음 칸을 받아요. 칸 종류가 다르면 오류예요 (FR-T01, T03) */
export function claimHook<K extends HookSlot['kind']>(kind: K): ClaimedHook<K> {
  const component = getCurrentComponent();
  if (!component) throw new Error('Hook은 컴포넌트 함수를 렌더링하는 동안에만 호출할 수 있어요');

  const i = component.hookIndex++;
  const slot = component.hooks[i];
  if (slot && slot.kind !== kind) {
    throw new Error(`${i}번째 Hook 칸은 ${slot.kind}인데 ${kind}로 꺼냈어요. Hook 호출 순서가 바뀌었는지 확인하세요`);
  }
  return { component, i, slot: slot as Extract<HookSlot, { kind: K }> | undefined };
}

export function useState<T>(initialValue: T | (() => T)): [T, SetState<T>] {
  const { component, i, slot } = claimHook('state');
  if (!slot) {
    // 함수면 첫 렌더링에서만 불러 결과를 넣어요 (지연 초기화, FR-SX01)
    const value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    component.hooks[i] = { kind: 'state', value };
  }

  // 인스턴스와 칸 번호를 클로저로 기억해, 렌더링이 끝난 뒤에 불려도 자기 칸을 바꿔요 (FR-S07)
  const setState: SetState<T> = (action) => {
    const current = component.hooks[i] as StateSlot;
    const next = typeof action === 'function' ? (action as (prev: T) => T)(current.value as T) : action;
    if (Object.is(next, current.value)) return; // 같은 값이면 칸도 update도 그대로 (FR-S08)
    current.value = next;
    component.scheduleUpdate();
  };

  return [(component.hooks[i] as StateSlot).value as T, setState];
}
