# 화면 스타일 설계 (할 일 앱)

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #93

## 개요

화면 스타일은 할 일 앱 페이지(`phase2.html`)의 배치, 색, 글자, 강조 표시 모양을 정해요. 이 문서를 읽으면 `phase2.html`의 틀과 `src/phase2/page/style.css`를 만들고, 앱 컴포넌트가 `h`로 요소를 만들 때 붙일 class를 알 수 있어요. 색과 글꼴, 패널 모양은 [Phase 1 화면 스타일 설계](../phase1/style.md)를 그대로 이어받아요. 디자인 초안은 [Design 캔버스 - 할 일 앱 목업](https://claude.ai/artifact/V2jvdEPSK1xHFLYEZX8wcs)의 "2차 — 들여다보기 + 순서 바꾸기 (Phase 1 스타일)" 아트보드예요.

## 다루는 요구사항

| ID      | 요구사항 요약                                                                 | 이 문서에서 다루는 곳        |
| ------- | ----------------------------------------------------------------------------- | ---------------------------- |
| FR-AP02 | 할 일 앱 페이지는 첫 화면으로 돌아가는 링크를 가져요                          | 배치                         |
| FR-AP03 | 페이지가 로드되면 입력 영역, 필터 영역, 목록, 아래 영역을 보여 줘요           | 할 일 앱                     |
| FR-AD08 | 입력값이 비어 있는 동안 추가 버튼을 비활성화해요                              | 버튼 상태                    |
| FR-DN02 | 끝낸 일의 항목을 남은 일의 항목과 다른 모양으로 보여 줘요                     | 할 일 앱                     |
| FR-FL03 | 지금 고른 필터의 버튼을 다른 필터 버튼과 다른 모양으로 보여 줘요              | 할 일 앱                     |
| FR-FL05 | 보이는 목록이 비어 있는 동안 목록 자리에 안내 문구를 보여 줘요                | 할 일 앱                     |
| FR-CT01 | 아래 영역에 남은 일 개수를 보여 줘요                                          | 할 일 앱                     |
| FR-CL02 | 끝낸 일이 없는 동안 끝낸 일 지우기 버튼을 비활성화해요                        | 버튼 상태                    |
| FR-AX01 | (2차) 렌더링이 끝날 때마다 렌더링 횟수와 hooks 배열의 칸을 보여 줘요          | 배치, 들여다보기 패널        |
| FR-AX02 | (2차) update마다 Diff 결과와 바뀐 DOM 노드를 패널과 앱에 표시해요             | 들여다보기 패널, 강조 표시 모양 |
| FR-AX03 | (2차) useMemo 계산과 useEffect 실행을 실행 기록에 남겨요                      | 들여다보기 패널              |
| FR-AX05 | (2차) 위·아래 이동 버튼으로 할 일을 이웃 할 일과 자리를 바꿔요                | 할 일 앱, 강조 표시 모양     |

## 위치와 흐름

```text
phase2.html + style.css ──▶ 페이지 틀 (머리글, 패널)
앱 컴포넌트(h, class) ──▶ #app 안의 할 일 앱
들여다보기 패널 코드 ──▶ 패널의 요소 노드 (2차)
```

- 입력을 주는 곳: 없음. 정적인 HTML과 CSS예요. 앱 컴포넌트와 들여다보기 패널 코드가 이 문서의 class와 `id`를 써요.
- 출력을 받는 곳: `src/phase2/page/main.ts`(`#app`에 mount), 앱 컴포넌트(`h` 호출의 `class` props), 들여다보기 패널 코드(2차, 패널 `id`로 요소 노드를 찾아 씀).

## 자료구조

색과 글꼴은 Phase 1과 같은 이름, 같은 값의 CSS 변수로 둬요. Phase 2에서 새로 쓰는 값만 더해요.

```css
:root {
  /* Phase 1과 같아요 (docs/design/phase1/style.md) */
  --dd-red: #e03131;
  --dd-blue: #1971c2;
  --dd-blue-line: #a5d8ff;
  --dd-blue-band: #2b8fff;
  --dd-primary: #6b46f5;
  --dd-primary-text: #5330d9;
  --dd-primary-soft: #ede7ff;
  --dd-bg: #f6f7ff;
  --dd-card: #ffffff;
  --dd-card-line: #dce0f5;
  --dd-text: #14162e;
  --dd-text-sub: #565c7a;
  --dd-off-bg: #f2f3f7;
  --dd-off-text: #a3a8b8;
  --dd-sans: 'Pretendard', system-ui, sans-serif;
  --dd-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Phase 2에서 더해요 */
  --dd-move-soft: #fff3bf;
  --dd-move-text: #a35f00;
  --dd-row-line: #eef0f5;
  --dd-frame: #eef1ff;
}
```

- `--dd-move-soft: #fff3bf`, `--dd-move-text: #a35f00` — 이동한 것. Phase 1 Diff 패널의 MOVE 칩(`.chip-move`) 색을 변수로 꺼냈어요. 이동한 항목의 강조 띠와 MOVE 칩에 써요. (예: `background: var(--dd-move-soft)`)
- `--dd-row-line: #eef0f5` — 목록 줄 사이의 선. Phase 1의 `.diff-item` 위 선과 같은 값이에요. 할 일 항목, hooks 칸, Diff 항목, 실행 기록 항목에 써요. (예: `border-top: 1px solid var(--dd-row-line)`)
- `--dd-frame: #eef1ff` — 렌더링 결과 박스의 바깥 테두리 칸. Phase 1의 `.render-frame` 배경과 같아요. 할 일 앱을 감싸요. (예: `background: var(--dd-frame)`)

Hook 칸과 Diff 변경의 종류 칩 색은 아래와 같아요. 칩 모양(안쪽 여백 2px 8px, 모서리 6px, 12px 600)은 Phase 1 `.chip`과 같아요.

| 칩              | 배경          | 글자          | 쓰는 곳                         |
| --------------- | ------------- | ------------- | ------------------------------- |
| `state`         | `#E3F1FF`     | `--dd-blue`   | hooks 배열, 실행 기록            |
| `memo`          | `--dd-primary-soft` | `--dd-primary-text` | hooks 배열, 실행 기록      |
| `effect`        | `--dd-off-bg` | `#3D4260`     | hooks 배열, 실행 기록            |
| `UPDATE`, `TEXT`, `MOUNT` | `--dd-primary-soft` | `--dd-primary-text` | Diff (Phase 1 기본 칩) |
| `CREATE`        | `#E3F1FF`     | `--dd-blue`   | Diff (Phase 1 `.chip-create`)   |
| `REMOVE`        | `#FFE3E3`     | `#C92A2A`     | Diff (Phase 1 `.chip-remove`)   |
| `MOVE`          | `--dd-move-soft` | `--dd-move-text` | Diff (Phase 1 `.chip-move`) |

## 인터페이스

### 페이지 틀 (`phase2.html`)

| `id` / class          | 요소 노드                  | 내용                                                         |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| `.dd-home`            | `<a href="./index.html">`  | 첫 화면으로 가는 링크 (FR-AP02)                              |
| `app`                 | `<div>`                    | 할 일 앱을 mount하는 컨테이너. `.render-root`를 함께 붙여요   |
| `render-count`        | `<strong>`                 | (2차) 렌더링 횟수                                            |
| `hooks-view`          | `<ol>`                     | (2차) hooks 배열의 칸                                        |
| `diff-message`        | `<p>`                      | (2차) Diff 요약 문구 (예: "바뀐 곳 2개 · 이동 1개")          |
| `diff-view`           | `<ul>`                     | (2차) 마지막 update의 변경 목록                              |
| `log-summary`         | `<p>`                      | (2차) 이번 렌더링의 계산·effect 요약 (예: "#5 memo 2/2 · effect 1/2") |
| `log-view`            | `<ol>`                     | (2차) 실행 기록                                              |

### 앱 컴포넌트가 붙이는 class

앱 컴포넌트는 `h` 호출의 `class` props로 아래 이름을 붙여요. 모양은 모두 `style.css`가 정하고, 컴포넌트는 `style` props를 쓰지 않아요.

| class                   | 요소 노드                    | 붙는 때                                   |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| `todo-app`              | `<div>`                      | 앱 루트                                   |
| `todo-input-row`        | `<div>`                      | 입력 영역                                 |
| `todo-input`            | `<input type="text">`        | 입력창                                    |
| `todo-add`              | `<button>`                   | 추가 버튼                                 |
| `todo-filters`          | `<div role="group">`         | 필터 영역                                 |
| `todo-filter`           | `<button>`                   | 필터 버튼 하나                            |
| `is-selected`           | `todo-filter`에 더함          | 지금 고른 필터 (FR-FL03)                  |
| `todo-list`             | `<ul>`                       | 목록                                      |
| `todo-item`             | `<li>`                       | 할 일 하나 (`key: todo.id`)               |
| `is-done`               | `todo-item`에 더함            | 끝낸 일 (FR-DN02)                         |
| `todo-check`            | `<input type="checkbox">`    | 끝냄 표시                                 |
| `todo-text`             | `<span>`                     | 할 일 글자                                |
| `todo-move`             | `<button>`                   | (2차) 위·아래 이동 버튼                   |
| `todo-delete`           | `<button>`                   | 삭제 버튼                                 |
| `todo-empty`            | `<p>`                        | 보이는 목록이 빈 동안의 안내 문구 (FR-FL05) |
| `todo-footer`           | `<div>`                      | 아래 영역                                 |
| `todo-count`            | `<strong>`                   | 남은 일 개수 (FR-CT01)                    |
| `todo-clear`            | `<button>`                   | 끝낸 일 지우기 버튼                       |

- 아이콘만 있는 버튼(`todo-move`, `todo-delete`)에는 `aria-label`을 붙여요. (예: `'우유 사기 삭제'`, `'우유 사기 위로 이동'`)

### 강조 표시 함수

```ts
function highlight(el: Element, kind: 'change' | 'move'): Animation;
function clearHighlights(container: Element): void;
```

- `el: Element` — 강조할 요소 노드. 앱 컨테이너 안의 노드예요. (예: 체크한 항목의 `<li>`)
- `kind: 'change' | 'move'` — 강조 종류. 내용이 바뀌거나 새로 생긴 노드는 `'change'`, Diff가 MOVE로 표시한 노드는 `'move'`예요. (예: `'move'`)
- `container: Element` — 앱 컨테이너. (예: `<div id="app">`)
- `highlight`
  - 반환값: `el.animate()`가 돌려준 `Animation`.
  - 부수 효과: `el`에 애니메이션을 하나 걸어요. 속성(`class`, `style`)과 자식 노드는 바꾸지 않아요.
- `clearHighlights`
  - 반환값: 없음.
  - 부수 효과: `container` 안 요소 노드의 애니메이션을 모두 취소해요(`getAnimations({ subtree: true })`).

## 동작 방식

### 배치

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [로고] Double D  (Phase 2 · 할 일 앱)          첫 화면으로  [ 렌더링 5회 ] │
│                                                                          │
│ ┌ 할 일 앱 ──────────────────────┐   ┌ hooks 배열 ─────────────────────┐  │
│ │ ┌ 렌더링 결과 박스 ──────────┐ │   │ [0] state  todos     바뀜      │  │
│ │ │ 입력창 [추가]              │ │   │ [1] state  text      그대로    │  │
│ │ │ [전체|남은 일|끝낸 일]     │ │   │ [3] memo   보이는 목록 다시 계산 │  │
│ │ │ □ 우유 사기       ↑ ↓ 🗑  │ │   │ [5] effect 탭 제목   건너뜀    │  │
│ │ │ 남은 일 3개  [끝낸 일 지우기]│ │   │ …                              │  │
│ │ └────────────────────────────┘ │   │                                │  │
│ └────────────────────────────────┘   └────────────────────────────────┘  │
│                                                                          │
│ ┌ Diff ─────────── 바뀐 곳 2개 ──┐   ┌ 실행 기록 ─── #5 memo 2/2 ─────┐  │
│ │ MOVE  li key=2  insertBefore… │   │ #5 effect 저장소 쓰기           │  │
│ │ …                              │   │ #5 memo   보이는 목록 다시 계산 │  │
│ └────────────────────────────────┘   └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- 페이지 전체는 한 화면(브라우저 창 높이)에 다 들어가요. 페이지 전체 스크롤은 없어요. Phase 1과 같아요.
- 머리글 아래를 위 줄과 아래 줄이 3:2로 나누고, 각 줄은 두 칸을 1:1로 나눠요. 각 칸의 내용이 넘치면 그 칸 안에서만 스크롤해요.
- 위 줄은 "대상"이에요. 왼쪽은 할 일 앱, 오른쪽은 앱의 hooks 배열이에요. 아래 줄은 "update 한 번에 일어난 일"이에요. 왼쪽은 Diff, 오른쪽은 실행 기록이에요. Phase 1의 "위: 두 영역, 아래: 분석 패널"과 같은 읽는 순서예요.

| 구역        | 들어가는 요소 노드                 | 규칙                                                                                                                                           |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 머리글      | 로고, 이름, 페이지 꼬리표, `.dd-home`, `render-count` | 왼쪽에 로고(높이 40px)와 "Double D", 보라 꼬리표 "Phase 2 · 할 일 앱"을 둬요. 오른쪽에 첫 화면 링크와 렌더링 횟수 묶음을 둬요. 렌더링 횟수 묶음은 Phase 1의 기록 이동 묶음(`.dd-history-nav`) 모양이에요 |
| 위 왼쪽     | `#app`                             | 패널 제목 "할 일 앱", 오른쪽 보조 글자에 탭 제목을 보여 줘요. 패널 안은 렌더링 결과 박스예요(아래 "할 일 앱")                                     |
| 위 오른쪽   | `hooks-view`                       | 칸마다 한 줄: 번호, 종류 칩, 이름과 값, 이번 렌더링의 결과(바뀜 / 그대로, 다시 계산 / 저장값 씀, 실행 / 건너뜀)예요. 이번 렌더링에서 바뀐 칸은 강조 띠를 칠해요 |
| 아래 왼쪽   | `diff-message`, `diff-view`        | 패널 제목 오른쪽에 요약 문구, 아래에 변경 목록이에요. 변경 항목은 Phase 1 `.diff-item`처럼 `칩 | 대상 | 내용` 세 칸이에요. 대상 칸은 132px이에요 |
| 아래 오른쪽 | `log-summary`, `log-view`          | 패널 제목 오른쪽에 이번 렌더링 요약, 아래에 기록이 최근 순으로 쌓여요. 이번 렌더링의 줄은 `--dd-text`, 지난 줄은 `#6B7180`이에요               |

### 글자

Phase 1과 같아요. 페이지 이름은 Pretendard 800 27px, 패널 제목은 800 20px, 내용(할 일, Diff, 기록, 버튼)은 14px, 보조 글자는 13px이에요. key, 값, deps처럼 코드인 글자는 JetBrains Mono 13px이에요. 글꼴 파일도 Phase 1과 같은 `public/fonts/PretendardVariable.woff2`와 Google Fonts를 써요.

### 할 일 앱

- 앱은 Phase 1의 렌더링 결과 박스 안에 그려요. 바깥 칸은 `--dd-frame` 배경에 안쪽 여백 6px, 모서리 10px이에요. 안쪽 칸(`#app.render-root`)은 흰 배경, 안쪽 여백 위아래 16px·좌우 20px, 넘치면 `overflow: auto`예요. "이 칸이 mini-react가 그린 결과"라는 것을 Phase 1과 같은 모양으로 알려요.
- 네 영역(FR-AP03)은 위에서 아래로 입력 영역, 필터 영역, 목록, 아래 영역 순서이고, 사이 간격은 12px이에요. 아래 영역은 칸 맨 아래에 붙여요(`margin-top: auto`).
- 입력창은 높이 44px, 테두리 2px `--dd-blue-line`, 모서리 10px이에요. 포커스가 있으면 테두리가 `--dd-blue-band`로 바뀌어요. Phase 1 테스트 영역 입력창과 같은 색이에요.
- 추가 버튼은 Phase 1 Patch 버튼 모양이에요(보라 배경, 흰 글자, 모서리 12px).
- 필터 영역은 `--dd-off-bg` 바탕에 안쪽 여백 4px, 모서리 12px인 세 칸 묶음이에요. `.is-selected` 버튼은 흰 배경, `--dd-primary-text` 글자, 700 굵기, 옅은 그림자예요(FR-FL03). 나머지는 투명 배경에 `--dd-text-sub` 글자예요.
- 할 일 항목은 한 줄에 체크박스(18px, `accent-color: var(--dd-primary)`), 글자, 이동 버튼 둘(2차), 삭제 버튼 순서예요. 줄 아래에 `--dd-row-line` 선을 그어요. 버튼은 아이콘만 보이지만 누르는 칸은 높이 44px이에요.
- `.is-done` 항목은 글자색 `--dd-text-sub`, 취소선(`text-decoration-color: var(--dd-off-text)`)이에요(FR-DN02).
- 안내 문구(`.todo-empty`)는 목록 자리 가운데에 14px `--dd-text-sub`로 보여 줘요(FR-FL05).
- 아래 영역은 위에 `--dd-row-line` 선을 긋고, 왼쪽에 "남은 일 **N**개"(FR-CT01), 오른쪽에 끝낸 일 지우기 버튼을 둬요. 켜진 끝낸 일 지우기 버튼은 `#FFEEEE` 배경에 `--dd-red` 글자예요.

### 들여다보기 패널 (2차)

- 패널 모양은 Phase 1 `.panel`과 같아요. 흰 배경, 테두리 `--dd-card-line`, 모서리 14px, 머리 안쪽 여백 16px 20px 12px이에요.
- 요약 문구(`diff-message`, `log-summary`)는 Phase 1 `.message`처럼 14px 700 `--dd-primary-text`예요.
- Diff의 MOVE 항목 아래에는 ADR-011 판단 방식을 13px 보조 글자 한 줄로 보여 줘요. "↑를 누르면 밀려난 이웃이 MOVE로 잡힌다"는 점을 발표에서 짚기 위해서예요.

### 강조 표시 모양

- 모양은 Phase 1과 같은 배경 띠예요. `box-shadow`로 띠를 좌우로만 4px 넓히고, 0.4초 동안 투명에서 나타나(`ease-out`) 다음 update 전까지 남아요(`fill: 'forwards'`).
- 종류에 따라 색만 달라요. 내용이 바뀌거나 새로 생긴 노드(`'change'`)는 보라 `--dd-primary-soft`, 이동한 노드(`'move'`)는 노랑 `--dd-move-soft`예요. Diff 패널의 칩 색과 같아서 앱의 띠와 패널의 항목을 색으로 짝지어 볼 수 있어요.
  ```ts
  const color = kind === 'move' ? '#FFF3BF' : '#EDE7FF';
  el.animate(
    [
      { backgroundColor: 'transparent', boxShadow: '-4px 0 0 transparent, 4px 0 0 transparent' },
      { backgroundColor: color, boxShadow: `-4px 0 0 ${color}, 4px 0 0 ${color}` },
    ],
    { duration: 400, easing: 'ease-out', fill: 'forwards' },
  );
  ```
- 한 노드가 이동과 내용 변경을 함께 가지면(ADR-011 결정 2) `'move'`로 칠해요. 내용 변경은 Diff 패널 항목으로 보여요.
- 다음 update의 Patch 전에 `clearHighlights`로 지난 띠를 모두 지워요.
- 강조 표시는 앱 컨테이너 안에 노드나 속성을 더하지 않아요. mini-react의 Diff는 이전 VNode와 새 VNode만 비교하고 Patch는 그 결과대로 DOM을 고쳐요. 강조 표시가 칩 같은 노드를 끼우면 `childNodes` 순서가 VNode와 어긋나 다음 Patch가 엉뚱한 노드를 고쳐요. 그래서 MOVE 칩은 Diff 패널에만 두고, 앱 안에는 띠만 칠해요.

예시 (할 일 `[1, 2, 3, 4]`에서 key=3의 ↑를 누름):

```text
입력: 이전 목록 [1, 2, 3, 4] → 새 목록 [1, 3, 2, 4]
      Diff: key=1 그대로(lastPlacedIndex 0), key=3 그대로(2), key=2 이전 위치 1 < 2 → MOVE, key=4 그대로(3)
출력: 앱에서 key=2 항목만 노랑 띠. 누른 key=3 항목은 칠하지 않아요.
      Diff 패널: [MOVE] li key=2  insertBefore(li key=4) · 같은 노드
      hooks 배열: [0] todos 바뀜, [3] 보이는 목록 다시 계산, [4] 남은 일 개수 다시 계산, [5] 탭 제목 건너뜀, [6] 저장소 쓰기 실행
```

### 버튼 상태

- 꺼진 버튼(추가 FR-AD08, 끝낸 일 지우기 FR-CL02)은 Phase 1과 같은 회색 배경 `--dd-off-bg`, 회색 글자 `--dd-off-text`, `cursor: not-allowed`예요.
- 꺼진 이동 버튼(맨 위 항목의 ↑, 맨 아래 항목의 ↓)은 배경 없이 아이콘만 `#C9CDD9`로 흐리게 보여요.
- 마우스를 올리면 이동 버튼은 `--dd-primary-soft` 배경에 `--dd-primary-text`, 삭제 버튼은 `#FFE3E3` 배경에 `#C92A2A`로 바뀌어요.

### 좁은 화면

- 화면이 768px 미만이면 모든 패널을 위아래로 쌓고 페이지 전체를 스크롤해요. 패널은 최소 높이 420px이에요.
- 순서는 할 일 앱, hooks 배열, Diff, 실행 기록이에요. HTML 순서 그대로라 순서를 바꾸는 CSS가 필요 없어요.

## 설계 결정

| 결정                                                                                     | 이유                                                                                                                                         | 관련 ADR                            |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 색, 글꼴, 패널, 칩, 버튼 모양은 Phase 1 화면 스타일을 그대로 이어받는다                   | 두 페이지가 같은 서비스로 보이고, 발표에서 화면을 다시 설명할 필요가 없어요                                                                    | -                                   |
| 한 화면에 2×2로 배치한다. 위 줄은 앱과 hooks 배열, 아래 줄은 Diff와 실행 기록이다        | Phase 1의 "위: 대상, 아래: 분석" 순서와 같아요. 동작 한 번에 바뀌는 네 곳(앱의 띠, hooks 칸, Diff, 기록)이 한눈에 보여요                          | -                                   |
| 앱은 Phase 1 렌더링 결과 박스 안에 그린다                                                | 어디까지가 mini-react가 그린 결과인지 모양으로 구분돼요                                                                                        | -                                   |
| 렌더링 횟수는 머리글에 둔다                                                              | Phase 1 기록 위치(`historyLabel`)와 같은 자리라 "지금 몇 번째 상태인가"를 같은 곳에서 읽어요                                                    | -                                   |
| 앱 컴포넌트는 `class`만 붙이고 모양은 `style.css`가 정한다                                | 컴포넌트 코드가 `h` 호출과 Hook에 집중해 발표에서 읽기 쉬워요. 모양을 바꿀 때 컴포넌트를 고치지 않아요                                           | -                                   |
| 강조 표시는 `element.animate()`로만 칠하고, 앱 컨테이너에 노드나 속성을 더하지 않는다      | DOM이 VNode와 어긋나면 다음 Patch가 틀린 노드를 고쳐요. `animate()`는 속성을 바꾸지 않아요                                                     | [ADR-008](../../adr/ADR-008.md)     |
| 이동한 노드는 노랑 띠, 내용이 바뀐 노드는 보라 띠로 칠한다                               | Phase 1 Diff 칩 색(MOVE 노랑, 기본 보라)과 같아 앱과 패널을 색으로 짝지어요. "같은 노드가 자리만 옮겼다"는 것을 내용 변경과 나눠 보여 줘요       | [ADR-011](../../adr/ADR-011.md)     |
| CSS 변수는 Phase 1과 같은 이름·값으로 `src/phase2/page/style.css`에 둔다                  | Phase 1 페이지 구조(`src/phase1/page/style.css`)와 짝을 맞춰요. 공통 파일로 뺄지는 "정하지 않은 것"에 남겨요                                    | -                                   |

## 경계 케이스

| 경우                         | 입력 예시                                   | 기대 동작                                                                                          | 관련 요구사항 |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| 할 일이 많음                 | 할 일 20개                                  | 앱 패널 높이는 그대로고 렌더링 결과 박스 안에서 스크롤해요. 페이지 전체 스크롤은 생기지 않아요       | FR-AP03       |
| 할 일 글자가 긺              | 공백 없는 60자                              | 글자 칸 안에서 줄을 바꿔요(`overflow-wrap: anywhere`). 버튼은 오른쪽에 그대로 있어요                 | -             |
| 보이는 목록이 빔             | `끝낸 일` 필터, 끝낸 일 없음                | 목록 자리에 안내 문구가 가운데로 보여요. 아래 영역은 그대로 맨 아래에 있어요                          | FR-FL05       |
| 맨 위·맨 아래 항목           | 첫 항목의 ↑, 마지막 항목의 ↓                | 흐린 아이콘에 `disabled`예요. 누를 수 없어요                                                         | FR-AX05       |
| ↑로 이동                     | `[1, 2, 3, 4]`에서 key=3 ↑                  | 누른 key=3이 아니라 밀려난 key=2가 노랑 띠예요(동작 방식 예시)                                        | FR-AX02, AX05 |
| 입력만 바뀜                  | 입력창에 "우" 입력                          | 입력창만 보라 띠, hooks의 `[1] text`만 강조, 실행 기록은 늘지 않아요                                  | FR-AX01, AX03 |
| 필터를 바꿈                  | `전체` → `남은 일`                          | 감춰진 항목은 Diff에 REMOVE로 나오고, 앱에는 남은 항목에 띠가 없어요. 필터 영역만 강조돼요            | FR-AX02       |
| 다음 update                  | 체크 뒤 글자 입력                           | 지난 update의 띠는 모두 지워지고 이번 변경만 칠해요                                                   | FR-AX02       |
| 좁은 화면                    | 화면 너비 600px                             | 패널이 위아래로 쌓이고 페이지 전체를 스크롤해요                                                       | -             |
| 들여다보기 패널을 넣지 않음  | 1차 구현                                    | 위 오른쪽과 아래 줄이 없어요. 배치는 "정하지 않은 것"을 봐요                                          | FR-AP03       |

## 검증 방법

- 단위 테스트: jsdom에 App을 mount해 `.todo-item.is-done`, `.todo-filter.is-selected`, `.todo-empty` class가 상태에 맞게 붙는지 확인해요(FR-DN02, FL03, FL05). 강조 표시 뒤 앱 컨테이너의 `innerHTML`이 강조 전과 같은지 확인해 강조가 노드와 속성을 더하지 않는지 봐요. jsdom에는 `animate`가 없으므로 `highlight`에 넘기는 `el`과 `kind`만 가짜 함수로 기록해 확인해요.
- 검증 페이지: `phase2.html`을 브라우저로 열어 창 높이를 줄여도 페이지 전체 스크롤이 생기지 않는지(`document.documentElement.scrollHeight`가 창 높이와 같은지) 확인해요. 할 일 20개를 넣어 앱 칸 안에서만 스크롤되는지 봐요. key=3 ↑를 눌러 key=2만 노랑 띠가 되고 Diff 패널에 MOVE가 하나 나오는지, 체크 한 번에 그 항목만 보라 띠가 되는지 확인해요. 768px 미만으로 줄여 패널이 쌓이는지 확인해요.

## 정하지 않은 것

- 1차(들여다보기 패널 없음) 배치: 앱 패널 하나만 가운데(최대 너비 680px)에 둘지, 2×2 틀을 두고 빈 칸을 안내할지. 1차 구현을 시작할 때 팀이 정해요.
- Virtual DOM 패널: App이 돌려준 VNode 트리를 Phase 1처럼 보여 줄지. 넣으면 아래 줄이 세 칸이 돼요. 2차 구현 때 정해요.
- CSS 변수 공통 파일: Phase 1과 Phase 2의 `:root` 변수를 `src/shared/` 같은 공통 파일로 뺄지. 두 페이지 스타일이 갈라지기 시작하면 정해요.
- 렌더링 원인 표시: 목업은 실행 기록 머리에 이번 update를 일으킨 setState(예: `setTodos (key=3 ↑)`)를 보여 줘요. 요구사항에 없는 동작이라 넣을지 정해야 해요. 들여다보기 패널의 관찰 지점(요구사항 6.2)과 함께 정해요.

## 관련 문서

- [요구사항 명세서: 할 일 앱](../../requirements/app_requirement.md)
- [Phase 1 화면 스타일 설계](../phase1/style.md)
- [Phase 1 변경 표시 설계](../phase1/change-highlight.md)
- [props 설계](props.md)
- [ADR-008](../../adr/ADR-008.md), [ADR-011](../../adr/ADR-011.md)
