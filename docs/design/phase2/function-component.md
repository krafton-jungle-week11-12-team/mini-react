# FunctionComponent 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #85

## 개요

FunctionComponent는 루트 컴포넌트 함수를 맡아 처음 화면을 그리고(mount), state가 바뀌면 바뀐 노드만 다시 그려요(update). hooks 배열과 이전 VNode, effect 실행 대기 목록을 인스턴스에 보관해요. 이 문서를 읽으면 mount, update, render, scheduleUpdate의 순서와 Phase 1 `diff`, `patch`를 부르는 방법을 알고 `src/component.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                   | 이 문서에서 다루는 곳     |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------- |
| FR-C01 | 만들면 컴포넌트 함수, props, 컨테이너를 보관하고 컴포넌트 함수는 실행하지 않아요                   | 인터페이스, 동작 방식     |
| FR-C02 | mount하면 렌더링한 VNode를 DOM으로 만들어 컨테이너의 자식으로 붙여요                               | 동작 방식                 |
| FR-C03 | 컨테이너에 원래 내용이 있으면 지우고 붙여요                                                        | 동작 방식                 |
| FR-C04 | update하면 새 VNode를 `prevVNode`와 Diff로 비교해 바뀐 노드만 Patch해요                            | 동작 방식, 설계 결정      |
| FR-C05 | mount나 update가 DOM 반영을 마치면 `prevVNode`를 이번 VNode로 바꿔요                               | 동작 방식                 |
| FR-C06 | 렌더링을 시작하면 `hookIndex`를 0으로 되돌려요                                                     | 동작 방식                 |
| FR-C07 | 컴포넌트 함수를 실행하는 동안 `currentComponent`가 이 인스턴스를 가리켜요                           | 인터페이스, 동작 방식     |
| FR-C08 | 컴포넌트 함수 실행이 끝나면 `currentComponent`를 `null`로 되돌려요                                 | 동작 방식                 |
| FR-C09 | (삭제됨) 막지 않기로 결정. 대체: FR-A12                                                           | 경계 케이스               |
| FR-C10 | (삭제됨) 막지 않기로 결정. 대체: FR-A12                                                           | 경계 케이스               |
| FR-C11 | hooks 배열을 인스턴스 필드로 가져요                                                                | 자료구조                  |
| FR-C12 | 컴포넌트 함수가 오류를 던지면 `currentComponent`를 `null`로 되돌린 뒤 오류를 그대로 전파해요         | 동작 방식, 설계 결정      |
| FR-A01 | 컴포넌트는 props 객체 하나를 받는 함수로 작성해요                                                  | 자료구조 (`Component`)    |
| FR-A02 | 컴포넌트는 함수 컴포넌트로만 작성하고 클래스 컴포넌트를 쓰지 않아요                                | 검증 방법                 |
| FR-A03 | 페이지를 루트 컴포넌트 하나와 그 아래 자식 컴포넌트로 구성해요                                     | 위치와 흐름, 검증 방법    |
| FR-A04 | 루트 컴포넌트는 페이지 전체를 담은 VNode 트리 하나를 돌려줘요                                       | 동작 방식, 설계 결정      |
| FR-A05 | state는 루트 컴포넌트에만 두고, 자식 컴포넌트는 Hook을 호출하지 않아요                               | 경계 케이스               |
| FR-A06 | 자식 컴포넌트는 같은 props에 항상 같은 모양의 VNode를 돌려줘요                                       | 검증 방법                 |
| FR-A07 | 자식 컴포넌트는 함수 바깥의 값을 바꾸지 않아요                                                      | 검증 방법                 |
| FR-A08 | 자식 컴포넌트는 실제 DOM을 직접 수정하지 않아요                                                     | 검증 방법                 |
| FR-A09 | 루트 컴포넌트는 자식이 그리는 데 필요한 값을 props로 넘겨요                                         | 검증 방법                 |
| FR-A10 | 자식에서 state를 바꿀 동작이 필요하면 루트는 state를 바꾸는 함수를 props로 넘겨요                    | 검증 방법                 |
| FR-A11 | 자식 요소에서 사용자 이벤트가 생기면 props로 받은 함수를 호출해 부모에 알려요                        | 검증 방법                 |
| FR-A12 | 앱은 `main.ts`에서 mount를 한 번만 호출하고, update를 직접 호출하지 않아요                          | 인터페이스, 경계 케이스   |

## 위치와 흐름

```text
main.ts(new, mount) → FunctionComponent.render → 컴포넌트 함수(h, Hook) → VNode
  → mount: toDOM → 컨테이너에 붙임 / update: diff([prevVNode], [vnode]) → patch(container, …)
  → runEffects → (예약된 update)
setState → scheduleUpdate → update
```

- 입력을 주는 곳: 앱의 `main.ts`(생성, `mount()`. FR-A03, A12), [useState](use-state.md)의 setState(`scheduleUpdate()`), 컴포넌트 함수가 돌려준 VNode([h 함수](h.md))
- 출력을 받는 곳: 컨테이너의 실제 DOM([Virtual DOM 변환](../vdom.md)의 `toDOM`, [Diff](../diff.md)의 `diff`, [Patch](../patch.md)의 `patch`), [useEffect](use-effect.md)의 `runEffects`, 렌더링 중인 Hook([useState](use-state.md)의 `claimHook`이 `getCurrentComponent()`로 읽어요. [useState](use-state.md), [useMemo](use-memo.md), [useEffect](use-effect.md)가 `hooks` 칸을 써요)

## 자료구조

```ts
class FunctionComponent<P extends object = Record<string, unknown>> {
  readonly fn: Component<P>;
  readonly props: P;
  readonly container: Element;

  hooks: HookSlot[];
  hookIndex: number;
  prevVNode: VNode | null;

  pendingEffects: PendingEffect[];
  isRunningEffects: boolean;
  needsUpdate: boolean;
}

type HookSlot = StateSlot | MemoSlot | EffectSlot;

// src/component.ts 안의 모듈 변수
let currentComponent: FunctionComponent | null;
```

- `fn: Component<P>` — 루트 컴포넌트 함수. 생성 때 받아 보관만 해요. 타입은 [h 함수 설계](h.md)의 `Component`예요. (예: `App`)
- `props: P` — 루트 컴포넌트에 넘길 props. 렌더링마다 같은 객체를 넘겨요. (예: `{}`, `{ title: '할 일' }`)
- `container: Element` — VNode를 붙일 실제 DOM 요소. VNode 트리 바깥에 있어요. (예: `document.getElementById('app')`)
- `hooks: HookSlot[]` — Hook마다 한 칸을 쓰는 배열. 생성 때 `[]`예요. 칸마다 어느 Hook의 칸인지 `kind`로 적어요. (예: `[{ kind: 'state', value: 0 }, { kind: 'memo', value: 3, deps: [todos] }]`) (FR-C11)
- `HookSlot` — 칸 하나. `kind`로 구분하는 유니언이고, 각 칸 타입은 [useState](use-state.md)의 `StateSlot`, [useMemo](use-memo.md)의 `MemoSlot`, [useEffect](use-effect.md)의 `EffectSlot`이에요. (예: `{ kind: 'effect', deps: [count], cleanup: undefined }`)
- `hookIndex: number` — 다음 Hook이 쓸 칸 번호. 렌더링을 시작할 때 0이에요. (예: Hook 세 개를 부른 뒤 `3`)
- `prevVNode: VNode | null` — 지금 화면을 그린 VNode. mount 전에는 `null`이에요. (예: `{ kind: 'element', tag: 'div', … }`)
- `pendingEffects: PendingEffect[]` — 이번 렌더링에서 실행할 effect 목록. 타입은 [useEffect 설계](use-effect.md)에 있어요. (예: `[{ i: 2, effect }]`)
- `isRunningEffects: boolean` — effect 실행 중 표시. 켜져 있으면 setState가 update를 예약만 해요. (예: `false`)
- `needsUpdate: boolean` — effect 실행 중 예약된 update가 있는지. (예: `true`)
- `currentComponent: FunctionComponent | null` — 지금 렌더링 중인 인스턴스. 렌더링 밖에서는 `null`이에요. (예: 렌더링 중 `app`, 클릭 핸들러 안에서 `null`)

## 인터페이스

```ts
class FunctionComponent<P extends object = Record<string, unknown>> {
  constructor(fn: Component<P>, props: P, container: Element);
  mount(): void;
  update(): void;
  scheduleUpdate(): void;
}

function getCurrentComponent(): FunctionComponent | null;
```

`constructor`

- `fn: Component<P>` — 루트 컴포넌트 함수. 실행하지 않고 보관해요. (예: `App`)
- `props: P` — 루트 컴포넌트에 넘길 props. (예: `{}`)
- `container: Element` — 붙일 곳. (예: `#app`)
- 반환값: 인스턴스. `hooks`는 `[]`, `prevVNode`는 `null`이에요.
- 부수 효과: 없음. (FR-C01)

`mount()`

- 반환값: 없음.
- 부수 효과: 컨테이너의 자식을 모두 지우고 렌더링 결과를 붙여요. `prevVNode`, `hooks`를 채우고 effect를 실행해요. `main.ts`에서 한 번만 불러요(FR-A12).

`update()`

- 반환값: 없음.
- 부수 효과: 컨테이너 안의 바뀐 노드만 고치고, `prevVNode`를 바꾸고, effect를 실행해요. 앱 코드는 부르지 않아요. `scheduleUpdate()`만 불러요(FR-A12).

`scheduleUpdate()`

- 반환값: 없음.
- 부수 효과: effect 실행 중이 아니면 `update()`를 바로 불러요. 실행 중이면 `needsUpdate`만 켜요. setState가 부르는 곳이에요.

`getCurrentComponent()`

- 반환값: 지금 렌더링 중인 인스턴스. 렌더링 밖이면 `null`이에요. (예: `App` 실행 중 `app`, `mount()`가 끝난 뒤 `null`)
- 부수 효과: 없음. Hook과 테스트(FR-C07, C08)가 읽어요.

## 동작 방식

### 렌더링 (내부 함수 `render`)

1. `hookIndex`를 0으로 되돌려요. (FR-C06)
2. `currentComponent`를 이 인스턴스로 바꿔요. (FR-C07)
3. `fn(props)`를 실행해요. 이 동안 Hook이 `hooks[0]`, `hooks[1]`, …을 차례로 써요.
4. `finally`에서 `currentComponent`를 `null`로 되돌려요. 3단계가 오류를 던져도 되돌려요. (FR-C08, C12)
5. 3단계의 VNode를 돌려줘요.

### mount

1. `render()`로 VNode를 받아요.
2. `container.replaceChildren(toDOM(vnode))`로 원래 자식을 지우고 새 DOM을 붙여요. (FR-C02, C03)
3. `prevVNode = vnode` (FR-C05)
4. effect를 실행해요. (아래 "effect 실행과 예약된 update")

### update

1. `render()`로 새 VNode를 받아요.
2. `patch(container, diff([prevVNode], [vnode]))`로 바뀐 노드만 고쳐요. (FR-C04)
3. `prevVNode = vnode` (FR-C05)
4. effect를 실행해요.

### effect 실행과 예약된 update (내부 함수 `commitEffects`)

1. `isRunningEffects = true`
2. `runEffects(this)`를 불러요. ([useEffect 설계](use-effect.md))
3. `isRunningEffects = false`
4. `needsUpdate`가 켜져 있으면 끄고 `update()`를 한 번 불러요. 이 update 안에서 다시 1~4단계가 돌아요.

### scheduleUpdate

1. `isRunningEffects`면 `needsUpdate = true`로 두고 끝내요.
2. 아니면 `update()`를 불러요.

예시 (카운터 앱):

```text
입력: function App() {
        const [count, setCount] = useState(0);
        return h('div', null, h('span', null, count), h('button', { onClick: () => setCount(c => c + 1) }, '+'));
      }
      const app = new FunctionComponent(App, {}, container);  // App 호출 0번
      app.mount();
      버튼 클릭
```

1. `mount`: `render` → `hooks = [{ kind: 'state', value: 0 }]`, VNode `div(span('0'), button('+'))` → 컨테이너에 붙임 → `prevVNode` 저장 → 실행할 effect 없음
2. 클릭: setState가 `hooks[0].value`를 1로 바꾸고 `scheduleUpdate()` → `update()`
3. `update`: `render` → `div(span('1'), button('+'))` → `diff([prev], [new])` = `[UPDATE(div ─ [UPDATE(span ─ [TEXT '1']), UPDATE(button, set: onClick)])]` → `patch`

```text
출력: span의 텍스트 노드 nodeValue만 '1'로 바뀌고, button에는 새 핸들러 하나만 등록돼요.
      div, span, button은 같은 DOM 객체(===)로 남아요.
```

## 설계 결정

| 결정                                                                                         | 이유                                                                                                                         | 관련 ADR |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| update는 `diff([prevVNode], [vnode])`, `patch(container, …)`로 Phase 1 함수를 그대로 쓴다        | 요구사항 6.1 루트 형태 결정이에요. 컴포넌트가 돌려준 VNode는 컨테이너의 자식 하나라 Phase 1의 자식 목록과 같은 층이에요     | -        |
| mount는 `replaceChildren(toDOM(vnode))`로 붙인다                                               | 원래 자식을 지우고 붙이는 일을 한 번에 해요(FR-C03). mount는 처음 그리기라 Diff가 필요 없어요                                 | -        |
| `currentComponent`는 모듈 변수로 두고 `getCurrentComponent()`로만 읽게 한다                    | Hook은 인스턴스를 인자로 받지 않아 전역에서 찾아야 해요. 쓰기는 `render`만 해요                                               | -        |
| `render`는 `try`/`finally`로 `currentComponent`를 되돌린다                                     | 컴포넌트 함수가 오류를 던져도 렌더링 밖 Hook 호출 검사(FR-T01)가 계속 맞게 동작해요                                           | -        |
| `hooks`는 `kind`로 구분하는 유니언(`HookSlot[]`)으로 둔다                     | 요구사항 6.1 결정이에요(PR #124). `kind`를 확인하면 TypeScript가 칸 모양을 알고, 호출 순서가 바뀌어 칸이 어긋나면 바로 알아채요(FR-T03) | -        |
| `HookSlot` 유니언만 이 파일에 두고, 칸 타입은 각 Hook 파일에 둔다               | 칸 모양은 그 Hook만 알면 돼요. 같은 타입을 두 곳에 정의하지 않아요                                                        | -        |
| update의 Diff 결과는 `ChildPatches`를 그대로 `patch`에 넘긴다                  | key Diff에서 결과가 배열 또는 `KEYED`가 됐어요. FunctionComponent는 결과 모양을 보지 않아요                                 | [ADR-011](../../adr/ADR-011.md) |
| 실행 대기 목록, effect 실행 중 표시, update 예약은 인스턴스 필드로 둔다 (use-effect 요구사항 6.1) | hooks처럼 인스턴스마다 따로라, 테스트에서 인스턴스를 여러 개 만들어도 서로 섞이지 않아요                                       | -        |
| effect 실행 중 표시를 켜고 끄는 일과 예약된 update 실행은 FunctionComponent가 한다             | `scheduleUpdate`와 같은 곳에서 다뤄야 예약 규칙이 한 파일에 모여요. `runEffects`는 cleanup과 effect 실행만 해요                | -        |
| 배칭은 넣지 않고, effect 실행 중이 아니면 setState마다 `update()`를 바로 부른다                  | 요구사항 6.2 미정 항목이에요. 넣을 때는 `scheduleUpdate`만 고쳐요                                                             | -        |
| mount 두 번, mount 전 update를 막지 않는다                                                     | 요구사항 6.1 결정이에요. FR-C09, C10은 삭제되고 FR-A12 앱 작성 규칙으로 옮겼어요                                               | -        |
| FunctionComponent와 `getCurrentComponent`는 `src/component.ts`에 둔다                          | Hook 파일들이 이 파일만 import하면 돼요                                                                                       | -        |
| 예제 앱(할 일 앱)의 진입점은 `phase2.html`과 `src/phase2/main.ts`로 둔다. Phase 1 검증 페이지는 `phase1.html`과 `src/phase1/main.ts`로 옮기고, `index.html`은 두 페이지로 가는 첫 화면으로 둔다 | Phase 1과 Phase 2 결과물을 함께 남겨 발표 때 둘 다 보여 줄 수 있어요. `vite.config.ts`에서 세 페이지를 함께 빌드해요 (2026-11-11 결정) | -        |

## 경계 케이스

| 경우                               | 입력 예시                                                    | 기대 동작                                                                                   | 관련 요구사항 |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------- |
| 생성만 함                          | `new FunctionComponent(App, {}, el)`                         | `App`이 한 번도 실행되지 않아요                                                             | FR-C01        |
| 내용이 있는 컨테이너에 mount       | `<div id="app"><p>로딩</p></div>`에 mount                   | `<p>로딩</p>`이 지워지고 루트 VNode 하나만 남아요                                           | FR-C03        |
| 연속 update                        | 빈 목록 → `[A]` → `[A, B]`                                   | `prevVNode`가 매번 바뀌어 화면에 A가 한 번만 있어요                                         | FR-C05        |
| 루트 태그가 바뀜                   | `div` → `section`                                           | Diff가 `REPLACE`를 내고 Patch가 컨테이너의 자식을 통째로 바꿔요                             | FR-C04        |
| 컴포넌트 함수가 오류를 던짐        | `App`에서 `throw`                                            | 오류가 `mount`/`update` 밖으로 전파되고 `currentComponent`는 `null`로 돌아와요. 화면과 `prevVNode`는 그대로예요 | FR-C12        |
| mount를 두 번 부름                 | `app.mount(); app.mount();`                                 | 막지 않아요. 두 번째 렌더링이 hooks를 이어 쓰고 컨테이너를 다시 채워요. 앱 작성 규칙 위반이에요 | FR-C09, FR-A12 |
| mount 전 update를 부름             | `app.update()`                                               | 막지 않아요. `prevVNode`가 `null`이라 Diff에서 오류가 나요. 앱 작성 규칙 위반이에요          | FR-C10, FR-A12 |
| 자식 컴포넌트에서 Hook을 부름      | `function Item() { useState(0); }`                           | 막지 않아요. 루트의 다음 칸을 차지해, 자식 수가 바뀌면 칸이 밀려요                           | FR-A05        |
| 렌더링 중 setState                 | `App` 본문에서 `setCount(1)`                                 | 막지 않아요. `update()`가 렌더링 안에서 불려 렌더링이 겹쳐요. 정하지 않은 것에 남겨요        | -             |

## 검증 방법

- 단위 테스트: jsdom 컨테이너로 FR-C01~C08, C11을 요구사항 확인 방법대로 확인해요. FR-C04는 update 전후 바뀌지 않은 노드가 같은 객체(`===`)인지, FR-C07, C08은 컴포넌트 함수 안과 `mount()` 뒤에서 `getCurrentComponent()`를 읽어 확인해요. effect 실행 순서와 예약된 update는 [useEffect 설계](use-effect.md)의 테스트에서 함께 확인해요.
- 검증 페이지: 예제 앱(FR-A01~A12)을 코드 리뷰로 확인해요. `main.ts`에서 FunctionComponent를 하나만 만들고 `mount()`를 한 번만 부르는지, 컴포넌트에 `class`가 없는지, 자식 컴포넌트에 Hook 호출·바깥 값 변경·DOM 직접 수정이 없는지, 자식이 props로 받은 함수로 부모에 알리는지 봐요. 화면에서는 버튼과 입력으로 state를 바꿔 바뀐 부분만 다시 그려지는지 봐요.

## 정하지 않은 것

- 배칭(`queueMicrotask`로 모아 한 번 update): 요구사항 6.2. 정하면 `scheduleUpdate`만 고쳐요.
- 렌더링 중 setState를 막을지: [useMemo 요구사항 7절](../../requirements/phase2/use-memo_requirement.md#7-추후-논의). 렌더링 중 표시를 두고 오류를 던질지 정해요.
- 자식 컴포넌트의 Hook 호출을 감지할지: 요구사항 7절. h가 자식 컴포넌트를 실행하는 동안 표시를 두는 방법이 후보예요.

## 관련 문서

- [요구사항 명세서: FunctionComponent · useState · State 제약](../../requirements/phase2/function-component_requirement.md)
- [h 함수 설계](h.md), [useState 설계](use-state.md), [useEffect 설계](use-effect.md)
- [Virtual DOM 변환 설계 (Phase 1)](../vdom.md), [Diff 설계 (Phase 1)](../diff.md), [Patch 설계 (Phase 1)](../patch.md)
