# 페이지 구성 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #93

## 개요

페이지 구성은 첫 화면(`index.html`)과 할 일 앱 페이지(`phase2.html`)를 잇고, 할 일 앱의 진입점 `main.ts`에서 루트 컴포넌트를 한 번 mount해요. 이 문서를 읽으면 두 HTML 파일에 무엇을 두는지, `src/phase2/page/main.ts`가 어떤 순서로 앱을 시작하는지 알고 그대로 구현할 수 있어요.

## 다루는 요구사항

| ID      | 요구사항 요약                                                          | 이 문서에서 다루는 곳        |
| ------- | ---------------------------------------------------------------------- | ---------------------------- |
| FR-AP01 | 첫 화면이 로드되면 Phase 1 검증 페이지와 할 일 앱으로 가는 링크를 보여 줘요 | 자료구조, 동작 방식          |
| FR-AP02 | 할 일 앱 페이지는 첫 화면으로 돌아가는 링크를 가져요                       | 자료구조, 설계 결정, 경계 케이스 |

## 위치와 흐름

```text
index.html(링크) → phase2.html → main.ts(new FunctionComponent, mount) → App
```

- 입력을 주는 곳: 브라우저의 페이지 로드. `phase2.html`의 `<script type="module">`이 `main.ts`를 실행해요.
- 출력을 받는 곳: [FunctionComponent](function-component.md)의 `mount()`. 루트 컴포넌트는 [할 일 앱 루트 컴포넌트](todo-app.md)의 `App`이에요.

## 자료구조

새 타입은 없어요. 두 HTML 파일의 모양만 정해요.

```text
index.html
  main
    h1  "Double D · Mini React"
    ul
      li > a[href="./phase1.html"]  Phase 1 검증 페이지
      li > a[href="./phase2.html"]  Phase 2 할 일 앱

phase2.html
  div#app                          ← mount가 이 안을 모두 바꿔요
  p > a[href="./index.html"]       ← #app 바깥
  script[type=module][src="/src/phase2/page/main.ts"]
```

- `#app` — 할 일 앱을 붙일 컨테이너. 스크립트가 실행되기 전에 보일 안내 문구를 넣어 둬요. mount가 지워요. (예: `<p>할 일 앱을 준비하고 있어요.</p>`)
- `a[href="./index.html"]` — 첫 화면으로 돌아가는 링크. `#app`의 형제로 둬요. (FR-AP02)
- 링크 주소는 `./`로 시작하는 상대 경로예요. GitHub Pages의 `/mini-react/` 아래에서도 열려요. (예: `./phase2.html`)

## 인터페이스

없음. `main.ts`는 import되지 않고 페이지가 실행하는 진입점이라 밖에서 부르는 함수가 없어요.

## 동작 방식

### 첫 화면

1. `index.html`은 스크립트 없이 링크 두 개만 보여 줘요. (FR-AP01)

### 할 일 앱 페이지 (`src/phase2/page/main.ts`)

1. `./style.css`를 import해요. (모양은 [화면 스타일 설계](style.md))
2. `document.getElementById('app')`로 컨테이너를 찾아요.
3. `new FunctionComponent(App, {}, container)`로 인스턴스를 하나 만들어요.
4. `mount()`를 한 번 불러요. 이 뒤로 화면은 setState만 바꿔요. ([FR-A12](../../requirements/phase2/function-component_requirement.md#54-앱-작성-규칙))

예시:

```text
입력: phase2.html 로드, localStorage 비어 있음
출력: #app 안의 안내 문구가 지워지고 App이 그린 div.todo-app 하나가 붙어요.
      "처음으로" 링크는 #app 바깥이라 그대로 남아요. 탭 제목은 "할 일 (0) · Double D"가 돼요.
```

## 설계 결정

| 결정                                                                 | 이유                                                                                                         | 관련 ADR |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 할 일 앱 진입점은 `src/phase2/page/main.ts`로 한다                       | [스킬 목록의 폴더 구조](../../../.claude/skills/README.md)와 `vite.config.ts` 주석이 화면 코드를 `page/`에 두기로 했어요. Phase 1(`src/phase1/page/main.ts`)과도 같아요 | -        |
| 첫 화면으로 가는 링크는 `#app` 바깥에 둔다                              | mount는 `replaceChildren`으로 컨테이너 안을 모두 바꿔요. 안에 두면 링크가 지워져요                               | -        |
| 엔진 모듈을 import하는 곳은 `main.ts`와 컴포넌트 파일뿐이다              | `main.ts`는 `FunctionComponent`만, 컴포넌트 파일은 `h`와 Hook만 가져와요. 앱 코드가 `diff`, `patch`를 직접 부르지 않아요 | -        |
| `index.html`은 바꾸지 않는다                                            | PR #136에서 링크 두 개를 이미 만들었어요. 꾸밈은 요구사항 7절 추후 논의예요                                      | -        |

## 경계 케이스

| 경우                         | 입력 예시                                | 기대 동작                                                         | 관련 요구사항 |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------- | ------------- |
| 스크립트 실행 전             | 느린 네트워크에서 `phase2.html` 로드       | `#app`의 안내 문구와 "처음으로" 링크가 보여요                      | FR-AP02       |
| mount 뒤                     | `app.mount()`                            | 안내 문구만 지워지고 "처음으로" 링크는 남아요                      | FR-AP02       |
| 하위 경로 배포               | `https://…/mini-react/index.html`        | `./phase2.html`이 `/mini-react/phase2.html`로 열려요               | FR-AP01       |

## 검증 방법

- 단위 테스트: 없음. 페이지 연결은 HTML 파일이라 화면에서 확인해요. 앱이 그리는 네 영역(FR-AP03)은 [자식 컴포넌트 설계](todo-components.md)에서 확인해요.
- 검증 페이지: `npm run build` 뒤 `npm run preview`로 첫 화면을 열어 두 링크가 각 페이지를 여는지(FR-AP01), 할 일 앱의 "처음으로" 링크가 첫 화면을 여는지(FR-AP02) 확인해요. 배포한 GitHub Pages에서도 한 번 더 확인해요.

## 관련 문서

- [요구사항 명세서: 할 일 앱](../../requirements/phase2/app_requirement.md)
- [할 일 앱 루트 컴포넌트 설계](todo-app.md), [할 일 앱 자식 컴포넌트 설계](todo-components.md)
- [FunctionComponent 설계](function-component.md)
