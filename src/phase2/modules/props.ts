// props 반영 (docs/design/phase2/props.md)
// toDOM과 patch가 props 하나를 DOM에 반영할 때 불러요.
// - on으로 시작하면 이벤트 핸들러 (FR-P01~P05, P10)
// - value, checked, selected는 property. attribute도 함께 맞춰요 (FR-P06, P07, ADR-015)
// - 나머지는 attribute. true는 빈 문자열, false·null·undefined는 지움 (FR-P08, P09)

type EventHandler = (event: Event) => void;

// 요소마다 지금 등록된 핸들러. 다음 Patch에서 이전 핸들러를 지우려면 같은 함수 참조가 필요해요 (요구사항 6.1 B안)
const listeners = new WeakMap<Element, Map<string, EventHandler>>();

const PROPERTY_PROPS = new Set(['value', 'checked', 'selected']);

export function setProp(el: Element, name: string, value: unknown): void {
  if (name.startsWith('on')) {
    setListener(el, name.slice(2).toLowerCase(), typeof value === 'function' ? (value as EventHandler) : undefined);
    return;
  }
  if (PROPERTY_PROPS.has(name)) {
    (el as unknown as Record<string, unknown>)[name] = propertyValue(name, value);
    setAttr(el, name, value); // toVNode가 attribute로 다시 읽어 같은 트리가 나오게 해요 (ADR-015)
    return;
  }
  setAttr(el, name, value);
}

export function removeProp(el: Element, name: string): void {
  if (name.startsWith('on')) setListener(el, name.slice(2).toLowerCase(), undefined);
  else {
    if (PROPERTY_PROPS.has(name)) (el as unknown as Record<string, unknown>)[name] = emptyValue(name);
    el.removeAttribute(name);
  }
}

/** true는 빈 문자열로 붙이고, false·null·undefined는 지우고, 나머지는 문자열로 붙여요 (FR-P08, P09) */
function setAttr(el: Element, name: string, value: unknown): void {
  if (value === false || value === null || value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? '' : String(value));
}

/**
 * property에 넣을 값이에요 (ADR-015).
 * value는 문자열로 바꿔요. checked·selected는 HTML boolean attribute처럼 문자열이면 값과 상관없이 켜요.
 * HTML의 `<input checked>`는 toVNode에서 `checked: ''`가 되는데, 빈 문자열을 그대로 넣으면 꺼지기 때문이에요.
 */
function propertyValue(name: string, value: unknown): string | boolean {
  if (value === null || value === undefined) return emptyValue(name);
  if (name === 'value') return String(value);
  return typeof value === 'string' ? true : Boolean(value);
}

/** 이전 핸들러를 지우고, 새 핸들러가 있으면 등록해요 */
function setListener(el: Element, event: string, handler: EventHandler | undefined): void {
  let map = listeners.get(el);
  const prev = map?.get(event);
  if (prev) el.removeEventListener(event, prev);
  if (!handler) {
    map?.delete(event);
    return;
  }
  if (!map) listeners.set(el, (map = new Map()));
  el.addEventListener(event, handler);
  map.set(event, handler);
}

function emptyValue(name: string): string | boolean {
  return name === 'value' ? '' : false;
}
