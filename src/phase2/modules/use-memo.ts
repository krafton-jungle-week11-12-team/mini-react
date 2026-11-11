// useMemo (docs/design/phase2/use-memo.md)
// 계산 결과를 hooks 칸에 기억해 두고, deps가 같으면 다시 계산하지 않고 그 값을 돌려줘요 (FR-M01~M06)
import { depsChanged, type Deps } from './deps';
import { claimHook } from './use-state';

export function useMemo<T>(compute: () => T, deps?: Deps): T {
  const { component, i, slot } = claimHook('memo');
  // 첫 렌더링은 칸이 비어 있는지로 판단해요 (요구사항 6.1)
  if (slot && !depsChanged(slot.deps, deps)) return slot.value as T;

  const value = compute();
  component.hooks[i] = { kind: 'memo', value, deps };
  return value;
}
