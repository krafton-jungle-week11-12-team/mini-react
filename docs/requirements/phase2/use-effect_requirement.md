# Mini React Phase 2 요구사항 명세서: useEffect

| 항목      | 내용                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| 문서 상태 | 초안 v0.1                                                                                               |
| 작성일    | 2026-11-11                                                                                              |
| 수정일    | 2026-11-11 (hooks 칸 kind 반영, 설계 반영: 실행 대기 목록 위치 · cleanup 저장 규칙)                      |
| 작성자    | 오동환                                                                                                  |
| 근거      | Discussions #118 (useEffect 개념 정리)                                                                  |
| 선행 문서 | [function-component_requirement.md](function-component_requirement.md), [use-memo_requirement.md](use-memo_requirement.md) (의존성 비교) |
| 작성 규칙 | 요구사항 문장은 EARS 형식(항상, 이벤트, 상태, 오류, 선택)을 따르고, 요구사항 하나에 동작 하나만 담는다. |

---

## 1. 목표

- 탭 제목 바꾸기, localStorage 저장, 타이머 시작처럼 컴포넌트 함수 바깥을 바꾸는 일(부수 효과)을 렌더링에서 떼어 내, DOM 반영이 끝난 뒤에 실행할 수 있게 한다.
- deps가 바뀐 렌더링에서만 effect를 다시 실행해, 관계없는 state가 바뀔 때마다 부수 효과가 반복되지 않게 한다.
- effect가 돌려준 cleanup을 시스템이 보관했다가 effect를 다시 실행하기 전에 불러, 이전 effect가 시작한 타이머·구독이 쌓이지 않게 한다.

## 2. 범위

### 2.1 포함

- effect 등록
  - 렌더링 중 useEffect가 deps를 비교해, 바뀌었으면 effect를 실행 대기 목록에 넣기
  - 등록 여부와 상관없이 `hookIndex` 늘리기
- effect 실행
  - mount · update가 DOM 반영을 마친 뒤 대기 목록의 effect를 선언 순서대로 실행하기 ([FunctionComponent 4.1 · 4.2](function-component_requirement.md#4-동작-흐름)의 "effect를 실행한다" 자리)
  - effect 실행 중 호출된 setState를 effect가 다 끝난 뒤 update 한 번으로 처리하기
- cleanup
  - effect가 돌려준 함수를 칸에 보관하기
  - 다시 실행할 effect의 cleanup을 모두 먼저 실행한 뒤 새 effect를 실행하기
- 엣지 케이스: deps 생략, 빈 배열(`[]`), 길이가 바뀐 deps, effect 안의 setState

### 2.2 제외

| 제외 항목                         | 이유                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 의존성 비교 규칙                  | useMemo와 같은 규칙을 쓴다. [use-memo 5.2 (FR-D)](use-memo_requirement.md#52-의존성-비교)를 따른다.                                                    |
| 렌더링 밖 호출 막기               | 모든 Hook에 같은 규칙이므로 [FR-T01](function-component_requirement.md#53-state-제약)을 따른다.                                                        |
| unmount와 unmount 때의 cleanup    | 우리 구현에서는 unmount가 일어나지 않는다. 루트 컴포넌트는 한 번 mount하면 떼어 내는 API가 없고, 자식 컴포넌트는 인스턴스가 없는 일반 함수라 Hook이 없다. 그래서 deps가 `[]`인 effect의 cleanup은 호출되지 않는다. (6.1) |
| 페인트 뒤 실행 보장               | effect는 patch 직후 동기로 실행하므로 페인트 전에 실행된다. 실제 React의 `useLayoutEffect`에 가깝다. (6.1)                                              |
| 연속 update 횟수 제한             | effect 안의 setState로 생기는 무한 루프는 앱 코드의 실수로 본다. 선택 항목으로 둔다. (7절)                                                             |
| effect · cleanup이 던진 오류 처리 | 오류를 잡지 않고 그대로 전파한다. (7절)                                                                                                                |
| useLayoutEffect                   | Phase 2 범위가 아니다.                                                                                                                                 |

### 2.3 사용 규칙 (앱 코드가 지킨다)

> 시스템이 검사할 수 없는 규칙이라 기능 요구사항(5절)에 넣지 않는다. 규칙을 어기면 오류는 나지 않지만 effect가 옛날 값을 쓰거나, 타이머가 쌓이거나, 렌더링이 끝나지 않을 수 있다.

- 부수 효과는 렌더링(컴포넌트 함수 본문)이 아니라 useEffect나 이벤트 핸들러에서 한다. 렌더링 중에는 아직 patch 전이라 DOM이 이전 상태이고, 시작한 타이머를 정리할 자리가 없다.
- effect가 읽는 값 중 바뀔 수 있는 값은 모두 deps에 넣는다. (예: `useEffect(() => { const id = setInterval(() => console.log(count), 1000); return () => clearInterval(id); }, [])`는 `count`가 빠져 있어 계속 0만 찍는다.)
- effect에서 시작한 일이 effect가 끝난 뒤에도 남으면 cleanup을 돌려준다. 한 번 하고 끝나는 일(`document.title` 바꾸기, `localStorage.setItem`)은 돌려주지 않아도 된다.

  | effect에서 시작                  | cleanup에서 끝                       |
  | -------------------------------- | ------------------------------------ |
  | `setInterval` / `setTimeout`     | `clearInterval` / `clearTimeout`     |
  | `window.addEventListener`        | `window.removeEventListener`         |
  | `subscribe`                      | `unsubscribe`                        |
  | `fetch`                          | `AbortController.abort()`            |

- effect 안에서 자기 deps에 든 state를 조건 없이 바꾸지 않는다. (예: `useEffect(() => setCount(count + 1), [count])`는 렌더링이 끝나지 않는다.)
- state로 계산할 수 있는 값을 effect에서 setState로 맞추지 않는다. 렌더링 중에 계산하고, 무거우면 useMemo를 쓴다. (예: `useEffect(() => setDoneCount(todos.filter(t => t.done).length), [todos])` 대신 `const doneCount = todos.filter(t => t.done).length`)

## 3. 용어

> FunctionComponent · useState 용어(hooks 배열, hookIndex, currentComponent, 렌더링, mount, update 등)는 [function-component_requirement.md 3절](function-component_requirement.md#3-용어), deps · 의존성 비교는 [use-memo_requirement.md 3절](use-memo_requirement.md#3-용어)을 따른다.

| 용어                    | 뜻                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 부수 효과 (side effect) | 함수가 값을 돌려주는 것 말고 함수 바깥의 값을 바꾸는 일. (예: `document.title` 바꾸기, localStorage 저장, 타이머 시작, 이벤트 구독) setState도 부수 효과다. |
| effect                  | useEffect의 첫 번째 인자. 인자 없이 실행되고, cleanup 함수를 돌려주거나 아무것도 돌려주지 않는다. (예: `() => { document.title = title; }`)                |
| cleanup                 | effect가 돌려주는 함수. effect가 시작한 일을 정리한다. 시스템이 칸에 보관했다가 그 effect를 다시 실행하기 직전에 부른다. (예: `() => clearInterval(id)`)    |
| effect 칸               | useEffect가 쓰는 hooks 칸. 이번 deps(`deps`)와 마지막으로 실행한 effect가 돌려준 cleanup(`cleanup`)을 함께 저장한다. (예: `{ kind: 'effect', deps: [count], cleanup: fn }`) |
| 실행 대기 목록          | 이번 렌더링에서 deps가 바뀌어 실행해야 하는 effect와 그 칸 번호의 목록. 인스턴스가 가지며, effect를 실행하면 비운다. (`pendingEffects`)                   |
| effect 실행 (runEffects)| 실행 대기 목록의 cleanup을 모두 부른 뒤 effect를 모두 실행하는 단계. mount와 update의 마지막 단계다.                                                      |
| 커밋 (commit)           | 렌더링 결과를 실제 DOM에 반영하는 것. mount에서는 컨테이너에 붙이기, update에서는 Patch다.                                                               |
| 페인트 (paint)          | 브라우저가 바뀐 DOM을 화면에 그리는 것. 지금 실행 중인 JavaScript가 끝나 콜 스택이 비어야 일어난다.                                                     |

## 4. 동작 흐름

### 4.1 useEffect 호출 (등록)

useEffect는 렌더링 중 컴포넌트 함수 안에서, 매 렌더링마다 호출된다. ([FunctionComponent 4.3](function-component_requirement.md#43-렌더링-render)) useMemo와 달리 effect를 그 자리에서 실행하지 않는다.

1. `currentComponent`가 `null`이면 오류를 던진다. ([FR-T01](function-component_requirement.md#53-state-제약))
2. `hookIndex`로 자기 칸 번호(`i`)를 정하고 `hookIndex`를 1 늘린다.
3. 칸(`hooks[i]`)이 있고, 칸의 deps와 이번 deps를 의존성 비교한 결과가 "같다"이면 아무것도 하지 않고 끝낸다. ([use-memo 4.2](use-memo_requirement.md#42-의존성-비교))
4. 칸이 비어 있거나(첫 렌더링) 의존성 비교 결과가 "바뀌었다"이면, effect와 칸 번호를 실행 대기 목록에 넣는다(`pendingEffects.push({ i, effect })`).
5. 칸의 deps를 이번 deps로 바꾼다. 칸의 cleanup은 그대로 둔다. 첫 렌더링이면 cleanup이 없는 칸을 만든다(`hooks[i] = { kind: 'effect', deps, cleanup: undefined }`).

deps에 따라 effect가 실행되는 렌더링은 다음과 같다. (판단 규칙은 [FR-D](use-memo_requirement.md#52-의존성-비교))

| deps        | effect를 실행하는 렌더링         |
| ----------- | -------------------------------- |
| `[count]`   | mount, count가 바뀐 update       |
| `[]`        | mount 때만                       |
| 생략        | mount와 모든 update              |
| 길이가 바뀜 | 그 update                        |

### 4.2 effect 실행 (runEffects)

mount와 update는 DOM 반영과 `prevVNode` 갱신을 마친 뒤 이 단계를 실행한다. ([FunctionComponent 4.1의 6단계, 4.2의 9단계](function-component_requirement.md#4-동작-흐름))

```text
mount:  render → toDOM(vnode) → 컨테이너에 붙임 → prevVNode = vnode → runEffects()
update: render → diff([prevVNode], [vnode]) → patch → prevVNode = vnode → runEffects()
```

1. 실행 대기 목록을 꺼내고, 인스턴스의 목록은 빈 목록으로 바꾼다.
2. "effect 실행 중" 표시를 켠다.
3. 꺼낸 목록의 칸마다 선언 순서대로, 칸에 cleanup이 있으면 부른다.
4. 꺼낸 목록의 effect마다 선언 순서대로 실행하고, 돌려준 값이 함수이면 칸의 cleanup에 저장한다. 함수가 아니면 칸의 cleanup을 비운다.
5. "effect 실행 중" 표시를 끈다.
6. 3~4단계 동안 update가 예약됐으면 예약을 지우고 update를 한 번 실행한다. (4.3)

cleanup을 모두 부른 뒤 effect를 실행하므로, 이전 렌더링이 세운 것을 다 치운 뒤 새것을 세운다. 실행 대기 목록에 없는 effect(deps가 같은 effect)는 cleanup도 실행도 하지 않는다.

```text
count=0 (mount)  → effect: 타이머 A 시작, cleanup_A 보관
count=1 (update) → cleanup_A (A 멈춤) → effect: 타이머 B 시작, cleanup_B 보관
count=2 (update) → cleanup_B (B 멈춤) → effect: 타이머 C 시작, cleanup_C 보관
→ 타이머는 항상 하나만 돈다
```

### 4.3 effect 안의 setState

effect 실행 중에 setState가 update를 바로 부르면, 새 렌더링의 effect가 이전 렌더링의 남은 effect보다 먼저 실행된다. 그래서 effect 실행 중에는 update를 예약만 하고, effect가 다 끝난 뒤 한 번 실행한다.

```text
바로 update하면:
  runEffects
    effect₁ → setState → update → runEffects (새 렌더링의 effect 실행)
    effect₂                       ← 이전 렌더링의 effect가 뒤늦게 실행돼 새 결과를 덮어씀

예약하면:
  runEffects
    effect₁ → setState → 칸 변경, update 예약
    effect₂
  예약된 update 한 번 → render → patch → runEffects
```

1. setState가 새 값을 정하고 같은 값인지 확인해 칸을 바꾼다. ([FunctionComponent 4.2의 2~4단계](function-component_requirement.md#42-setstate와-update))
2. "effect 실행 중" 표시가 켜져 있으면 update를 예약만 하고 끝낸다. 꺼져 있으면 update를 바로 부른다.
3. 4.2의 6단계에서 예약된 update를 한 번 실행한다. 같은 effect 실행 단계에서 setState를 여러 번 불러도 update는 한 번이다.

예약된 update도 같은 콜 스택 안에서 끝나므로 페인트 전에 끝난다. 사용자는 중간 상태를 보지 않는다.

## 5. 기능 요구사항

> 확인 방법은 초안이다. 테스트 문서를 작성할 때 구체화한다.
> 비고 열의 "삭제됨"은 번호를 유지하기 위해 남긴 행이다.
> 의존성 비교는 [use-memo 5.2 (FR-D)](use-memo_requirement.md#52-의존성-비교)를 그대로 쓴다.

### 5.1 effect 등록

| ID     | 유형              | 요구사항                                                                                                                       | 확인 방법 (초안)                                                                                                                  | 비고                                   |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| FR-F01 | 항상 (Ubiquitous) | 시스템은 effect를 useEffect 호출 안에서 실행하지 않아야 한다.                                                                   | effect와 컴포넌트 함수의 `return` 직전에서 각각 순서를 기록해, 컴포넌트 함수가 먼저 기록되는지 확인                               | useMemo(FR-M06)와 반대                 |
| FR-F02 | 이벤트 (When)     | 첫 렌더링에서 useEffect가 호출되면, 시스템은 effect를 실행 대기 목록에 넣어야 한다.                                            | deps가 `[]`인 useEffect로 mount한 뒤 effect 호출 횟수가 1인지 확인                                                                 | 첫 렌더링은 칸이 비어 있는지로 판단    |
| FR-F03 | 이벤트 (When)     | 리렌더링에서 useEffect가 호출되고 의존성 비교 결과가 "바뀌었다"이면, 시스템은 effect를 실행 대기 목록에 넣어야 한다.           | deps에 있는 state를 바꿔 update한 뒤 effect 호출 횟수가 1 늘었는지 확인                                                            |                                        |
| FR-F04 | 이벤트 (When)     | 리렌더링에서 useEffect가 호출되고 의존성 비교 결과가 "같다"이면, 시스템은 effect를 실행 대기 목록에 넣지 않아야 한다.          | deps에 없는 state를 바꿔 update한 뒤 effect 호출 횟수가 그대로인지 확인                                                            |                                        |
| FR-F05 | 이벤트 (When)     | useEffect가 호출되면, 시스템은 이번 deps를 자기 칸에 저장하고 칸의 cleanup은 그대로 둬야 한다.                                 | deps가 `[count]`인 effect가 cleanup을 돌려주게 하고, deps에 없는 state를 바꿔 update한 뒤 칸의 cleanup이 같은 함수(`===`)인지 확인 | 칸 형태 `{ deps, cleanup }` (6.1)      |
| FR-F06 | 항상 (Ubiquitous) | 시스템은 useEffect가 호출될 때마다 등록 여부와 상관없이 `hookIndex`를 1 늘려야 한다.                                            | useEffect 뒤에 useState를 쓰는 컴포넌트에서, effect를 등록하지 않는 update를 여러 번 해도 useState가 자기 칸의 값을 돌려주는지 확인 | 안 늘리면 다음 Hook이 effect 칸을 씀   |
| FR-F07 | 항상 (Ubiquitous) | 시스템은 useEffect의 의존성 비교에 useMemo와 같은 규칙(FR-D)을 써야 한다.                                                       | deps 생략은 매 update마다, `[]`는 mount 때만, 길이가 바뀐 deps는 그 update에서 effect가 실행되는지 확인                            | 같은 `depsChanged`를 호출 ([use-memo 6.1](use-memo_requirement.md#61-결정된-항목)) |

### 5.2 effect 실행

| ID     | 유형              | 요구사항                                                                                                                         | 확인 방법 (초안)                                                                                                                       | 비고                                     |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| FR-F08 | 이벤트 (When)     | mount가 VNode를 컨테이너에 붙이고 `prevVNode`를 바꾸면, 시스템은 실행 대기 목록의 effect를 실행해야 한다.                          | effect 안에서 `container.querySelector`로 찾은 요소가 이번 렌더링의 DOM인지 확인                                                         | FunctionComponent 4.1의 6단계            |
| FR-F09 | 이벤트 (When)     | update가 Patch하고 `prevVNode`를 바꾸면, 시스템은 실행 대기 목록의 effect를 실행해야 한다.                                          | deps가 `[count]`인 effect에서 읽은 DOM 텍스트가 바뀐 count 값인지 확인                                                                   | FunctionComponent 4.2의 9단계            |
| FR-F10 | 항상 (Ubiquitous) | 시스템은 실행 대기 목록의 effect를 useEffect가 호출된 순서대로 실행해야 한다.                                                      | useEffect 세 개가 각자 번호를 기록하게 하고, mount 뒤 기록이 1, 2, 3 순서인지 확인                                                         |                                          |
| FR-F11 | 항상 (Ubiquitous) | 시스템은 mount나 update가 끝나기 전에 effect 실행을 마쳐야 한다.                                                                    | `mount()` 바로 다음 줄에서 effect 호출 횟수가 이미 1인지 확인 (타이머를 기다리지 않음)                                                     | 동기 실행 (6.1)                          |
| FR-F12 | 이벤트 (When)     | effect를 실행하기 시작하면, 시스템은 인스턴스의 실행 대기 목록을 비워야 한다.                                                       | effect를 등록하지 않는 update를 한 번 더 해, 이전 effect가 다시 실행되지 않는지 확인                                                       |                                          |

### 5.3 cleanup

| ID     | 유형              | 요구사항                                                                                                                          | 확인 방법 (초안)                                                                                                                                    | 비고                               |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| FR-L01 | 이벤트 (When)     | effect가 함수를 돌려주면, 시스템은 그 함수를 자기 칸의 cleanup에 저장해야 한다.                                                    | `useEffect(() => cleanup, [])`로 mount한 뒤 `hooks[0].cleanup`이 `cleanup`(`===`)인지 확인                                                           |                                    |
| FR-L02 | 이벤트 (When)     | effect가 함수가 아닌 값을 돌려주면, 시스템은 자기 칸의 cleanup을 비워야 한다.                                                       | 처음엔 cleanup을 돌려주고 다음엔 아무것도 돌려주지 않는 effect로 update를 두 번 해, 첫 cleanup이 한 번만 호출되는지 확인                               | 이미 부른 cleanup을 다시 부르지 않음 |
| FR-L03 | 이벤트 (When)     | 실행 대기 목록의 effect를 실행하기 전에 그 칸에 cleanup이 있으면, 시스템은 그 cleanup을 먼저 실행해야 한다.                         | deps가 `[count]`이고 `setInterval`을 시작하는 effect로 count를 두 번 바꾼 뒤, 가짜 타이머로 시간을 보내 타이머가 하나만 도는지 확인                    |                                    |
| FR-L04 | 항상 (Ubiquitous) | 시스템은 실행 대기 목록의 cleanup을 모두 실행한 뒤에 effect를 실행해야 한다.                                                         | 두 effect가 같은 update에서 다시 실행될 때 기록 순서가 cleanup₁, cleanup₂, effect₁, effect₂인지 확인                                                  | 실제 React와 같음 (6.1)            |
| FR-L05 | 항상 (Ubiquitous) | 시스템은 cleanup을 useEffect가 호출된 순서대로 실행해야 한다.                                                                        | FR-L04의 기록에서 cleanup₁이 cleanup₂보다 먼저인지 확인                                                                                              |                                    |
| FR-L06 | 항상 (Ubiquitous) | 시스템은 실행 대기 목록에 든 effect의 cleanup만 실행해야 한다.                                                                       | deps가 `[]`인 effect와 `[count]`인 effect를 두고 count를 여러 번 바꿔, `[]` effect의 cleanup이 한 번도 호출되지 않는지 확인                             | unmount 없음 (2.2)                 |

### 5.4 effect 안의 setState

| ID     | 유형              | 요구사항                                                                                                                          | 확인 방법 (초안)                                                                                                                                      | 비고                                        |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| FR-F13 | 상태 (While)      | effect나 cleanup을 실행하는 동안, 시스템은 setState가 칸을 바꿔도 update를 바로 실행하지 않고 예약만 해야 한다.                     | effect₁이 setState하고 effect₂가 실행 기록을 남기게 해, effect₂가 다음 렌더링의 effect보다 먼저 기록되는지 확인                                           | FR-S06의 예외 ([FunctionComponent 4.2](function-component_requirement.md#42-setstate와-update)) |
| FR-F14 | 이벤트 (When)     | effect 실행 단계가 끝났을 때 update가 예약돼 있으면, 시스템은 예약을 지우고 update를 한 번 실행해야 한다.                            | mount의 effect에서 setState를 두 번 부른 뒤, 렌더링 횟수가 2(mount 1 + update 1)이고 화면이 마지막 값인지 확인                                           | mount와 update 모두 적용                    |
| FR-F15 | 항상 (Ubiquitous) | 시스템은 effect 실행 중 예약된 update를 mount나 update가 끝나기 전에 마쳐야 한다.                                                    | `mount()` 바로 다음 줄에서 화면이 effect가 setState한 값인지 확인                                                                                       | 페인트 전에 끝남 (4.3)                      |
| FR-F16 | 오류 (If-Then)    | 만약 effect 안의 setState가 지금 값과 같은 값으로 호출되면, 시스템은 update를 예약하지 않아야 한다.                                 | mount의 effect에서 지금 값과 같은 값으로 setState한 뒤 렌더링 횟수가 1인지 확인                                                                          | 같은 값 건너뛰기 ([FR-S08](function-component_requirement.md#52-usestate)) |

## 6. 설계로 넘기는 항목

> ([#118](https://github.com/orgs/krafton-jungle-week11-12-team/discussions/118) "10. 요구사항·설계로 넘길 것")

### 6.1 결정된 항목

- 실행 시점: patch 직후 동기로 실행한다. (FR-F08, F09, F11)

  | 안             | 방법                                          | 페인트              | 결정 |
  | -------------- | --------------------------------------------- | ------------------- | ---- |
  | A. 동기        | patch 바로 뒤 `runEffects()`                  | 전                  | ✅   |
  | B. 지연        | `setTimeout(runEffects, 0)`                   | 보통 후 (보장 없음) |      |
  | C. 페인트 후   | `requestAnimationFrame` 안에서 `setTimeout`   | 후                  |      |

  - 근거: 과제 요구("커밋 후 실행")를 충족하고, 테스트를 동기로 쓸 수 있다. B · C는 effect가 실행되기 전에 다음 setState가 오면 밀린 effect를 먼저 처리하는 순서 처리가 더 필요하다.
  - 대가: effect가 오래 걸리면 페인트가 늦어진다.
  - 실제 React와의 차이: React의 useEffect는 페인트 뒤에 실행된다. 우리 동작은 `useLayoutEffect`에 가깝다.
  - 배칭을 `queueMicrotask`로 하더라도 마이크로태스크는 페인트 전에 끝나므로 결과는 같다.
- cleanup 순서: 다시 실행할 effect의 cleanup을 모두 부른 뒤 effect를 모두 실행한다. 같은 단계 안에서는 선언 순서대로다. (FR-L04, L05)
  - 근거: effect 하나씩 "cleanup → effect"로 실행하면, 메뉴가 닫히고 모달이 열리는 렌더링에서 모달 effect가 `overflow = 'hidden'`으로 스크롤을 막은 뒤 이전 메뉴의 cleanup이 `overflow = ''`로 풀어 버린다. 이전 렌더링의 것을 다 치운 뒤 새것을 세우면 이 문제가 없다.
  - 실제 React와 같은 순서다.
- unmount는 다루지 않는다. deps가 `[]`인 effect의 cleanup은 호출되지 않는다. (2.2, FR-L06)
  - 근거: 루트 컴포넌트는 한 번 mount하면 떼어 내는 API가 없다. 조건부로 빠지거나 목록에서 지워지는 자식 컴포넌트는 h가 렌더링 중에 실행하는 일반 함수라 Hook과 effect가 없고, Diff · Patch가 DOM 노드만 지운다. 페이지를 닫으면 브라우저가 모두 정리한다.
  - 테스트에서 이전 테스트의 타이머가 남는 문제는 가짜 타이머(`vi.useFakeTimers()`)로 대신한다.
- effect 안의 setState는 허용하고, effect가 다 끝난 뒤 update를 한 번 실행한다. (FR-F13~F15)
  - 근거: 바로 update하면 update 안에서 update가 불려, 새 렌더링의 effect가 이전 렌더링의 남은 effect보다 먼저 실행되고 이전 effect가 새 결과를 덮어쓴다.
  - 방법: setState가 update를 직접 부르지 않고 `scheduleUpdate()`를 거치게 한다. 배칭 자리로 쓸 함수를 같이 쓴다. ([FunctionComponent 4.2의 5단계, 6.1](function-component_requirement.md#42-setstate와-update))

  ```ts
  update() {
    // render → diff → patch → prevVNode = vnode
    this.isRunningEffects = true;
    runEffects();
    this.isRunningEffects = false;
    if (this.needsUpdate) {
      this.needsUpdate = false;
      this.update();
    }
  }

  scheduleUpdate() {
    if (this.isRunningEffects) { this.needsUpdate = true; return; }
    this.update();
  }
  ```

- effect 칸에는 `{ kind: 'effect', deps, cleanup }`을 저장한다. effect 함수는 칸이 아니라 실행 대기 목록(`{ i, effect }`)에 넣는다.
  - 근거: effect는 매 렌더링마다 새로 만들어지고, 실행할 때만 필요하다. deps는 다음 렌더링의 비교에, cleanup은 다음 실행 전 정리에 필요하므로 칸에 남긴다.

  ```ts
  function runEffects() {
    const effects = pendingEffects;
    pendingEffects = [];
    for (const { i } of effects) hooks[i].cleanup?.();                 // 1. 정리 전부
    for (const { i, effect } of effects) hooks[i].cleanup = effect();  // 2. 실행 전부
  }
  ```

  - 위 코드는 effect가 함수가 아닌 값을 돌려주면 그 값을 그대로 저장한다. 설계에서는 함수일 때만 저장하고, 아니면 `undefined`로 비운다(FR-L02). cleanup을 부른 직후에도 칸의 cleanup을 비워, effect가 오류를 던져도 이미 부른 cleanup을 다시 부르지 않는다. ([useEffect 설계](../../design/phase2/use-effect.md))
- 의존성 비교는 useMemo 문서의 `depsChanged`를 그대로 호출한다. ([use-memo 6.1](use-memo_requirement.md#61-결정된-항목))

- hooks 칸의 타입: 모든 칸을 `kind`로 구분하는 유니언으로 둔다. effect 칸은 `{ kind: 'effect', deps, cleanup }`이다. 타입 정의와 근거는 [FunctionComponent 6.1](function-component_requirement.md#61-결정된-항목)에 둔다.
- 실행 대기 목록(`pendingEffects`), "effect 실행 중" 표시(`isRunningEffects`), update 예약(`needsUpdate`)은 FunctionComponent의 인스턴스 필드로 둔다. ([FunctionComponent 설계](../../design/phase2/function-component.md))
  - 근거: hooks처럼 인스턴스마다 따로라, 테스트에서 인스턴스를 여러 개 만들어도 서로 섞이지 않는다.
  - 표시를 켜고 끄는 일과 예약된 update 실행은 FunctionComponent가 하고, `runEffects`는 cleanup과 effect 실행만 한다.

### 6.2 미정 항목

없음.

## 7. 추후 논의

- 연속 update 횟수 제한: `useEffect(() => setCount(count + 1), [count])` 같은 무한 루프를 막을지. 실제 React는 연속 update가 50번을 넘으면 오류를 던진다. 차별점 후보다.
- `unmount()` 추가: 루트를 떼어 내며 남은 cleanup을 모두 부르는 API를 둘지. 차별점 후보다.
- effect나 cleanup이 오류를 던질 때: 지금은 그대로 전파되어 남은 effect가 실행되지 않고 "effect 실행 중" 표시가 켜진 채 남을 수 있다. `try`/`finally`로 표시를 끌지 정한다.
- useState 지연 초기화: 이번 단계에서는 FR-S에 넣지 않기로 했다(2026-11-11). 저장된 값을 effect에서 불러오면(`useEffect(() => setTodos(load()), [])`) 첫 화면이 빈 목록으로 한 번 그려진다. 지연 초기화(`useState(() => load())`)는 [use-memo 7절](use-memo_requirement.md#7-추후-논의)과 같이 [FunctionComponent 요구사항의 2차 추가 기능(FR-SX01)](function-component_requirement.md#55-2차-추가-기능)으로 미뤘다.
