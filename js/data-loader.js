/* 공식 데이터 JSON 공통 로더 (발주 사양 ⅩⅥ)
 *
 * 원칙
 *  - 외부 API 텍스트를 innerHTML 에 넣지 않는다. 전부 textContent 로 출력한다.
 *  - 링크는 same-origin 또는 허용 호스트(법제처·국회)만 통과시킨다.
 *  - 실패해도 화면이 비지 않게 한다. 정적으로 이미 그려진 값이 그대로 남는다.
 *
 * CSP: script-src 'self' · connect-src 'self' — 동일 출처 JSON 만 부른다.
 */

export class DatasetLoadError extends Error {}

const ALLOWED_LINK_HOSTS = [
  'www.law.go.kr',
  'law.go.kr',
  'likms.assembly.go.kr',
  'open.assembly.go.kr',
];

export function safeUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  let url;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.origin === window.location.origin) return url.href;
  if (ALLOWED_LINK_HOSTS.includes(url.hostname)) {
    // 외부 원문 링크는 https 로 승격해 내보낸다.
    url.protocol = 'https:';
    return url.href;
  }
  return null;
}

export async function loadDataset(datasetName, options = {}) {
  const { timeoutMs = 10000, cacheBust = false } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const suffix = cacheBust ? `?v=${encodeURIComponent(Date.now())}` : '';

  try {
    const response = await fetch(
      `/data/${encodeURIComponent(datasetName)}.json${suffix}`,
      { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal },
    );

    if (!response.ok) {
      throw new DatasetLoadError(`데이터를 불러오지 못했습니다: ${response.status}`);
    }

    const payload = await response.json();

    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray(payload.records) ||
      !payload.metadata
    ) {
      throw new DatasetLoadError('데이터 형식이 올바르지 않습니다.');
    }

    return payload;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new DatasetLoadError('데이터 요청 시간이 초과되었습니다.');
    }
    if (error instanceof DatasetLoadError) throw error;
    throw new DatasetLoadError('데이터를 불러오는 중 오류가 발생했습니다.');
  } finally {
    clearTimeout(timeout);
  }
}

/** YYYYMMDD → 2026.07.01 */
export function formatDate8(value) {
  const raw = String(value || '').replace(/[-.]/g, '');
  if (!/^\d{8}$/.test(raw)) return '';
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
}

export function formatKst(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

/** 확인일·제공기관 한 줄. 컨테이너를 비우고 textContent 로만 채운다. */
export function renderDatasetStatus(container, dataset) {
  if (!container) return;
  container.textContent = '';
  const line = document.createElement('p');
  line.className = 'dataset-status';
  line.textContent =
    `공식 원천 확인: ${formatKst(dataset.metadata.checked_at)}` +
    ` · 제공기관: ${dataset.metadata.provider_name}`;
  container.append(line);
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
