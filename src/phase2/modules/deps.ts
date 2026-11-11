// 의존성 비교 (docs/design/phase2/deps.md)
// useMemo와 useEffect가 함께 써요 (use-memo 요구사항 6.1)

export type Deps = readonly unknown[];

/** 이전 deps와 이번 deps가 "바뀌었다"면 true, "같다"면 false (FR-D01~D06) */
export function depsChanged(prev: Deps | undefined, next: Deps | undefined): boolean {
  if (!prev || !next) return true; // 생략 → 바뀌었다 (FR-D05)
  return next.length !== prev.length || next.some((d, i) => !Object.is(d, prev[i]));
}
