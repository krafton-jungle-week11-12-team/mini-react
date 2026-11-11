# Mini React Phase 2 요구사항 명세서: FunctionComponent · useState · State 제약

| 항목      | 내용                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 문서 상태 | 초안 v0.1                                                                                                                                    |
| 작성일    | 2026-11-10                                                                                                                                   |
| 수정일    | 2026-11-11 (임동호 요구사항 병합, 루트 형태 · 같은 값 건너뛰기 결정, 앱 작성 규칙 분리, scheduleUpdate 반영, 설계 반영: FR-C12)                                                                    |
| 작성자    | 오동환, 임동호                                                                                                                                       |
| 근거      | Discussions #104 (mount와 Hook의 동작 원리), #105 (App이 return한 VNode는 어디로 가는가), #106 (useState와 클로저), #107 (같은 값이면 update 건너뛰기), 임동호 컴포넌트 요구사항, 2026-11-10 코어타임                           |
| 선행 문서 | [phase1_requirement.md](../phase1/phase1_requirement.md), [h-props_requirement.md](h-props_requirement.md)                     |
| 작성 규칙 | 요구사항 문장은 EARS 형식(항상, 이벤트, 상태, 오류, 선택)을 따르고, 요구사항 하나에 동작 하나만 담는다.                                      |

---

## 1. 목표

- 컴포넌트 함수(App)를 FunctionComponent에 맡겨 처음 화면을 그리고(mount), state가 바뀌면 다시 그릴(update) 수 있게 한다.
- update는 Phase 1의 Diff와 Patch로 바뀐 노드만 실제 DOM에 반영한다.
- useState로 state를 컴포넌트 함수 바깥(인스턴스)에 보관해, 리렌더링 뒤에도 값이 유지되게 한다.

## 2. 범위

### 2.1 포함

- 컴포넌트 정의 (props를 받아 VNode를 돌려주는 함수, 루트 하나와 자식으로 페이지 구성)
- FunctionComponent
  - 생성 (컴포넌트 함수, props, 컨테이너 보관)
  - render (컴포넌트 함수를 실행해 VNode 얻기)
  - mount (처음 그리기)
  - update (다시 그리기)
- useState
  - hooks 배열, hookIndex, currentComponent
  - setState (값으로 바꾸기, 함수형 업데이트, 같은 값 건너뛰기)
- State 제약 (시스템이 지킨다)
  - 렌더링 밖 Hook 호출 막기
  - setState로만 update하기
- 앱 작성 규칙 (앱 코드가 지킨다)
  - 컴포넌트를 props 하나를 받는 함수로 작성하기
  - 루트 컴포넌트 하나와 자식 컴포넌트로 페이지 구성하기
  - state를 루트 컴포넌트에만 두기
  - 루트가 자식에게 값과 state를 바꾸는 함수를 props로 넘기기
  - 자식 컴포넌트를 순수 함수로 두기
  - mount는 한 번만 호출하고 update는 직접 호출하지 않기

### 2.2 제외

| 제외 항목                         | 이유                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| h 함수, props 처리                | [h-props_requirement.md](h-props_requirement.md)에서 다룬다.                                   |
| useMemo                           | [use-memo_requirement.md](use-memo_requirement.md)에서 다룬다.                                 |
| useEffect, effect 실행            | [use-effect_requirement.md](use-effect_requirement.md)에서 다룬다. 이 문서는 mount, update 흐름에서 effect를 실행하는 자리만 정한다. |
| 자식 컴포넌트의 state             | h가 자식 컴포넌트를 바로 실행하므로 자식은 props만 받는 순수 함수로 둔다. (5.4절)                            |
| 조건문 · 반복문 안의 Hook 호출    | Hook은 호출 순서로 칸을 찾으므로, 순서가 바뀌는 호출은 지원하지 않는다.                                       |
| 자식 컴포넌트 직접 호출 (`PostCard(props)`) | 자식 컴포넌트는 `h(PostCard, props)`로만 호출해, 모든 노드를 h 하나로 만든다. ([h-props FR-H06](h-props_requirement.md)) |

## 3. 용어

> 컴포넌트와 노드(VNode)는 서로 다른 것이다. 컴포넌트는 VNode를 만드는 함수이고, VNode는 그 결과물인 객체다. "자식 컴포넌트", "자식 노드"처럼 뒤의 말까지 함께 쓴다.
>
> Phase 1 용어는 [phase1_requirement.md 3절](../phase1/phase1_requirement.md#3-용어), h 함수 · props 용어는 [h-props_requirement.md 3절](h-props_requirement.md#3-용어)을 따른다.

| 용어                  | 뜻                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 컴포넌트 함수         | props를 받아 VNode를 돌려주는 함수. (예: `App`)                                                                      |
| 루트 컴포넌트         | FunctionComponent에 맡긴 컴포넌트 함수. state를 가질 수 있는 유일한 컴포넌트다.                                     |
| FunctionComponent     | 컴포넌트 함수를 맡아 실행 시점을 정하고, state와 이전 VNode를 보관하는 인스턴스. `new FunctionComponent(App, props, container)`로 만든다. |
| 컨테이너              | 루트 컴포넌트가 돌려준 VNode를 붙이는 실제 DOM 요소. VNode 트리 바깥에 있다. (Phase 1 영역 컨테이너와 같은 역할)    |
| 렌더링 (render)       | 컴포넌트 함수를 실행해 새 VNode를 얻는 것. 화면은 바꾸지 않는다.                                                    |
| mount                 | 처음 화면을 그리는 것. VNode를 DOM으로 만들어 컨테이너에 붙인다.                                                     |
| update                | state가 바뀐 뒤 다시 그리는 것. 이전 VNode와 새 VNode를 Diff로 비교해 Patch한다.                                     |
| prevVNode             | 지금 화면을 그린 VNode. 다음 update에서 Diff의 비교 기준이 된다.                                                     |
| hooks 배열            | state를 컴포넌트 함수 바깥(인스턴스)에 보관하는 배열. Hook마다 한 칸을 쓰고, 칸에는 어느 Hook의 칸인지 나타내는 `kind`를 함께 저장한다. (예: `{ kind: 'state', value: 0 }`)                                         |
| hookIndex             | 다음 Hook이 쓸 칸 번호. Hook이 호출될 때마다 1씩 늘고, 렌더링을 시작할 때 0으로 되돌린다.                             |
| currentComponent      | 지금 렌더링 중인 FunctionComponent를 가리키는 전역 변수. Hook이 어느 인스턴스의 hooks 배열을 쓸지 찾는 데 쓴다.     |
| 함수형 업데이트       | setState에 값 대신 함수(`prev => prev + 1`)를 넘기는 것. setState가 실행되는 순간의 state 값으로 계산한다.          |
| stale closure         | 핸들러가 렌더링 당시 복사한 옛날 state 값을 보는 문제                                                                |
| 컴포넌트 트리         | 어느 컴포넌트가 어느 컴포넌트를 호출하는지 나타낸 구조. 설명용 개념이며 객체로 만들지 않는다. VNode 트리에는 컴포넌트가 남지 않는다. |

## 4. 동작 흐름

### 4.1 생성과 mount

1. `main.ts`에서 `new FunctionComponent(App, props, container)`로 인스턴스를 만든다. 이때 App은 실행하지 않고 보관만 한다.
2. `main.ts`에서 `mount()`를 한 번 부른다.
3. 렌더링한다. (4.3)
4. 받은 VNode를 DOM으로 만들어 컨테이너의 자식으로 붙인다. 컨테이너에 원래 내용이 있으면 비우고 붙인다.
5. `prevVNode`에 4단계의 VNode를 넣는다.
6. effect를 실행한다. ([useEffect 문서](use-effect_requirement.md))

### 4.2 setState와 update

1. 사용자 동작(클릭, 입력)으로 핸들러가 setState를 부른다.
2. setState가 새 값을 정한다. 함수를 넘겼으면 그 순간의 `hooks[i].value`로 함수를 실행한 결과가 새 값이다.
3. 새 값이 지금 값(`hooks[i].value`)과 `Object.is`로 같으면 칸을 바꾸지 않고 여기서 끝낸다. (6절)
4. setState가 자기 칸의 값(`hooks[i].value`)을 새 값으로 바꾼다.
5. setState가 `scheduleUpdate()`를 부른다. effect 실행 중이 아니면 `update()`를 바로 부르고, effect 실행 중이면 update를 예약만 한다. 예약된 update는 effect가 다 끝난 뒤 한 번 실행한다. ([useEffect 4.3](use-effect_requirement.md#43-effect-안의-setstate)) (배칭은 미정, 6절)
6. 렌더링한다. (4.3)
7. `prevVNode`와 새 VNode를 각각 `[ ]`로 감싸 Diff로 비교하고(`diff([prevVNode], [vnode])`), 그 결과로 컨테이너 안의 바뀐 노드만 Patch한다(`patch(container, result)`). (루트 형태, 6절)
8. `prevVNode`를 새 VNode로 바꾼다.
9. effect를 실행한다. ([useEffect 문서](use-effect_requirement.md))

### 4.3 렌더링 (render)

1. `hookIndex`를 0으로 되돌린다.
2. `currentComponent`가 이 인스턴스를 가리키게 한다.
3. 보관한 컴포넌트 함수를 `fn(props)`로 실행한다. 이 동안 useState가 호출 순서대로 `hooks[0]`, `hooks[1]`, …을 쓴다.
4. `currentComponent`를 `null`로 되돌리고, 3단계에서 받은 VNode를 돌려준다. 3단계가 오류를 던져도 `currentComponent`는 `null`로 되돌린다. (FR-C12)

## 5. 기능 요구사항

> 확인 방법은 초안이다. 테스트 문서를 작성할 때 구체화한다.
> 비고 열의 "삭제됨"은 번호를 유지하기 위해 남긴 행이다.
> 비고 열의 "미정"은 6절의 결정에 따라 요구사항이 바뀔 수 있다는 뜻이다.
> 5.1~5.3은 시스템(라이브러리)이 지킬 요구사항이고 단위 테스트로 확인한다. 5.4는 라이브러리로 앱을 만드는 코드가 지킬 규칙이고 코드 리뷰와 예제 앱으로 확인한다. ([Phase 1](../phase1/phase1_requirement.md)의 5.1 엔진, 5.2 웹 페이지 구분과 같다.)

### 5.1 FunctionComponent

| ID     | 유형              | 요구사항                                                                                                                        | 확인 방법 (초안)                                                                                                       | 비고                     |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| FR-C01 | 이벤트 (When)     | FunctionComponent를 만들면, 시스템은 컴포넌트 함수, props, 컨테이너를 보관하고 컴포넌트 함수는 실행하지 않아야 한다.             | 호출 횟수를 세는 컴포넌트 함수로 인스턴스를 만든 직후 호출 횟수가 0인지 확인                                            |                          |
| FR-C02 | 이벤트 (When)     | mount가 호출되면, 시스템은 렌더링해서 받은 VNode를 DOM으로 만들어 컨테이너의 자식으로 붙여야 한다.                               | mount 후 컨테이너의 자식이 컴포넌트 함수가 돌려준 루트 VNode 하나이고, 그 아래 트리가 VNode와 같은지 확인               |                          |
| FR-C03 | 이벤트 (When)     | 컨테이너에 원래 내용이 있을 때 mount가 호출되면, 시스템은 원래 내용을 지우고 붙여야 한다.                                        | 자식이 있는 컨테이너에 mount한 뒤 원래 자식이 남아 있지 않은지 확인                                                    |                          |
| FR-C04 | 이벤트 (When)     | update가 호출되면, 시스템은 렌더링해서 받은 새 VNode를 `prevVNode`와 Diff로 비교해 바뀐 노드만 Patch해야 한다.                  | update 전후로 바뀌지 않은 노드가 같은 DOM 객체(`===`)로 유지되는지 확인 (Phase 1 FR-E04와 같은 방법)                    | 루트 형태 결정 (6절)     |
| FR-C05 | 이벤트 (When)     | mount나 update가 DOM 반영을 마치면, 시스템은 `prevVNode`를 이번에 렌더링한 VNode로 바꿔야 한다.                                  | 빈 목록 → `[A]` → `[A, B]`로 두 번 update한 뒤 화면에 A가 한 번만 있는지 확인                                          |                          |
| FR-C06 | 이벤트 (When)     | 렌더링을 시작하면, 시스템은 `hookIndex`를 0으로 되돌려야 한다.                                                                   | useState를 두 번 쓰는 컴포넌트를 여러 번 update해도 두 state가 초기화되지 않는지 확인                                   |                          |
| FR-C07 | 상태 (While)      | 컴포넌트 함수를 실행하는 동안, 시스템은 `currentComponent`가 이 인스턴스를 가리키게 해야 한다.                                    | 컴포넌트 함수 안에서 읽은 `currentComponent`가 그 인스턴스인지 확인                                                    |                          |
| FR-C08 | 이벤트 (When)     | 컴포넌트 함수 실행이 끝나면, 시스템은 `currentComponent`를 `null`로 되돌려야 한다.                                               | mount 후 `currentComponent`가 `null`인지 확인                                                                          |                          |
| FR-C09 | -                 | (삭제됨)                                                                                                                        | -                                                                                                                      | 삭제됨: 막지 않기로 결정 (6.1). 대체: FR-A12 |
| FR-C10 | -                 | (삭제됨)                                                                                                                        | -                                                                                                                      | 삭제됨: 막지 않기로 결정 (6.1). 대체: FR-A12 |
| FR-C11 | 항상 (Ubiquitous) | FunctionComponent는 hooks 배열을 인스턴스 필드로 가져야 한다.                                                                    | 생성 직후 인스턴스에 빈 hooks 배열이 있는지 확인                                                                       | 임동호 요구사항에서 추가 |
| FR-C12 | 오류 (If-Then)    | 만약 컴포넌트 함수가 실행 중 오류를 던지면, 시스템은 `currentComponent`를 `null`로 되돌린 뒤 그 오류를 그대로 전파해야 한다.     | 오류를 던지는 컴포넌트로 mount해 오류가 나는지, 그 뒤 `currentComponent`가 `null`이고 useState 직접 호출이 FR-T01 오류를 내는지 확인 | 설계 반영 ([FunctionComponent 설계](../../design/phase2/function-component.md)) |

### 5.2 useState

| ID     | 유형              | 요구사항                                                                                                                   | 확인 방법 (초안)                                                                                                       | 비고                                  |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| FR-S01 | 이벤트 (When)     | 첫 렌더링에서 useState가 호출되면, 시스템은 비어 있는 자기 칸에 초깃값을 저장하고 그 값을 돌려줘야 한다.                    | `useState(0)`이 첫 렌더링에서 0을 돌려주고 `hooks[0]`이 `{ kind: 'state', value: 0 }`인지 확인                                                     |                                       |
| FR-S02 | 이벤트 (When)     | 리렌더링에서 useState가 호출되면, 시스템은 초깃값을 무시하고 자기 칸에 저장된 값을 돌려줘야 한다.                           | setState(5) 뒤 리렌더링에서 `useState(0)`이 5를 돌려주는지 확인                                                         |                                       |
| FR-S03 | 항상 (Ubiquitous) | 시스템은 한 렌더링 안에서 useState가 호출된 순서대로 칸을 나눠 줘야 한다.                                                   | `count`, `text` 두 state를 쓰는 컴포넌트에서 한쪽을 바꿔도 다른 쪽 값이 그대로인지 확인                                  |                                       |
| FR-S04 | 이벤트 (When)     | 값을 넘겨 setState가 호출되면, 시스템은 자기 칸을 그 값으로 바꿔야 한다.                                                    | `setText('')` 뒤 `hooks[i].value`가 `''`인지 확인                                                                            |                                       |
| FR-S05 | 이벤트 (When)     | 함수를 넘겨 setState가 호출되면, 시스템은 그 순간 자기 칸의 값을 인자로 함수를 실행하고, 결과로 칸을 바꿔야 한다.           | 한 핸들러에서 `setCount(prev => prev + 1)`을 두 번 부르면 2가 되는지 확인. 같은 자리에서 `setCount(count + 1)`을 두 번 부르면 1이 되는 것과 비교 | stale closure 대응                    |
| FR-S06 | 이벤트 (When)     | setState가 칸을 바꾸면, 시스템은 update를 실행해야 한다.                                                                     | 버튼 클릭으로 setState를 부른 뒤 화면의 값이 바뀌는지 확인                                                             | 배칭 미정 (6절). effect 실행 중이면 예약 ([use-effect FR-F13, F14](use-effect_requirement.md#54-effect-안의-setstate)) |
| FR-S07 | 항상 (Ubiquitous) | 시스템은 렌더링이 끝난 뒤(`currentComponent`가 `null`인 때) 호출된 setState도 자기 인스턴스의 자기 칸을 바꿔야 한다.        | mount 후 클릭 핸들러에서 setState를 불러 해당 칸이 바뀌는지 확인                                                       | setState가 인스턴스와 칸 번호를 클로저로 기억 |
| FR-S08 | 오류 (If-Then)    | 만약 setState에 넘긴 값(함수를 넘겼으면 그 실행 결과)이 지금 값과 `Object.is`로 같으면, 시스템은 칸을 바꾸지 않고 update를 실행하지 않아야 한다. | 렌더링 횟수를 세는 컴포넌트에서 지금 값과 같은 값, 같은 값을 돌려주는 함수, state가 `NaN`일 때 `NaN`으로 각각 setState해 렌더링 횟수가 늘지 않는지 확인 | 6.1 같은 값 건너뛰기 (#107) |

### 5.3 State 제약

| ID     | 유형              | 요구사항                                                                                                          | 확인 방법 (초안)                                                                                           | 비고 |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| FR-T01 | 오류 (If-Then)    | 만약 렌더링 밖(`currentComponent`가 `null`인 때)에서 Hook이 호출되면, 시스템은 오류를 던져야 한다.               | mount 전과 mount 후에 useState를 직접 호출하면 오류가 나는지 확인                                          |      |
| FR-T02 | 항상 (Ubiquitous) | 시스템은 setState가 호출될 때만 update를 실행해야 한다.                                                            | 핸들러에서 state 변수를 직접 바꾸거나 배열에 `push`해도 화면이 바뀌지 않는지 확인                           | 그래서 state는 setState로만 바꾼다 (#106) |
| FR-T03 | 오류 (If-Then)    | 만약 Hook이 자기 칸에서 다른 Hook의 `kind`를 가진 칸을 꺼내면, 시스템은 오류를 던져야 한다.                              | useState를 조건문 안에 두어 두 번째 렌더링에서 호출 순서가 바뀌게 한 뒤, 칸이 어긋날 때 오류가 나는지 확인 | 칸 타입 결정(6.1)에 따라 추가 |

### 5.4 앱 작성 규칙

> 라이브러리로 앱을 만드는 코드가 지킬 규칙이다. 시스템은 이 규칙을 검사하지 않지만, 규칙을 어기면 시스템이 의도대로 동작하지 않는다. (예: 자식 컴포넌트에서 Hook을 부르면 루트 컴포넌트의 칸을 차지한다. 7절)

| ID     | 유형              | 요구사항                                                                                                          | 확인 방법 (초안)                                                                                           | 비고 |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| FR-A01 | 항상 (Ubiquitous) | 컴포넌트는 props 객체 하나를 받는 함수로 작성해야 한다.                                                            | 각 컴포넌트가 인자 하나(props)를 받는 함수인지 코드 리뷰로 확인                                              | 임동호 요구사항에서 추가 |
| FR-A02 | 항상 (Ubiquitous) | 컴포넌트는 함수 컴포넌트로만 작성해야 하며, 클래스 컴포넌트를 쓰면 안 된다.                                         | 컴포넌트 정의에 `class`가 없는지 코드 리뷰로 확인. FunctionComponent는 컴포넌트가 아니라 컴포넌트를 맡아 실행하는 인스턴스다 | 임동호 요구사항에서 추가 |
| FR-A03 | 항상 (Ubiquitous) | 앱은 페이지를 루트 컴포넌트 하나와 그 아래 자식 컴포넌트를 조립해 구성해야 한다.                                    | `main.ts`에서 FunctionComponent를 하나만 만드는지 확인                                                     | 임동호 요구사항에서 추가 |
| FR-A04 | 항상 (Ubiquitous) | 루트 컴포넌트는 페이지 전체를 담은 VNode 트리 하나를 돌려줘야 한다.                                                 | 렌더링 결과가 VNode 하나이고, 자식 컴포넌트가 돌려준 VNode가 모두 그 아래에 있는지 확인                      | 임동호 요구사항에서 추가 |
| FR-A05 | 항상 (Ubiquitous) | state는 루트 컴포넌트에만 둬야 하며, 자식 컴포넌트는 Hook을 호출하면 안 된다.                                       | 예제 앱의 자식 컴포넌트에 Hook 호출이 없는지 확인                                                          |      |
| FR-A06 | 항상 (Ubiquitous) | 자식 컴포넌트는 받은 props로만 화면 구조를 정해, 같은 props에는 항상 같은 모양의 VNode를 돌려줘야 한다. (예: `h(PostCard, { title: 'A' })`는 제목 `'A'`가 든 VNode를 돌려준다.) | 자식 컴포넌트마다 고정된 props(예: `{ title: 'A' }`)로 두 번 실행해, 두 결과 VNode의 `tag`, `props`, `children`이 서로 같고 미리 적어 둔 값과도 같은지 확인 | 순수 함수 조건. 임동호 요구사항에서 추가 |
| FR-A07 | 항상 (Ubiquitous) | 자식 컴포넌트는 함수 바깥의 값을 바꾸면 안 된다.                                                                  | 자식 컴포넌트 호출 전후로 전역 값이 바뀌지 않는지 확인                                                     | 순수 함수 조건. 임동호 요구사항에서 추가 |
| FR-A08 | 항상 (Ubiquitous) | 자식 컴포넌트는 실제 DOM을 직접 수정하면 안 된다.                                                                 | 자식 컴포넌트 호출 전후로 실제 DOM이 바뀌지 않는지 확인                                                    | 순수 함수 조건. 임동호 요구사항에서 추가 |
| FR-A09 | 이벤트 (When)     | 루트 컴포넌트가 자식 컴포넌트를 호출하면, 루트 컴포넌트는 자식이 그리는 데 필요한 값을 props로 넘겨야 한다.      | 자식 컴포넌트가 받은 props와 루트의 state 값이 같은지 확인                                                 | 임동호 요구사항에서 추가 |
| FR-A10 | 이벤트 (When)     | 자식 컴포넌트에서 state를 바꿀 사용자 동작이 필요하면, 루트 컴포넌트는 state를 바꾸는 함수를 props로 넘겨야 한다. | 버튼이 있는 자식 컴포넌트의 props에 함수가 들어 있는지 확인                                                | 임동호 요구사항에서 추가 |
| FR-A11 | 이벤트 (When)     | 자식 컴포넌트의 요소에서 사용자 이벤트가 생기면, 자식 컴포넌트는 props로 받은 함수를 호출해 부모에 알려야 한다.   | 테스트용 함수를 props로 넘기고 버튼을 클릭했을 때 그 함수가 한 번 호출되는지 확인                          | 핸들러 등록은 [h-props FR-P01](h-props_requirement.md). 임동호 요구사항에서 추가 |
| FR-A12 | 항상 (Ubiquitous) | 앱은 `main.ts`에서 mount를 한 번만 호출해야 하며, update를 직접 호출하면 안 된다.                                              | `main.ts`에서 mount 호출이 한 번이고, 앱 코드에 `update()` 직접 호출이 없는지 코드 리뷰로 확인                    | FR-C09, C10 대체 (6.1) |

## 6. 설계로 넘기는 항목

> ([#104](https://github.com/orgs/krafton-jungle-week11-12-team/discussions/104) "7. 정할 것")

### 6.1 결정된 항목

- 루트 형태: update에서 VNode 하나를 `[vnode]`로 감싸 Phase 1 diff(`VNode[]`)에 그대로 넘긴다. Phase 1 diff, patch는 고치지 않는다.
  - 근거: Phase 1은 컨테이너 자신을 비교하지 않고 컨테이너의 자식 목록끼리 비교한 뒤, 그 결과를 `patch(container, result)`로 컨테이너의 자식에 적용한다. 컴포넌트 함수가 돌려준 VNode는 컨테이너의 자식 하나이므로, `[vnode]`가 Phase 1의 자식 목록과 같은 층이다.
  - 고려한 다른 선택지: diff가 VNode 하나도 받게 고치기, Phase 1의 루트를 컨테이너로 바꾸기. 둘 다 Phase 1 코드를 고쳐야 한다. 특히 루트를 컨테이너로 바꾸면 실제 영역과 테스트 영역 컨테이너의 `id`가 달라 Patch 때마다 실제 영역 컨테이너의 `id`가 바뀌고, patch에 컨테이너의 부모를 넘겨야 해서 위치가 어긋난다.
- 같은 값 건너뛰기: setState에 넘긴 값이 지금 값과 `Object.is`로 같으면 hooks에 쓰지 않고 update도 부르지 않는다. ([#107](https://github.com/orgs/krafton-jungle-week11-12-team/discussions/107))
  - 함수를 넘겼으면 먼저 실행해 새 값을 계산한 뒤 비교한다.
  - 근거: 같은 값으로 다시 렌더링하면 Diff 결과가 비어 화면이 바뀌지 않으므로, 렌더링과 Diff 비용만 든다. `===` 대신 `Object.is`를 써서 state가 `NaN`일 때도 같은 값으로 본다.
  - 주의: 배열·객체는 참조로 비교하므로, 직접 고친 뒤 같은 객체를 넘기면 update가 생략된다. 새 배열·객체를 만들어 넘긴다.
- mount 두 번 호출, mount 전 update 호출: 시스템이 막지 않는다. 앱 작성 규칙(FR-A12)으로 둔다. FR-C09, C10은 삭제한다.
  - 근거: 두 경우 모두 정상 경로로는 생기지 않는다. update를 부르는 것은 setState뿐이고, setState는 렌더링 중 useState가 돌려주며(FR-T01), 첫 렌더링은 mount 안에서 일어난다. 그래서 setState가 있으면 이미 mount된 뒤다. mount는 `main.ts`에서 한 번만 부른다(4.1). 앱 코드가 API를 직접 잘못 부를 때만 생기므로 앱 작성 규칙에서 다룬다.
  - 대가: 규칙을 어기면 `prevVNode`가 없어 Diff나 Patch에서 원인을 알기 어려운 오류가 난다. 부르는 곳이 `main.ts` 한 곳이라 감수한다.
- update 예약: setState는 `update()`를 직접 부르지 않고 `scheduleUpdate()`를 거친다. ([use-effect 6.1](use-effect_requirement.md#61-결정된-항목), [#121](https://github.com/orgs/krafton-jungle-week11-12-team/discussions/121))
  - effect 실행 중이 아니면 `update()`를 바로 부른다. effect 실행 중이면 예약만 하고, effect가 다 끝난 뒤 update를 한 번 실행한다.
  - 근거: effect 실행 중에 update를 바로 부르면 update 안에서 update가 불려, 새 렌더링의 effect가 이전 렌더링의 남은 effect보다 먼저 실행된다.
  - 배칭을 넣을 때도 이 함수만 고친다. (6.2)

- hooks 칸의 타입: 모든 칸을 `kind`로 구분하는 유니언으로 둔다. ([use-memo 6.1](use-memo_requirement.md#61-결정된-항목))

  ```ts
  type HookSlot =
    | { kind: 'state'; value: unknown }
    | { kind: 'memo'; value: unknown; deps: unknown[] | undefined }
    | { kind: 'effect'; deps: unknown[] | undefined; cleanup: (() => void) | undefined };
  hooks: HookSlot[] = [];
  ```

  - 근거: 한 배열에 모양이 다른 칸이 섞여도, `kind`를 확인하면 TypeScript가 칸의 모양을 정확히 알아 실수를 잡아 준다. 호출 순서가 바뀌어 칸이 어긋나면 `kind`가 맞지 않아 바로 알아챌 수 있다. (FR-T03)
  - 고려한 다른 선택지: `unknown[]`로 두고 Hook마다 꺼낼 때 단언(`as`)한다. 코드는 짧지만, 칸이 어긋나도 TypeScript와 시스템 모두 알아채지 못한다.
  - 대가: useState 칸이 값 그대로가 아니라 `{ kind: 'state', value }`가 되어, 칸의 값을 읽을 때 `.value`를 거쳐야 한다.

### 6.2 미정 항목

- 배칭: 지금은 effect 실행 중이 아니면 setState마다 `update()`를 바로 부른다. 어느 쪽이든 `scheduleUpdate()` 안에서 정한다. ([#121](https://github.com/orgs/krafton-jungle-week11-12-team/discussions/121))
  - setState마다 바로 update한다.
  - `queueMicrotask`로 모아 한 번만 update한다.

## 7. 추후 논의

- 자식 컴포넌트에서 Hook을 호출했을 때 감지할지: h가 자식 컴포넌트를 루트의 렌더링 도중 실행하므로, 지금 구조로는 자식의 Hook 호출이 루트의 칸을 조용히 차지한다.
