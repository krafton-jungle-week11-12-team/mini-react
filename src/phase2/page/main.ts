// 할 일 앱 페이지 진입점 (docs/design/phase2/app-pages.md)
// 인스턴스를 하나 만들어 mount를 한 번 불러요. 이 뒤로 화면은 setState만 바꿔요 (FR-A12)
// 2차: onCommit으로 들여다보기 패널을 붙여요 (FR-SX02, FR-AX01~AX03)
import './style.css';
import { FunctionComponent } from '../modules/component';
import { App } from './app';
import { createInspector } from './inspector';

function byId(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id}가 없어요`);
  return found;
}

const app = byId('app');

// App의 hooks 칸 이름. 칸 번호 순서예요 (todo-app.md "자료구조"의 7칸 표)
const HOOK_LABELS = ['todos', 'text', 'filter', '보이는 목록', '남은 일 개수', '탭 제목', '저장소 쓰기'];

const onCommit = createInspector(
  {
    app,
    renderCount: byId('render-count'),
    appTitle: byId('app-tab-title'),
    hooksView: byId('hooks-view'),
    diffMessage: byId('diff-message'),
    diffView: byId('diff-view'),
    logSummary: byId('log-summary'),
    logView: byId('log-view'),
  },
  HOOK_LABELS,
);

new FunctionComponent(App, {}, app, { onCommit }).mount();
