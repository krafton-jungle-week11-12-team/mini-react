# useState 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #86

## 개요

useState는 state를 컴포넌트 함수 바깥(FunctionComponent의 hooks 배열)에 보관해, 리렌더링 뒤에도 값이 유지되게 해요. setState는 그 칸을 바꾸고 update를 요청해요. 이 문서를 읽으면 Hook이 칸을 받고 칸의 `kind`를 확인하는 공통 규칙(`claimHook`)과, setState가 값을 정하고 update를 부르는 순서를 알고 `src/phase2/modules/use-state.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                                   | 이 문서에서 다루는 곳    |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| FR-S01 | 첫 렌더링에서 useState가 호출되면, 비어 있는 자기 칸에 초깃값을 저장하고 돌려줘요                                  | 동작 방식                |
| FR-S02 | 리렌더링에서 useState가 호출되면, 초깃값을 무시하고 자기 칸의 값을 돌려줘요                                        | 동작 방식                |
| FR-S03 | 한 렌더링 안에서 useState가 호출된 순서대로 칸을 나눠 줘요                                                         | 인터페이스 (`claimHook`) |
| FR-S04 | 값을 넘겨 setState를 부르면 자기 칸을 그 값으로 바꿔요                                                             | 동작 방식                |
| FR-S05 | 함수를 넘겨 setState를 부르면 그 순간 자기 칸의 값으로 함수를 실행하고, 결과로 칸을 바꿔요                          | 동작 방식                |
| FR-S06 | setState가 칸을 바꾸면 update를 실행해요                                                                          | 동작 방식                |
| FR-S07 | 렌더링이 끝난 뒤 호출된 setState도 자기 인스턴스의 자기 칸을 바꿔요                                                | 동작 방식, 설계 결정     |
| FR-S08 | setState에 넘긴 값(함수면 실행 결과)이 지금 값과 `Object.is`로 같으면 칸을 바꾸지 않고 update를 실행하지 않아요     | 동작 방식                |
| FR-T01 | 렌더링 밖(`currentComponent`가 `null`인 때)에서 Hook이 호출되면 오류를 던져요                                       | 인터페이스 (`claimHook`) |
| FR-T02 | setState가 호출될 때만 update를 실행해요                                                                          | 설계 결정                |
| FR-T03 | Hook이 자기 칸에서 다른 Hook의 `kind`를 가진 칸을 꺼내면 오류를 던져요                                             | 인터페이스 (`claimHook`) |

## 위치와 흐름

```text
렌더링 중: 컴포넌트 함수 → useState → claimHook('state') → 칸 읽기/만들기 → [값, setState]
렌더링 뒤: 이벤트 핸들러 → setState → 칸의 value 쓰기 → FunctionComponent.scheduleUpdate
```

- 입력을 주는 곳: 컴포넌트 함수(렌더링 중 호출), 이벤트 핸들러와 effect(setState 호출), [FunctionComponent](function-component.md)의 `getCurrentComponent()`
- 출력을 받는 곳: [FunctionComponent](function-component.md)의 `hooks`, `hookIndex`, `scheduleUpdate()`. `claimHook`은 [useMemo](use-memo.md)와 [useEffect](use-effect.md)도 불러요.

## 자료구조

```ts
type StateSlot = {
  kind: 'state';
  value: unknown;
};

type SetStateAction<T> = T | ((prev: T) => T);

type SetState<T> = (action: SetStateAction<T>) => void;

type ClaimedHook<K extends HookSlot['kind']> = {
  component: FunctionComponent;
  i: number;
  slot: Extract<HookSlot, { kind: K }> | undefined;
};
```

- `StateSlot.kind: 'state'` — useState의 칸이라는 표시. (예: `'state'`)
- `StateSlot.value: unknown` — 지금 state 값. setState가 바꿔요. 꺼낼 때 useState의 `T`로 봐요. (예: `0`, `[{ id: 1, text: '우유' }]`)
- `SetStateAction<T>` — setState에 넘기는 값. 새 값이나, 지금 값을 받아 새 값을 돌려주는 함수예요. (예: `''`, `prev => prev + 1`)
- `SetState<T>` — useState가 돌려주는 state 변경 함수. 만든 인스턴스와 칸 번호를 클로저로 기억해요. (예: `setCount`)
- `ClaimedHook.component: FunctionComponent` — 이 Hook이 속한 인스턴스. `claimHook` 때의 `currentComponent`예요. (예: `app`)
- `ClaimedHook.i: number` — 이 Hook의 칸 번호. 0부터예요. (예: `count`는 `0`, `text`는 `1`)
- `ClaimedHook.slot` — 이미 있는 칸. `kind`를 확인한 뒤라 그 Hook의 칸 타입이에요. 첫 렌더링이면 `undefined`예요. (예: `{ kind: 'state', value: 3 }`)

## 인터페이스

```ts
function claimHook<K extends HookSlot['kind']>(kind: K): ClaimedHook<K>;
function useState<T>(initialValue: T): [T, SetState<T>];
```

`claimHook`

- `kind: 'state' | 'memo' | 'effect'` — 부르는 Hook의 칸 종류. (예: useMemo는 `'memo'`)
- 반환값: 지금 렌더링 중인 인스턴스, 이 Hook의 칸 번호, 이미 있는 칸. (예: `{ component: app, i: 2, slot: undefined }`)
- 부수 효과: `hookIndex`를 1 늘려요. 렌더링 밖이면 `'Hook은 컴포넌트 함수를 렌더링하는 동안에만 호출할 수 있어요'` 오류를 던져요(FR-T01). 칸의 `kind`가 다르면 `'i번째 Hook 칸은 memo인데 state로 꺼냈어요. Hook 호출 순서가 바뀌었는지 확인하세요'` 같은 오류를 던져요(FR-T03).

`useState`

- `initialValue: T` — 첫 렌더링에서 칸에 넣을 값. 리렌더링에서는 무시해요. (예: `0`, `[]`, `''`)
- 반환값: `[지금 값, setState]`. setState는 같은 칸에 대해 렌더링마다 새로 만들지만 하는 일은 같아요. (예: `[0, setCount]`)
- 부수 효과: 첫 렌더링이면 `hooks[i]`에 `{ kind: 'state', value: initialValue }`를 넣어요. setState를 부르면 `hooks[i].value`를 바꾸고 `scheduleUpdate()`를 불러요.

## 동작 방식

### `claimHook(kind)`

1. `getCurrentComponent()`가 `null`이면 오류를 던져요. (FR-T01)
2. `i = component.hookIndex`로 정하고 `hookIndex`를 1 늘려요. (FR-S03)
3. `slot = component.hooks[i]`가 있고 `slot.kind !== kind`면 오류를 던져요. (FR-T03)
4. `{ component, i, slot }`을 돌려줘요.

### `useState(initialValue)`

1. `{ component, i, slot } = claimHook('state')`
2. `slot`이 없으면 `hooks[i] = { kind: 'state', value: initialValue }`로 칸을 만들어요. (FR-S01)
3. `setState`를 만들어요. `component`와 `i`를 클로저로 기억해요. (FR-S07)
4. `[hooks[i].value, setState]`를 돌려줘요. (FR-S01, S02)

### `setState(action)`

1. `slot = component.hooks[i]`, `prev = slot.value`로 그 순간의 값을 읽어요.
2. `action`이 함수면 `next = action(prev)`, 아니면 `next = action`이에요. (FR-S04, S05)
3. `Object.is(next, prev)`면 아무것도 하지 않고 끝내요. (FR-S08)
4. `slot.value = next` (FR-S04, S05)
5. `component.scheduleUpdate()`를 불러요. effect 실행 중이면 예약만 돼요. (FR-S06)

예시 (함수형 업데이트와 stale closure):

```text
입력: const [count, setCount] = useState(0);
      onClick: () => { setCount(prev => prev + 1); setCount(prev => prev + 1); }
```

1. 첫 setState: `prev = 0` → `next = 1` → `hooks[0].value = 1` → `update()` (배칭 없음)
2. 둘째 setState: `prev = 1` → `next = 2` → `hooks[0].value = 2` → `update()`

```text
출력: hooks[0]은 { kind: 'state', value: 2 }이고 화면에 2가 보여요. update는 두 번 일어나요.
      같은 자리에서 setCount(count + 1)을 두 번 부르면 count가 클로저의 0이라 1이 돼요.
```

## 설계 결정

| 결정                                                                              | 이유                                                                                                                       | 관련 ADR |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| useState 칸은 `{ kind: 'state', value }`로 둔다                                   | 요구사항 6.1 hooks 칸 타입 결정이에요(PR #124). 대가로 칸의 값을 읽을 때 `.value`를 거쳐요                                 | -        |
| `claimHook`이 칸 번호 받기, 렌더링 밖 검사, `kind` 검사를 모두 한다                | 세 Hook이 같은 함수로 FR-T01, T03을 지켜요. 칸을 꺼낼 때 한 번만 확인하면 그 뒤 코드는 단언 없이 칸 타입을 알아요         | -        |
| `kind` 검사는 칸이 이미 있을 때만 한다                                             | 첫 렌더링에는 비교할 칸이 없어요. 리렌더링에서 Hook 수가 늘면 늘어난 칸은 새로 만들어요                                   | -        |
| setState는 `component`와 `i`를 클로저로 기억하고, `currentComponent`를 보지 않는다 | 클릭 핸들러는 렌더링 밖이라 `currentComponent`가 `null`이에요(FR-S07)                                                       | -        |
| setState는 칸 객체를 갈아 끼우지 않고 `value`만 바꾼다                             | 칸 객체는 `kind`를 담은 채 그대로 두고, 바뀌는 건 값뿐이에요                                                                | -        |
| setState는 `update()`가 아니라 `scheduleUpdate()`를 부른다                         | 요구사항 6.1 update 예약 결정이에요. effect 실행 중 setState를 예약으로 돌려요                                              | -        |
| 함수를 넘기면 항상 실행 결과를 새 값으로 쓴다                                       | 요구사항 4.2의 2단계예요. 그래서 함수 자체를 state로 저장할 수는 없어요                                                     | -        |
| update는 setState 말고는 부르지 않는다                                             | state 변수를 직접 바꾸거나 배열에 `push`해도 시스템은 알 수 없어요(FR-T02). 관찰 장치를 두지 않아요                          | -        |
| `claimHook`은 `src/phase2/modules/use-state.ts`에 두고 useMemo, useEffect가 import한다             | 모든 Hook이 같은 함수로 칸을 받아요                                                                                         | -        |

## 경계 케이스

| 경우                               | 입력 예시                                              | 기대 동작                                                                                 | 관련 요구사항  |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------- |
| mount 전 Hook 호출                 | 테스트에서 `useState(0)` 직접 호출                     | 오류를 던져요                                                                             | FR-T01         |
| mount 뒤 Hook 호출                 | 클릭 핸들러 안에서 `useState(0)`                       | 오류를 던져요                                                                             | FR-T01         |
| 조건문 안 Hook으로 순서가 바뀜     | `if (show) useMemo(…)` 뒤에 `useState`                 | 두 번째 렌더링에서 `useState`가 memo 칸을 꺼내 오류를 던져요                               | FR-T03         |
| 같은 종류 Hook끼리 순서가 바뀜     | `if (a) useState(1)` 뒤에 `useState(2)`                | 둘 다 state 칸이라 `kind` 검사로는 못 잡아요. 칸이 조용히 어긋나요                         | FR-T03         |
| 같은 값                            | `count`가 3일 때 `setCount(3)`                         | 칸도 그대로, update도 없어요                                                              | FR-S08         |
| 같은 값을 돌려주는 함수            | `setCount(c => c)`                                     | 함수를 실행한 뒤 같아서 update가 없어요                                                    | FR-S08         |
| `NaN`                              | state가 `NaN`일 때 `setX(NaN)`                         | `Object.is`로 같아 update가 없어요                                                        | FR-S08         |
| 배열을 고친 뒤 같은 배열을 넘김     | `todos.push(t); setTodos(todos)`                       | 같은 참조라 update가 없어요. 새 배열(`[...todos, t]`)을 넘겨야 해요                        | FR-S08, FR-T02 |
| state 변수를 직접 바꿈             | `count = 5`                                            | 화면이 바뀌지 않아요                                                                      | FR-T02         |
| 초깃값이 `undefined`               | `useState(undefined)`                                  | 칸은 `{ kind: 'state', value: undefined }`라 리렌더링에서 칸이 있는 것으로 봐요            | FR-S01, S02    |
| 두 state                           | `count`, `text`                                        | `hooks[0]`, `hooks[1]`을 따로 써서 한쪽을 바꿔도 다른 쪽이 그대로예요                       | FR-S03         |
| 비싼 초깃값                        | `useState(loadFromStorage())`                          | 매 렌더링마다 `loadFromStorage()`가 실행되고 결과는 버려져요. 지연 초기화는 이번 단계에서 만들지 않아요     | -              |

## 검증 방법

- 단위 테스트: FunctionComponent에 테스트용 컴포넌트를 mount하고 요구사항 확인 방법대로 `hooks` 칸과 화면을 확인해요. FR-S01은 `hooks[0]`이 `{ kind: 'state', value: 0 }`인지 봐요. FR-S05는 한 핸들러에서 함수형 업데이트 두 번(결과 2)과 값 업데이트 두 번(결과 1)을 비교해요. FR-S08은 렌더링 횟수를 세는 컴포넌트로 같은 값, 같은 값을 돌려주는 함수, `NaN` 세 경우에 횟수가 늘지 않는지 봐요. FR-T01은 mount 전과 후에 `useState`를 직접 불러 오류가 나는지, FR-T03은 조건문 안의 useMemo로 순서를 바꿔 오류가 나는지 봐요.
- 검증 페이지: 예제 앱의 카운터 버튼과 입력창으로 state가 바뀌고, 다른 state가 초기화되지 않는지 확인해요.

## 정하지 않은 것

- useState 지연 초기화(`useState(() => load())`): 이번 단계에서는 만들지 않아요(2026-11-11). [FunctionComponent 요구사항의 2차 추가 기능(FR-SX01)](../../requirements/phase2/function-component_requirement.md#55-2차-추가-기능)으로 미뤘어요.
  - 지금 동작: 함수를 넘기면 함수 자체가 state 값으로 저장돼요. 예제 앱은 `useState(load())`처럼 값을 넘겨요.
  - 넣을 때: `useState`의 2단계에서 `initialValue`가 함수면 불러서 그 결과를 칸에 넣어요.
  - 근거: [useMemo 요구사항 7절](../../requirements/phase2/use-memo_requirement.md#7-추후-논의), [useEffect 요구사항 7절](../../requirements/phase2/use-effect_requirement.md#7-추후-논의)
- 렌더링 중 setState를 막을지: [FunctionComponent 설계](function-component.md)의 "정하지 않은 것"과 함께 정해요.

## 관련 문서

- [요구사항 명세서: FunctionComponent · useState · State 제약](../../requirements/phase2/function-component_requirement.md)
- [FunctionComponent 설계](function-component.md), [useMemo 설계](use-memo.md), [useEffect 설계](use-effect.md)
