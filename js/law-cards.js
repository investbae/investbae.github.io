/* /radar/ — 법령 카드를 data/laws.json 으로 갱신하고, 관련 발의 의안을 그린다.
 *
 * 정적 HTML 의 제1조 목적 문구는 그대로 두고, 자동화가 확인한 메타데이터(소관부처·공포·
 * 개정유형·시행예정·확인일)를 덧붙인다. JSON 회수에 실패해도 화면이 비지 않는다.
 *
 * ★[2026-08-23] 종전에는 **시행일도 정적 HTML 값을 그대로 두었다.** 그 결과 자료를 갱신하자
 *   한 카드가 「🗓️ 시행 2026.03.17」(정적)과 「시행 2026.08.04」(자료)를 **동시에** 표시했다.
 *   기관 페이지가 같은 법의 시행일을 두 개 말하는 것은 낡은 것보다 나쁘다.
 *   → 시행일과 법제처 원문 링크(lsiSeq)를 **자료에서 갱신**한다. 자료가 유일한 출처다.
 *   정적 값은 JS 실패 시의 baseline 으로 남긴다(수집일 기준으로 함께 갱신해 둔다).
 *
 * 국회 API 가 주지 않은 심사 전망·통과 가능성은 만들지 않는다. 처리결과가 없으면
 * "처리결과 없음(국회 공개값 기준)"으로만 적는다.
 */
import { loadDataset, safeUrl, formatDate8, formatKst, el } from '/js/data-loader.js';

function enrichLawCards(dataset) {
  const byId = new Map(dataset.records.map((r) => [String(r.law_id), r]));
  let matched = 0;

  document.querySelectorAll('.law-card[data-law-id]').forEach((card) => {
    const record = byId.get(card.dataset.lawId);
    if (!record) return;
    matched += 1;

    const meta = el('div', 'law-card__meta');

    // 시행일은 카드 머리의 「🗓️ 시행」 줄이 담당한다(아래에서 자료로 갱신). 여기서 겹쳐 적지 않는다.
    const facts = [
      ['소관', record.ministry],
      ['공포', `${formatDate8(record.promulgation_date)} 제${record.promulgation_number}호`],
      ['최근 개정', record.revision_type],
    ].filter(([, value]) => value);

    facts.forEach(([label, value]) => {
      const row = el('span', 'law-card__fact');
      row.append(el('b', null, label), document.createTextNode(` ${value}`));
      meta.append(row);
    });

    if (Array.isArray(record.pending_amendments) && record.pending_amendments.length) {
      const first = record.pending_amendments[0];
      const badge = el(
        'span',
        'law-card__pending',
        `수집 당시 시행예정 ${record.pending_amendments.length}건 · 최초 ${formatDate8(first.effective_date)}`,
      );
      badge.title = '자료 확인 당시의 예정 개정 목록입니다. 날짜가 지난 뒤의 시행 여부와 현행 조문은 법제처 원문에서 다시 확인하세요.';
      meta.append(badge);
    }

    const checked = el('span', 'law-card__checked', `확인 ${formatKst(dataset.metadata.checked_at)}`);
    meta.append(checked);

    const old = card.querySelector('.law-card__meta');
    if (old) old.remove();
    card.append(meta);

    // ★ 카드 머리의 「🗓️ 시행 … · 법제처 원문 →」 줄을 자료로 갱신한다.
    //   정적 값을 그대로 두면 자료 갱신 시 **두 시행일이 동시에 보인다**(2026-08-23 실측).
    const link = card.querySelector('a[href*="lsInfoP"]');
    // 부칙 단계 시행(법률 제21324호 부칙 제1조) — 수집 자료(data/laws.json)가 파이프라인에서 덮여도 같은 버전(lsiSeq)이면 유지한다.
    const STAGED = { '283193': '2026.02.03(공포일) · 제50조①단서 2026.08.04 · 제166조 2027.02.04' };
    const eff = record.effective_display || STAGED[String(record.law_serial_number)] || formatDate8(record.effective_date);
    if (link && eff) {
      const href = safeUrl(record.official_detail_url);
      if (href) link.setAttribute('href', href);
      // 앵커 앞의 텍스트 노드만 갈아 끼운다 — 앵커·스타일은 건드리지 않는다.
      const line = link.parentNode;
      if (line) {
        for (const node of Array.from(line.childNodes)) {
          if (node.nodeType === 3 && node.nodeValue.indexOf('시행') > -1) {
            node.nodeValue = `🗓️ 시행 ${eff} · `;
          }
        }
      }
    }
  });

  return matched;
}

function renderBills(dataset, mount) {
  mount.textContent = '';

  const head = el('p', 'bills__note');
  head.textContent =
    '국회가 공개한 의안 메타데이터를 그대로 옮긴 것입니다. ' +
    '심사 전망이나 통과 가능성은 표시하지 않습니다. ' +
    '검색은 의안명 부분일치이므로 관련 의안 전부를 포괄하지 않습니다. ' +
    '키워드 부분일치 결과를 발의일 역순으로 기계적으로 표시하며 선별하지 않았습니다.';
  mount.append(head);

  const list = el('ul', 'bills__list');
  const additional = el('ul', 'bills__list');
  const initialCount = Math.min(20, dataset.records.length);
  dataset.records.forEach((record, index) => {
    const item = el('li', 'bills__item');

    const href = safeUrl(record.official_detail_url);
    const title = href ? el('a', 'bills__title') : el('span', 'bills__title');
    title.textContent = record.bill_name || '(의안명 없음)';
    if (href) {
      title.href = href;
      title.target = '_blank';
      title.rel = 'noopener';
    }

    const meta = el('span', 'bills__meta');
    meta.textContent = [
      record.bill_no ? `의안번호 ${record.bill_no}` : '',
      record.propose_date ? `제안 ${record.propose_date}` : '',
      record.proposer || '',
      record.committee || '',
      record.process_result ? `처리결과 ${record.process_result}` : '처리결과 없음(국회 공개값 기준)',
    ]
      .filter(Boolean)
      .join(' · ');

    item.append(title, meta);
    (index < initialCount ? list : additional).append(item);
  });
  mount.append(list);
  if (dataset.records.length > initialCount) {
    const more = el('details', 'bills__more');
    more.append(el('summary', '', `나머지 ${dataset.records.length - initialCount}건 더 보기`), additional);
    mount.append(more);
  }

  const foot = el('p', 'bills__foot');
  foot.textContent =
    `${dataset.metadata.provider_name} · ${dataset.metadata.reference_period || ''}` +
    ` · 확인 ${formatKst(dataset.metadata.checked_at)}` +
    (((dataset.metadata.population || '').match(/총 (\d+)건/) || [])[1] ? ` · 키워드 해당 ${dataset.metadata.population.match(/총 (\d+)건/)[1]}건 중 최근 ${dataset.records.length}건 게시` : ` · 게시 ${dataset.records.length}건`) +
    ` · 기본 목록 ${initialCount}건` +
    (dataset.records.length > initialCount ? ` · 더 보기 ${dataset.records.length - initialCount}건` : '');
  mount.append(foot);
  const download = el('a', 'bills__source', '수집 의안 전체 자료(JSON) 보기 →');
  download.href = '/data/bills.json';
  mount.append(download);
}

async function init() {
  if (document.querySelector('.law-card[data-law-id]')) {
    try {
      const laws = await loadDataset('laws');
      enrichLawCards(laws);
    } catch {
      /* 정적 값 유지 — 화면을 비우지 않는다 */
    }
  }

  const mount = document.getElementById('billsMount');
  if (mount) {
    try {
      const bills = await loadDataset('bills');
      renderBills(bills, mount);
    } catch {
      mount.textContent = '';
      mount.append(
        el('p', 'bills__note', '의안 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주십시오.'),
      );
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
