# useMemo 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #86

## 개요

useMemo는 렌더링마다 반복되는 계산의 결과를 hooks 칸에 기억해 두고, deps가 바뀌지 않으면 다시 계산하지 않고 그 값을 돌려줘요. 이 문서를 읽으면 메모 칸의 모양과 재사용·재계산을 가르는 순서를 알고 `src/phase2/use-memo.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                          | 이 문서에서 다루는 곳 |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------- |
| FR-M01 | 첫 렌더링에서 useMemo가 호출되면 계산 함수를 실행해 결과를 돌려줘요                                       | 동작 방식             |
| FR-M02 | useMemo가 계산 함수를 실행하면 결과와 이번 deps를 자기 칸에 저장해요                                       | 자료구조, 동작 방식   |
| FR-M03 | 리렌더링에서 의존성 비교 결과가 "같다"면 계산 함수를 실행하지 않고 칸의 값을 돌려줘요                      | 동작 방식             |
| FR-M04 | 리렌더링에서 의존성 비교 결과가 "바뀌었다"면 계산 함수를 다시 실행해 결과를 돌려줘요                       | 동작 방식             |
| FR-M05 | useMemo가 호출될 때마다 계산 여부와 상관없이 `hookIndex`를 1 늘려요                                       | 동작 방식             |
| FR-M06 | 계산 함수를 useMemo 호출 안에서 바로 실행해, 값을 돌려주기 전에 실행을 마쳐요                              | 동작 방식, 설계 결정  |

## 위치와 흐름

```text
컴포넌트 함수(렌더링 중) → useMemo → claimHook → depsChanged → (계산 함수) → 값
```

- 입력을 주는 곳: 컴포넌트 함수(렌더링 중 호출), [useState](use-state.md)의 `claimHook`(인스턴스와 칸 번호), [의존성 비교](deps.md)의 `depsChanged`
- 출력을 받는 곳: 컴포넌트 함수(돌려준 값으로 VNode를 만들어요), [FunctionComponent](function-component.md)의 `hooks[i]`(메모 칸)

## 자료구조

```ts
type MemoSlot = {
  kind: 'memo';
  value: unknown;
  deps: Deps | undefined;
};
```

- `kind: 'memo'` — useMemo의 칸이라는 표시. [FunctionComponent 설계](function-component.md)의 `HookSlot` 유니언에 들어가요. (예: `'memo'`)
- `value: unknown` — 꺼낼 때 useMemo의 `T`로 봐요. 마지막으로 계산한 결과. deps가 같은 동안 이 값을 그대로(`===`) 돌려줘요. (예: `[{ text: '우유', done: false }]`, `3`)
- `deps: Deps | undefined` — `value`를 계산할 때 넘긴 deps. 다음 렌더링의 비교 기준이에요. 생략했으면 `undefined`예요. 타입은 [의존성 비교 설계](deps.md)의 `Deps`예요. (예: `[todos]`)

## 인터페이스

```ts
function useMemo<T>(compute: () => T, deps?: Deps): T;
```

- `compute: () => T` — 계산 함수. 인자 없이 실행해 값을 돌려줘요. 순수 함수라야 해요(요구사항 2.3). (예: `() => todos.filter(t => t.done).length`)
- `deps?: Deps` — 의존성 배열. 계산 함수가 읽는 바뀔 수 있는 값을 모두 넣어요. 생략하면 매 렌더링마다 계산해요. (예: `[todos]`, `[]`)
- 반환값: 계산 결과 또는 칸에 저장된 값. (예: `2`)
- 부수 효과: `hookIndex`를 1 늘리고, 계산하면 `hooks[i]`를 새 `MemoSlot`으로 바꿔요. 렌더링 밖이거나 칸의 `kind`가 `'memo'`가 아니면 `claimHook`이 오류를 던져요(FR-T01, T03).

## 동작 방식

1. `{ component, i, slot } = claimHook('memo')`로 칸 번호와 이전 칸을 받아요. 이때 `hookIndex`가 1 늘어요. 재사용해도 늘어요. (FR-M05, FR-T01, T03)
2. `slot`은 없거나 `MemoSlot`이에요. `kind` 검사를 `claimHook`이 마쳐서 단언이 필요 없어요.
3. `slot`이 있고 `depsChanged(slot.deps, deps)`가 `false`면 `slot.value`를 돌려주고 끝내요. 계산 함수는 실행하지 않아요. (FR-M03)
4. 그 밖(칸이 비었거나 "바뀌었다")이면 `value = compute()`를 바로 실행해요. (FR-M01, M04, M06)
5. `component.hooks[i] = { kind: 'memo', value, deps }` (FR-M02)
6. `value`를 돌려줘요.

예시 (할 일 목록에서 완료 개수 세기):

```text
입력: function App() {
        const [todos, setTodos] = useState([{ text: '우유', done: true }]);
        const [text, setText] = useState('');
        const doneCount = useMemo(() => todos.filter(t => t.done).length, [todos]);
        …
      }
```

1. mount: `hooks[2]`가 비어 있어 계산해요 → `hooks[2] = { kind: 'memo', value: 1, deps: [todos₁] }`
2. `setText('a')`: `depsChanged([todos₁], [todos₁])`가 `false` → 계산하지 않고 `1`을 돌려줘요
3. `setTodos([...todos, { text: '빵', done: true }])`: `depsChanged([todos₁], [todos₂])`가 `true` → 다시 계산해요 → `hooks[2] = { kind: 'memo', value: 2, deps: [todos₂] }`

```text
출력: 계산 함수는 mount와 setTodos 때 두 번만 실행되고, doneCount는 1 → 1 → 2예요.
```

## 설계 결정

| 결정                                                                 | 이유                                                                                                                       | 관련 ADR |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| 메모 칸에는 `{ kind: 'memo', value, deps }`를 저장한다                | 요구사항 6.1 결정이에요. deps를 저장해 두어야 다음 렌더링에서 바뀌었는지 판단할 수 있어요                                  | -        |
| 첫 렌더링은 칸이 비어 있는지(`undefined`)로 판단한다                  | 요구사항 6.1 결정이에요. 메모 칸은 항상 객체라 값이 `undefined`여도 칸과 구분돼요                                          | -        |
| deps가 같으면 항상 재사용한다                                         | 요구사항 6.1 결정이에요. 메모를 버리고 다시 계산하는 일은 하지 않아요                                                       | -        |
| 칸 번호는 계산 전에 받는다(`claimHook`을 먼저 부른다)                 | 계산 함수 안에서 다른 Hook을 부르는 실수가 있어도 이 Hook의 칸 번호는 그대로예요. 재사용할 때도 같은 자리에서 1 늘어요(FR-M05) | -        |
| 계산 함수가 오류를 던지면 칸을 바꾸지 않고 그대로 전파한다            | 저장은 계산이 끝난 뒤(5단계)에만 해서, 실패한 계산이 칸에 남지 않아요                                                       | -        |
| 칸은 `claimHook('memo')`가 `kind`를 확인한 `MemoSlot`으로 받는다       | 요구사항 6.1 hooks 칸 타입 결정(PR #124)을 따라요. 칸이 어긋나면 오류가 나요(FR-T03)                                        | -        |
| useMemo는 `src/phase2/use-memo.ts`에 둔다                                    | Hook마다 파일을 나눠 설계 문서와 맞춰요                                                                                     | -        |

## 경계 케이스

| 경우                           | 입력 예시                                                   | 기대 동작                                                                            | 관련 요구사항 |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| deps가 `[]`                    | `useMemo(f, [])`                                            | mount 때만 계산하고 이후 계속 재사용해요                                             | FR-D06        |
| deps 생략                      | `useMemo(f)`                                                | 매 렌더링마다 계산해요                                                               | FR-D05        |
| deps 길이가 바뀜               | `[todos]` → `[todos, mode]`                                 | 다시 계산해요                                                                        | FR-D04        |
| 재사용 뒤 다음 Hook            | `useMemo` 다음에 `useState`                                 | 재사용해도 `hookIndex`가 늘어 `useState`가 자기 칸을 읽어요                           | FR-M05        |
| 계산 결과가 `undefined`        | `useMemo(() => undefined, [])`                              | 칸은 `{ kind: 'memo', value: undefined, deps: [] }`라 다음 렌더링에 재사용해요       | FR-M03        |
| deps에 넣은 배열을 직접 고침   | `todos.push(t)` 뒤 같은 배열로 setState                     | setState가 같은 값이라 update가 없고, update가 있어도 deps가 같아 재사용해요          | FR-D03        |
| deps 누락                      | `useMemo(() => todos.filter(t => t.text.includes(keyword)), [todos])` | `keyword`가 바뀌어도 이전 결과가 나와요. 사용 규칙(요구사항 2.3) 위반이에요 | -             |
| 계산 함수 안에서 setState      | `useMemo(() => { setX(1); … }, [a])`                        | 막지 않아요. 렌더링 중 update가 불려요. 사용 규칙 위반이에요                         | -             |

## 검증 방법

- 단위 테스트: `vi.fn`으로 감싼 계산 함수로 mount와 update를 하며 호출 횟수를 세요. FR-M02는 `hooks[0]`이 `{ kind: 'memo', value: 10, deps: [1] }`인지, FR-M03은 재사용한 값이 이전과 같은 객체(`===`)인지 봐요. FR-M05는 useMemo 뒤 useState가 자기 값을 돌려주는지, FR-M06은 계산 함수와 컴포넌트 `return` 직전의 기록 순서로 확인해요.
- 검증 페이지: 예제 앱에서 deps에 없는 state(입력창 글자)를 바꿀 때 계산 결과가 다시 만들어지지 않고, 목록을 바꿀 때만 바뀌는지 확인해요.

## 정하지 않은 것

- 렌더링 중 setState를 막을지: [useMemo 요구사항 7절](../../requirements/phase2/use-memo_requirement.md#7-추후-논의). [FunctionComponent 설계](function-component.md)와 함께 정해요.

## 관련 문서

- [요구사항 명세서: useMemo](../../requirements/phase2/use-memo_requirement.md)
- [의존성 비교 설계](deps.md), [useState 설계](use-state.md), [FunctionComponent 설계](function-component.md)
