# 변경 표시 설계

- 상태: 리뷰 중
- 작성자: 임동호
- 관련 이슈: #12

## 개요

변경 표시는 Patch로 바뀐 부분을 실제 영역에서 강조 표시하고, 변경 개수를 요약해 보여 줘요. 이 문서를 읽으면 변경을 세는 규칙과 화면에 보이는지 판단하는 규칙을 알고 변경 표시를 구현할 수 있어요. Diff나 Patch를 다른 구현으로 바꿔도 이 모듈에서 고칠 곳이 어디인지도 알 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                | 이 문서에서 다루는 곳                       |
| ------ | ------------------------------------------------------------ | ------------------------------------------- |
| FR-W16 | Patch하면 실제 영역에서 화면에 보이는 변경만 강조 표시해요   | 동작 방식, 경계 케이스, 검증 방법           |
| FR-W27 | 강조 표시가 두 영역 비교(FR-W15)에 영향을 주지 않아요        | 설계 결정, 검증 방법                        |
| FR-W30 | Patch하면 변경 개수와 화면에 안 보이는 변경 개수를 보여 줘요 | 자료구조, 동작 방식, 경계 케이스, 검증 방법 |

FR-X04(Diff 결과 표시)는 2차 추가 기능이에요. 이 문서의 `ChangeRecord` 목록을 [검증 페이지](page.md#2차-추가-기능)의 Diff 패널이 그대로 보여 줘요.

## 위치와 흐름

```text
                     ┌─────────── 변경 표시 ───────────────────────────────────────┐
Diff 결과 + 이전 트리 ─▶ fromDiffResult ─▶ ChangeRecord[] ─▶ captureBefore ─▶ (Patch) ─▶ showChanges ─▶ 강조 표시, 요약 문구
                     └─────────────────────────────────────────────────────────────┘
```

- 입력을 주는 곳: [검증 페이지](page.md)
  - Diff 결과와 이전 트리(현재 위치 기록의 `vdom`)로 `fromDiffResult`를 호출해 변경 목록을 만들어요.
  - Patch 전에 `captureBefore`, Patch 후에 `showChanges`를 호출해요.
- 출력을 받는 곳: 화면(실제 영역의 강조 표시), 검증 페이지(요약 문구, Diff 패널)
- 변경 표시는 Diff, Patch, State History를 직접 호출하지 않아요.

### 다른 모듈에 기대는 것

변경 표시는 아래 세 가지에만 기대요. 이것만 지켜지면 Diff나 Patch를 다른 구현으로 바꿔도 돼요.

| 기대는 것                                      | 출처                                       | 바뀌면 고칠 곳     |
| ---------------------------------------------- | ------------------------------------------ | ------------------ |
| Diff 결과의 형식                               | [Diff 설계](diff.md)의 `(Patch \| null)[]` | `fromDiffResult`만 |
| Patch 전 실제 영역은 이전 트리와 같은 구조예요 | [Patch 설계](patch.md)의 전제 조건         | 없음               |
| Patch 후 실제 영역은 새 트리와 같은 구조예요   | FR-W15. 검증 페이지가 Patch 후 확인해요    | 없음               |

Patch가 무엇을 돌려주는지, 어떤 순서로 DOM을 고치는지에는 기대지 않아요. 바뀐 노드는 두 트리에서의 위치로 실제 영역에서 직접 찾아요.

## 자료구조

```ts
type NodeKind = 'element' | 'text' | 'comment';

type ChangeRecord = {
  kind: 'create' | 'remove' | 'replace' | 'text' | 'props';
  oldPath: number[] | null;
  newPath: number[] | null;
  parentOldPath: number[];
  parentNewPath: number[];
  oldNodeKind: NodeKind | null;
  newNodeKind: NodeKind | null;
  detail: string;
};

type TextBefore = (string | null)[];

type ChangeSummary = {
  total: number;
  hidden: number;
  message: string;
  highlighted: Element[];
  items: { record: ChangeRecord; visible: boolean }[];
};
```

경로(`number[]`)는 루트 목록의 인덱스부터 자식 인덱스를 차례로 담아요. 공백 텍스트 노드와 주석 노드까지 센 인덱스라 DOM의 `childNodes` 인덱스와 같아요. 빈 배열 `[]`은 영역 컨테이너 자신이에요.

- `ChangeRecord` — 변경으로 세는 칸 하나. Diff 결과의 형식과 상관없이 변경 표시가 쓰는 모양이에요.
  - `kind` — 변경 종류. `'create'`(추가), `'remove'`(삭제), `'replace'`(교체), `'text'`(텍스트·주석 내용 변경), `'props'`(속성 변경) 중 하나예요. (예: `'text'`)
  - `oldPath: number[] | null` — 이전 트리에서 그 노드의 위치. `create`면 `null`이에요. (예: `[0, 1, 0]`)
  - `newPath: number[] | null` — 새 트리에서 그 노드의 위치. `remove`면 `null`이에요. (예: `[0, 1, 0]`)
  - `parentOldPath: number[]`, `parentNewPath: number[]` — 이전 트리, 새 트리에서 부모 요소 노드의 위치. 루트 노드면 `[]`(영역 컨테이너)예요. (예: `[0, 1]`)
  - `oldNodeKind: NodeKind | null` — 나가는(또는 고쳐지는) 노드의 종류. `create`면 `null`이에요. (예: `'text'`)
  - `newNodeKind: NodeKind | null` — 들어오는(또는 고쳐지는) 노드의 종류. `remove`면 `null`이에요. (예: `'text'`)
  - `detail: string` — Diff 패널에 보여 줄 내용. `text`는 새 내용, `props`는 바뀐 속성, `create`·`replace`는 새 노드의 태그나 내용, `remove`는 빈 문자열이에요. (예: `'오늘 할 일'`)
- `TextBefore: (string | null)[]` — Patch 전에 읽은 부모 요소 노드의 `innerText` 목록. 순서와 개수가 `ChangeRecord[]`와 같아요. 텍스트 노드 규칙을 따르는 변경만 값이 있고, 나머지는 `null`이에요. (예: `['할 일 목록', null]`)
- `ChangeSummary` — `showChanges`의 결과.
  - `total: number` — 변경 개수. `ChangeRecord[]`의 길이예요. (예: `2`)
  - `hidden: number` — 그중 화면에 안 보이는 변경의 개수. (예: `1`)
  - `message: string` — 요약 문구. "변경 N개 (화면에 안 보이는 변경 M개)" 형식이고, M이 0이면 괄호 부분을 빼요(FR-W30). (예: `'변경 2개 (화면에 안 보이는 변경 1개)'`)
  - `highlighted: Element[]` — 강조 표시한 요소 노드. 같은 요소 노드는 한 번만 담고, 부모라서 칠하는 요소 노드가 다른 강조 대상을 품으면 빼요. (예: `[h1]`)
  - `items: { record: ChangeRecord; visible: boolean }[]` — 변경마다 화면에 보이는지 판단한 결과. 순서와 개수가 `records`와 같아요. 검증 페이지의 Diff 결과 패널(FR-X04)이 써요. (예: `[{ record: text 변경, visible: true }, { record: create 변경, visible: false }]`)

## 인터페이스

```ts
type HighlightOptions = {
  readText?: (el: Element) => string;
  highlight?: (el: Element) => void;
};

function fromDiffResult(result: (Patch | null)[], oldRoots: VNode[]): ChangeRecord[];

function captureBefore(container: Element, records: ChangeRecord[], options?: HighlightOptions): TextBefore;

function showChanges(
  container: Element,
  records: ChangeRecord[],
  before: TextBefore,
  options?: HighlightOptions,
): ChangeSummary;
```

`Patch`는 [Diff 설계](diff.md), `VNode`는 [Virtual DOM 변환 설계](vdom.md)의 타입이에요.

- `result: (Patch | null)[]` — [`diff`](diff.md)의 반환값. (예: 동작 방식 예시의 Diff 결과)
- `oldRoots: VNode[]` — Diff에 넘긴 이전 트리. 현재 위치 기록의 `vdom`이에요. 삭제·교체된 노드의 종류를 여기서 읽어요. (예: `history.current().vdom`)
- `container: Element` — 실제 영역 컨테이너. (예: `<div id="real-root">`)
- `records: ChangeRecord[]` — `fromDiffResult`가 돌려준 변경 목록. 변경 하나가 한 칸이에요. (예: `[{ kind: 'text', oldPath: [0,1,0], newPath: [0,1,0], … }, { kind: 'create', oldPath: null, newPath: [0,3,5], … }]`)
- `before: TextBefore` — `captureBefore`가 Patch 전에 돌려준 값. 순서와 개수가 `records`와 같아 같은 자리끼리 짝이에요. *i*번째 값은 `records[i]`의 부모 요소 노드의 `innerText`이고, 텍스트 노드 규칙이 아닌 변경은 `null`이에요. (예: 위 `records`에 대해 `['할 일 목록', null]`)
- `options.readText: (el: Element) => string` — 요소 노드의 `innerText`를 읽는 함수. 기본값은 HTML 요소 노드면 `innerText`, 아니면(SVG 요소 노드 등) `textContent`를 읽어요. SVG 요소 노드에는 `innerText`가 없기 때문이에요. 단위 테스트에서 바꿔 넣어요. (예: `el => el.textContent ?? ''`)
- `options.highlight: (el: Element) => void` — 요소 노드 하나를 강조 표시하는 함수. 기본값은 `element.animate()`로 배경색을 잠깐 바꾸는 함수예요. 색과 모양은 [화면 스타일 설계](style.md#강조-표시-모양)를 따라 검증 페이지가 정해 넘겨요. jsdom에서는 `animate`가 없어 아무것도 하지 않아요. (예: `el => el.animate([{ backgroundColor: '#EDE7FF', boxShadow: '0 0 0 4px #EDE7FF' }, {}], 800)`)
- `fromDiffResult`
  - 반환값: 변경으로 세는 칸의 목록. 한 자식 목록의 칸을 앞에서부터 처리한 뒤 그 아래 자식 목록으로 내려간 순서예요. 순서는 Diff 결과 패널에만 쓰고 판단에는 영향이 없어요. 바뀐 내용이 없으면 `[]`예요.
  - 부수 효과: 없음. **Diff 결과의 형식을 아는 함수는 이것 하나예요.**
- `captureBefore`
  - 반환값: Patch 전 `innerText` 목록.
  - 부수 효과: DOM을 바꾸지 않아요. `innerText`를 읽을 때 레이아웃을 다시 계산해야 하면 Reflow가 일어날 수 있어요.
- `showChanges`
  - 반환값: 요약 결과.
  - 부수 효과: `highlighted`의 요소 노드마다 `options.highlight`를 호출해요.

## 동작 방식

### Diff 결과를 변경 목록으로 바꾸기 (`fromDiffResult`)

[Diff 설계](diff.md)의 결과는 Virtual DOM 트리와 같은 모양이에요. 결과를 훑으며 칸마다 아래처럼 해요. 훑는 방식(재귀, 반복문과 명시적 스택)은 결과에 영향이 없어서 Diff 구현과 같은 방식을 써요. `p`는 그 칸의 위치예요.

| 칸                                                               | 만드는 `ChangeRecord`                                                               | 자식으로 내려가나     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `null`                                                           | 없음                                                                                | 안 내려감             |
| `CREATE`                                                         | `kind: 'create'`, `oldPath: null`, `newPath: p`, `newNodeKind: vnode.kind`          | 안 내려감             |
| `REMOVE`                                                         | `kind: 'remove'`, `oldPath: p`, `newPath: null`, `oldNodeKind`는 이전 트리에서 읽음 | 안 내려감             |
| `REPLACE`                                                        | `kind: 'replace'`, 두 경로 모두 `p`, 두 노드 종류를 모두 채움                       | 안 내려감             |
| `TEXT`                                                           | `kind: 'text'`, 두 경로 모두 `p`, 두 노드 종류는 이전 트리에서 읽은 같은 값         | 안 내려감             |
| `UPDATE`, `props.set`이 비지 않았거나 `props.remove`가 비지 않음 | `kind: 'props'`, 두 경로 모두 `p`, 두 노드 종류 모두 `'element'`                    | `children`으로 내려감 |
| `UPDATE`, 속성이 그대로이고 자식만 바뀜                          | 없음                                                                                | `children`으로 내려감 |

- 같은 자리 비교([ADR-002](../adr/ADR-002.md), 제안됨)라 두 트리에서 위치가 같아요. 그래서 `parentOldPath`와 `parentNewPath`는 둘 다 `p`에서 마지막 인덱스를 뺀 값이에요.
- 자식만 바뀐 `UPDATE`는 그 요소 노드가 바뀐 게 아니라서 세지 않아요. 예를 들어 `h1`의 텍스트만 바꾸면 `div`, `h1`이 `UPDATE`로 나오지만 변경은 `text` 1개예요.
- Phase 2에서 Diff가 key 기반으로 바뀌면 두 트리의 위치가 달라질 수 있어요. 그때도 이 함수가 `oldPath`, `newPath`를 따로 채우면 나머지는 그대로 써요.

### 변경마다 보이는지 판단하는 규칙

`ChangeRecord`의 `kind`와 두 노드 종류로만 판단해요.

| 변경                                                                                | 보이는 변경인가                       | 강조 표시할 요소 노드       |
| ----------------------------------------------------------------------------------- | ------------------------------------- | --------------------------- |
| `props`                                                                             | 보임                                  | `newPath`의 요소 노드       |
| `create`, `replace`이고 `newNodeKind`가 `'element'`                                 | 보임                                  | `newPath`의 요소 노드       |
| `remove`이고 `oldNodeKind`가 `'element'`. `replace`이고 `oldNodeKind`만 `'element'` | 보임                                  | `parentNewPath`의 요소 노드 |
| **텍스트 노드 규칙**: 요소 노드는 관련 없고, 두 노드 종류 중 하나 이상이 `'text'`   | 부모 `innerText`가 바뀌었을 때만 보임 | `parentNewPath`의 요소 노드 |
| 관련 노드가 모두 `'comment'`                                                        | 안 보임                               | 없음                        |

- 위치로 노드를 찾을 때는 영역 컨테이너의 `childNodes[path[0]]`, 그 노드의 `childNodes[path[1]]` 순서로 내려가요. `[]`이면 영역 컨테이너예요.

### captureBefore (Patch 전)

1. 텍스트 노드 규칙을 따르는 변경마다 `parentOldPath`로 실제 영역에서 부모 요소 노드를 찾아요. Patch 전 실제 영역은 이전 트리와 같은 구조예요.
2. 부모 요소 노드의 `readText` 값을 넣어요. 같은 부모 요소 노드는 한 번만 읽어요.
3. 나머지 변경은 `null`을 넣어요.

### showChanges (Patch 후)

1. 변경마다 위 규칙으로 보이는지 판단해요.
2. 강조 표시할 요소 노드를 `newPath`나 `parentNewPath`로 실제 영역에서 찾아요. Patch 후 실제 영역은 새 트리와 같은 구조예요(FR-W15).
3. 텍스트 노드 규칙이면, 부모 요소 노드를 다시 읽어 `before`의 값과 비교해요.
4. 보이는 변경의 요소 노드를 모아요. 같은 요소 노드는 한 번만 담아요. 모은 요소 노드 중 부모라서 칠하는 것(텍스트 노드 규칙, 삭제·교체된 요소 노드의 부모)이 다른 강조 대상을 품으면 빼요. 그 요소 노드 자신이 바뀐 경우(속성 변경, 추가·교체된 요소 노드)는 빼지 않아요. 조상을 칠하면 자손까지 통째로 덮여 어디가 바뀌었는지 안 보여요. 보이는지 판단(`items`, `hidden`)은 그대로예요.
5. 모은 요소 노드마다 `options.highlight`를 호출해요.
6. 안 보이는 변경의 개수로 `message`를 만들어요(FR-W30).

예시 (샘플 HTML 코드에서 `h1`의 텍스트를 바꾸고, 주석을 `</ul>` 바로 앞에 넣은 경우):

```text
Diff 결과: [UPDATE div ─ children[1]: UPDATE h1 ─ children[0]: TEXT '오늘 할 일'
                       └ children[3]: UPDATE ul ─ children[5]: CREATE <!-- 메모 -->]
fromDiffResult → [{ kind: 'text',   oldPath: [0,1,0], newPath: [0,1,0], parent: [0,1], old/new: 'text' },
                  { kind: 'create', oldPath: null,    newPath: [0,3,5], parent: [0,3], new: 'comment' }]
                 (div, h1, ul의 UPDATE는 자식만 바뀌어 만들지 않아요)
captureBefore  → ['할 일 목록', null]
patch 후 showChanges:
  1. 텍스트 노드 규칙: h1의 innerText '할 일 목록' → '오늘 할 일'. 보임 → h1 강조 표시
  2. 관련 노드가 모두 주석: 안 보임
결과: { total: 2, hidden: 1, message: '변경 2개 (화면에 안 보이는 변경 1개)', highlighted: [h1],
        items: [{ text, visible: true }, { create, visible: false }] }
```

주석을 다른 위치에 넣으면 같은 자리 비교 때문에 변경 개수가 달라져요. 예를 들어 첫 `</li>` 바로 뒤에 넣으면 뒤의 형제 노드가 한 칸씩 밀려 `replace` 3개와 `create` 1개가 나와요.

## 설계 결정

| 결정                                                                                     | 이유                                                                                                                                          | 관련 ADR                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Diff 결과는 `fromDiffResult` 한 곳에서만 읽고, 나머지는 `ChangeRecord`만 쓴다            | Diff의 결과 형식이 바뀌어도 이 함수만 고치면 돼요                                                                                             | -                                                                  |
| 바뀐 노드는 Patch 결과가 아니라 두 트리에서의 위치로 실제 영역에서 찾는다                | Patch가 무엇을 돌려주는지, 어떤 순서로 고치는지에 기대지 않아요. Patch 전후 실제 영역이 두 트리와 같다는 전제(Patch 전제 조건, FR-W15)만 써요 | -                                                                  |
| 삭제·교체된 노드의 종류는 실제 영역이 아니라 이전 트리에서 읽는다                        | Diff 결과의 `REMOVE`에는 노드 정보가 없어요. 이전 트리는 페이지가 이미 들고 있어 DOM을 읽지 않아도 돼요                                       | -                                                                  |
| 자식만 바뀐 `UPDATE`는 변경으로 세지 않는다. 속성이 바뀐 `UPDATE`는 1개로 센다           | 그 요소 노드는 바뀌지 않았어요. 세면 `h1` 텍스트 하나만 바꿔도 "변경 3개"가 돼 FR-W30 확인 방법("변경 1개")과 맞지 않아요                     | -                                                                  |
| 변경 표시는 Diff와 분리한다                                                              | 화면에 보이는지는 Diff가 아니라 표시 단계에서 판단해요                                                                                        | [ADR-008](../adr/ADR-008.md)                                       |
| 텍스트 노드 규칙을 따르는 변경은 부모의 `innerText`가 바뀌었을 때만 보이는 변경으로 본다 | 공백이 보이는지는 브라우저가 계산한 `innerText`로 판단하는 게 정확해요                                                                        | [ADR-008](../adr/ADR-008.md)                                       |
| 관련 노드가 모두 주석 노드인 변경은 강조 표시하지 않는다                                 | 화면에 보이지 않아요                                                                                                                          | [ADR-008](../adr/ADR-008.md)                                       |
| 텍스트·주석 노드의 추가, 삭제, 교체는 노드 종류로 판단한다                               | ADR-008 표에 없는 경우예요. 요소 노드가 관련되면 보이고, 텍스트 노드면 `innerText`로, 주석 노드만이면 안 보이는 것으로 ADR-008 표를 넓혀요    | [ADR-008](../adr/ADR-008.md)                                       |
| 삭제된 요소 노드는 부모 요소 노드를 강조 표시한다                                        | 삭제된 노드는 화면에 없어 강조 표시할 자리가 없어요. 부모를 표시해 어디가 바뀌었는지 보여 줘요                                                | -                                                                  |
| Patch 전 정보는 검증 페이지가 Patch 전에 `captureBefore`를 호출해 읽는다                 | Patch가 변경 표시를 호출하지 않아도 돼요                                                                                                      | [ADR-008](../adr/ADR-008.md) 결정 2 (읽는 주체는 이 문서에서 정함) |
| 강조 표시는 기본으로 `element.animate()`로 하고 DOM의 속성을 바꾸지 않는다               | 두 영역 비교는 속성까지 담은 Virtual DOM 트리로 해요. `animate()`는 속성을 바꾸지 않아 비교에 영향을 주지 않아요(FR-W27)                      | [ADR-008](../adr/ADR-008.md)                                       |
| `innerText` 읽기와 강조 표시 방법을 함수로 넘겨받는다                                    | jsdom은 `innerText`와 `animate()`를 구현하지 않아요. 표시 방법을 바꿔도 판단 규칙은 그대로 써요                                               | -                                                                  |

## 경계 케이스

| 경우                                 | 입력 예시 (이전 → 새)                                               | 기대 동작                                                                             | 관련 요구사항 |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------- |
| 보이는 텍스트 변경                   | 샘플에서 `<h1>할 일 목록</h1>` → `<h1>오늘 할 일</h1>`              | `text` 1개. `h1`을 강조 표시해요. "변경 1개"                                          | FR-W16, W30   |
| 보이지 않는 공백 변경                | `<li>A</li>` → `<li> A</li>`                                        | `text` 1개. 강조 표시하지 않아요. "변경 1개 (화면에 안 보이는 변경 1개)"              | FR-W16, W30   |
| 블록 요소 노드 사이 공백 변경        | `<div><p>A</p>\n<p>B</p></div>` → `<div><p>A</p>\n\n<p>B</p></div>` | `div`의 `innerText`가 그대로라 강조 표시하지 않아요. 안 보이는 변경으로 세요          | FR-W16, W30   |
| `<pre>` 안의 공백 변경               | `<pre>A</pre>` → `<pre> A</pre>`                                    | `innerText`가 바뀌어 `pre`를 강조 표시해요                                            | FR-W16        |
| 주석만 추가 (끝)                     | `<li>A</li>` → `<li>A</li><!-- 메모 -->`                            | `create` 1개. 강조 표시하지 않아요. "변경 1개 (화면에 안 보이는 변경 1개)"            | FR-W30        |
| 주석 내용 변경                       | `<!-- a -->` → `<!-- b -->`                                         | `text` 1개, 두 노드 종류가 `'comment'`. 강조 표시하지 않아요. 안 보이는 변경으로 세요 | FR-W16, W30   |
| 속성 변경                            | `<li class="a">A</li>` → `<li class="b">A</li>`                     | `props` 1개. `li`를 강조 표시해요                                                     | FR-W16        |
| 속성과 텍스트가 함께 바뀜            | `<li class="a">A</li>` → `<li class="b">B</li>`                     | `props` 1개와 `text` 1개로 "변경 2개". `li`는 한 번만 강조 표시해요                   | FR-W16, W30   |
| 요소 노드 삭제                       | `<ul><li>A</li><li>B</li></ul>` → `<ul><li>A</li></ul>`             | `remove` 1개. 부모 `ul`을 강조 표시해요                                               | FR-W16        |
| 루트 요소 노드 삭제                  | `<p>A</p><p>B</p>` → `<p>A</p>`                                     | `parentNewPath`가 `[]`라 영역 컨테이너를 강조 표시해요                                | FR-W16        |
| 요소 노드를 주석으로 교체            | `<p>A</p>` → `<!-- A -->`                                           | `replace` 1개. 보이는 변경이라 부모 요소 노드(여기서는 영역 컨테이너)를 강조 표시해요 | FR-W16        |
| 한 부모 안의 보이는 변경과 공백 변경 | `<p>A<b>B</b> </p>` → `<p>C<b>B</b>  </p>`                          | `text` 2개로 "변경 2개". 부모 `p`의 `innerText`가 바뀌어 둘 다 보이는 변경으로 세요   | FR-W30        |
| 화면에 렌더링되지 않은 요소 노드     | `display: none` 요소 노드 안의 텍스트 변경                          | `innerText`가 `textContent`와 같은 값을 돌려줘 공백 변경도 보이는 변경으로 세요       | FR-W16        |

마지막 두 행은 부모 `innerText`로 판단하는 ADR-008 규칙의 한계예요. 같은 부모 요소 노드 아래(자손 포함)에서 보이는 변경이 함께 일어나면, 그 부모의 `innerText`가 바뀌어 공백 변경도 보이는 변경으로 세요. 예를 들어 샘플에서 `h1` 텍스트와 들여쓰기를 함께 바꾸면, 들여쓰기 변경도 보이는 변경이 돼요. 다만 `div#app`은 `h1`을 품은 조상이라 강조 표시는 `h1`에만 해요. 기대 동작은 이 한계를 그대로 따른 결과예요.

## 검증 방법

- 단위 테스트 (jsdom, `options.highlight`에 호출을 기록하는 함수를 넣음)
  - jsdom에는 `innerText`가 없어요. `textContent`는 공백을 그대로 돌려줘서, 공백 변경이 모두 보이는 변경이 돼요. 그래서 공백 관련 경계 케이스(보이지 않는 공백, 블록 요소 노드 사이 공백, `<pre>`)는 단위 테스트에서 확인하지 않고 검증 페이지에서 확인해요. 단위 테스트의 `readText`는 경우마다 Patch 전후 값을 정해 돌려주는 가짜 함수로 넣어요.
  - `fromDiffResult`: Diff 결과를 손으로 만들어 넣고, 위 경계 케이스마다 `ChangeRecord`의 `kind`, 경로, 노드 종류가 맞는지 확인해요. 자식만 바뀐 `UPDATE`가 빠지는지 따로 확인해요. Diff 구현 없이도 테스트할 수 있어요.
  - 판단 규칙: `ChangeRecord`를 손으로 만들어 넣고, 표의 행마다 `highlighted`와 `hidden`이 맞는지 확인해요. Diff와 Patch 없이 테스트할 수 있어요.
  - FR-W30: `message`가 "변경 N개 (화면에 안 보이는 변경 M개)" 형식이고, M이 0이면 괄호가 없는지 확인해요. 요구사항 확인 방법의 두 경우("주석만 추가" → "변경 1개 (화면에 안 보이는 변경 1개)", "`h1` 텍스트만 변경" → "변경 1개")를 넣어요.
  - FR-W27: `showChanges` 전후로 실제 영역 모든 요소 노드의 속성 목록이 같은지 확인해요.
- 검증 페이지 (실제 브라우저)
  - FR-W16: 위 경계 케이스마다 Patch해서 보이는 변경만 강조 표시되는지 확인해요. 공백 판단은 `innerText`가 있는 브라우저에서만 확인할 수 있어요.
  - FR-W27: 강조 표시 애니메이션 도중에 두 영역을 Virtual DOM 트리로 변환해 Diff 결과가 모두 `null`인지 확인해요.

## 정하지 않은 것

- 주석을 끝이 아닌 곳에 넣으면 변경이 여러 개 나오는 FR-W13·FR-W30 확인 방법 충돌: FR-W30 확인 방법을 "끝에 주석 추가"로 한정하는 안을 [ADR-002](../adr/ADR-002.md) 승인 PR에서 임동호·오동환이 정해요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1_requirement.md)
- [ADR-002](../adr/ADR-002.md), [ADR-007](../adr/ADR-007.md), [ADR-008](../adr/ADR-008.md)
- [Diff 설계](diff.md), [Patch 설계](patch.md), [검증 페이지 설계](page.md)
