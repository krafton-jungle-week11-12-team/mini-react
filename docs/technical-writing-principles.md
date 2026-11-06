# 테크니컬 라이팅 원칙

## 한 페이지에서는 하나만 다루기

**Incorrect:** 설치 방법, 장애 대응, 설계 결정을 한 문서에 함께 써요.

**Correct:** 설치 가이드와 ADR을 나누고 서로 링크해요.

## 가치를 먼저 제시하기

**Incorrect:** "이 문서는 Diff 함수를 설명해요."

**Correct:** "이 문서를 읽으면 화면에서 바뀐 부분만 고치는 원리를 알 수 있어요."

## 속성 설명에 의미와 형식 함께 쓰기

**Incorrect:**

```markdown
date: string
```

**Correct:**

```markdown
date: string — 결제가 완료된 날짜예요.
YYYY-MM-DD 형식으로 입력해요. (예: 2025-09-22)
```
