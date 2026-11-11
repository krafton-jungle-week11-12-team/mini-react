# props 반영 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #85

## 개요

props 반영은 요소 VNode의 props 하나를 실제 DOM 요소에 넣거나 빼요. 이벤트 핸들러는 `addEventListener`로, `value`, `checked`, `selected`는 property로, 나머지는 attribute로 반영해요. 이 문서를 읽으면 Phase 1의 `VNode` props 타입을 어떻게 넓히는지와 `toDOM`, `patch`가 props를 반영하는 방법을 알고 `src/props.ts`를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                  | 이 문서에서 다루는 곳 |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------- |
| FR-P01 | VNode를 DOM으로 만들 때 이벤트 props가 있으면 `addEventListener`로 등록해요                       | 동작 방식             |
| FR-P02 | 이벤트 props를 attribute로 붙이지 않아요                                                         | 동작 방식             |
| FR-P03 | Patch할 때 이벤트 핸들러가 바뀌었으면 이전 핸들러를 지우고 새 핸들러를 등록해요                   | 동작 방식, 설계 결정  |
| FR-P04 | Patch할 때 이벤트 props가 없어졌으면 이전 핸들러를 지워요                                         | 동작 방식             |
| FR-P05 | Patch할 때 이벤트 props가 새로 생겼으면 그 핸들러를 등록해요                                      | 동작 방식             |
| FR-P06 | `value`, `checked`, `selected`는 attribute가 아니라 property로 바꿔요                            | 동작 방식             |
| FR-P07 | Patch할 때 `value`, `checked`, `selected`가 없어졌으면 property를 빈 값(`''`, `false`)으로 바꿔요 | 동작 방식             |
| FR-P08 | 이벤트 props와 FR-P06의 props를 뺀 나머지는 Phase 1처럼 attribute로 반영해요                      | 동작 방식, 경계 케이스 |
| FR-P09 | attribute로 반영하는 값이 `false`, `null`, `undefined`면 attribute를 지우고, `true`면 빈 문자열로 붙여요 | 동작 방식, 설계 결정  |
| FR-P10 | `on`으로 시작하는 props는 값이 함수가 아니어도 attribute로 붙이지 않고 이전 핸들러만 지워요         | 동작 방식, 설계 결정  |

## 위치와 흐름

```text
mount: VNode → toDOM → setProp → 새 DOM 요소
update: diff(PropsPatch) → patch → setProp / removeProp → 기존 DOM 요소
```

- 입력을 주는 곳: [Virtual DOM 변환](../vdom.md)의 `toDOM`(요소를 만들 때 props마다), [Patch](../patch.md)의 `UPDATE` 처리(`PropsPatch.set`, `PropsPatch.remove`마다). 반영할 props 값은 [h 함수](h.md)가 VNode에 담아요.
- 출력을 받는 곳: 실제 DOM 요소의 이벤트 리스너, property, attribute. 등록한 핸들러는 이 모듈의 핸들러 저장소에 남아 다음 Patch에서 꺼내 써요.

## 자료구조

Phase 1의 `VElement.props`는 `Record<string, string>`이라 이벤트 핸들러(함수)와 `checked: true`(boolean)를 담을 수 없어요. 값 타입을 넓혀요.

```ts
type EventHandler = (event: Event) => void;

type PropValue = string | number | boolean | EventHandler | null | undefined;

type Props = Record<string, PropValue>;

type VElement = {
  kind: 'element';
  tag: string;
  props: Props; // Phase 1: Record<string, string>
  children: VNode[];
  key?: string; // key Diff에서 더해짐 (ADR-011). 이 문서는 바꾸지 않아요
};

type PropsPatch = {
  set: Props; // Phase 1: Record<string, string>
  remove: string[];
};

// src/props.ts 안에만 있는 핸들러 저장소
const listeners: WeakMap<Element, Map<string, EventHandler>>;
```

- `EventHandler` — 이벤트 props의 값. DOM 이벤트 객체를 받는 함수예요. (예: `() => setCount(c => c + 1)`, `(e) => setText((e.target as HTMLInputElement).value)`)
- `PropValue` — props 값 하나. 문자열은 Phase 1처럼 attribute 값이고, 숫자·boolean·`null`·`undefined`·함수가 새로 들어와요. (예: `'btn'`, `3`, `true`, `onClick` 핸들러)
- `Props` — 속성 이름과 값. `toVNode`가 만든 VNode는 지금처럼 문자열만 담아요. (예: `{ class: 'todo', checked: true, onChange: toggle }`)
- `VElement.props: Props` — 넓힌 것 말고는 Phase 1과 같아요. `key`는 [h 함수](h.md)가 `key` 필드로 옮겨서 h가 만든 VNode의 props에는 없어요. (예: `{ type: 'checkbox', checked: false }`)
- `PropsPatch.set: Props` — 새로 생기거나 값이 바뀐 props의 새 값. 핸들러가 새 함수로 바뀌어도 들어가요. (예: `{ onClick: 새 핸들러 }`)
- `PropsPatch.remove: string[]` — 없어진 props 이름. Phase 1과 같아요. (예: `['onClick']`)
- `listeners: WeakMap<Element, Map<string, EventHandler>>` — 요소마다 지금 등록된 핸들러. 안쪽 `Map`의 키는 DOM 이벤트 이름이에요. 요소가 지워지면 가비지 컬렉션이 함께 치워요. (예: `button → Map { 'click' → handleAdd }`)

## 인터페이스

```ts
function setProp(el: Element, name: string, value: PropValue): void;
function removeProp(el: Element, name: string): void;
```

`setProp`

- `el: Element` — props를 반영할 DOM 요소. (예: `toDOM`이 방금 만든 `<button>`, Patch가 `UPDATE`로 찾은 `<input>`)
- `name: string` — props 이름. h에 쓴 이름 그대로예요. (예: `'onClick'`, `'value'`, `'class'`)
- `value: PropValue` — 새 값. (예: `handleAdd`, `''`, `'btn'`)
- 반환값: 없음.
- 부수 효과: `el`의 이벤트 리스너, property, attribute 중 하나를 바꾸고, 이벤트면 `listeners`를 바꿔요.

`removeProp`

- `el: Element` — props를 뺄 DOM 요소. (예: `onClick`이 빠진 `<button>`)
- `name: string` — 없어진 props 이름. (예: `'onClick'`, `'checked'`, `'disabled'`)
- 반환값: 없음.
- 부수 효과: `el`의 이벤트 리스너를 지우거나, property를 빈 값으로 바꾸거나, attribute를 지워요.

Phase 1 함수에서 바뀌는 곳은 아래와 같아요. 시그니처는 그대로예요.

- `toDOM`: `props`마다 `setAttribute` 대신 `setProp(element, name, value)`를 불러요.
- `diff`의 내부 함수 `diffProps`: 타입만 `Props`로 바뀌어요. 값 비교(`!==`)는 그대로라, 렌더링마다 새로 만든 핸들러는 `set`에 들어가요.
- `patch`의 `UPDATE`: `set`마다 `setProp`, `remove`마다 `removeProp`을 불러요. key로 짝지은 자식 목록(`KEYED`)도 칸마다 같은 `UPDATE` 처리를 거쳐요.

## 동작 방식

props 이름과 값으로 세 갈래 중 하나를 골라요.

| 갈래     | 고르는 조건                                 | `setProp`                                                                                  | `removeProp`                                         |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 이벤트   | 이름이 `on`으로 시작                        | 이전 핸들러가 있으면 `removeEventListener`. 값이 함수면 `addEventListener`하고 저장        | 이전 핸들러가 있으면 `removeEventListener`하고 지움 |
| property | 이름이 `value`, `checked`, `selected`       | `value`는 `el.value = String(값 ?? '')`, 나머지는 `el[name] = Boolean(값)`                 | `value`는 `''`, 나머지는 `false`로 바꿈             |
| attribute | 그 밖                                      | `true`면 `setAttribute(name, '')`, `false`·`null`·`undefined`면 `removeAttribute`, 나머지는 `setAttribute(name, String(값))` | `removeAttribute(name)`                              |

이벤트 갈래의 순서는 아래와 같아요.

1. 이벤트 이름을 정해요. `name`에서 `on`을 빼고 소문자로 바꿔요. (`onClick` → `click`, `onInput` → `input`)
2. `listeners`에서 `el`의 이 이벤트 핸들러를 꺼내요. 있으면 `removeEventListener(이벤트 이름, 이전 핸들러)`를 부르고 저장소에서 지워요. (FR-P03, P04)
3. `setProp`이고 값이 함수면 `addEventListener(이벤트 이름, 값)`을 부르고 저장소에 넣어요. (FR-P01, P03, P05)
4. attribute는 건드리지 않아요. 값이 함수가 아니어도 `onclick` attribute를 만들지 않아요. (FR-P02)

예시 (리렌더링으로 버튼 핸들러가 바뀜):

```text
입력: 이전 VNode  h('button', { class: 'btn', onClick: add₁ }, '추가')
      새 VNode    h('button', { class: 'btn', onClick: add₂ }, '추가')
      diff 결과   UPDATE(props: { set: { onClick: add₂ }, remove: [] }, children: [null])
```

1. Patch가 `setProp(button, 'onClick', add₂)`를 불러요.
2. 이벤트 이름은 `click`이에요. 저장소에서 `add₁`을 꺼내 `removeEventListener('click', add₁)`을 불러요.
3. `addEventListener('click', add₂)`를 부르고 저장소에 `add₂`를 넣어요.

```text
출력: 버튼에는 add₂ 하나만 등록돼 있어요. 클릭 한 번에 add₂가 한 번 실행돼요.
      class attribute와 버튼 DOM 객체는 그대로예요.
```

## 설계 결정

| 결정                                                                                     | 이유                                                                                                                                                    | 관련 ADR |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 이전 핸들러는 요소별 저장소(`WeakMap`)에 두고 Patch가 거기서 꺼낸다 (요구사항 6.1, B안) | `PropsPatch` 모양이 그대로라 Diff와 [변경 표시](../change-highlight.md)를 고치지 않아요. A안(`PropsPatch`에 이전 값 담기)은 Diff 결과 타입과 그 테스트를 모두 바꿔야 해요 | -        |
| 저장소는 요소에 필드를 붙이지 않고 모듈 안의 `WeakMap`으로 둔다                           | DOM 객체에 임의 필드를 붙이지 않고, 요소가 지워지면 함께 치워져요. key Diff가 노드를 `insertBefore`로 옮겨도 키가 같은 요소 객체라 핸들러를 그대로 찾아요 | [ADR-011](../../adr/ADR-011.md) |
| props 값 타입을 `string \| number \| boolean \| EventHandler \| null \| undefined`로 넓힌다 (요구사항 6.1 VNode 타입 변경) | h에 넘기는 값(숫자, `checked: true`, 핸들러)을 그대로 담아요. 문자열은 그대로라 Phase 1 `toVNode` 결과도 이 타입에 맞아요                               | -        |
| `VElement`를 새로 나누지 않고 Phase 1 타입의 `props`만 넓힌다                              | h가 만든 VNode와 `toVNode`가 만든 VNode를 Diff, Patch가 같은 코드로 다뤄요                                                                              | -        |
| 이름이 `on`으로 시작하면 값이 함수가 아니어도 attribute로 만들지 않는다                    | `onClick: undefined`처럼 핸들러를 끈 경우 이전 핸들러만 지워야 해요. 문자열 `onclick` attribute는 인라인 스크립트라 만들지 않아요                         | -        |
| attribute 갈래에서 `false`·`null`·`undefined`는 attribute를 지우고, `true`는 빈 문자열로 붙인다 | `disabled: false`를 `setAttribute('disabled', 'false')`로 붙이면 버튼이 비활성이 돼요. HTML의 boolean attribute는 있으면 켜진 것이에요               | -        |
| 이벤트 이름은 `on` 뒤를 소문자로 바꾸는 규칙만 쓴다                                        | 요구사항 4.2의 규칙이에요. 예제 앱에 쓰는 `click`, `input`, `change`, `submit`, `keydown`은 모두 이 규칙으로 맞아요                                        | -        |
| props 반영은 `src/props.ts`에 두고 `toDOM`과 `patch`가 같이 부른다                         | 처음 만들 때와 Patch할 때 같은 규칙을 한 곳에서 지켜요                                                                                                  | -        |

## 경계 케이스

| 경우                               | 입력 예시 (이전 → 새)                                     | 기대 동작                                                                                     | 관련 요구사항 |
| ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| 리렌더링마다 새 핸들러             | `onClick: add₁` → `onClick: add₂`                         | `add₁`을 지우고 `add₂`만 남아요. 클릭 한 번에 한 번 실행돼요                                  | FR-P03        |
| 핸들러 제거                        | `onClick: add` → (없음)                                   | `removeEventListener('click', add)`만 불러요. 클릭해도 실행되지 않아요                         | FR-P04        |
| 핸들러 추가                        | (없음) → `onClick: add`                                   | `addEventListener('click', add)`를 불러요                                                     | FR-P05        |
| 핸들러를 `undefined`로 끔          | `onClick: add` → `onClick: undefined`                     | `set`에 들어오지만 함수가 아니라 이전 핸들러만 지워요. `onclick` attribute는 생기지 않아요     | FR-P10        |
| 사용자가 입력한 뒤 빈 값으로 Patch | 사용자가 "우유" 입력, `value: ''` → `value: ''`           | 값이 같아 Diff에 안 나와요. 입력창에 "우유"가 남아요. 제어 컴포넌트는 `onInput`으로 state를 맞춰 값이 바뀌게 해야 해요. FR-P06의 확인 방법은 이 경우를 피해 `value: '우유'`에서 시작해요 | FR-P06        |
| state로 입력값 비우기              | `value: '우유'` → `value: ''`                             | `el.value = ''`로 입력창이 비어요                                                             | FR-P06        |
| 체크 풀기                          | `checked: true` → (없음)                                  | `el.checked = false`                                                                          | FR-P07        |
| boolean attribute                  | `disabled: true` → `disabled: false`                      | `removeAttribute('disabled')`로 버튼이 다시 눌려요                                             | FR-P09        |
| 숫자 attribute                     | `tabindex: 0`                                             | `setAttribute('tabindex', '0')`                                                               | FR-P08        |
| Phase 1 문자열 props               | `toVNode`가 만든 `{ class: 'todo' }`                      | 지금처럼 `setAttribute('class', 'todo')`예요. Phase 1 테스트 결과가 바뀌지 않아요             | FR-P08        |
| key로 순서가 바뀐 항목             | `[li#a(onClick: fa), li#b]` → `[li#b, li#a(onClick: fa')]` | `li#a`가 같은 객체로 옮겨지고, 저장소에서 `fa`를 꺼내 `fa'`로 바꿔요. 입력값과 체크도 남아요   | FR-P03        |
| h에 넘긴 `key`                     | `h('li', { key: 'a' })`                                   | h가 props에서 빼서 `setProp`에 오지 않아요. `key` attribute가 생기지 않아요                   | FR-H08        |

## 검증 방법

- 단위 테스트: 요구사항의 확인 방법대로 `toDOM`과 `patch`를 거쳐 확인해요. FR-P03은 같은 버튼에 핸들러를 바꿔 Patch를 세 번 한 뒤 `click()` 한 번에 마지막 핸들러만 한 번 불리는지 `vi.fn`으로 확인해요. FR-P02는 `getAttribute('onclick')`이 `null`인지 봐요. FR-P06, P07은 `el.value`, `el.checked` property를 읽어 확인해요. Phase 1 `vdom`, `diff`, `patch` 테스트가 그대로 통과하는지도 봐요.
- 검증 페이지: 예제 앱에서 버튼을 여러 번 눌러도 값이 한 번에 1씩만 바뀌고, 입력창이 state를 비우면 함께 비는지 확인해요.

## 정하지 않은 것

- 이벤트 이름 변환 규칙이 충분한지(`onDoubleClick` → `doubleclick`처럼 DOM 이름과 다른 경우): 요구사항 7절. 예제 앱에 필요한 이벤트가 생기면 정해요.
- Phase 1 문서 갱신: [Virtual DOM 변환](../vdom.md), [Diff](../diff.md), [Patch](../patch.md) 설계의 `props` 타입과 `toDOM`·`UPDATE` 설명을 이 문서에 맞게 고칠지, 이 문서를 링크만 할지. 리뷰에서 정해요.

## 관련 문서

- [요구사항 명세서: h 함수 · props 처리](../../requirements/phase2/h-props_requirement.md)
- [h 함수 설계](h.md)
- [Virtual DOM 변환 설계 (Phase 1)](../vdom.md), [Diff 설계 (Phase 1)](../diff.md), [Patch 설계 (Phase 1)](../patch.md), [변경 표시 설계 (Phase 1)](../change-highlight.md)
- [ADR-011](../../adr/ADR-011.md): key Diff는 뒤로 돌아간 노드만 이동으로 보고, Patch는 같은 노드를 insertBefore로 옮긴다
