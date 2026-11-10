# Diff 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #12

## 개요

Diff는 Virtual DOM 트리 두 개를 비교해 노드 추가, 삭제, 교체, 속성 변경, 텍스트 변경을 찾아요. 이 문서를 읽으면 Diff 결과의 형태와 비교 순서를 알고 Diff를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                       | 이 문서에서 다루는 곳 |
| ------ | ------------------------------------------------------------------- | --------------------- |
| FR-E03 | 두 트리를 비교해 추가, 삭제, 교체, 속성 변경, 텍스트 변경을 찾아요 | 자료구조, 동작 방식   |
| FR-E08 | 빈 문자열을 포함한 모든 HTML 코드를 변환할 수 있어요               | 경계 케이스           |
| FR-E09 | 빈 문자열로 Patch하면 실제 영역의 모든 노드를 삭제해요             | 경계 케이스           |
| FR-W10 | 새 트리가 현재 기록의 `vdom`과 같으면 Patch 버튼을 비활성화해요    | 인터페이스, 경계 케이스 |
| FR-W13 | Patch 때 현재 기록의 `vdom`과 새 트리를 비교해 바뀐 노드를 찾아요  | 위치와 흐름, 경계 케이스 |
| FR-W25 | 공백이나 줄바꿈만 바꿔도 바뀐 내용으로 판단해요                    | 경계 케이스           |
| FR-W26 | 주석만 추가해도 바뀐 내용으로 판단해요                             | 경계 케이스           |
| FR-W28 | 바뀐 내용 없이 Patch하면 실제 영역과 State History를 바꾸지 않아요 | 인터페이스, 경계 케이스 |

## 위치와 흐름

```text
현재 기록의 vdom + 새 Virtual DOM 트리 ──▶ Diff ──▶ Diff 결과 ──▶ Patch, 변경 표시
```

- 입력을 주는 곳: 검증 페이지(Patch 버튼. 요구사항 4.2의 4단계, FR-W13)
- 출력을 받는 곳: [Patch](patch.md), [변경 표시](change-highlight.md)

## 자료구조

Diff 결과는 Virtual DOM 트리와 같은 모양이에요. 자식 목록의 *i*번째 칸이 같은 부모의 *i*번째 자식에 대한 결과예요. 그래서 노드 위치를 경로로 따로 적지 않고, 결과 트리에서의 위치가 곧 노드 위치예요.

```ts
type Patch =
  | { type: 'CREATE'; vnode: VNode }
  | { type: 'REMOVE' }
  | { type: 'REPLACE'; vnode: VNode }
  | { type: 'TEXT'; text: string }
  | { type: 'UPDATE'; props: PropsPatch; children: (Patch | null)[] };

type PropsPatch = {
  set: Record<string, string>;
  remove: string[];
};
```

`VNode`는 [Virtual DOM 변환 설계](vdom.md)의 타입이에요.

- `type` — 변경 종류. FR-E03의 다섯 경우에 대응해요.
  - `'CREATE'`: 새 트리에만 있는 노드(추가). (예: `<li>A</li>` → `<li>A</li><li>B</li>`의 두 번째 칸)
  - `'REMOVE'`: 이전 트리에만 있는 노드(삭제). (예: `<li>A</li><li>B</li>` → `<li>A</li>`의 두 번째 칸)
  - `'REPLACE'`: 노드 종류나 태그가 달라 통째로 바꾸는 노드(교체). (예: `<p>A</p>` → `<div>A</div>`)
  - `'TEXT'`: 텍스트나 주석의 내용만 바뀐 노드(텍스트 변경). (예: `<li>A</li>` 안의 `A` → `B`)
  - `'UPDATE'`: 같은 요소인데 속성이나 자식 중 바뀐 게 있는 노드(속성 변경, 또는 자식 안의 변경). (예: `<h1 class="a">` → `<h1 class="b">`)
- `vnode: VNode` — `CREATE`, `REPLACE`에서 새로 넣을 노드. Patch 코드에서 `node`는 DOM 노드를 뜻해서 이름을 구분해요. 새 트리의 노드를 그대로 담아요. Patch가 [`toDOM`](vdom.md)으로 DOM을 만들어요. (예: `{ kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'B' }] }`)
- `text: string` — `TEXT`에서 바뀐 뒤의 내용. (예: `'운동하기'`)
- `props: PropsPatch` — `UPDATE`에서 바뀐 속성. 속성이 그대로면 `set`은 `{}`, `remove`는 `[]`예요.
  - `set: Record<string, string>` — 새로 생기거나 값이 바뀐 속성의 새 값. (예: `{ class: 'b' }`)
  - `remove: string[]` — 없어진 속성 이름. (예: `['disabled']`)
- `children: (Patch | null)[]` — `UPDATE`에서 자식 비교 결과. 길이는 이전·새 자식 수 중 긴 쪽이고, 바뀌지 않은 자리는 `null`이에요. (예: `[null, { type: 'TEXT', text: 'B' }]`)

## 인터페이스

```ts
function diff(oldRoots: VNode[], newRoots: VNode[]): (Patch | null)[];
```

- `oldRoots: VNode[]` — 이전 트리의 루트 목록. 현재 위치 기록의 `vdom`을 넣어요. (예: `history[i].vdom`)
- `newRoots: VNode[]` — 새 트리의 루트 목록. Patch 때 테스트 영역을 [`toVNode`](vdom.md)로 변환한 결과예요.
- 반환값: 루트 목록의 비교 결과. 길이는 두 목록 중 긴 쪽이고, 바뀌지 않은 자리는 `null`이에요. 모든 칸이 `null`이면 바뀐 내용이 없어요. (예: 같은 트리 → `[null]`, 둘 다 빈 배열 → `[]`)
- 부수 효과: 없음. 두 트리를 읽기만 해요.

## 동작 방식

`diff`는 재귀로 트리를 내려가요([ADR-009](../adr/ADR-009.md)). 내부 함수 세 개를 써요.

- `pairChildren`: 자식 목록 두 개를 노드 쌍으로 짝지어요. Phase 2에서 key 기반 비교로 바꿀 때 Diff 안에서는 이 함수만 바꿔요([ADR-002](../adr/ADR-002.md)).
- `diffChildren`: 짝지은 쌍마다 `diffNode`를 불러 결과 배열을 만들어요.
- `diffNode`: 노드 한 쌍을 비교해요. 둘 다 같은 요소면 `diffChildren`을 재귀로 불러 자식을 비교해요.

### `diff(oldRoots, newRoots)`

1. 컨테이너를 비교하지 않고, 컨테이너의 자식 목록(`VNode[]`)끼리 비교해요.
2. `diffChildren(oldRoots, newRoots)`의 결과를 그대로 돌려줘요.

### `pairChildren(oldList, newList)`

```ts
function pairChildren(oldList: VNode[], newList: VNode[]): [VNode | undefined, VNode | undefined][];
```

1. 두 목록 중 긴 쪽의 길이만큼 돌아요.
2. 같은 인덱스의 두 노드를 한 쌍 `[oldList[i], newList[i]]`로 만들어요. 한쪽 목록이 짧으면 그 칸은 없는 노드(`undefined`)예요.
3. 쌍 목록을 돌려줘요. *i*번째 쌍의 결과가 결과 배열의 *i*번째 칸에 들어가요.

### `diffChildren(oldList, newList)`

1. `pairChildren(oldList, newList)`로 쌍 목록을 받아요.
2. 쌍마다 두 노드를 `diffNode`로 비교해 결과를 같은 인덱스에 담아요. 바뀌지 않은 자리는 `null`이에요. 쌍은 `for` 반복문으로 돌아요. `map` 같은 콜백으로 돌면 재귀 한 단계마다 호출이 더 쌓여 버틸 수 있는 깊이가 줄어요([ADR-009](../adr/ADR-009.md) 결정 5번).
3. 결과 배열을 돌려줘요.

### `diffNode(oldNode, newNode)`

아래 순서로 검사하고, 해당하는 단계에서 그 노드의 비교를 끝내요. 순서는 [ADR-002](../adr/ADR-002.md)의 판단 순서를 따라요.

1. 새 노드가 없으면 `{ type: 'REMOVE' }`
2. 이전 노드가 없으면 `{ type: 'CREATE', vnode: newNode }`
3. `kind`가 다르면 `{ type: 'REPLACE', vnode: newNode }`
4. 둘 다 요소면
   1. `tag`가 다르면 `{ type: 'REPLACE', vnode: newNode }`
   2. 같으면 `props`를 비교하고, 자식은 `diffChildren`으로 재귀 비교해요.
   3. 속성이나 자식 중 하나라도 바뀌었으면 `{ type: 'UPDATE', props, children }`, 아니면 `null`. `diffChildren`이 돌아온 시점에는 자식 결과가 모두 나와 있어서 바로 정할 수 있어요.
5. 둘 다 텍스트이거나 둘 다 주석이면, `text`가 다르면 `{ type: 'TEXT', text: newNode.text }`, 같으면 `null`
6. 마지막의 `return null`은 도달하지 않는 안전장치예요. 3단계에서 `kind`가 같다는 게 보장되므로 4, 5단계가 모든 경우를 덮어요.

`props` 비교는 두 객체의 속성 이름을 합쳐서 봐요. 새 쪽에만 있거나 값이 다르면 `set`에, 이전 쪽에만 있으면 `remove`에 넣어요.

바뀐 곳이 없는 하위 트리는 맨 위 요소가 `null`을 돌려주므로 결과에서 `null` 한 칸이 돼요.

예시 (샘플 HTML 코드에서 두 번째 `li`의 텍스트만 바꿈):

```text
입력: 이전 = 샘플 HTML 코드의 vdom ([vdom.md](vdom.md) 예시)
      새   = 같은 HTML에서 <li>운동하기</li> → <li>독서하기</li>
```

```ts
// 출력
[
  { type: 'UPDATE', props: { set: {}, remove: [] }, children: [     // div#app
    null,                                                             // '\n  '
    null,                                                             // h1
    null,                                                             // '\n  '
    { type: 'UPDATE', props: { set: {}, remove: [] }, children: [   // ul.todo
      null,                                                           // '\n    '
      null,                                                           // li 장보기
      null,                                                           // '\n    '
      { type: 'UPDATE', props: { set: {}, remove: [] }, children: [ // li
        { type: 'TEXT', text: '독서하기' },
      ] },
      null,                                                           // '\n  '
    ] },
    null,                                                             // '\n  '
    null,                                                             // button
    null,                                                             // '\n'
  ] },
]
```

## 설계 결정

| 결정                                                         | 이유                                                                          | 관련 ADR                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| 이전 트리로 현재 기록의 `vdom`을 받는다                      | 한 기록의 Patch 후가 다음 기록의 Patch 전이라 따로 저장하지 않아요            | [ADR-006](../adr/ADR-006.md) |
| 공백·주석 노드를 포함해 모든 노드를 비교한다                 | 정확성을 먼저 택해요                                                          | [ADR-007](../adr/ADR-007.md) |
| 화면에 보이는지는 Diff 결과에 넣지 않는다                    | 변경 표시는 Diff와 분리해요                                                   | [ADR-008](../adr/ADR-008.md) |
| 두 루트 목록(`VNode[]`)을 `diffChildren`으로 비교한다        | [Virtual DOM 변환](vdom.md)이 컨테이너를 빼고 자식 목록을 돌려줘요            | [ADR-005](../adr/ADR-005.md) |
| 자식은 같은 인덱스끼리 비교한다                              | key가 없는 Phase 1에서 가장 단순하고, 결과 위치가 곧 노드 위치가 돼요         | [ADR-002](../adr/ADR-002.md) |
| `kind`나 `tag`가 다르면 교체로 본다                          | 다른 종류의 노드는 고쳐 쓸 수 없어요                                          | [ADR-002](../adr/ADR-002.md) |
| 재귀로 내려가고, 자식 쌍은 `for` 반복문으로 돈다             | 함수가 돌아올 때 자식 결과로 `UPDATE`인지 `null`인지 바로 정해요. 파서가 깊이를 512단계로 제한해 콜 스택이 넘치지 않아요 | [ADR-009](../adr/ADR-009.md) |
| 자식 목록을 짝짓는 부분을 `pairChildren`으로 나눈다          | Phase 2에서 key 기반 비교로 바꿀 때 Diff 안에서는 이 함수만 바꿔요            | [ADR-002](../adr/ADR-002.md) |
| 결과를 트리와 같은 모양으로 만든다                           | 경로를 따로 적지 않아도 Patch가 같은 모양으로 내려가며 위치를 찾아요          | -                            |
| 텍스트와 주석의 내용 변경은 모두 `TEXT`로 본다               | 두 타입 모두 내용이 `text` 필드에 있어 같은 비교를 써요                       | -                            |

## 경계 케이스

| 경우                    | 입력 예시 (이전 → 새)                           | 기대 동작                                              | 관련 요구사항 |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------ | ------------- |
| 노드 추가               | `<li>A</li>` → `<li>A</li><li>B</li>`           | 두 번째 칸이 `CREATE`                                  | FR-E03        |
| 노드 삭제               | `<li>A</li><li>B</li>` → `<li>A</li>`           | 두 번째 칸이 `REMOVE`                                  | FR-E03        |
| 교체 (태그가 다름)      | `<p>A</p>` → `<div>A</div>`                     | `REPLACE` 1개. 자식은 비교하지 않아요                  | FR-E03        |
| 교체 (노드 종류가 다름) | `A` → `<b>A</b>`                                | `REPLACE` 1개                                          | FR-E03        |
| 교체 (텍스트 → 주석)    | `A` → `<!--A-->`                                | `REPLACE` 1개                                          | FR-E03        |
| 속성 변경               | `<h1 class="a">` → `<h1 class="b">`             | `UPDATE`, `props.set`이 `{ class: 'b' }`. 자식이 그대로라 `children`은 모두 `null`이지만, 속성이 바뀌어 `UPDATE`예요 | FR-E03        |
| 속성 삭제               | `<button disabled>` → `<button>`                | `UPDATE`, `props.remove`가 `['disabled']`              | FR-E03        |
| 텍스트 변경             | `<li>A</li>` → `<li>B</li>`                     | `li`가 `UPDATE`, 그 자식이 `TEXT`                      | FR-E03        |
| 주석 내용 변경          | `<!-- a -->` → `<!-- b -->`                     | `TEXT` 1개                                             | FR-E03, W26   |
| 공백만 변경             | `<li>A</li>` → `<li> A</li>`                    | `TEXT` 1개                                             | FR-W25        |
| 순서 바뀜               | `<li>A</li><li>B</li>` → `<li>B</li><li>A</li>` | 인덱스끼리 비교해 두 `li` 안이 각각 `TEXT`             | FR-W13 ([ADR-002](../adr/ADR-002.md)) |
| 앞에 노드 끼워 넣기     | `<li>A</li>` → `<li>Z</li><li>A</li>`           | 첫 칸 `TEXT`(A → Z), 두 번째 칸 `CREATE`(A)            | FR-W13 ([ADR-002](../adr/ADR-002.md)) |
| 깊게 중첩된 요소        | `<div>`를 512번 중첩(Chromium 파서 상한) → 맨 안쪽 텍스트만 바꿈 | 오류 없이 끝나요. 조상 `div`는 모두 `UPDATE`, 맨 안쪽 칸은 `TEXT` | FR-E03 ([ADR-009](../adr/ADR-009.md)) |
| 모두 삭제               | 샘플 HTML 코드 → 빈 문자열                      | 루트 칸이 모두 `REMOVE`                                | FR-E09        |
| 빈 문자열 → 내용 추가   | 빈 문자열 → `<p>A</p>`                          | `[CREATE]`                                             | FR-E08        |
| 바뀐 내용 없음          | 같은 트리                                       | 모든 칸이 `null`                                       | FR-W10, W28   |

## 검증 방법

- 단위 테스트: 위 경계 케이스마다 테스트 케이스를 두고, 결과가 기대 동작과 같은지 확인해요. 특히 다섯 가지 변경(추가, 삭제, 교체, 속성 변경, 텍스트 변경)마다 해당 변경만 담기는지 확인해요(FR-E03).
- `UPDATE` 판단 단위 테스트: 자식 결과로 부모를 `UPDATE`나 `null`로 정하는 부분을 따로 확인해요.
  - 바뀐 게 없는 중첩 트리(`<div><p>A</p></div>` → 같은 HTML)의 결과가 `[null]`인지 (FR-W10, W28)
  - 속성만 바뀌고 자식이 그대로인 요소가 `UPDATE`로 남고, `children`이 모두 `null`인지
  - 형제 중 하나만 바뀌었을 때(`<ul><li>A</li><li>B</li></ul>` → 두 번째 `li`만 `C`) 첫 번째 `li` 칸이 `null`인지
- 검증 페이지: Diff 결과를 직접 보여 주는 화면은 2차 기능(FR-X04)이에요. 기본 기능에서는 Patch 후 두 영역이 같은지(FR-W15)로 간접 확인해요.

## 정하지 않은 것

- 변경 개수(FR-W30)를 셀 때 자식만 바뀐 `UPDATE`를 셀지: 위 예시에서는 `div`, `ul`, `li`가 모두 `UPDATE`지만 실제 변경은 `TEXT` 1개예요. [변경 표시 설계](change-highlight.md)에서 정해요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1_requirement.md)
- [ADR-002](../adr/ADR-002.md): Diff는 Phase 1에서 같은 자리, Phase 2에서 key로 노드를 짝짓는다. key 규칙은 Phase 2 설계에서 정해요.
- [ADR-009](../adr/ADR-009.md): 트리 순회는 재귀로 한다
- [Virtual DOM 변환 설계](vdom.md), [Patch 설계](patch.md), [변경 표시 설계](change-highlight.md)
