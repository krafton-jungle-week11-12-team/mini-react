# h 함수 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #85

## 개요

h 함수는 `h(tag, props, ...children)` 호출을 VNode로 바꿔요. 컴포넌트가 VNode 객체를 직접 쓰지 않고 트리를 만들 수 있게 해 줘요. 이 문서를 읽으면 h가 자식을 정리하는 순서, 자식 컴포넌트를 실행하는 방법, props의 `key`를 VNode의 `key` 필드로 옮기는 방법을 알고 `src/phase2/impl/h.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                              | 이 문서에서 다루는 곳 |
| ------ | ------------------------------------------------------------------------------------------ | --------------------- |
| FR-H01 | 태그 이름으로 h가 호출되면, 그 태그, props, 자식을 가진 요소 VNode를 돌려줘요               | 인터페이스, 동작 방식 |
| FR-H02 | props를 `null`로 넘기면, 빈 객체를 props로 가진 VNode를 돌려줘요                             | 동작 방식             |
| FR-H03 | 자식 중 배열을 펼쳐, 배열 안의 노드를 자식으로 넣어요                                       | 동작 방식             |
| FR-H04 | 자식 중 `null`, `undefined`, `true`, `false`를 자식으로 넣지 않아요                          | 동작 방식             |
| FR-H05 | 문자열과 숫자 자식을 텍스트 VNode로 바꿔요                                                   | 동작 방식             |
| FR-H06 | 함수를 `tag`로 넘기면, props와 `children`을 합친 객체로 바로 실행하고 그 결과 VNode를 돌려줘요 | 동작 방식             |
| FR-H07 | 자식을 넘긴 순서대로 `children`에 넣어요                                                    | 동작 방식             |
| FR-H08 | props에 `key`를 넘기면, `key`를 문자열로 바꿔 VNode의 `key` 필드에 넣고 props에서는 빼요      | 자료구조, 동작 방식   |
| FR-H09 | 함수를 `tag`로 넘기고 props에 `key`가 있으면, `key`를 자식 컴포넌트에 넘기지 않고 결과 요소 VNode의 `key`에 넣어요 | 동작 방식, 설계 결정 |

## 위치와 흐름

```text
컴포넌트 함수(렌더링 중) → h → VNode 트리 → FunctionComponent(mount의 toDOM, update의 diff)
```

- 입력을 주는 곳: 컴포넌트 함수. [FunctionComponent](function-component.md)가 렌더링할 때 루트 컴포넌트 안에서 불려요. 자식 컴포넌트도 h 안에서 실행돼요.
- 출력을 받는 곳: 컴포넌트 함수의 반환값으로 [FunctionComponent](function-component.md)에 가요. 요소 VNode의 `props`는 [props 반영](props.md)이 DOM에 반영하고, `key`는 [Diff](../diff.md)가 자식 목록을 짝지을 때 읽어요([ADR-011](../../adr/ADR-011.md)).

## 자료구조

h는 [Virtual DOM 변환 설계](../vdom.md)의 `VNode`를 그대로 만들어요. key Diff에서 더해진 `VElement`의 `key?: string` 필드도 채워요. `props` 타입은 [props 반영 설계](props.md)에서 넓힌 `Props`를 써요. h가 새로 정하는 타입은 자식 인자와 컴포넌트 함수의 타입이에요.

```ts
type Child = VNode | string | number | boolean | null | undefined | Child[];

type Component<P extends object = Record<string, unknown>> = (props: P) => VNode;
```

- `Child` — h의 셋째 인자부터 넘길 수 있는 값. VNode, 문자열, 숫자, 조건부 렌더링 값(`null`, `undefined`, `true`, `false`)과 이들을 담은 배열(중첩 가능)이에요. (예: `'추가'`, `0`, `isOpen && h('p', null, '열림')`, `todos.map(t => h('li', null, t.text))`)
- `VElement.key?: string` — 형제 사이에서 이 노드를 가리키는 이름표. h는 props의 `key`를 문자열로 바꿔 여기에 넣고 `props`에서는 빼요. 없으면 필드를 두지 않아요. (예: `h('li', { key: 7 }, '우유')` → `key: '7'`, `props: {}`)
- `Component<P>` — props 객체 하나를 받아 VNode 하나를 돌려주는 함수. 루트 컴포넌트와 자식 컴포넌트 모두 이 모양이에요([FR-A01](../../requirements/phase2/function-component_requirement.md#54-앱-작성-규칙)). h로 부르면 `P`에 `children: VNode[]`가 들어가요. (예: `function PostCard(props: { title: string; children: VNode[] }) { return h('li', null, props.title); }`)

## 인터페이스

```ts
function h(tag: string, props: Props | null, ...children: Child[]): VElement;
function h<P extends object>(
  tag: Component<P & { children: VNode[] }>,
  props: P | null,
  ...children: Child[]
): VNode;
```

- `tag: string | Component` — 요소의 태그 이름이나 자식 컴포넌트 함수. 문자열이면 요소 VNode를 만들고, 함수면 그 함수를 바로 실행해요. (예: `'button'`, `TodoList`)
- `props: Props | null` (요소) / `P | null` (컴포넌트) — 요소의 속성과 이벤트 핸들러, 또는 자식 컴포넌트에 넘길 값. `null`이면 빈 객체로 봐요. `key`가 있으면 props가 아니라 VNode의 `key`로 옮겨요. (예: `{ class: 'btn', onClick: handleAdd }`, `{ key: todo.id, todo }`)
- `children: Child[]` — 자식. 넘긴 순서가 `children`의 순서예요. (예: `'추가'`, `h('li', null, 'A')`, `[li1, li2]`)
- 반환값: 요소 VNode, 또는 자식 컴포넌트가 돌려준 VNode. 트리에는 자식 컴포넌트를 나타내는 노드가 남지 않아요. (예: `h('button', { class: 'btn' }, '0')` → `{ kind: 'element', tag: 'button', props: { class: 'btn' }, children: [{ kind: 'text', text: '0' }] }`)
- 부수 효과: 없음. 자식 컴포넌트를 실행하지만, 자식 컴포넌트는 순수 함수라야 해요([FR-A06~A08](../../requirements/phase2/function-component_requirement.md#54-앱-작성-규칙)).

## 동작 방식

h는 내부 함수 `normalizeChildren`으로 자식을 정리해요. 인자는 먼저 계산되므로 안쪽 h부터 실행돼요.

1. `children`을 정리해 `VNode[]`를 만들어요. (`normalizeChildren`)
   1. 앞에서부터 하나씩 봐요.
   2. 배열이면 그 배열에 1~4단계를 재귀로 적용해, 결과를 그 자리에 차례로 넣어요. (FR-H03)
   3. `null`, `undefined`, `true`, `false`면 버려요. (FR-H04)
   4. 문자열이나 숫자면 `{ kind: 'text', text: String(값) }`으로 바꿔요. `0`도 텍스트 `'0'`이 돼요. (FR-H05)
   5. 그 밖(VNode)은 그대로 넣어요.
2. props에서 `key`를 떼어 내요. `key`가 `null`이나 `undefined`가 아니면 `String(key)`로 기억하고, 나머지 props(`rest`)만 남겨요. props가 `null`이면 `rest`는 `{}`예요.
3. `tag`가 함수면 `tag({ ...rest, children: 정리한 자식 })`을 실행해요. (FR-H06) 기억한 `key`가 있고 결과가 요소 VNode면 결과의 `key`에 넣어요. 결과를 돌려줘요.
4. `tag`가 문자열이면 `{ kind: 'element', tag, props: rest, children: 정리한 자식 }`을 만들고, 기억한 `key`가 있으면 `key` 필드에 넣어 돌려줘요. (FR-H01, H02)

정리 결과는 넘긴 순서를 지켜요. 배열을 펼칠 때도 배열 안 순서 그대로 그 자리에 들어가요. (FR-H07)

예시:

```text
입력: h('ul', null, false, [h('li', null, 'A'), [h('li', null, 'B')]], 0)
출력: { kind: 'element', tag: 'ul', props: {}, children: [
        { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'A' }] },
        { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'B' }] },
        { kind: 'text', text: '0' },
      ] }
```

```text
입력: h(TodoList, { todos: ['우유'] })
      // function TodoList({ todos }) { return h('ul', null, todos.map(t => h('li', null, t))); }
출력: { kind: 'element', tag: 'ul', props: {}, children: [
        { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: '우유' }] },
      ] }
      // TodoList를 나타내는 노드는 없어요
```

```text
입력: h('ul', null, todos.map(t => h(TodoItem, { key: t.id, todo: t })))
      // todos = [{ id: 1, text: '우유' }], TodoItem은 h('li', null, todo.text)를 돌려줘요
출력: { kind: 'element', tag: 'ul', props: {}, children: [
        { kind: 'element', tag: 'li', props: {}, key: '1', children: [{ kind: 'text', text: '우유' }] },
      ] }
      // TodoItem은 props에서 key를 받지 않아요. key는 li VNode에 붙어요
```

## 설계 결정

| 결정                                                                         | 이유                                                                                                               | 관련 ADR |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| 자식 컴포넌트에 넘기는 `children`도 정리한 `VNode[]`로 넘긴다                  | 자식 컴포넌트가 받은 `children`을 h에 다시 넘겨도 결과가 같고, 타입을 `VNode[]` 하나로 둘 수 있어요                | -        |
| 자식 정리는 재귀로 하고, 자식은 `for` 반복문으로 돈다                          | 중첩 배열 깊이만큼 내려가요. Phase 1 순회 방식과 같아요                                                            | [ADR-009](../../adr/ADR-009.md) |
| `key`가 없으면 props 객체를 복사하지 않고 그대로 VNode에 넣는다                 | 매 렌더링마다 새 객체 리터럴이 들어와요. `key`를 뺄 때만 나머지를 새 객체로 만들어요                               | -        |
| props의 `key`는 VNode의 `key` 필드로 옮기고 props에서 뺀다 (요구사항 6.1 key props 처리) | key는 Diff가 짝을 찾을 때만 쓰는 표시라 attribute가 되면 안 돼요. props에 남으면 FR-P08대로 attribute로 붙어요 | [ADR-002](../../adr/ADR-002.md), [ADR-011](../../adr/ADR-011.md) |
| `key`는 `String(key)`로 바꿔 넣는다                                             | `todo.id` 같은 숫자 key를 그대로 쓸 수 있어요. `VElement.key`가 문자열이라 Diff의 key 비교가 그대로 맞아요           | -        |
| 자식 컴포넌트에 넘긴 `key`는 컴포넌트에 넘기지 않고, 컴포넌트가 돌려준 요소 VNode에 붙인다 | 목록은 보통 `h(TodoItem, { key, … })`로 만들어요. 트리에 컴포넌트가 남지 않으므로 key가 결과 VNode에 있어야 Diff가 읽어요 | -        |
| h는 `src/phase2/impl/h.ts`에 둔다                                                          | 컴포넌트 코드가 import하는 진입점이라 FunctionComponent와 따로 둬요                                                 | -        |

## 경계 케이스

| 경우                      | 입력 예시                                          | 기대 동작                                                              | 관련 요구사항 |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| props가 `null`            | `h('span', null)`                                  | `props`가 `{}`이고 `children`이 `[]`예요                               | FR-H02        |
| 숫자 `0` 자식             | `h('span', null, 0)`                               | 텍스트 `'0'` 하나가 자식이에요                                         | FR-H05        |
| 조건부 렌더링 값만 있음   | `h('div', null, false, null, undefined, true)`     | `children`이 `[]`예요                                                   | FR-H04        |
| 빈 문자열 자식            | `h('p', null, '')`                                 | 텍스트 `''` 하나가 자식이에요. `''`는 버리는 값이 아니에요              | FR-H05        |
| 중첩 배열                 | `h('ul', null, [[li1], li2])`                      | 자식이 `li1`, `li2` 두 개예요                                          | FR-H03        |
| 빈 배열                   | `h('ul', null, [])`                                | `children`이 `[]`예요                                                   | FR-H03        |
| 자식 컴포넌트, props `null` | `h(Header, null)`                                | `Header({ children: [] })`로 실행해요                                   | FR-H06        |
| 자식 컴포넌트 안에서 Hook 호출 | `function Child() { useState(0); … }`          | 막지 않아요. 루트 컴포넌트의 칸을 차지해요. 앱 작성 규칙으로 막아요     | FR-A05        |
| 숫자 key                  | `h('li', { key: 7 })`                              | `key`가 `'7'`이고 `props`에 `key`가 없어요                               | FR-H08        |
| key가 `null`              | `h('li', { key: null })`                           | `key` 필드를 두지 않고 `props`에서도 빼요                                | FR-H08        |
| 컴포넌트가 텍스트를 돌려줌 | `h(Label, { key: 'a' })`, `Label`이 텍스트 VNode를 돌려줌 | 텍스트 VNode에는 `key` 필드가 없어 key를 버려요                  | FR-H09        |
| key가 일부 자식에만 있음  | `h('ul', null, h('li', { key: 'a' }), h('li', null))` | h는 그대로 만들어요. Diff는 key로 짝짓지 않고 같은 자리끼리 비교해요    | -             |

## 검증 방법

- 단위 테스트: 요구사항의 확인 방법대로 h의 반환값을 VNode 리터럴과 `toEqual`로 비교해요. FR-H06은 자식 컴포넌트를 `vi.fn`으로 감싸, 받은 인자가 `{ ...props, children }`이고 반환값이 그대로 나오는지 확인해요. FR-H07은 두 인자 순서를 바꿔 `children` 순서도 바뀌는지 확인해요.
- 검증 페이지: 예제 앱 화면에 h로 만든 목록과 조건부 요소가 기대한 순서로 보이는지 확인해요.

## 정하지 않은 것

- 자식 컴포넌트에서 Hook을 불렀을 때 감지할지: 요구사항 7절. [FunctionComponent 설계](function-component.md)에서 함께 정해요.
## 관련 문서

- [요구사항 명세서: h 함수 · props 처리](../../requirements/phase2/h-props_requirement.md)
- [props 반영 설계](props.md), [FunctionComponent 설계](function-component.md)
- [Virtual DOM 변환 설계 (Phase 1)](../vdom.md)
- [ADR-002](../../adr/ADR-002.md), [ADR-009](../../adr/ADR-009.md), [ADR-011](../../adr/ADR-011.md)
