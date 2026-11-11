# useEffect 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #86

## 개요

useEffect는 렌더링 중에 effect를 등록만 해 두고, mount·update가 DOM 반영을 마친 뒤 실행해요. 다시 실행하기 전에는 이전 effect가 돌려준 cleanup을 먼저 불러요. 이 문서를 읽으면 effect 칸과 실행 대기 목록의 모양, `runEffects`가 cleanup과 effect를 부르는 순서를 알고 `src/phase2/modules/use-effect.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                          | 이 문서에서 다루는 곳          |
| ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| FR-F01 | effect를 useEffect 호출 안에서 실행하지 않아요                                                           | 동작 방식                      |
| FR-F02 | 첫 렌더링에서 useEffect가 호출되면 effect를 실행 대기 목록에 넣어요                                       | 동작 방식                      |
| FR-F03 | 리렌더링에서 의존성 비교 결과가 "바뀌었다"면 effect를 실행 대기 목록에 넣어요                             | 동작 방식                      |
| FR-F04 | 리렌더링에서 의존성 비교 결과가 "같다"면 effect를 실행 대기 목록에 넣지 않아요                            | 동작 방식                      |
| FR-F05 | useEffect가 호출되면 이번 deps를 자기 칸에 저장하고 칸의 cleanup은 그대로 둬요                            | 자료구조, 동작 방식            |
| FR-F06 | useEffect가 호출될 때마다 등록 여부와 상관없이 `hookIndex`를 1 늘려요                                     | 동작 방식                      |
| FR-F07 | useEffect의 의존성 비교에 useMemo와 같은 규칙(FR-D)을 써요                                                | 동작 방식, 설계 결정           |
| FR-F08 | mount가 VNode를 붙이고 `prevVNode`를 바꾸면 실행 대기 목록의 effect를 실행해요                           | 위치와 흐름                    |
| FR-F09 | update가 Patch하고 `prevVNode`를 바꾸면 실행 대기 목록의 effect를 실행해요                               | 위치와 흐름                    |
| FR-F10 | 실행 대기 목록의 effect를 useEffect가 호출된 순서대로 실행해요                                           | 동작 방식                      |
| FR-F11 | mount나 update가 끝나기 전에 effect 실행을 마쳐요                                                        | 설계 결정                      |
| FR-F12 | effect를 실행하기 시작하면 인스턴스의 실행 대기 목록을 비워요                                             | 동작 방식                      |
| FR-F13 | effect나 cleanup을 실행하는 동안 setState가 칸을 바꿔도 update를 바로 실행하지 않고 예약만 해요           | 위치와 흐름, 설계 결정         |
| FR-F14 | effect 실행 단계가 끝났을 때 update가 예약돼 있으면 예약을 지우고 update를 한 번 실행해요                 | 위치와 흐름                    |
| FR-F15 | effect 실행 중 예약된 update를 mount나 update가 끝나기 전에 마쳐요                                        | 설계 결정                      |
| FR-F16 | effect 안의 setState가 지금 값과 같은 값으로 호출되면 update를 예약하지 않아요                            | 경계 케이스                    |
| FR-L01 | effect가 함수를 돌려주면 그 함수를 자기 칸의 cleanup에 저장해요                                           | 동작 방식                      |
| FR-L02 | effect가 함수가 아닌 값을 돌려주면 자기 칸의 cleanup을 비워요                                             | 동작 방식                      |
| FR-L03 | 실행 대기 목록의 effect를 실행하기 전에 그 칸에 cleanup이 있으면 cleanup을 먼저 실행해요                  | 동작 방식                      |
| FR-L04 | 실행 대기 목록의 cleanup을 모두 실행한 뒤에 effect를 실행해요                                             | 동작 방식                      |
| FR-L05 | cleanup을 useEffect가 호출된 순서대로 실행해요                                                            | 동작 방식                      |
| FR-L06 | 실행 대기 목록에 든 effect의 cleanup만 실행해요                                                            | 동작 방식, 경계 케이스         |

## 위치와 흐름

```text
렌더링 중: 컴포넌트 함수 → useEffect → claimHook → depsChanged → pendingEffects에 넣기
커밋 뒤:   FunctionComponent(mount/update) → isRunningEffects = true → runEffects → isRunningEffects = false
           → needsUpdate면 update 한 번
```

- 입력을 주는 곳: 컴포넌트 함수(렌더링 중 호출), [useState](use-state.md)의 `claimHook`, [의존성 비교](deps.md)의 `depsChanged`, [FunctionComponent](function-component.md)의 mount·update 마지막 단계(`runEffects(this)` 호출. FR-F08, F09)
- 출력을 받는 곳: [FunctionComponent](function-component.md)의 `hooks[i]`(effect 칸)와 `pendingEffects`. effect 안의 setState는 [useState](use-state.md)를 거쳐 FunctionComponent의 `scheduleUpdate()`로 가고, `isRunningEffects`가 켜져 있어 예약만 돼요(FR-F13~F15).

## 자료구조

```ts
type Cleanup = () => void;

type EffectCallback = () => void | Cleanup;

type EffectSlot = {
  kind: 'effect';
  deps: Deps | undefined;
  cleanup: Cleanup | undefined;
};

type PendingEffect = {
  i: number;
  effect: EffectCallback;
};
```

- `Cleanup` — effect가 돌려주는 정리 함수. effect가 시작한 일을 끝내요. (예: `() => clearInterval(id)`)
- `EffectCallback` — useEffect의 첫 번째 인자. 인자 없이 실행되고 cleanup을 돌려주거나 아무것도 돌려주지 않아요. (예: `() => { document.title = title; }`)
- `EffectSlot.kind: 'effect'` — useEffect의 칸이라는 표시. [FunctionComponent 설계](function-component.md)의 `HookSlot` 유니언에 들어가요. (예: `'effect'`)
- `EffectSlot.deps: Deps | undefined` — 이번 렌더링에서 넘긴 deps. 실행 여부와 상관없이 매 렌더링 바꿔요. 생략했으면 `undefined`예요. (예: `[count]`)
- `EffectSlot.cleanup: Cleanup | undefined` — 마지막으로 실행한 effect가 돌려준 cleanup. 없거나 이미 불렀으면 `undefined`예요. (예: `() => clearInterval(7)`)
- `PendingEffect.i: number` — 이 effect의 칸 번호. 실행할 때 칸의 cleanup을 찾고 새 cleanup을 저장하는 데 써요. (예: `2`)
- `PendingEffect.effect: EffectCallback` — 이번 렌더링에서 만들어진 effect. 칸에는 넣지 않아요. (예: 이번 렌더링의 `count`를 읽는 함수)

## 인터페이스

```ts
function useEffect(effect: EffectCallback, deps?: Deps): void;
function runEffects(component: FunctionComponent): void;
```

`useEffect`

- `effect: EffectCallback` — DOM 반영 뒤에 실행할 함수. (예: `() => localStorage.setItem('todos', JSON.stringify(todos))`)
- `deps?: Deps` — 의존성 배열. 생략하면 매 렌더링 뒤에 실행해요. (예: `[todos]`, `[]`)
- 반환값: 없음.
- 부수 효과: `hookIndex`를 1 늘리고, 칸의 `deps`를 바꾸고, 필요하면 `pendingEffects`에 넣어요. effect는 실행하지 않아요. 렌더링 밖이거나 칸의 `kind`가 `'effect'`가 아니면 `claimHook`이 오류를 던져요(FR-T01, T03).

`runEffects`

- `component: FunctionComponent` — effect를 실행할 인스턴스. mount·update가 자기 자신을 넘겨요. (예: `this`)
- 반환값: 없음.
- 부수 효과: `pendingEffects`를 비우고, 목록에 든 칸의 cleanup과 effect를 실행하고, 칸의 `cleanup`을 바꿔요. `isRunningEffects`와 예약된 update는 건드리지 않아요. FunctionComponent가 다뤄요.

## 동작 방식

### `useEffect(effect, deps)` (등록)

1. `{ component, i, slot } = claimHook('effect')`. 등록하지 않아도 `hookIndex`가 1 늘어요. (FR-F06, FR-T01, T03)
2. `slot`은 없거나 `EffectSlot`이에요. `kind` 검사를 `claimHook`이 마쳐서 단언이 필요 없어요.
3. `slot`이 없으면(첫 렌더링) `pendingEffects.push({ i, effect })`하고 `hooks[i] = { kind: 'effect', deps, cleanup: undefined }`로 칸을 만들어요. (FR-F02)
4. `slot`이 있으면 `depsChanged(slot.deps, deps)`가 `true`일 때만 `pendingEffects.push({ i, effect })`해요. (FR-F03, F04, F07)
5. `slot.deps = deps`로 바꿔요. `slot.cleanup`은 그대로 둬요. (FR-F05)
6. effect는 여기서 실행하지 않아요. (FR-F01)

### `runEffects(component)` (실행)

1. `effects = component.pendingEffects`로 꺼내고, `component.pendingEffects = []`로 비워요. (FR-F12)
2. `effects`를 앞에서부터 돌며, 칸의 `cleanup`이 있으면 부르고 `cleanup = undefined`로 비워요. (FR-L03, L05, L06)
3. 2단계가 끝난 뒤 `effects`를 앞에서부터 돌며 `result = effect()`를 실행해요. (FR-L04, F10)
4. `result`가 함수면 칸의 `cleanup = result`, 아니면 `cleanup = undefined`로 둬요. (FR-L01, L02)

목록에 없는 effect(deps가 같은 effect)의 칸은 건드리지 않아요. 그래서 그 cleanup은 불리지 않아요. (FR-L06)

예시 (count가 바뀔 때마다 타이머를 다시 시작):

```text
입력: function App() {
        const [count, setCount] = useState(0);
        useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, [count]);
        …
      }
      mount → setCount(1) → setCount(2)
```

1. mount 렌더링: `hooks[1]`이 없어 `pendingEffects = [{ i: 1, effect₀ }]`, `hooks[1] = { kind: 'effect', deps: [0], cleanup: undefined }`
2. mount 커밋 뒤 `runEffects`: 정리할 것 없음 → `effect₀` 실행 → 타이머 A, `cleanup = clearA`
3. `setCount(1)` 렌더링: `depsChanged([0], [1])`가 `true` → 목록에 `effect₁`, `deps = [1]`
4. update 커밋 뒤 `runEffects`: `clearA()` 호출, `cleanup = undefined` → `effect₁` 실행 → 타이머 B, `cleanup = clearB`
5. `setCount(2)`도 같은 순서로 `clearB()` 뒤 타이머 C가 시작돼요.

```text
출력: 타이머는 항상 하나만 돌아요. hooks[1]은 { kind: 'effect', deps: [2], cleanup: clearC }예요.
```

## 설계 결정

| 결정                                                                                       | 이유                                                                                                                                         | 관련 ADR |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| effect는 patch 직후 동기로 실행한다                                                        | 요구사항 6.1 결정이에요. "커밋 후 실행"을 지키고 테스트를 동기로 쓸 수 있어요. 실제 React의 `useLayoutEffect`에 가까워요(FR-F11)              | -        |
| 다시 실행할 effect의 cleanup을 모두 부른 뒤 effect를 모두 실행한다                          | 요구사항 6.1 결정이에요. 이전 렌더링이 세운 것을 다 치운 뒤 새것을 세워요. 실제 React와 같은 순서예요(FR-L04)                                 | -        |
| effect 칸에는 `{ kind: 'effect', deps, cleanup }`만 두고, effect 함수는 실행 대기 목록(`{ i, effect }`)에 넣는다 | 요구사항 6.1 결정이에요(칸 `kind`는 PR #124). effect는 매 렌더링 새로 만들어지고 실행할 때만 필요해요                    | -        |
| effect가 함수를 돌려줄 때만 cleanup에 저장하고, 아니면 `undefined`로 비운다                  | 요구사항 6.1이 설계로 넘긴 부분이에요. `async` effect가 돌려준 Promise 같은 값을 cleanup으로 부르지 않아요(FR-L02)                           | -        |
| cleanup을 부른 직후 칸의 cleanup을 비운다                                                   | effect가 3단계에서 오류를 던져도 이미 부른 cleanup을 다음에 다시 부르지 않아요                                                               | -        |
| 의존성 비교는 [의존성 비교 설계](deps.md)의 `depsChanged`를 그대로 부른다                    | 요구사항 6.1 결정이에요. useMemo와 같은 규칙을 한 함수로 지켜요(FR-F07)                                                                      | -        |
| `runEffects`는 cleanup과 effect 실행만 하고, 실행 중 표시와 예약된 update는 FunctionComponent가 다룬다 | update 예약은 `scheduleUpdate`와 함께 있어야 해요. 그래서 FR-F13~F15는 [FunctionComponent 설계](function-component.md)의 `commitEffects`에서 지켜요 | -        |
| 실행 대기 목록은 인스턴스 필드(`pendingEffects`)로 둔다 (요구사항 6.1)         | [FunctionComponent 설계](function-component.md)의 결정을 따라요                                                                              | -        |
| unmount를 두지 않는다. deps가 `[]`인 effect의 cleanup은 불리지 않는다                       | 요구사항 6.1 결정이에요. 루트를 떼어 내는 API가 없고, 자식 컴포넌트에는 Hook이 없어요                                                        | -        |
| useEffect와 `runEffects`는 `src/phase2/modules/use-effect.ts`에 둔다                                       | 등록과 실행이 같은 칸 모양(`EffectSlot`)을 써요                                                                                              | -        |

## 경계 케이스

| 경우                                    | 입력 예시                                                         | 기대 동작                                                                                          | 관련 요구사항 |
| --------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| deps가 `[]`                             | `useEffect(f, [])`                                                | mount 뒤에만 실행해요                                                                              | FR-D06        |
| deps 생략                               | `useEffect(f)`                                                    | mount와 모든 update 뒤에 실행해요                                                                  | FR-D05        |
| deps 길이가 바뀜                        | `[a]` → `[a, b]`                                                  | 그 update 뒤에 실행해요                                                                            | FR-D04        |
| `[]` effect와 `[count]` effect가 같이 있음 | count를 여러 번 바꿈                                            | `[]` effect의 cleanup은 한 번도 불리지 않아요                                                      | FR-L06        |
| cleanup을 돌려주다 안 돌려줌            | 첫 실행은 `return c`, 다음은 `return undefined`                   | `c`는 두 번째 실행 전에 한 번만 불리고, 그 뒤 칸의 cleanup은 `undefined`예요                       | FR-L02        |
| effect 안에서 setState 두 번            | mount의 effect에서 `setA(1); setB(2)`                             | 예약만 하고, effect가 다 끝난 뒤 update를 한 번 해요. 렌더링 횟수는 2예요                          | FR-F13, F14   |
| effect 안에서 같은 값으로 setState      | `count`가 0일 때 effect에서 `setCount(0)`                          | 예약하지 않아요. 렌더링 횟수는 1이에요                                                             | FR-F16        |
| effect가 자기 deps의 state를 조건 없이 바꿈 | `useEffect(() => setCount(count + 1), [count])`                 | update가 끝없이 이어져요. 막지 않아요. 사용 규칙(요구사항 2.3) 위반이에요                          | -             |
| effect가 오류를 던짐                    | effect₁에서 `throw`                                               | 그대로 전파돼요. 남은 effect는 실행되지 않고 `isRunningEffects`가 켜진 채 남을 수 있어요           | -             |
| `async` effect                          | `useEffect(async () => { … }, [])`                                | Promise는 함수가 아니라 cleanup으로 저장하지 않아요                                                | FR-L02        |

## 검증 방법

- 단위 테스트: 기록 배열에 순서를 남기는 effect와 cleanup으로 FR-F10, L04, L05(`cleanup₁, cleanup₂, effect₁, effect₂`)를 확인해요. FR-F11, F15는 `mount()` 바로 다음 줄에서 호출 횟수와 화면을 봐요. FR-L03은 `vi.useFakeTimers()`로 시간을 보내 타이머가 하나만 도는지 봐요. FR-F13은 effect₁이 setState하고 effect₂가 기록을 남겨, effect₂가 다음 렌더링의 effect보다 먼저 기록되는지 확인해요.
- 검증 페이지: 예제 앱에서 할 일을 바꿀 때마다 `document.title`이나 localStorage가 바뀌고, 입력창 글자만 바꿀 때는 effect가 다시 실행되지 않는지 확인해요.

## 정하지 않은 것

- effect나 cleanup이 오류를 던질 때 `try`/`finally`로 `isRunningEffects`를 끌지: 요구사항 7절. 정하면 [FunctionComponent 설계](function-component.md)의 `commitEffects`를 고쳐요. 렌더링 도중 오류가 나 `pendingEffects`에 남은 항목을 비울지도 함께 정해요.
- 연속 update 횟수 제한(무한 루프 막기): 요구사항 7절. 차별점 후보예요.
- `unmount()` 추가: 요구사항 7절. 차별점 후보예요.

## 관련 문서

- [요구사항 명세서: useEffect](../../requirements/phase2/use-effect_requirement.md)
- [FunctionComponent 설계](function-component.md), [useState 설계](use-state.md), [의존성 비교 설계](deps.md), [useMemo 설계](use-memo.md)
