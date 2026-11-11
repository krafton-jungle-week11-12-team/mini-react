# Patch 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #12

## 개요

Patch는 Diff 결과를 받아 실제 영역의 DOM에서 바뀐 노드만 고쳐요. 이 문서를 읽으면 Diff 결과의 변경 종류마다 어떤 DOM API를 부르는지와, 바뀌지 않은 노드를 그대로 두는 방법을 알고 Patch를 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                         | 이 문서에서 다루는 곳 |
| ------ | --------------------------------------------------------------------- | --------------------- |
| FR-E04 | 바뀐 노드만 실제 DOM에 반영하고 전체를 다시 그리지 않아요             | 동작 방식             |
| FR-E09 | 빈 문자열로 Patch하면 실제 영역의 모든 노드를 삭제해요                | 경계 케이스           |
| FR-W14 | 바뀐 노드에 대해서만 DOM API를 호출하고 나머지 노드는 그대로 둬요     | 동작 방식             |
| FR-W15 | Patch가 끝나면 실제 영역과 테스트 영역의 렌더링 결과가 같아요         | 검증 방법             |

## 위치와 흐름

```text
Diff 결과 + 실제 영역 컨테이너 ──▶ Patch ──▶ 고쳐진 실제 영역 DOM ──▶ 변경 표시
```

- 입력을 주는 곳: 검증 페이지(Patch 버튼. 요구사항 4.2의 5단계), 새 노드가 필요하면 [Virtual DOM 변환](vdom.md)의 `toDOM`
- 출력을 받는 곳: 실제 영역 DOM, [변경 표시](change-highlight.md)

## 자료구조

Patch는 새 타입을 만들지 않아요. 입력은 [Diff 설계](diff.md)의 `Patch` 타입을 그대로 받아요.

## 인터페이스

```ts
function patch(parent: Node, patches: ChildPatches): void;
```

- `parent: Node` — 자식을 고칠 부모 DOM 노드. 처음에는 실제 영역 컨테이너를 넣고, `UPDATE`를 만나면 그 요소를 넣어 재귀로 불러요. (예: 실제 영역 컨테이너, `<ul class="todo">`)
- `patches: ChildPatches` — `parent`의 자식 목록에 대한 Diff 결과. 배열이면 *i*번째 칸이 `parent`의 *i*번째 자식에 대한 결과예요. `KeyedPatches`면 칸이 새 순서를 따르고, 칸마다 이전 몇 번 자식인지(`oldIndex`) 담아요. 형식은 [Diff 설계](diff.md)의 자료구조를 봐요. 처음에는 [`diff`](diff.md)의 반환값을 그대로 넣어요. (예: `[null, { type: 'TEXT', text: 'B' }]`, `{ type: 'KEYED', children: [{ oldIndex: 1, move: false, patch: null }], removes: [0] }`)
- 반환값: 없음.
- 부수 효과: `parent` 아래의 DOM을 고쳐요. 바뀐 노드에 대해서만 DOM API를 불러요.

전제 조건: `parent`의 자식 목록은 Diff의 이전 트리(`oldRoots`)와 같은 모양이어야 해요. 이전 트리는 현재 기록의 `vdom`이고, 실제 영역은 매 Patch 뒤에 이 `vdom`과 같아요(FR-W15). 그래서 `REMOVE`, `REPLACE`, `TEXT`, `UPDATE` 칸에는 항상 대응하는 DOM 노드가 있어요.

## 동작 방식

`patch`는 `patches`가 `KeyedPatches`면 `patchKeyed`를 부르고, 배열이면 내부 함수 `applyPatch`로 칸 하나씩 적용하고, `UPDATE`면 그 요소의 자식에 `patch`를 재귀로 불러요([ADR-009](../adr/ADR-009.md)).

### `patch(parent, patches)`

1. 적용 전에 `parent`의 자식 목록(`childNodes`)을 배열로 복사해 둬요.
2. `patches`를 앞에서부터 `for` 반복문으로 돌아요. `forEach` 같은 콜백으로 돌면 재귀 한 단계마다 호출이 더 쌓여 버틸 수 있는 깊이가 줄어요([ADR-009](../adr/ADR-009.md) 결정 5번).
3. 칸이 `null`이면 건너뛰어요. 그 노드는 그대로 둬요.
4. `null`이 아니면 `applyPatch(parent, 복사한 목록[i], 칸)`을 불러요.

### `patchKeyed(parent, keyed)`

key로 짝지은 결과를 적용해요([ADR-011](../adr/ADR-011.md)). 이동한 노드는 새로 만들지 않고 같은 DOM 노드를 옮겨요. 그래서 체크 상태, 입력값, 이벤트 핸들러가 함께 따라가요.

1. 적용 전에 `parent`의 자식 목록을 배열로 복사해 둬요.
2. `removes`의 인덱스마다 복사한 목록의 노드를 `removeChild`로 지워요.
3. `children`을 앞에서부터 돌며 칸마다 놓을 노드를 정해 둬요. 아직 붙이지 않아요.
   - `oldIndex`가 `null`이면 `toDOM(patch.vnode)`로 새 노드를 만들어요.
   - `patch`가 `null`이면 복사한 목록의 `oldIndex`번 노드를 그대로 써요.
   - `patch`가 `REPLACE`면 `replaceChild`로 바꾸고 새 노드를 써요.
   - 그 밖에는 `applyPatch`로 그 노드를 고치고 그 노드를 써요.
4. `children`을 뒤에서부터 돌아요. 기준 노드(`ref`)는 `null`에서 시작해요. 새 노드(`oldIndex`가 `null`)나 `move`가 `true`인 노드만 `insertBefore(노드, ref)`로 넣고, 칸마다 `ref`를 그 칸의 노드로 바꿔요.

뒤에서부터 넣으면 기준 노드는 이미 최종 자리에 있어요. 그래서 기준 노드는 항상 새 목록에서 바로 뒤에 올 노드이고, 맨 끝이면 `null`이에요.

예시 (`[A, B, C]` → `[C, A, B]`, `move`가 `false, true, true`):

```text
뒤에서부터: B 칸(move) → insertBefore(B, null)  → [A, C, B]
           A 칸(move) → insertBefore(A, B)     → [C, A, B]
           C 칸       → 그대로 두고 ref = C
출력: A, B, C 모두 이전과 같은 DOM 객체(===)예요.
```

### `applyPatch(parent, node, p)`

| `p.type`  | DOM API                                                                 | 비고                                         |
| --------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| `CREATE`  | `parent.appendChild(toDOM(p.vnode))`                                     | `node`는 없어요                              |
| `REMOVE`  | `parent.removeChild(node)`                                               |                                              |
| `REPLACE` | `parent.replaceChild(toDOM(p.vnode), node)`                              | 같은 자리에 새 노드가 들어가요               |
| `TEXT`    | `node.nodeValue = p.text`                                                | 텍스트와 주석 모두 `nodeValue`로 고쳐요      |
| `UPDATE`  | `set`의 속성마다 `setAttribute`, `remove`의 속성마다 `removeAttribute`, 그다음 `patch(node, p.children)` | 요소 객체는 그대로 두고 속성과 자식만 고쳐요 |

예시 (샘플 HTML 코드에서 `h1`의 텍스트만 바꿈):

```text
입력: parent  = 실제 영역 컨테이너
      patches = [UPDATE(div#app) ─ children[1]: UPDATE(h1) ─ children[0]: TEXT '오늘 할 일']
```

1. `patch(컨테이너, …)`: 복사한 목록은 `[div#app]`이에요. 0번 칸이 `UPDATE`라 속성은 건너뛰고 `patch(div#app, …)`를 불러요.
2. `patch(div#app, …)`: 복사한 목록은 `[텍스트, h1, 텍스트, ul, 텍스트, button, 텍스트]`예요. 1번 칸만 `UPDATE`라 `patch(h1, …)`를 불러요.
3. `patch(h1, …)`: 0번 칸이 `TEXT`라 `'할 일 목록'` 텍스트 노드의 `nodeValue`를 `'오늘 할 일'`로 바꿔요.

```text
출력: 텍스트 노드 하나의 nodeValue만 바뀌어요.
      div#app, h1, ul, button과 공백 텍스트 노드는 모두 같은 DOM 객체(===)로 남아요.
```

## 설계 결정

| 결정                                                    | 이유                                                                                                   | 관련 ADR                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| key 결과는 이동한 노드를 새로 만들지 않고 `insertBefore`로 옮긴다 | 같은 DOM 노드를 옮겨야 체크 상태, 입력값, 포커스가 남아요 | [ADR-011](../adr/ADR-011.md) |
| key 결과는 뒤에서부터 배치한다                          | 기준 노드가 항상 최종 자리에 있어 위치 계산이 필요 없어요                                              | [ADR-011](../adr/ADR-011.md) |
| 재귀로 내려가고, 칸은 `for` 반복문으로 돈다           | 코드가 트리 모양과 닮아 이해하기 쉬워요. 파서가 깊이를 512단계로 제한해 콜 스택이 넘치지 않아요        | [ADR-009](../adr/ADR-009.md) |
| 새 노드는 Virtual DOM → DOM 변환으로 만든다             | 렌더링 결과는 파싱한 DOM으로 만들고, 변환은 Patch에서만 써요                                           | [ADR-004](../adr/ADR-004.md) |
| 실제 영역 DOM에 강조용 속성을 붙이지 않는다             | 강조 표시가 두 영역 비교(FR-W15)에 영향을 주지 않아야 해요                                             | [ADR-008](../adr/ADR-008.md) |
| 적용 전에 자식 목록을 복사해 두고 그 목록으로 노드를 찾는다 | 앞 칸의 `REMOVE`가 뒤 칸의 인덱스를 당겨도 엉뚱한 노드를 고치지 않아요. 그래서 적용 순서를 따로 정하지 않아도 돼요 | -                            |
| `CREATE`는 `appendChild`로 끝에 붙인다                  | Diff가 같은 인덱스끼리 비교해서 `CREATE`는 이전 자식 수보다 뒤 칸에만 나와요. 앞 칸부터 붙이면 위치가 맞아요. Phase 2에서 key로 짝지으면 `CREATE`가 중간에도 나오고 이동이 생겨, 새 순서대로 `insertBefore`로 배치하는 단계를 더해요 | [ADR-011](../adr/ADR-011.md) |
| `TEXT`는 노드를 바꾸지 않고 `nodeValue`만 고친다        | 텍스트·주석 모두 같은 API로 고치고, 노드 객체가 유지돼요(FR-E04)                                       | -                            |
| `UPDATE`는 요소를 그대로 두고 속성과 자식만 고친다      | 바뀌지 않은 요소가 같은 DOM 객체로 남아요(FR-E04)                                                      | -                            |

## 경계 케이스

| 경우                       | 입력 예시 (이전 → 새)                               | 기대 동작                                                                                     | 관련 요구사항 |
| -------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| 모두 삭제                  | 샘플 HTML 코드 → 빈 문자열                          | 루트 칸이 모두 `REMOVE`라 실제 영역에 노드가 하나도 남지 않아요                              | FR-E09        |
| 한 부모에서 여러 자식 삭제 | `<li>A</li><li>B</li><li>C</li>` → `<li>B</li>`     | 첫 `li`는 같은 객체로 남고 텍스트만 B가 돼요. 복사한 목록으로 두 번째, 세 번째 `li`를 지워요 | FR-W14        |
| 빈 영역에 추가             | 빈 문자열 → `<p>A</p>`                              | `appendChild`로 `<p>A</p>`가 들어가요                                                        | FR-E08        |
| 바뀌지 않은 형제 노드      | 샘플에서 `h1` 텍스트만 변경                         | `ul`, `button`은 같은 DOM 객체(`===`)로 남아요                                                | FR-E04        |
| 교체                       | `<p>A</p>` → `<div>A</div>`                         | `replaceChild`로 같은 위치에 새 노드가 들어가요                                               | FR-E04        |
| 속성 삭제                  | `<button disabled>` → `<button>`                    | `removeAttribute('disabled')`만 불러요. `button`은 같은 객체예요                              | FR-W14        |
| 주석 내용 변경             | `<!-- a -->` → `<!-- b -->`                         | 주석 노드의 `nodeValue`만 바뀌어요                                                            | FR-W26        |
| key 순서 바뀜              | key A, B, C → C, A, B                               | 세 노드 모두 같은 DOM 객체(`===`)로 남고 순서만 C, A, B가 돼요                                | [ADR-011](../adr/ADR-011.md) |
| key 순서 바뀜 + 내용 변경  | key A(텍스트 a), B → B, A(텍스트 a2)                | A는 같은 객체로 옮겨지고 텍스트만 a2로 바뀌어요                                               | [ADR-011](../adr/ADR-011.md) |
| 스크립트가 든 노드 추가    | `<script>alert(1)</script>`, `<img src=x onerror=…>` | `toDOM`으로 만든 노드를 문서에 붙이면 실행될 수 있어요. 정책은 요구사항 7절에서 정해요        | -             |
| 전제 조건이 깨짐           | 실제 영역이 현재 기록의 `vdom`과 다름               | 칸에 대응하는 노드가 없거나 다른 노드라 오류가 나거나 잘못 고쳐요. FR-W15로 막아요            | FR-W15        |

## 검증 방법

- 단위 테스트
  - FR-E04, W14: Patch 전후로 바뀌지 않은 노드가 같은 DOM 객체(`===`)로 남는지 확인해요. 위 예시에서 `ul`, `button`을 확인해요.
  - FR-E09: 빈 문자열로 Patch한 뒤 실제 영역에 노드가 없는지 확인해요.
  - 여러 자식 삭제: 위 경계 케이스에서 남은 `li`가 원래 첫 `li`와 같은 객체인지 확인해요.
  - FR-W15: 강조 표시를 뺀 두 영역의 DOM을 각각 Virtual DOM 트리로 변환해 같은지 확인해요. 다르면 Diff가 노드를 놓친 것이에요.
- 검증 페이지: Patch 버튼을 누른 뒤 두 영역이 같게 보이는지 확인해요.

## 정하지 않은 것

- Patch 도중 오류가 나서 실제 영역이 일부만 바뀐 경우의 처리: 요구사항 6절.
- 변경 표시에 바뀐 DOM 노드를 넘기는 방법: 지금 `patch`는 아무것도 돌려주지 않아요. 바뀐 노드를 돌려주게 할지, 변경 표시가 Diff 결과의 위치로 다시 찾을지 [변경 표시 설계](change-highlight.md)와 함께 정해요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1/phase1_requirement.md)
- [ADR-009](../adr/ADR-009.md): 트리 순회는 재귀로 한다
- [ADR-011](../adr/ADR-011.md): Phase 2에서 순서가 바뀐 노드는 같은 노드를 `insertBefore`로 옮긴다
- [ADR-010](../adr/ADR-010.md): 기록 이동 때 실제 영역은 기록의 HTML 코드를 파싱한 DOM으로 바꾼다. 기록 이동에는 Patch를 쓰지 않아요
- [Diff 설계](diff.md), [Virtual DOM 변환 설계](vdom.md), [변경 표시 설계](change-highlight.md)
