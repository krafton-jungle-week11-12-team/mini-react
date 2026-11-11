# 스킬 목록

이 저장소의 스킬과 쓰는 순서를 정리해요. 이 문서를 읽으면 어떤 스킬을 언제 부르고, 각 스킬이 어떤 파일을 고치는지 알 수 있어요.

스킬을 새로 만들거나 고치면 아래 표도 함께 고쳐요. 작성 규칙은 [스킬 작성 규칙](../rules/skill-writing.md)을 따라요.

## 스킬

| 명령어 | 하는 일 | 고치는 파일 | 읽고 보고만 하는 파일 |
| ------ | ------- | ----------- | --------------------- |
| `/design-doc <phase> [모듈 이름]` | 요구사항 문서가 완성됐는지 확인하고, 모듈별 설계 문서를 쓴 뒤 연결성을 검증해요. 사용자가 고르면 설계에서 바뀐 점을 요구사항에 반영해요. | `docs/design/`, `docs/requirements/<phase>/` (7단계에서 사용자가 고를 때만) | `docs/adr/`, `src/` |
| `/doc-check <phase>` 또는 `/doc-check <문서 경로...>` | 요구사항, 설계, ADR, 테스트 케이스, 스킬을 포함한 모든 문서가 템플릿 형식을 지키는지와 문서끼리 맞는지 검증해요. 경로를 주면 그 문서만 검증해요. | 없음 | `docs/`, `.claude/skills/`, `src/` |
| `/make-testcase <phase> [요구사항 문서 경로 또는 ID]` | 요구사항과 설계 문서를 확인해 vitest 테스트 코드를 바로 쓰고, 추가하면 좋을 케이스를 물어 반영해요. 테스트 문서는 만들지 않아요. Claude도 알아서 불러요. | `src/**/*.test.ts` | `docs/requirements/`, `docs/design/`, `docs/adr/`, 테스트가 아닌 `src/` |
| `/implement-tc <phase> [테스트 파일 경로 또는 요구사항 ID]` | 실패하는 테스트를 테스트는 고치지 않고 구현 코드만 바꿔 하나씩 통과시켜요. (1차 구현) Claude도 알아서 불러요. | 테스트가 아닌 `src/` | `src/**/*.test.ts`, `docs/requirements/`, `docs/design/`, `docs/adr/` |
| `/implement-design <phase> [설계 문서 경로]` | 통과한 테스트를 지키면서 ADR, 요구사항, 설계를 모두 확인해 구현을 최종 형태로 고치고, 마지막에 `test-final`을 자동으로 따라요. (2차 구현) Claude도 알아서 불러요. | 테스트가 아닌 `src/` | `src/**/*.test.ts`, `docs/requirements/`, `docs/design/`, `docs/adr/` |
| `/test-final <phase>` | 모든 구현이 끝난 Phase의 테스트·타입 검사·빌드, 요구사항 ID별 테스트·구현 연결, 설계·ADR 반영, 문서 정합성, 검증 페이지를 확인하고 최종 판정을 보고해요. 구현이 끝나지 않았으면 멈춰요. `/implement-design` 끝에 자동으로 실행되고, Claude도 알아서 불러요. | 없음 | `src/`, `docs/requirements/`, `docs/design/`, `docs/adr/` |
| `/skill-writing <스킬 이름> [할 일]` | 스킬 작성 규칙과 템플릿대로 스킬을 만들거나 고치고, 이 표를 갱신한 뒤 doc-check로 검수해요. 호출 방식은 항상 사용자에게 물어요. | `.claude/skills/<스킬 이름>/SKILL.md`, `.claude/skills/README.md` | `.claude/rules/`, 다른 스킬, `docs/` 템플릿 |

## 쓰는 순서

한 Phase는 아래 순서로 진행해요.

```text
1. 요구사항 작성
2. 요구사항으로 설계와 테스트 케이스 만들기 (둘 다 요구사항이 기준이라 따로 진행할 수 있어요)
   - 설계: /design-doc <phase> → /doc-check <phase>
   - 테스트 케이스: /make-testcase <phase>
3. 1차 구현: 테스트 케이스를 통과하도록 구현 → /implement-tc <phase>
4. 2차 구현: 통과한 테스트를 지키면서 ADR, 요구사항, 설계대로 구현을 다듬기 → /implement-design <phase>
5. 최종 검증: 테스트를 다시 돌리고, 구현이 요구사항·설계와 맞는지 확인 → /test-final <phase> (4단계 끝에 자동 실행)
```

- 3·4단계 스킬은 테스트 파일을 고치지 않아요. 설계대로 고치면 테스트가 깨지는 곳은 멈추고 물어요. 테스트를 고쳐야 하면 요구사항이나 설계와 어긋난 곳을 먼저 확인하고 `/make-testcase`로 고쳐요.

- `/doc-check`는 `/design-doc` 없이 사람이 직접 쓰거나 고친 문서를 검증할 때도 써요. ADR을 쓰거나 상태를 바꾼 뒤에는 `/doc-check docs/adr/ADR-<번호>.md`로 요구사항 비고와 맞는지 확인해요.
- 다른 스킬은 모두 결과를 주기 전에 쓰거나 고친 문서를 `doc-check` 절차로 검수해요.
- `/doc-check`에서 문제가 나오면 고친 뒤 `/doc-check`를 다시 돌려요.

## Phase 인자

Phase를 받는 스킬은 모두 아래처럼 읽어요. 각 스킬에 다시 쓰지 않고 이 절을 가리켜요.

- 첫 단어가 Phase예요. `phase1`, `phase2`처럼 `docs/requirements/` 아래 폴더 이름으로 써요.
- 숫자만 오면 `phase<숫자>`로 읽어요. (예: `2` → `phase2`)
- Phase가 비어 있거나 `docs/requirements/<phase>/` 폴더가 없으면, `docs/requirements/` 아래 폴더 목록을 보여 주고 AskUserQuestion으로 어느 Phase인지 물어요. 추측해서 진행하지 않아요.
- 설계 문서 위치는 Phase 1만 `docs/design/` 바로 아래이고, Phase 2부터는 `docs/design/<phase>/` 아래예요.
