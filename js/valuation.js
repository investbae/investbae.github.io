/* 벤처시장연구원 — 비상장 벤처 공정가치 평가 (교육·연구용) 엔진
   2026-07-03 · 정적 사이트·백엔드0·CSP script-src 'self'(외부JS 불가)·개인정보 서버전송0(브라우저 계산만)
   방법: IPEV/IFRS13 공정가치 축(직전라운드 calibration·시장배수·DCF·순자산·OPM·몬테카를로) + VC법 + 초기정성(Scorecard/Berkus) + 상증세법§54(국내참고)
   근거: R1~R5 3자 토론(교육용·range·민감도·해외배수 한국보정·오류방지). 모든 산출은 '참고 범위'이며 공정가치/평가액/감정가/투자자문 아님. */
(function () {
  "use strict";
  var app = document.getElementById("valApp");
  if (!app) return;
  // 비공개 게이트 (박사님 지시 2026-07-04) — 박사님 검토용 URL: /valuation/?preview · 그 외엔 준비중 표시
  if (location.search.indexOf("preview") < 0) {
    var mn = document.getElementById("main");
    if (mn) mn.innerHTML = '<section class="section"><div class="container" style="max-width:640px;text-align:center;padding:80px 20px;"><h1 style="font-size:26px;">준비 중입니다</h1><p style="color:var(--text-muted);margin-top:14px;line-height:1.7;">이 페이지는 현재 준비 중이며 아직 일반에 공개되지 않았습니다.</p><p style="margin-top:24px;"><a href="/" class="btn btn--primary btn--lg">홈으로 돌아가기</a></p></div></section>';
    return;
  }
  var docsEl = document.getElementById("valMethodDocs");

  var money = function (v) {
    if (v == null || !isFinite(v)) return "—";
    if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2) + "조원";
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(1) + "억원";
    if (Math.abs(v) >= 1e4) return Math.round(v / 1e4).toLocaleString() + "만원";
    return Math.round(v).toLocaleString() + "원";
  };
  var num = function (id) { var el = document.getElementById(id); var v = el ? parseFloat(String(el.value).replace(/[, ]/g, "")) : NaN; return isFinite(v) ? v : NaN; };
  var val = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clamp = function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; };

  /* ── 결정론적 난수(몬테카를로 재현성·시드 고정) mulberry32 ── */
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function normCdf(x) { var t = 1 / (1 + 0.2316419 * Math.abs(x)); var d = 0.3989423 * Math.exp(-x * x / 2); var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }

  /* ── 업종 배수(참고·해외 기준·한국 비상장 보정 전) ── */
  var SECTORS = {
    platform: { name: "플랫폼·마켓플레이스·광고(당근·오늘의집형)", rev: [4, 12], ebitda: [18, 40] },
    saas: { name: "SaaS·소프트웨어", rev: [4, 8], ebitda: [15, 30] },
    fintech: { name: "핀테크", rev: [3, 8], ebitda: [12, 25] },
    bio: { name: "바이오·헬스케어", rev: [3, 9], ebitda: [12, 22] },
    ecommerce: { name: "이커머스·리테일(무신사·컬리형)", rev: [1, 4], ebitda: [8, 16] },
    deeptech: { name: "딥테크·제조", rev: [1.5, 5], ebitda: [8, 15] },
    consumer: { name: "소비재·서비스", rev: [0.75, 2.5], ebitda: [6, 12] },
    general: { name: "일반·기타", rev: [1, 3], ebitda: [7, 13] }
  };
  /* 한국 비상장 보정: 비유동성 할인(DLOM)·규모/국가 디스카운트 (R5 토론) */
  var KOREA_ADJ = 0.75; // 해외 상장배수 → 한국 초·중기 비상장 보정계수(참고)
  var DLOM = { early: 0.35, growth: 0.25, late: 0.20, mature: 0.15 }; // 비유동성 할인율(단계별·참고)
  // Fable ⑤: 동적 DLOM (유동화 시점·변동성·지배지분 반영·Finnerty/Chaffe 방향성)
  function dlomOf(i) {
    var d = DLOM[i.stageKey] != null ? DLOM[i.stageKey] : 0.25;
    var t = isFinite(i.exitYears) ? i.exitYears : (isFinite(i.opmYears) ? i.opmYears : 4);
    if (t <= 1.5) d -= 0.10; else if (t >= 5) d += 0.05;
    var vol = isFinite(i.mcVol) ? i.mcVol : (isFinite(i.opmVol) ? i.opmVol : NaN);
    if (isFinite(vol) && vol >= 70) d += 0.05;
    if (isFinite(i.ownPct) && i.ownPct >= 50) d -= 0.05; // 지배지분→시장성 제약 완화(프리미엄 가산은 안 함·보수)
    return clamp(d, 0.10, 0.45);
  }

  /* ══════════════ 개별 방법 계산 ══════════════ */

  // 1) 직전 라운드 calibration (IPEV 핵심·Fable TriAnchor ①: 비대칭 성장·감쇠·다운라운드·시장수렴)
  function mCalibration(i, marketBase) {
    var post = i.lastPost, months = i.monthsSince, growth = i.revGrowth; // %
    if (!isFinite(post) || post <= 0) return null;
    var g = isFinite(growth) ? growth / 100 : 0;
    var yrs = Math.min(isFinite(months) ? months / 12 : 0, 2.5);   // 외삽 상한 2.5년
    var gEff = g >= 0 ? g * 0.4 : g * 1.0;                          // 비대칭: 상방 40%·하방 100%
    var regime = isFinite(i.marketRegime) ? i.marketRegime : 0;    // 시장국면(선택)
    var base = post * Math.pow(1 + gEff, yrs) * (1 + regime);
    if (i.downRound) base = Math.min(base, post * 0.8);            // 다운라운드 → 앵커 20% 하향
    if (isFinite(marketBase) && marketBase > 0 && marketBase < base * 0.6) { // 시장 60%+ 괴리 → log 1/3 수렴
      base = Math.exp(Math.log(base) * (2 / 3) + Math.log(marketBase) * (1 / 3));
    }
    return { label: "직전 라운드 calibration", low: base * 0.65, base: base, high: base * 1.15,
      note: "직전 post-money 앵커에 성장 상방 40%·하방 100% 비대칭 반영(외삽 상한 2.5년). " +
        (i.downRound ? "다운라운드 감지 → 앵커 20% 하향. " : "") +
        "시장배수와 60%+ 괴리 시 자동 수렴. 앵커 신뢰는 경과월수만큼 감쇠(반감기 15개월). 특수조건 미반영." };
  }

  /* ═══ Fable TriAnchor-P: 부분정보 강건 — 참고표(실거래 미캘리브레이션·캘리브 시 이 표만 교체) ═══ */
  var STAGE_PRE = { early:{lo:2e9,mid:4e9,hi:8e9}, a:{lo:8e9,mid:15e9,hi:30e9}, growth:{lo:30e9,mid:60e9,hi:150e9}, late:{lo:100e9,mid:250e9,hi:800e9}, mature:{lo:30e9,mid:80e9,hi:300e9} };
  var SECTOR_STAGE_ADJ = { platform:1.2, saas:1.1, fintech:1.1, bio:1.3, ecommerce:0.9, deeptech:1.1, consumer:0.8, general:1.0 };
  var EV_PER_HEAD = { platform:{lo:3e8,mid:8e8,hi:20e8}, saas:{lo:3e8,mid:7e8,hi:15e8}, fintech:{lo:2e8,mid:6e8,hi:15e8}, bio:{lo:3e8,mid:8e8,hi:25e8}, ecommerce:{lo:2e8,mid:5e8,hi:10e8}, deeptech:{lo:2e8,mid:5e8,hi:12e8}, consumer:{lo:1e8,mid:3e8,hi:7e8}, general:{lo:1.5e8,mid:4e8,hi:9e8} };
  var MARGIN_TYP = { platform:8, saas:10, fintech:8, bio:-10, ecommerce:3, deeptech:5, consumer:7, general:5 };
  var GROWTH_TYP = { early:100, growth:50, late:25, mature:10 };
  var REV_PER_HEAD = { platform:2.0e8, saas:1.5e8, fintech:2.0e8, bio:1.0e8, ecommerce:4.0e8, deeptech:1.2e8, consumer:2.0e8, general:1.5e8 };
  var MANUAL_STAGE = { seed:{key:"early",label:"시드·프리A"}, a:{key:"a",label:"시리즈A"}, growth:{key:"growth",label:"시리즈B·성장"}, late:{key:"late",label:"시리즈C+·후기"}, mature:{key:"mature",label:"성숙(이익)"} };

  // 완결도 게이트 (앵커 개수로 A/B/C)
  function completenessOf(i) {
    var anchors = [];
    if (isFinite(i.lastPost) && i.lastPost > 0) anchors.push("직전라운드");
    if (isFinite(i.revenue) && i.revenue > 0) anchors.push("매출");
    if (isFinite(i.equity)) anchors.push("자기자본");
    if (isFinite(i.ebitda)) anchors.push("EBITDA");
    var soft = [];
    if (isFinite(i.employees) && i.employees > 0) soft.push("직원수");
    if (i.stageSel && i.stageSel !== "auto") soft.push("단계(수동)");
    if (i.sector && i.sector !== "general") soft.push("업종");
    if (isFinite(i.age)) soft.push("경과연수");
    return { tier: anchors.length >= 2 ? "A" : anchors.length === 1 ? "B" : "C", anchors: anchors, soft: soft };
  }
  // 결측 추론 원장 (추론값=위치신호로만·피승수 금지·전량 공개)
  function inferDefaults(i) {
    var ledger = [], i2 = {}; for (var k in i) i2[k] = i[k];
    if (!(isFinite(i2.revGrowth)) && i2.stageKey) { i2.revGrowth = GROWTH_TYP[i2.stageKey] != null ? GROWTH_TYP[i2.stageKey] : 50; i2._growthInferred = true; ledger.push({ f: "매출성장률", v: i2.revGrowth + "%", b: (i2.stage || "단계") + " 전형치" }); }
    if (!(isFinite(i2.ebitda)) && isFinite(i2.revenue) && i2.revenue > 0) { i2._marginTyp = MARGIN_TYP[i2.sector] != null ? MARGIN_TYP[i2.sector] : 5; ledger.push({ f: "EBITDA 마진", v: i2._marginTyp + "%", b: "업종 전형치(위치판정만·배수 미사용)" }); }
    if (!(isFinite(i2.revenue) && i2.revenue > 0) && isFinite(i2.employees) && i2.employees > 0) { i2.revenueEst = i2.employees * (REV_PER_HEAD[i2.sector] || REV_PER_HEAD.general); ledger.push({ f: "매출", v: money(i2.revenueEst), b: "임직원 " + i2.employees + "명 × 인당매출 역산" }); }
    return { i: i2, ledger: ledger };
  }
  // 폴백 ①: 업종×단계 벤치마크 (항상·바닥 보장)
  function mBenchmark(i) {
    var st = STAGE_PRE[i.stageKey] || STAGE_PRE.early;
    var adj = SECTOR_STAGE_ADJ[i.sector] || 1.0;
    var q = isFinite(i.qualScore) ? clamp(i.qualScore, 0.5, 1.5) : 1.0;
    return { label: "업종×단계 벤치마크 (참고 범위)", low: st.lo * adj * q, base: st.mid * adj * q, high: st.hi * adj * q, fallback: true,
      note: "해당 업종·단계 기업의 전형 pre-money 범위(참고치·실거래 미캘리브레이션). 개별 실적 미반영·자릿수 참고용." };
  }
  // 폴백 ②: 인당가치
  function mPerHead(i) {
    if (!(isFinite(i.employees) && i.employees > 0)) return null;
    var t = EV_PER_HEAD[i.sector] || EV_PER_HEAD.general, n = i.employees;
    return { label: "인당가치 (직원수 × 업종 인당 EV·참고)", low: n * t.lo, base: n * t.mid, high: n * t.hi, fallback: true,
      note: "임직원 " + n + "명 × 업종 인당 기업가치 전형. 인력은 가치의 거친 대리변수(바이오·딥테크 괴리 큼)·극소정보 폴백용." };
  }
  // 폴백 ③: 단순 매출배수(성장·마진 없을 때·추정매출 허용)
  function mRevSimple(i) {
    var rev = (isFinite(i.revenue) && i.revenue > 0) ? i.revenue : i.revenueEst;
    if (!(isFinite(rev) && rev > 0)) return null;
    var s = SECTORS[i.sector] || SECTORS.general, est = !(isFinite(i.revenue) && i.revenue > 0);
    return { label: "단순 매출배수 " + (est ? "(추정매출·하한~상한)" : "(하한~상한)"), low: rev * s.rev[0] * KOREA_ADJ, base: rev * Math.sqrt(s.rev[0] * s.rev[1]) * KOREA_ADJ, high: rev * s.rev[1] * KOREA_ADJ, fallback: true,
      note: "업종 배수 구간 전체를 " + (est ? "역산 추정매출" : "매출") + "에 적용(위치보정 없음). base는 기하중앙일 뿐 점추정 아님." };
  }

  // 2) 시장 배수 (Fable ③: Rule of 40 위치보정·NRR·규모조정·기하평균·동적 DLOM)
  function mMarket(i) {
    var s = SECTORS[i.sector] || SECTORS.general;
    var netDebt = isFinite(i.netDebt) ? i.netDebt : 0;
    var dlom = dlomOf(i);
    var margin = (isFinite(i.ebitda) && isFinite(i.revenue) && i.revenue > 0) ? i.ebitda / i.revenue * 100 : NaN;
    var gs = isFinite(i.revGrowth) ? clamp((i.revGrowth - 10) / 50, 0, 1) : 0.5;   // 성장 10%→0·60%+→1
    var ms = isFinite(margin) ? clamp((margin + 20) / 40, 0, 1) : 0.5;             // 마진 -20%→0·+20%→1
    var r40 = (isFinite(i.revGrowth) && isFinite(margin)) ? clamp((i.revGrowth + margin) / 40, 0, 1) : 0.5;
    var pos = clamp(0.5 * gs + 0.3 * r40 + 0.2 * ms + (isFinite(i.marketRegime) ? i.marketRegime : 0), 0, 1);
    var nrrAdj = isFinite(i.nrr) ? (i.nrr >= 120 ? 1.10 : i.nrr < 90 ? 0.85 : 1.0) : 1.0;
    var sizeAdj = (isFinite(i.revenue) && i.revenue < 5e9) ? 0.90 : (isFinite(i.revenue) && i.revenue >= 1e11) ? 1.05 : 1.0;
    var evs = [];
    if (isFinite(i.revenue) && i.revenue > 0) {
      var rm = s.rev[0] + (s.rev[1] - s.rev[0]) * pos;
      evs.push(i.revenue * rm * KOREA_ADJ * nrrAdj * sizeAdj);
    }
    if (isFinite(i.ebitda) && i.ebitda > 0) {
      var em = s.ebitda[0] + (s.ebitda[1] - s.ebitda[0]) * pos;
      evs.push(i.ebitda * em * KOREA_ADJ * sizeAdj);
    }
    if (!evs.length) return null;
    // 실측 보정: 매출법·EBITDA법 통합 시 매출가중(0.65)·EBITDA(0.35) — 저마진 성장기업 과소평가 방지(기하평균 폐기)
    var ev = evs.length === 2 ? (evs[0] * 0.65 + evs[1] * 0.35) : evs[0];
    var eq = Math.max(0, (ev - netDebt) * (1 - dlom));
    return { label: "시장 배수 (한국 보정·DLOM 반영)", low: Math.max(0, eq * 0.78), base: eq, high: Math.max(0, eq * 1.28),
      note: "해외 " + s.name + " 배수 구간에서 성장·마진(Rule of 40)으로 위치 결정(pos " + pos.toFixed(2) + ")·한국 보정 " + KOREA_ADJ + "·비유동성 할인 " + Math.round(dlom * 100) + "%" + (nrrAdj !== 1 ? "·NRR 조정" : "") + ". 낙관 입력 시 과대평가 유의." };
  }

  // 3) VC 방법
  function mVC(i) {
    var exitMetric = i.exitRevenue, mult = i.exitMultiple, yrs = i.exitYears, irr = i.targetIRR;
    if (![exitMetric, mult, yrs, irr].every(isFinite) || exitMetric <= 0) return null;
    var exitVal = exitMetric * mult;
    var post = exitVal / Math.pow(1 + irr / 100, yrs);
    return { label: "VC 방법", low: post * 0.7, base: post, high: post * 1.3,
      note: "Exit가치(" + money(exitVal) + " = 예상 exit지표 × 배수)를 목표 IRR " + irr + "%로 " + yrs + "년 할인. IRR·배수 가정에 매우 민감." };
  }

  // 4) DCF (간이·경고)
  function mDCF(i) {
    var fcf = i.fcf0, g = i.fcfGrowth / 100, wacc = i.wacc / 100, tg = i.termGrowth / 100, netDebt = isFinite(i.netDebt) ? i.netDebt : 0;
    if (![fcf, i.fcfGrowth, i.wacc, i.termGrowth].every(isFinite)) return null;
    if (wacc <= tg) return { label: "DCF", low: NaN, base: NaN, high: NaN, warn: true, note: "WACC(" + i.wacc + "%)가 영구성장률(" + i.termGrowth + "%) 이하이면 계산 불가. 입력 재확인." };
    var pv = 0, f = fcf;
    for (var y = 1; y <= 5; y++) { f = f * (1 + g); pv += f / Math.pow(1 + wacc, y); }
    var terminal = (f * (1 + tg)) / (wacc - tg);
    pv += terminal / Math.pow(1 + wacc, 5);
    var eq = pv - netDebt;
    return { label: "DCF (5년+영구가치)", low: eq * 0.7, base: eq, high: eq * 1.3,
      note: "초기·적자 벤처엔 부적합(FCF 음수·terminal 과민). 안정적 현금흐름 기업만 참고. WACC·영구성장률에 극도로 민감." };
  }

  // 5) 순자산가치
  function mNetAsset(i) {
    if (!isFinite(i.equity)) return null;
    var v = i.equity + (isFinite(i.assetAdj) ? i.assetAdj : 0);
    return { label: "순자산가치", low: v * 0.9, base: v, high: v * 1.1,
      note: "자기자본(자본총계)에 자산 공정가치 조정 반영. 성장가치·무형자산 미반영 → 성장 벤처엔 하한 성격." };
  }

  // 6) 상증세법 시행령 §54 (국내 법정·교육용)
  function mSangjeungse(i) {
    var shares = i.shares, na = i.equity;
    if (!isFinite(shares) || shares <= 0 || !isFinite(na)) return null;
    var naPer = na / shares; // 1주당 순자산가치
    // 사업개시 3년 미만·자산예외 → 순자산가치만
    if (i.under3yr) {
      return { label: "상증세법 §54 (순자산가치만·3년미만 특례)", low: naPer * shares * 0.95, base: naPer * shares, high: naPer * shares * 1.05,
        note: "사업개시 3년 미만 등 특례로 순자산가치만 적용(시행령 §54④2호). 세법상 순자산은 회계 자본총계와 달라 별도 조정 필요(교육용 근사)." };
    }
    var ni = i.netIncome3; // [직전1년, 2년전, 3년전]
    if (!ni || ni.length < 3 || !ni.every(isFinite)) return null;
    var wAvg = (ni[0] * 3 + ni[1] * 2 + ni[2] * 1) / 6; // 최근3년 가중평균 순손익
    var niPer = wAvg / shares; // 1주당 순손익액
    var earnVal = niPer / 0.10; // 순손익가치환원율 10%
    if (earnVal < 0) earnVal = 0; // 음수 순손익 → 0 처리(교육 단순화)
    var w = i.realEstate ? [2, 3] : [3, 2];
    var blended = (earnVal * w[0] + naPer * w[1]) / 5;
    var floor = naPer * 0.8;
    var per = Math.max(blended, floor);
    var total = per * shares;
    return { label: "상증세법 §54 보충적 평가 (교육용 근사)", low: total * 0.9, base: total, high: total * 1.1,
      note: "1주 = (순손익가치×" + w[0] + " + 순자산가치×" + w[1] + ")÷5, 순자산 80% 하한. 환원율 10%. ★세법상 순자산≠회계 자본총계·최대주주 20% 할증 미반영 → 실제 세무신고엔 세무사 필요." };
  }

  // 7) Scorecard / Berkus (초기 정성·참고 범위)
  function mEarly(i) {
    var base = isFinite(i.regionAvg) ? i.regionAvg : 3e9; // 지역 평균 pre-money(기본 30억·참고)
    var score = isFinite(i.qualScore) ? i.qualScore : 1.0; // 0.5~1.5 가중
    var v = base * Math.max(0.3, Math.min(1.8, score));
    return { label: "초기 정성(Scorecard 방식·참고)", low: v * 0.6, base: v, high: v * 1.5,
      note: "지역 평균 pre-money(" + money(base) + ") × 정성 가중(" + score.toFixed(2) + "). Berkus·Scorecard 계열. 매우 주관적·불확실." };
  }

  // 8) OPM backsolve (우선주/보통주·간이 2계층)
  function mOPM(i) {
    var ev = i.opmEV, lp = i.opmPref, vol = i.opmVol / 100, t = i.opmYears, rf = (isFinite(i.opmRf) ? i.opmRf : 3) / 100;
    if (![ev, lp, i.opmVol, t].every(isFinite) || ev <= 0 || t <= 0) return null;
    // 단순 2계층: 우선주(청산우선권 lp) 우선, 잔여 보통주. 브레이크포인트 = lp
    // 보통주 = 콜옵션(행사가 lp) 가치, 우선주 = EV - 보통주
    var K = lp;
    var d1 = (Math.log(ev / K) + (rf + vol * vol / 2) * t) / (vol * Math.sqrt(t));
    var d2 = d1 - vol * Math.sqrt(t);
    var common = ev * normCdf(d1) - K * Math.exp(-rf * t) * normCdf(d2);
    if (!isFinite(common) || common < 0) common = 0;
    var pref = ev - common;
    return { label: "OPM (우선주/보통주 배분·간이)", low: ev * 0.85, base: ev, high: ev * 1.15,
      extra: "· 보통주 지분가치 ≈ " + money(common) + " / 우선주(청산우선권 " + money(lp) + ") ≈ " + money(pref),
      note: "Black-Scholes로 기업가치를 청산우선권(" + money(lp) + ") 기준 2계층 배분. 변동성(" + i.opmVol + "%)·만기(" + t + "년)에 민감·다계층 우선주는 미반영(간이)." };
  }

  // 9) 몬테카를로 (exit 경로 시뮬레이션·박사님 명시)
  function mMonteCarlo(i) {
    var ev = i.mcEV, drift = (isFinite(i.mcDrift) ? i.mcDrift : 15) / 100, vol = (isFinite(i.mcVol) ? i.mcVol : 60) / 100, t = isFinite(i.mcYears) ? i.mcYears : 4, pFail = (isFinite(i.mcFail) ? i.mcFail : 30) / 100, disc = (isFinite(i.mcDisc) ? i.mcDisc : 20) / 100;
    if (!isFinite(ev) || ev <= 0) return null;
    var N = 10000, r = rng(20260703), vals = [];
    for (var k = 0; k < N; k++) {
      if (r() < pFail) { vals.push(0); continue; } // 실패 시나리오 → 0
      var z = gauss(r);
      var exit = ev * Math.exp((drift - vol * vol / 2) * t + vol * Math.sqrt(t) * z); // GBM exit
      vals.push(exit / Math.pow(1 + disc, t)); // 할인 현재가치
    }
    vals.sort(function (a, b) { return a - b; });
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / N;
    var pct = function (p) { return vals[Math.min(N - 1, Math.floor(p * N))]; };
    return { label: "몬테카를로 (10,000회 exit 시뮬레이션)", low: pct(0.25), base: mean, high: pct(0.75),
      extra: "· 5%~95% 범위 " + money(pct(0.05)) + " ~ " + money(pct(0.95)) + " · 실패확률 " + Math.round(pFail * 100) + "%",
      note: "기업가치의 " + Math.round(drift * 100) + "% 성장·변동성 " + Math.round(vol * 100) + "%로 " + t + "년 GBM 경로 10,000회. 시드 고정(재현). 가정(성장·변동성·실패율)에 좌우·정밀 아님." };
  }

  /* ══════════════ KVMI 종합 발명 프레임워크 (단계자동판별·교차검증·range) ══════════════ */
  function stageOf(i) {
    if (i.stageSel && i.stageSel !== "auto" && MANUAL_STAGE[i.stageSel]) return MANUAL_STAGE[i.stageSel];
    var hasRev = isFinite(i.revenue) && i.revenue > 0;
    var hasProfit = (isFinite(i.ebitda) && i.ebitda > 0);
    var post = i.lastPost;
    var sizeLate = isFinite(post) && post >= 1e11;  // 1,000억+ → 후기
    var sizeGrow = isFinite(post) && post >= 2e10;  // 200억+ → 성장 이상
    if (!hasRev && !sizeGrow) return { key: "early", label: "pre-revenue·초기" };
    if (!hasRev && sizeGrow) return { key: "growth", label: "pre-revenue·대형라운드(딥테크·바이오형)" };
    if (isFinite(i.age) && i.age < 3 && !sizeGrow) return { key: "early", label: "매출초기(<3년)" };
    if (!hasProfit) return sizeLate ? { key: "late", label: "후기(대형라운드·미이익)" } : { key: "growth", label: "성장(매출·미이익)" };
    return { key: "mature", label: "성숙(매출·이익)" };
  }

  function pct(sorted, p) { if (!sorted.length) return NaN; var idx = (sorted.length - 1) * p; var lo = Math.floor(idx), hi = Math.ceil(idx); if (lo === hi) return sorted[lo]; return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); }
  // 방법 기본가중(이론 신뢰)
  function methodWeightBase(label) {
    if (/calibration/.test(label)) return 3.0;
    if (/시장 배수/.test(label)) return 2.2;
    if (/몬테카를로/.test(label)) return 1.6;
    if (/VC 방법/.test(label)) return 1.4;
    if (/OPM/.test(label)) return 1.2;
    if (/DCF/.test(label)) return 1.0;
    if (/순자산가치$/.test(label)) return 0.7;
    if (/상증세법/.test(label)) return 0.6;
    if (/단순 매출배수 \(하한/.test(label)) return 0.9; // 실측 매출 기반
    if (/단순 매출배수/.test(label)) return 0.5;        // 추정매출 기반
    if (/벤치마크/.test(label)) return 0.5;
    if (/인당가치/.test(label)) return 0.5;
    if (/초기 정성/.test(label)) return 0.8;
    return 1.0;
  }
  // Fable ②: 품질계수 q∈[0.4,1.2] — 공급된 데이터 질. 앵커는 시간감쇠(반감기 15개월).
  function qualityOf(label, i) {
    if (/calibration/.test(label)) {
      // 실측 보정(5개 유니콘): 반감기 30개월·하한 가중 1.5(앵커가 완전 소멸하지 않게). 신규 라운드 없는 비상장은 마지막 밸류가 수년 참조.
      var m = isFinite(i.monthsSince) ? i.monthsSince : 24;
      var q = Math.max(1.5 / 3.0, Math.pow(2, -m / 30));
      return i.downRound ? q * 0.6 : q;
    }
    if (/시장 배수/.test(label)) {
      var q2 = 0.85;
      if (isFinite(i.ebitda)) q2 += 0.15;
      if (isFinite(i.netDebt)) q2 += 0.10;
      if (isFinite(i.revGrowth)) q2 += 0.10;
      return Math.min(1.2, q2);
    }
    if (/DCF/.test(label)) return (isFinite(i.fcf0) && i.fcf0 > 0) ? 1.0 : 0.4;
    if (/VC 방법/.test(label)) return 0.9;
    if (/몬테카를로/.test(label)) return isFinite(i.mcFail) ? 1.0 : 0.85;
    return 1.0;
  }
  // Fable ④: 누적가중 분위수(반복삽입 근사 폐기)
  function wPct(pairs, p) {
    pairs.sort(function (a, b) { return a.x - b.x; });
    var tot = pairs.reduce(function (a, b) { return a + b.w; }, 0), acc = 0;
    for (var k = 0; k < pairs.length; k++) { acc += pairs[k].w; if (acc >= tot * p) return pairs[k].x; }
    return pairs[pairs.length - 1].x;
  }
  // Fable ④: 로그공간 3점 풀링 종합 (방법 간 산포 ∪ 방법 내 폭)
  function synthesize(results, i) {
    i = i || {};
    var ok = results.filter(function (r) { return r && isFinite(r.base) && r.base > 0; });
    if (!ok.length) return null;
    var median = pct(ok.map(function (r) { return r.base; }).sort(function (a, b) { return a - b; }), 0.5);
    var kept = ok.filter(function (r) { return Math.abs(Math.log(r.base / median)) <= Math.log(3); });
    if (kept.length < 2) kept = ok;
    var pool = [];
    kept.forEach(function (r) {
      var w = methodWeightBase(r.label) * qualityOf(r.label, i);
      if (isFinite(r.low) && r.low > 0) pool.push({ x: Math.log(r.low), w: w * 0.25 });
      pool.push({ x: Math.log(r.base), w: w * 0.5 });
      if (isFinite(r.high) && r.high > 0) pool.push({ x: Math.log(r.high), w: w * 0.25 });
    });
    var low = Math.exp(wPct(pool.slice(), 0.25)), mid = Math.exp(wPct(pool.slice(), 0.5)), high = Math.exp(wPct(pool.slice(), 0.75));
    if (!(high > low)) { low = mid * 0.75; high = mid * 1.25; }
    var spread = Math.log(high / low);
    var conf = spread < 0.4 ? "높음" : spread < 0.9 ? "보통" : "낮음";
    var dnAll = Math.min.apply(null, ok.map(function (r) { return r.low; }));
    var upAll = Math.max.apply(null, ok.map(function (r) { return r.high; }));
    return { low: low, base: mid, high: high, conf: conf, n: kept.length, nAll: ok.length, median: median, downside: dnAll, upside: upAll };
  }

  /* ══════════════ 입력 폼 ══════════════ */
  var FORM = '' +
    '<div class="ds-panel" style="padding:24px 22px;border:1px solid var(--line);border-radius:14px;background:rgba(13,22,46,.55);">' +
    '<h2 style="font-size:18px;margin-bottom:4px;">① 보유지분 정보 입력</h2>' +
    '<p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;">아는 값만 입력하세요. 단계·자본구조·데이터에 따라 적용 가능한 방법이 자동 선택됩니다. (입력값은 브라우저에만 존재)</p>' +
    grp("기본 (아는 값만·업종·단계만 넣어도 됩니다)", [
      f("회사명(선택·로컬만)", "text", "vName", "예: ○○테크 (저장·내보내기용·서버 전송 안 함)"),
      '<label style="display:block;font-size:12.5px;color:var(--text-muted);">단계(선택)<select id="stageSel" style="display:block;width:100%;margin-top:5px;padding:10px 12px;background:rgba(9,14,30,.65);border:1px solid var(--line-soft);border-radius:9px;color:#fff;font-size:15px;font-family:inherit;"><option value="auto">자동판별(기본)</option><option value="seed">시드·프리A</option><option value="a">시리즈A</option><option value="growth">시리즈B·성장</option><option value="late">시리즈C+·후기</option><option value="mature">성숙(이익)</option></select></label>',
      f("임직원수(명·선택)", "number", "employees", "예: 25"),
      f("설립 후 경과연수", "number", "age", "예: 4"),
      f("발행주식총수(주)", "number", "shares", "예: 1000000"),
      f("자기자본(자본총계, 원)", "number", "equity", "예: 5000000000"),
      f("지분율(%·선택)", "number", "ownPct", "예: 15")
    ]) +
    grp("손익·현금흐름", [
      f("최근 매출(원)", "number", "revenue", "예: 3000000000"),
      f("EBITDA(원·선택)", "number", "ebitda", "예: 500000000"),
      f("순차입금(부채−현금, 원·선택)", "number", "netDebt", "예: 0"),
      selEl("업종", "sector", SECTORS)
    ]) +
    grp("직전 라운드 (있으면)", [
      f("직전 라운드 post-money(원)", "number", "lastPost", "예: 10000000000"),
      f("직전 라운드 후 경과월수", "number", "monthsSince", "예: 12"),
      f("연 매출성장률(%)", "number", "revGrowth", "예: 40"),
      f("최근3년 순이익 [직전,2년전,3년전] 콤마(원)", "text", "netIncome3", "예: 800000000,500000000,300000000")
    ]) +
    '<div style="margin-bottom:14px;"><div style="font-size:12px;font-weight:700;color:var(--gold-soft);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">시장·보정 (선택)</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
    '<label style="display:block;font-size:12.5px;color:var(--text-muted);">시장 국면<select id="marketRegime" style="display:block;width:100%;margin-top:5px;padding:10px 12px;background:rgba(9,14,30,.65);border:1px solid var(--line-soft);border-radius:9px;color:#fff;font-size:15px;font-family:inherit;"><option value="0">중립(기본)</option><option value="0.05">강세 (+5%)</option><option value="-0.10">조정 (−10%)</option><option value="-0.20">침체 (−20%)</option></select></label>' +
    f("NRR 순매출유지율(%·SaaS/플랫폼)", "number", "nrr", "예: 115") +
    '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-muted);margin-top:22px;cursor:pointer;"><input type="checkbox" id="downRound" class="vm-check">직전 라운드 이후 다운라운드·브릿지·구조화 있었음</label>' +
    '</div></div>' +
    '<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:13px;color:var(--gold-soft);">고급: VC법·DCF·OPM·몬테카를로 입력 (선택)</summary><div style="margin-top:12px;">' +
    grp("VC 방법", [
      f("예상 exit 지표(매출 등, 원)", "number", "exitRevenue", "예: 20000000000"),
      f("exit 배수", "number", "exitMultiple", "예: 5"),
      f("exit까지 연수", "number", "exitYears", "예: 5"),
      f("목표 IRR(%)", "number", "targetIRR", "예: 40")
    ]) +
    grp("DCF", [
      f("올해 FCF(원)", "number", "fcf0", "예: 400000000"),
      f("FCF 성장률(%)", "number", "fcfGrowth", "예: 20"),
      f("WACC(%)", "number", "wacc", "예: 15"),
      f("영구성장률(%)", "number", "termGrowth", "예: 2")
    ]) +
    grp("OPM (우선주 자본구조)", [
      f("기업가치 EV(원)", "number", "opmEV", "예: 10000000000"),
      f("우선주 청산우선권 총액(원)", "number", "opmPref", "예: 4000000000"),
      f("변동성(%)", "number", "opmVol", "예: 60"),
      f("만기(exit까지 연)", "number", "opmYears", "예: 4")
    ]) +
    grp("몬테카를로", [
      f("현재 기업가치(원)", "number", "mcEV", "예: 8000000000"),
      f("연 성장 drift(%)", "number", "mcDrift", "예: 15"),
      f("변동성(%)", "number", "mcVol", "예: 60"),
      f("실패확률(%)", "number", "mcFail", "예: 30")
    ]) +
    '</div></details>' +
    '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">' +
    '<button id="valFromLedger" type="button" class="btn btn--navy btn--lg">주주원장에서 불러오기</button>' +
    '<button id="valRun" type="button" class="btn btn--primary btn--lg">공정가치 교차평가 실행</button>' +
    '<button id="valAdd" type="button" class="btn btn--navy btn--lg">포트폴리오에 추가</button>' +
    '<button id="valClear" type="button" class="btn btn--ghost btn--lg" style="font-size:13px;">입력 초기화</button>' +
    '<label class="btn btn--ghost btn--lg" style="font-size:13px;cursor:pointer;">주주원장 CSV 가져오기<input type="file" id="valImpCsv" accept=".csv" style="display:none;"></label>' +
    '</div></div>' +
    '<div id="valResult" style="margin-top:20px;"></div>' +
    '<div id="valPortfolio" style="margin-top:26px;"></div>';

  function grp(title, fields) {
    return '<div style="margin-bottom:14px;"><div style="font-size:12px;font-weight:700;color:var(--gold-soft);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">' + esc(title) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' + fields.join("") + '</div></div>';
  }
  function f(label, type, id, ph) {
    return '<label style="display:block;font-size:12.5px;color:var(--text-muted);">' + esc(label) +
      '<input id="' + id + '" type="' + type + '" ' + (type === "number" ? 'inputmode="decimal" ' : "") + 'placeholder="' + esc(ph) + '" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:10px 12px;background:rgba(9,14,30,.65);border:1px solid var(--line-soft);border-radius:9px;color:#fff;font-size:15px;font-family:inherit;"></label>';
  }
  function selEl(label, id, obj) {
    var opts = Object.keys(obj).map(function (k) { return '<option value="' + k + '">' + esc(obj[k].name) + '</option>'; }).join("");
    return '<label style="display:block;font-size:12.5px;color:var(--text-muted);">' + esc(label) +
      '<select id="' + id + '" style="display:block;width:100%;margin-top:5px;padding:10px 12px;background:rgba(9,14,30,.65);border:1px solid var(--line-soft);border-radius:9px;color:#fff;font-size:15px;font-family:inherit;">' + opts + '</select></label>';
  }

  function readInputs() {
    var ni3 = String(val("netIncome3")).split(",").map(function (x) { return parseFloat(String(x).replace(/[, ]/g, "")); });
    var i = {
      name: val("vName"), age: num("age"), shares: num("shares"), equity: num("equity"),
      revenue: num("revenue"), ebitda: num("ebitda"), netDebt: num("netDebt"), sector: val("sector"),
      lastPost: num("lastPost"), monthsSince: num("monthsSince"), revGrowth: num("revGrowth"),
      netIncome3: ni3.length === 3 && ni3.every(isFinite) ? ni3 : null,
      exitRevenue: num("exitRevenue"), exitMultiple: num("exitMultiple"), exitYears: num("exitYears"), targetIRR: num("targetIRR"),
      fcf0: num("fcf0"), fcfGrowth: num("fcfGrowth"), wacc: num("wacc"), termGrowth: num("termGrowth"),
      opmEV: num("opmEV"), opmPref: num("opmPref"), opmVol: num("opmVol"), opmYears: num("opmYears"), opmRf: 3,
      mcEV: num("mcEV"), mcDrift: num("mcDrift"), mcVol: num("mcVol"), mcYears: 4, mcFail: num("mcFail"), mcDisc: 20,
      ownPct: num("ownPct"), nrr: num("nrr"), employees: num("employees"), stageSel: val("stageSel"),
      downRound: !!(document.getElementById("downRound") && document.getElementById("downRound").checked),
      marketRegime: (function () { var m = val("marketRegime"); return m === "" ? 0 : parseFloat(m); })(),
      regionAvg: NaN, qualScore: NaN, assetAdj: NaN, realEstate: false, netIncome3ok: false
    };
    var st = stageOf(i); i.stage = st.label; i.stageKey = st.key;
    i.under3yr = isFinite(i.age) && i.age < 3;
    return i;
  }

  function runAll(i0) {
    var gate = completenessOf(i0);
    var inf = inferDefaults(i0); var i = inf.i, ledger = inf.ledger;
    var out = [];
    // 시장배수 먼저 → calibration 교차수렴 신호로 전달 (Fable ①·④ 호출순서)
    var mkt = null;
    try { mkt = mMarket(i); } catch (e) {}
    var marketBase = mkt && isFinite(mkt.base) ? mkt.base : NaN;
    try { var rc = mCalibration(i, marketBase); if (rc) out.push(rc); } catch (e) {}
    if (mkt) out.push(mkt);
    [mVC, mDCF, mNetAsset, mSangjeungse, mOPM, mMonteCarlo].forEach(function (fn) {
      try { var r = fn(i); if (r) out.push(r); } catch (e) { /* skip */ }
    });
    // Fable TriAnchor-P: 부분·극소 정보 폴백 (Gate A는 미산출·회귀0)
    if (gate.tier !== "A") {
      if (!out.some(function (r) { return /시장 배수/.test(r.label); })) { try { var rs = mRevSimple(i); if (rs) out.push(rs); } catch (e) {} }
      try { var ph = mPerHead(i); if (ph) out.push(ph); } catch (e) {}
      try { out.push(mBenchmark(i)); } catch (e) {}
    }
    return { results: out, gate: gate, ledger: ledger, i: i };
  }

  function renderResult(i) {
    var ra = runAll(i);
    var results = ra.results, gate = ra.gate, ledger = ra.ledger;
    var el = document.getElementById("valResult");
    if (!results.length) { el.innerHTML = '<div class="warn" style="padding:14px 16px;border:1px solid rgba(184,151,58,.4);background:rgba(184,151,58,.08);border-radius:10px;color:#e8d9a8;font-size:13.5px;">입력값이 전혀 없습니다. 최소한 업종·단계만 골라도 시장 전형 범위를 보여드립니다.</div>'; return; }
    var syn = synthesize(results, ra.i);
    // 주주원장 연동: 평가 결과를 브리지에 기록 (Fable Bridge §3.3)
    if (syn && isFinite(syn.base) && syn.base > 0) {
      var su = (isFinite(i.shares) && i.shares > 0) ? i.shares : null;
      writeBridgeSection("valuation", { writtenBy: "valuation", at: new Date().toISOString(), companyName: (i.name || "").trim(), low: syn.low, base: syn.base, high: syn.high, sharesUsed: su, perShareBase: su ? syn.base / su : null, tier: gate.tier, conf: syn.conf });
    }
    // 게이트 배지 + 정보부족 문구 + 추론 원장 (Fable §4)
    var badge = gate.tier === "A" ? '<span style="background:rgba(46,160,90,.2);color:#8fe0b0;border:1px solid rgba(46,160,90,.5);border-radius:6px;padding:2px 9px;font-size:11.5px;font-weight:700;">입력 충분 A</span>'
      : gate.tier === "B" ? '<span style="background:rgba(184,151,58,.2);color:var(--gold-soft);border:1px solid rgba(184,151,58,.5);border-radius:6px;padding:2px 9px;font-size:11.5px;font-weight:700;">부분 입력 B</span>'
      : '<span style="background:rgba(201,80,80,.2);color:#ffb3b3;border:1px solid rgba(201,80,80,.5);border-radius:6px;padding:2px 9px;font-size:11.5px;font-weight:700;">극소정보 C</span>';
    var gmsg = gate.tier === "A" ? "" : gate.tier === "B" ? "일부 입력이 없어 " + ledger.length + "개 값을 업종·단계 전형치로 추정했습니다. 그만큼 범위가 넓습니다." : "정보가 매우 적어(극소정보) 시장 전형 범위 중심으로 산출했습니다. 개별 실적 미반영 — 자릿수 참고로만 보십시오.";
    var ledgerHtml = ledger.length ? '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:12px;color:var(--gold-soft);">▸ 추정값 사용 내역 (입력 아님 · ' + ledger.length + '건)</summary><ul style="margin:6px 0 0;padding-left:18px;font-size:11.5px;color:var(--text-dim);">' + ledger.map(function (l) { return '<li>' + esc(l.f) + ': <strong>' + esc(l.v) + '</strong> — ' + esc(l.b) + '</li>'; }).join("") + '</ul></details>' : "";
    var rows = results.map(function (r) {
      if (r.warn || !isFinite(r.base)) return '<tr><td>' + esc(r.label) + '</td><td colspan="3" style="color:#e8b3b3;">' + esc(r.note) + '</td></tr>';
      return '<tr><td style="font-weight:600;">' + esc(r.label) + '</td><td style="text-align:right;font-variant-numeric:tabular-nums;">' + money(r.low) + '</td><td style="text-align:right;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">' + money(r.base) + '</td><td style="text-align:right;font-variant-numeric:tabular-nums;">' + money(r.high) + '</td></tr>' +
        '<tr><td colspan="4" style="font-size:11.5px;color:var(--text-dim);padding:0 0 8px 4px;">' + esc(r.note) + (r.extra ? ' <span style="color:var(--gold-soft);">' + esc(r.extra) + '</span>' : "") + '</td></tr>';
    }).join("");
    var synHtml = syn ? '<div style="margin-bottom:16px;padding:18px 20px;border:1px solid rgba(201,162,39,.4);border-radius:14px;background:linear-gradient(162deg,rgba(24,34,64,.7),rgba(13,22,46,.5));">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><div style="font-size:12px;font-weight:700;color:var(--gold-soft);letter-spacing:.06em;text-transform:uppercase;">KVMI 종합 · 모형 산출 추정 범위 (통계적 신뢰구간 아님)</div>' + badge + '</div>' +
      (gmsg ? '<div style="font-size:12px;color:#e8d9a8;margin-top:6px;background:rgba(184,151,58,.1);border:1px solid rgba(184,151,58,.3);border-radius:8px;padding:8px 11px;">' + esc(gmsg) + '</div>' : "") +
      '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:8px;">' +
      '<div style="font-size:32px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;">' + money(syn.low) + ' ~ ' + money(syn.high) + '</div>' +
      '<div style="font-size:14px;color:var(--text-muted);">방법 중앙값 ' + money(syn.base) + '</div></div>' +
      '<div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;">단계: <strong style="color:var(--gold-soft);">' + esc(i.stage) + '</strong> · 적용 방법 ' + syn.nAll + '개(이상치 제외 ' + syn.n + '개) · 방법 간 산포: <strong>' + (syn.conf === "높음" ? "작음(방법 일치)" : syn.conf === "보통" ? "보통" : "큼(방법 불일치)") + '</strong></div>' +
      '<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">전 방법 최저~최고(실패 시나리오·업사이드 포함): ' + money(syn.downside) + ' ~ ' + money(syn.upside) + '. 헤드라인 범위 = 방법별 중앙 추정의 25~75분위(모형 산출값의 분위수이며 시장 신뢰구간이 아님).</div>' +
      '<div style="font-size:11.5px;color:#e8b3b3;margin-top:8px;">※ 이 값은 <strong>공식 평가액·감정가·회계상 공정가치가 아니라 서로 다른 방법의 산출값을 모아 본 교육용 참고 범위</strong>입니다. 방법들이 같은 입력을 재사용하므로 값이 가까워도 독립 검증이 아닙니다. 산포가 크면 그만큼 불확실하다는 뜻이며, 실제 평가·거래·신고·회계·LP 보고엔 자격 전문가 평가가 필요합니다.</div>' +
      ledgerHtml +
      '</div>' : "";
    el.innerHTML = synHtml +
      '<div class="ds-panel" style="padding:20px;border:1px solid var(--line);border-radius:14px;background:rgba(13,22,46,.55);overflow-x:auto;">' +
      '<h3 style="font-size:15px;margin-bottom:10px;">방법별 결과 (낮음 · 중앙 · 높음)</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;"><thead><tr style="color:var(--text-dim);font-size:11.5px;text-align:left;border-bottom:1px solid var(--line);"><th style="padding:6px 4px;">방법</th><th style="text-align:right;">낮음</th><th style="text-align:right;">중앙</th><th style="text-align:right;">높음</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p style="font-size:11.5px;color:var(--text-dim);margin-top:10px;">방법마다 전제·데이터가 다릅니다. 값이 서로 크게 다르면 그 자체가 "불확실성이 크다"는 신호입니다.</p></div>';
    document.getElementById("valResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ══════════════ 포트폴리오 (localStorage·LP 관리) ══════════════ */
  var PKEY = "kvmi_val_portfolio_v1";
  function loadP() { try { return JSON.parse(localStorage.getItem(PKEY) || "[]"); } catch (e) { return []; } }
  function saveP(a) { try { localStorage.setItem(PKEY, JSON.stringify(a)); } catch (e) {} }
  /* ── 주주원장 연동 브리지 (Fable Bridge·같은 origin localStorage 공유) ── */
  var BKEY = "kvmi_bridge_v1";
  function readBridge() { try { var b = JSON.parse(localStorage.getItem(BKEY)); return (b && b.schemaVersion === 1) ? b : null; } catch (e) { return null; } }
  function writeBridgeSection(section, data) { try { var b = readBridge() || { schemaVersion: 1 }; b[section] = data; localStorage.setItem(BKEY, JSON.stringify(b)); } catch (e) {} }
  function addToP(i) {
    var ra = runAll(i); var syn = synthesize(ra.results, ra.i);
    if (!syn) { alert("계산 가능한 값이 없어 추가할 수 없습니다."); return; }
    var arr = loadP();
    arr.push({ name: i.name || "(무명 " + (arr.length + 1) + ")", stage: i.stage, low: syn.low, base: syn.base, high: syn.high, conf: syn.conf, date: (document.getElementById("valAsOf") && document.getElementById("valAsOf").value) || "" });
    saveP(arr); renderP();
    document.getElementById("valPortfolio").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function renderP() {
    var arr = loadP(); var el = document.getElementById("valPortfolio");
    if (!arr.length) { el.innerHTML = ""; return; }
    var tot = arr.reduce(function (a, h) { return { low: a.low + h.low, base: a.base + h.base, high: a.high + h.high }; }, { low: 0, base: 0, high: 0 });
    var rows = arr.map(function (h, idx) {
      return '<tr><td style="font-weight:600;">' + esc(h.name) + '</td><td style="font-size:12px;color:var(--text-dim);">' + esc(h.stage || "") + '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums;">' + money(h.low) + '</td><td style="text-align:right;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">' + money(h.base) + '</td><td style="text-align:right;font-variant-numeric:tabular-nums;">' + money(h.high) + '</td>' +
        '<td style="text-align:center;font-size:12px;">' + esc(h.conf) + '</td>' +
        '<td style="text-align:center;"><button type="button" data-del="' + idx + '" class="btn btn--ghost" style="font-size:11px;padding:3px 8px;">삭제</button></td></tr>';
    }).join("");
    el.innerHTML = '<div class="ds-panel" style="padding:20px;border:1px solid var(--line);border-radius:14px;background:rgba(13,22,46,.55);overflow-x:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;"><h3 style="font-size:15px;">② 포트폴리오 (LP 관리 · 브라우저 로컬 저장)</h3>' +
      '<div style="display:flex;gap:8px;"><button id="valCsv" type="button" class="btn btn--navy" style="font-size:12px;">CSV 내보내기</button><button id="valWipe" type="button" class="btn btn--ghost" style="font-size:12px;">전체 삭제</button></div></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:600px;"><thead><tr style="color:var(--text-dim);font-size:11.5px;text-align:left;border-bottom:1px solid var(--line);"><th style="padding:6px 4px;">보유기업</th><th>단계</th><th style="text-align:right;">낮음</th><th style="text-align:right;">중앙</th><th style="text-align:right;">높음</th><th style="text-align:center;">신뢰</th><th></th></tr></thead><tbody>' + rows +
      '<tr style="border-top:2px solid var(--line);font-weight:800;"><td colspan="2" style="padding-top:8px;">포트폴리오 합산 추정 범위(단순합·참고)</td><td style="text-align:right;color:var(--gold-soft);font-variant-numeric:tabular-nums;padding-top:8px;">' + money(tot.low) + '</td><td style="text-align:right;color:#fff;font-variant-numeric:tabular-nums;padding-top:8px;">' + money(tot.base) + '</td><td style="text-align:right;color:var(--gold-soft);font-variant-numeric:tabular-nums;padding-top:8px;">' + money(tot.high) + '</td><td colspan="2"></td></tr>' +
      '</tbody></table>' +
      '<p style="font-size:11.5px;color:#e8b3b3;margin-top:10px;">※ 합산은 각 보유지분 참고 범위의 단순 합입니다. 실제 펀드 NAV·LP 보고는 IPEV/IFRS13에 따른 자격자 평가가 필요하며, 본 합산은 교육·내부 검토용 참고입니다. 데이터는 이 브라우저에만 저장됩니다.</p></div>';
  }
  function exportCsv() {
    var arr = loadP(); if (!arr.length) return;
    var head = "기업,단계,낮음(원),중앙(원),높음(원),신뢰\n";
    var body = arr.map(function (h) { return '"' + String(h.name).replace(/"/g, '""') + '","' + (h.stage || "") + '",' + Math.round(h.low) + "," + Math.round(h.base) + "," + Math.round(h.high) + "," + h.conf; }).join("\n");
    var blob = new Blob(["﻿" + head + body], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kvmi_portfolio_valuation.csv"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ══════════════ 방법론 해설(정적) ══════════════ */
  var DOCS = [
    ["IPEV·IFRS13 공정가치 (LP 표준)", "전세계 PE/VC 펀드가 LP 보고용으로 비상장 지분을 평가하는 국제표준(IPEV 2025·IFRS13/ASC820). 공정가치 = 측정일에 시장참여자 간 정상거래에서 매도 시 받을 가격. 직전 라운드 calibration·시장배수·DCF·순자산을 상황에 맞게 사용."],
    ["직전 라운드 calibration", "가장 최근 투자 라운드 가격을 출발점으로, 경과기간·성과를 반영해 보정. 특수조건(우선권·구조화)은 별도 판단 필요."],
    ["시장 배수 (EV/Revenue·EBITDA)", "유사 상장/거래 기업의 배수를 적용. 해외 배수를 한국 비상장에 쓸 땐 유동성·규모·성장 차이로 보정·할인 필요."],
    ["VC 방법", "예상 exit 가치를 목표 수익률로 현재가치 할인. 초기 투자 협상에서 흔히 사용. 가정에 민감."],
    ["DCF", "미래 잉여현금흐름을 WACC로 할인. 안정적 현금흐름 기업에 적합하며, 적자·초기 벤처엔 부적합."],
    ["OPM·PWERM·몬테카를로", "우선주·보통주 등 복잡 자본구조를 청산우선권 순위(waterfall)로 배분. OPM(옵션가격)·PWERM(시나리오 확률)·몬테카를로(경로 시뮬레이션)로 fair value 배분. 변동성·시나리오 가정에 민감."],
    ["순자산가치", "자산 공정가치에서 부채를 차감. 성장가치 미반영 → 성장 벤처엔 하한 성격."],
    ["초기 정성 (Berkus·Scorecard·Risk Factor)", "매출 이전 단계에서 팀·시장·제품 등 정성 요소로 근사. 매우 주관적."],
    ["상증세법 §54 (국내 법정·교육용)", "한국 세법상 비상장주식 보충적 평가. 순손익가치×3 + 순자산가치×2 ÷ 5(순자산 80% 하한). 세법상 순자산은 회계 자본총계와 달라 실제 세무신고엔 세무사 검토 필요."]
  ];
  function renderDocs() {
    if (!docsEl) return;
    docsEl.innerHTML = DOCS.map(function (d) {
      return '<div style="padding:14px 18px;border:1px solid var(--line);border-radius:12px;background:var(--card-bg);"><strong style="color:#fff;font-size:14px;">' + esc(d[0]) + '</strong><p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-top:5px;">' + esc(d[1]) + '</p></div>';
    }).join("");
  }

  /* ══════════════ 초기화·이벤트 ══════════════ */
  app.innerHTML = FORM;
  renderDocs(); renderP();
  // 클릭 동의 게이트 (R8 법적 방어) — 동의 전 계산/추가 버튼 비활성
  var consent = document.getElementById("valConsent");
  function gate() {
    var ok = consent && consent.checked;
    ["valRun", "valAdd", "valFromLedger"].forEach(function (id) {
      var b = document.getElementById(id); if (b) { b.disabled = !ok; b.style.opacity = ok ? "1" : "0.45"; b.style.cursor = ok ? "pointer" : "not-allowed"; }
    });
  }
  if (consent) { consent.addEventListener("change", gate); gate(); }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.id === "valRun") { if (!consent || !consent.checked) { alert("상단의 이용 동의에 체크해 주세요."); return; } renderResult(readInputs()); }
    else if (t.id === "valAdd") { if (!consent || !consent.checked) { alert("상단의 이용 동의에 체크해 주세요."); return; } addToP(readInputs()); }
    else if (t.id === "valFromLedger") {
      if (!consent || !consent.checked) { alert("상단의 이용 동의에 체크해 주세요."); return; }
      var b = readBridge(), L = b && b.ledger;
      if (!L || !L.company) { alert("주주원장 데이터가 없습니다.\n/shareholders/?preview 에서 회사·주식 이벤트를 먼저 등록하세요."); return; }
      var msg = [];
      if (L.company.name) { document.getElementById("vName").value = L.company.name; msg.push("회사명"); }
      if (isFinite(L.company.sharesOutstanding) && L.company.sharesOutstanding > 0) { document.getElementById("shares").value = L.company.sharesOutstanding; msg.push("발행주식총수 " + L.company.sharesOutstanding.toLocaleString() + "주"); }
      else { msg.push("(발행주식 0주 — 원장에서 설립발행을 먼저 등록하세요)"); }
      var ageD = (Date.now() - Date.parse(L.at)) / 864e5;
      alert("주주원장에서 불러왔습니다: " + msg.join(" · ") +
        (isFinite(L.company.capital) && L.company.capital > 0 ? "\n\n참고: 원장 자본금 " + money(L.company.capital) + " — 자본금은 자기자본(자본총계)이 아니므로 자동 입력하지 않았습니다. 재무제표의 자본총계를 [자기자본] 칸에 직접 입력하세요." : "") +
        (isFinite(ageD) && ageD > 90 ? "\n주의: 원장 기록이 " + Math.floor(ageD) + "일 전입니다." : ""));
    }
    else if (t.id === "valClear") { app.querySelectorAll("input").forEach(function (el) { el.value = ""; }); document.getElementById("valResult").innerHTML = ""; }
    else if (t.id === "valCsv") exportCsv();
    else if (t.id === "valWipe") { if (confirm("포트폴리오를 모두 삭제할까요?")) { saveP([]); renderP(); } }
    else if (t.getAttribute && t.getAttribute("data-del") != null) { var arr = loadP(); arr.splice(+t.getAttribute("data-del"), 1); saveP(arr); renderP(); }
  });
  // 주주원장 CSV 가져오기 (파일 브리지 역방향·Fable §3.4)
  document.addEventListener("change", function (e) {
    if (e.target.id !== "valImpCsv") return;
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var text = String(rd.result).replace(/^﻿/, "");
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (lines.length < 2) throw "행 부족";
        var parseLine = function (line) { var o = [], cur = "", q = false; for (var c = 0; c < line.length; c++) { var ch = line[c]; if (q) { if (ch === '"') { if (line[c + 1] === '"') { cur += '"'; c++; } else q = false; } else cur += ch; } else { if (ch === '"') q = true; else if (ch === ',') { o.push(cur); cur = ""; } else cur += ch; } } o.push(cur); return o; };
        var head = parseLine(lines[0]).map(function (h) { return h.trim(); });
        var iName = head.indexOf("회사명"), iN = head.indexOf("발행주식총수"), iSh = head.indexOf("주식수");
        if (iSh < 0) throw "주식수 열 없음";
        var sum = 0, company = "", declared = NaN, rows = 0;
        for (var r = 1; r < lines.length; r++) {
          var cells = parseLine(lines[r]);
          var n = parseFloat(String(cells[iSh]).replace(/[, ]/g, ""));
          if (!isFinite(n) || n < 0 || n !== Math.floor(n)) throw (r + 1) + "행 주식수 형식 오류";
          sum += n; rows++;
          if (iName >= 0 && !company) company = String(cells[iName] || "").trim();
          if (iN >= 0 && !isFinite(declared)) declared = parseFloat(String(cells[iN]).replace(/[, ]/g, ""));
        }
        if (!rows || sum <= 0) throw "유효 데이터 없음";
        var mismatch = isFinite(declared) && declared !== sum;
        document.getElementById("shares").value = isFinite(declared) ? declared : sum;
        if (company) document.getElementById("vName").value = company;
        alert("가져오기 완료: " + rows + "행 · 발행주식총수 " + (isFinite(declared) ? declared : sum).toLocaleString() + "주" + (company ? " · " + company : "") + (mismatch ? "\n주의: 파일 발행총수(" + declared.toLocaleString() + ")와 행 합계(" + sum.toLocaleString() + ")가 다릅니다. 파일값을 채택했습니다 — 원본 확인 권장." : ""));
      } catch (err) { alert("가져오기 실패: " + err + "\n주주원장에서 내보낸 CSV(주주명·주식수 열 포함)인지 확인하세요. 기존 입력은 변경되지 않았습니다."); }
      e.target.value = "";
    };
    rd.readAsText(f, "utf-8");
  });
})();
