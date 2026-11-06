# w11-12-mini-react

# 커밋 규칙

## 형식
 
```
<타입>: <커밋 내용>
```

## 타입
 
| 타입 | 언제 쓰나 | 예시 |
|---|---|---|
| `feat` | 새로운 기능 추가 | `feat: useState 훅 구현` |
| `fix` | 버그 수정 | `fix: 리렌더링 시 상태 초기화되는 문제 수정` |
| `refactor` | 동작은 그대로, 코드 구조만 개선 | `refactor: diff 함수 분리` |
| `docs` | 문서 추가·수정 (README, 규칙 문서, 주석 등) | `docs: 커밋 규칙 문서 추가` |
| `chore` | 기능·문서와 무관한 작업 (설정, 패키지, 워크플로 등) | `chore: Daily Scrum 워크플로 추가` |
 
# Github Claude App 사용법

저장소에 설치된 GitHub Claude App을 통해, 이슈나 PR 댓글에 `@claude`를 멘션하면 Claude가 GitHub Actions에서 실행되어 작업합니다.

## 형식

```
@claude <요청 내용>
```

## 예시

| 어디서 | 요청 예시 | 결과 |
|---|---|---|
| 이슈 | `@claude 이 이슈 내용대로 useState 훅 구현해줘` | 브랜치 생성 후 코드 작성 |
| PR | `@claude 이 PR 리뷰해줘` | 코드 리뷰 댓글 작성 |
| PR 리뷰 코멘트 | `@claude 이 지적사항 반영해줘` | 수정 커밋 추가 |
| PR | `@claude 테스트 왜 실패했는지 보고 고쳐줘` | CI 실패 원인 분석 후 수정 |

## 참고

- 요청은 구체적으로 작성할수록 결과가 좋습니다. (파일명, 함수명, 기대 동작 등)
- Claude가 만든 커밋·PR도 반드시 사람이 검토한 뒤 머지합니다.
- 실행할 때마다 GitHub Actions 시간과 Claude 사용량이 소모되니 필요할 때만 호출합니다.
