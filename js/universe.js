/* =========================================================================
   벤처 유니버스 (Venture Universe) v2 — Canvas2D 우주 쇼케이스 · 의존성 0
   3자 토론(vmi_universe_2x_hyperreal_20260621·R1~R6) 합의 스펙.
   - 별·은하(현상)·우주선 2배 밀도
   - 오프스크린 스프라이트 캐시: 우주선 극사실화 + 현상 그라디언트 병목 제거
   - 매우 느리고 고요한 모션(px/초·dt 기반) · 워프 240초당 1회 · 별똥별 희귀
   - 별 심도 3레이어 정적 캐시 + 7% 라이브 반짝임(장주기·저진폭)
   - 성능 자동 감축 사다리 내장 · prefers-reduced-motion 존중
   ========================================================================= */
(function () {
  "use strict";
  var cv = document.getElementById("universe") || document.getElementById("cosmicCanvas");
  if (!cv) return;
  var homeMode = cv.id === "cosmicCanvas";
  // 박사 "별·흰점·동그라미 모두 거슬림" → 홈/콘텐츠 페이지 배경 엔진 전면 정지(정적 네이비 배경·vmi_bg_redesign B′). 전용 쇼케이스 /universe/만 유지.
  if (homeMode) return;
  var ctx = cv.getContext("2d");
  var isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);   // 모바일 1.25→1.5 (라벨·pill 텍스트 선명도·DPR3 기기)
  var W = 0, H = 0, T = 0, last = performance.now();
  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function starCol() { var r = Math.random(); return r < 0.6 ? "rgba(255,201,150," : r < 0.85 ? "rgba(255,247,232," : "rgba(184,208,255,"; }
  // 실사 색온도 5종(O/B 청 → M 주황적·박사 "실사 다양"). ImageData 직접 기록용 RGB.
  var STAR_SPECTRA = [[150,185,255], [200,220,255], [255,251,246], [255,240,208], [255,196,148]];
  function starSpec() { var r = Math.random(); return r < 0.18 ? 0 : r < 0.38 ? 1 : r < 0.62 ? 2 : r < 0.82 ? 3 : 4; }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  // 박사님 "움직임을 느낄 수 있게" 명시 → 무조건 가동(reduced-motion 강제정지 해제·과거 'off' 잔재 무력화 위해 키 교체).
  // 'off' 저장 시에만 ambient(반짝임·호흡만). ▶ 토글은 정지/재생.
  var full = (function () { try { return localStorage.getItem("vmiMotion") !== "off"; } catch (e) { return true; } })();
  var animate = true;

  // ── 2배 밀도 CAP + LOD 비율 (3자 토론 합의) ──
  // 박사 7배(데스크톱): 별 밀도 ×7(starDiv 85→12)·현상 ×7(460→3220). 모바일은 성능상 ×3 보수(폭사 방지·정직).
  var CAP = isMobile
    ? { ships: 480, phen: 420, starDiv: 55, starMax: 32000, lodGlyph: 0.06, lodSprite: 0.008 }
    : { ships: 1200, phen: 1400, starDiv: 4, starMax: 600000, lodGlyph: 0.10, lodSprite: 0.012 };

  /* ───────── 500+ 우주 현상 카탈로그 ───────── */
  var CATALOG = [
    ["원시성운 (Protostellar Nebula)", "STELLAR", "nebula"],
    ["성운 기둥 (Pillars of Creation)", "STELLAR", "nebula"],
    ["주계열성 (Main-sequence Star)", "STELLAR", "star"],
    ["적색거성 (Red Giant)", "STELLAR", "giant"],
    ["청색초거성 (Blue Supergiant)", "STELLAR", "giant"],
    ["황색왜성 (Yellow Dwarf)", "STELLAR", "star"],
    ["적색왜성 (Red Dwarf)", "STELLAR", "star"],
    ["갈색왜성 (Brown Dwarf)", "STELLAR", "star"],
    ["백색왜성 (White Dwarf)", "STELLAR", "whitedwarf"],
    ["볼프-레이에별 (Wolf–Rayet Star)", "STELLAR", "giant"],
    ["세페이드 변광성 (Cepheid Variable)", "STELLAR", "pulse"],
    ["원시행성원반 (Protoplanetary Disk)", "STELLAR", "disk"],
    ["허빅-아로 천체 (Herbig–Haro Object)", "STELLAR", "jet"],
    ["산개성단 (Open Cluster)", "STELLAR", "cluster"],
    ["구상성단 (Globular Cluster)", "STELLAR", "cluster"],
    ["성협 (Stellar Association)", "STELLAR", "cluster"],
    ["초신성 폭발 (Supernova)", "CATACLYSM", "supernova"],
    ["초신성 잔해 (Supernova Remnant)", "CATACLYSM", "nebula"],
    ["극초신성 (Hypernova)", "CATACLYSM", "supernova"],
    ["감마선 폭발 (Gamma-Ray Burst)", "CATACLYSM", "jet"],
    ["킬로노바 (Kilonova)", "CATACLYSM", "supernova"],
    ["신성 (Nova)", "CATACLYSM", "pulse"],
    ["행성상성운 (Planetary Nebula)", "CATACLYSM", "ring"],
    ["게성운 (Crab Nebula)", "CATACLYSM", "nebula"],
    ["펄사 (Pulsar)", "CATACLYSM", "pulsar"],
    ["마그네타 (Magnetar)", "CATACLYSM", "pulsar"],
    ["중성자별 (Neutron Star)", "CATACLYSM", "whitedwarf"],
    ["조석 교란 사건 (Tidal Disruption)", "CATACLYSM", "jet"],
    ["항성질량 블랙홀 (Stellar Black Hole)", "GRAVITY", "blackhole"],
    ["초대질량 블랙홀 (Supermassive BH)", "GRAVITY", "blackhole"],
    ["사건의 지평선 (Event Horizon)", "GRAVITY", "blackhole"],
    ["강착원반 (Accretion Disk)", "GRAVITY", "disk"],
    ["상대론적 제트 (Relativistic Jet)", "GRAVITY", "jet"],
    ["중력렌즈 (Gravitational Lens)", "GRAVITY", "lens"],
    ["아인슈타인 고리 (Einstein Ring)", "GRAVITY", "ring"],
    ["중력파 (Gravitational Wave)", "GRAVITY", "wave"],
    ["퀘이사 (Quasar)", "GRAVITY", "jet"],
    ["블레이자 (Blazar)", "GRAVITY", "pulse"],
    ["전파은하 (Radio Galaxy)", "GRAVITY", "jet"],
    ["웜홀 가설 (Wormhole)", "GRAVITY", "lens"],
    ["나선은하 (Spiral Galaxy)", "GALACTIC", "spiral"],
    ["막대나선은하 (Barred Spiral)", "GALACTIC", "spiral"],
    ["타원은하 (Elliptical Galaxy)", "GALACTIC", "elliptical"],
    ["불규칙은하 (Irregular Galaxy)", "GALACTIC", "cluster"],
    ["왜소은하 (Dwarf Galaxy)", "GALACTIC", "elliptical"],
    ["은하 충돌 (Galaxy Merger)", "GALACTIC", "spiral"],
    ["은하단 (Galaxy Cluster)", "GALACTIC", "cluster"],
    ["초은하단 (Supercluster)", "GALACTIC", "cluster"],
    ["우주 거대구조 필라멘트 (Cosmic Web)", "GALACTIC", "web"],
    ["보이드 (Cosmic Void)", "GALACTIC", "void"],
    ["스타버스트 은하 (Starburst Galaxy)", "GALACTIC", "spiral"],
    ["활동은하핵 (AGN)", "GALACTIC", "blackhole"],
    ["발광성운 (Emission Nebula)", "NEBULA", "nebula"],
    ["반사성운 (Reflection Nebula)", "NEBULA", "nebula"],
    ["암흑성운 (Dark Nebula)", "NEBULA", "void"],
    ["분자운 (Molecular Cloud)", "NEBULA", "nebula"],
    ["보크 구상체 (Bok Globule)", "NEBULA", "void"],
    ["성간먼지 (Interstellar Dust)", "NEBULA", "web"],
    ["우주 자기장 (Cosmic Magnetism)", "NEBULA", "wave"],
    ["외계행성 (Exoplanet)", "PLANETARY", "planet"],
    ["뜨거운 목성 (Hot Jupiter)", "PLANETARY", "planet"],
    ["슈퍼지구 (Super-Earth)", "PLANETARY", "planet"],
    ["고리 행성 (Ringed Planet)", "PLANETARY", "ringplanet"],
    ["외계행성 식 (Transit)", "PLANETARY", "transit"],
    ["위성계 (Moon System)", "PLANETARY", "planet"],
    ["소행성대 (Asteroid Belt)", "PLANETARY", "belt"],
    ["카이퍼 벨트 (Kuiper Belt)", "PLANETARY", "belt"],
    ["오르트 구름 (Oort Cloud)", "PLANETARY", "belt"],
    ["혜성 (Comet)", "PLANETARY", "comet"],
    ["장주기 혜성 (Long-period Comet)", "PLANETARY", "comet"],
    ["유성우 (Meteor Shower)", "PLANETARY", "meteor"],
    ["조석 고정 (Tidal Locking)", "PLANETARY", "planet"],
    ["쌍성계 (Binary System)", "PLANETARY", "binary"],
    ["삼중성계 (Trinary System)", "PLANETARY", "binary"],
    ["오로라 (Aurora)", "PLANETARY", "aurora"],
    ["태양 플레어 (Solar Flare)", "PLANETARY", "pulse"],
    ["코로나 질량 방출 (CME)", "PLANETARY", "pulse"],
    ["태양풍 (Solar Wind)", "PLANETARY", "wave"],
    ["우주배경복사 (CMB)", "COSMOLOGY", "web"],
    ["빅뱅 잔광 (Afterglow)", "COSMOLOGY", "nebula"],
    ["암흑물질 헤일로 (Dark Matter Halo)", "COSMOLOGY", "void"],
    ["암흑에너지 팽창 (Dark Energy)", "COSMOLOGY", "wave"],
    ["적색편이 (Redshift)", "COSMOLOGY", "wave"],
    ["청색편이 (Blueshift)", "COSMOLOGY", "wave"],
    ["재이온화 시대 (Reionization)", "COSMOLOGY", "nebula"],
    ["최초의 별 (Population III)", "COSMOLOGY", "giant"],
    ["우주 끈 가설 (Cosmic String)", "COSMOLOGY", "jet"],
    ["다중우주 가설 (Multiverse)", "COSMOLOGY", "lens"],
    ["딥필드 관측 (Deep Field)", "EXPLORE", "cluster"],
    ["중력파 간섭계 (Interferometer)", "EXPLORE", "wave"],
    ["전파망원경 어레이 (VLA)", "EXPLORE", "web"],
    ["우주 정거장 (Space Station)", "EXPLORE", "station"],
    ["라그랑주점 관측소 (L2 Observatory)", "EXPLORE", "station"],
    ["성간 탐사선 (Interstellar Probe)", "EXPLORE", "ship"],
    ["태양돛 (Solar Sail)", "EXPLORE", "ship"],
    ["세대 우주선 (Generation Ship)", "EXPLORE", "ship"],
    ["채굴 함대 (Mining Fleet)", "EXPLORE", "ship"],
    ["다이슨 스피어 (Dyson Sphere)", "EXPLORE", "ring"],
    ["워프 항로 (Warp Lane)", "EXPLORE", "wave"],
    ["테라포밍 행성 (Terraforming)", "EXPLORE", "planet"],
    ["우주 엘리베이터 (Space Elevator)", "EXPLORE", "jet"],
    ["콜로니 군집 (Colony Cluster)", "EXPLORE", "cluster"],
    ["귀환 캡슐 (Return Capsule)", "EXPLORE", "ship"],
    ["심우주 통신망 (Deep Space Network)", "EXPLORE", "web"],
    ["소행성 자원 채굴 (Asteroid Mining)", "EXPLORE", "belt"],
    ["궤도 도킹 (Orbital Docking)", "EXPLORE", "station"]
  ];
  (function () {
    var dso = ["nebula", "cluster", "spiral", "elliptical", "nebula", "cluster", "star", "blackhole"];
    for (var m = 1; m <= 110; m++) CATALOG.push(["M" + m + " (Messier " + m + ")", "GALACTIC", dso[m % dso.length]]);
    for (var n = 1; n <= 220; n++) CATALOG.push(["NGC " + n, "NEBULA", dso[n % dso.length]]);
    for (var ic = 1; ic <= 60; ic++) CATALOG.push(["IC " + ic, "NEBULA", dso[(ic + 3) % dso.length]]);
    var sn = ["시리우스 (Sirius)", "카노푸스 (Canopus)", "리겔 (Rigel)", "베텔게우스 (Betelgeuse)", "베가 (Vega)", "아르크투루스 (Arcturus)", "카펠라 (Capella)", "프로키온 (Procyon)", "아케르나르 (Achernar)", "알타이르 (Altair)", "알데바란 (Aldebaran)", "안타레스 (Antares)", "스피카 (Spica)", "폴룩스 (Pollux)", "포말하우트 (Fomalhaut)", "데네브 (Deneb)", "레굴루스 (Regulus)", "카스토르 (Castor)", "벨라트릭스 (Bellatrix)", "폴라리스 (Polaris)", "미라 (Mira)", "알골 (Algol)", "알니탁 (Alnitak)", "알닐람 (Alnilam)", "민타카 (Mintaka)", "사이프 (Saiph)", "두브헤 (Dubhe)", "알카이드 (Alkaid)", "미자르 (Mizar)", "알코르 (Alcor)", "하다르 (Hadar)", "아크룩스 (Acrux)", "가크룩스 (Gacrux)", "엘나스 (Elnath)", "알페라츠 (Alpheratz)", "미르파크 (Mirfak)", "샤울라 (Shaula)", "나오스 (Naos)", "라스알게티 (Rasalgethi)"];
    for (var s2 = 0; s2 < sn.length; s2++) CATALOG.push([sn[s2], "STELLAR", s2 % 4 === 0 ? "giant" : "star"]);
    var exo = ["케플러-22b (Kepler-22b)", "트라피스트-1 (TRAPPIST-1)", "프록시마 b (Proxima b)", "51 페가시 b (51 Pegasi b)", "HD 209458 b", "글리제 581 (Gliese 581)", "케플러-452b", "케플러-186f", "HD 189733 b", "WASP-12b", "55 캔크리 e (55 Cancri e)", "글리제 667C", "TOI-700 d", "케플러-16b", "케플러-442b", "LHS 1140 b", "K2-18b", "로스 128 b (Ross 128 b)", "티가든의 별 b (Teegarden b)", "울프 1061c (Wolf 1061c)"];
    for (var ex2 = 0; ex2 < exo.length; ex2++) CATALOG.push([exo[ex2], "PLANETARY", "planet"]);
  })();

  var GOLD = "rgba(201,162,39,";
  var ICE = "rgba(201,215,232,";
  var palette = ["rgba(226,232,244,", "rgba(150,180,235,", "rgba(201,162,39,", "rgba(186,150,255,", "rgba(120,200,220,"];
  var palIdx = {}; for (var pi = 0; pi < palette.length; pi++) palIdx[palette[pi]] = pi;
  // 세련된 8색 팔레트 (박사님 "색도 모두 달라야"·형광 원색 금지·연구기관 품격)
  var SHIPTONE = [
    "rgba(206,214,226,", // 티타늄 실버
    "rgba(224,176,96,",  // 웜 앰버
    "rgba(150,198,232,", // 아이스 블루
    "rgba(226,200,120,", // 페일 골드
    "rgba(206,150,110,", // 뮤트 코퍼
    "rgba(140,202,196,", // 소프트 틸
    "rgba(186,180,214,", // 라벤더 그레이
    "rgba(234,228,214,"  // 웜 화이트
  ];
  var SHIP_SIZES = isMobile ? [6, 10, 14] : [8, 13, 19];   // LOD2 본체 px (실사 스케일·상한 22)
  var SHIP_RATIOS = [0.88, 1.0, 1.12];                      // hull 길이 비율 변이

  // 애니메이션 필수 현상(인라인) — 나머지는 전부 오프스크린 스프라이트 캐시
  // 주기 현상만 인라인(반복이 과학적으로 맞음). supernova·meteor는 고정반복 폐기 → 전역 희귀 이벤트/shooters로 이관.
  var ANIM = { pulse: 1, pulsar: 1, binary: 1, transit: 1, wave: 1 };
  // 그릴 때 screen(가산 글로우) 합성할 캐시 현상
  var SCREENY = { nebula: 1, spiral: 1, elliptical: 1, giant: 1, star: 1, whitedwarf: 1, disk: 1, ring: 1, lens: 1, jet: 1, aurora: 1, cluster: 1, web: 1, comet: 1, belt: 1 };
  // 그릴 때 외부 회전 적용할 캐시 현상
  var ROTATES = { spiral: 1, blackhole: 1, disk: 1, ring: 1, jet: 1, belt: 1 };

  var stars = { layers: [], twinkle: [], pad: 64 };
  var phenomena = [], ships = [], shooters = [];
  var phenCache = {}, shipCache = {};
  var warpTimer = rnd(15, 40), shootTimer = rnd(3, 10), activeWarps = 0;
  // 전역 대형 이벤트 스케줄러(단일·상태머신·타이머 누적 방지): supernova(원형 팽창)·grb(양극 빔). 희귀·1회성·동시1.
  var bigEvent = null, bigTimer = rnd(40, 60), lastBigType = "", bigCool = 0;
  var showerTimer = rnd(120, 180), showerQueue = [], showerCool = 0;
  var px = 0, py = 0, tx = 0, ty = 0;
  var quality = 1; // 자동 감축 계수

  /* ── 모바일 라벨 배치 시스템 (2026-07-21 모바일 재설계) ──
     데스크톱은 기존 그대로(라벨 밀도=정체성·인라인 fillText 유지).
     모바일만: 화면당 예산(성좌 2 + 현상 3)·AABB 충돌 회피·히어로/상단바 금지영역·
     엣지 클램프(우측 우선→좌측 폴백)·pill 배경으로 소수 라벨을 '정보'로 복원. */
  var exZones = [];                                  // 금지영역(실제 DOM rect 기반)
  var labelPool = [];                                // 라벨 후보(depth×feat 내림차순·최근접 우선)
  var MOB_LBL = { constel: 2, phen: 3 };             // 화면당 예산
  var mobRects = [], mobUsed = { constel: 0, phen: 0 };
  function computeExclusions() {
    exZones = [];
    if (!isMobile) return;
    var els = [document.querySelector(".u-top"), document.querySelector(".u-hero")];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var r = els[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) exZones.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    }
    if (!exZones.length) {                           // DOM 부재 폴백(보수적)
      exZones.push({ x: 0, y: 0, w: W, h: 96 });
      exZones.push({ x: 0, y: H * 0.52, w: W, h: H * 0.48 });
    }
  }
  function mobLabelReset() { mobRects.length = 0; mobUsed.constel = 0; mobUsed.phen = 0; }
  function rectHits(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function rectBlocked(r) {
    for (var i = 0; i < exZones.length; i++) if (rectHits(r, exZones[i])) return true;
    for (var j = 0; j < mobRects.length; j++) if (rectHits(r, mobRects[j])) return true;
    return false;
  }
  function roundRectPath(c, x, y, w, h, rr) {
    c.beginPath();
    c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
    c.lineTo(x + w, y + h - rr); c.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
    c.lineTo(x + rr, y + h); c.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
    c.lineTo(x, y + rr); c.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
    c.closePath();
  }
  function tryMobLabel(kindKey, text, x, y, colStr) {
    if (mobUsed[kindKey] >= MOB_LBL[kindKey]) return false;
    ctx.font = kindKey === "phen" ? "10px ui-monospace, Menlo, Consolas, monospace" : "10.5px 'Pretendard Variable', ui-sans-serif, sans-serif";
    var twd = ctx.measureText(text).width, hh = 17, padX = 6, bw = twd + padX * 2;
    var cands = [x + 12, x - 12 - bw];               // 우측 우선 → 좌측 폴백(엣지 클리핑)
    for (var i = 0; i < 2; i++) {
      var r = { x: cands[i], y: y - hh / 2, w: bw, h: hh };
      if (r.x < 6 || r.x + r.w > W - 6 || r.y < 6 || r.y + r.h > H - 6) continue;
      if (rectBlocked(r)) continue;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(201,215,232,0.35)"; ctx.lineWidth = 1;   // 천체→pill 연결선
      ctx.beginPath(); ctx.moveTo(i === 0 ? x + 5 : x - 5, y); ctx.lineTo(i === 0 ? r.x - 1 : r.x + r.w + 1, y); ctx.stroke();
      ctx.fillStyle = "rgba(6,10,22,0.58)";
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 5); ctx.fill();
      ctx.fillStyle = colStr;
      ctx.fillText(text, r.x + padX, y + 3.5);
      mobRects.push({ x: r.x - 8, y: r.y - 8, w: r.w + 16, h: r.h + 16 });   // 라벨 간 여백 8px 확보
      mobUsed[kindKey]++;
      return true;
    }
    return false;
  }
  function buildLabelPool() {
    labelPool = [];
    if (!isMobile) return;
    for (var i = 0; i < phenomena.length; i++) { var p = phenomena[i]; if (p.show && p.depth > 0.6) labelPool.push(p); }
    labelPool.sort(function (a, b) { return b.depth * b.feat - a.depth * a.feat; });
    if (labelPool.length > 48) labelPool.length = 48;
  }
  // 별 시차 드리프트(박사 "모든 별 천천히 과학적 이동"·3자 토론 vmi_starmotion): 정적 레이어를 심도별 속도로 wrap drift.
  var STAR_DRIFT = 2.2, SDIRX = -0.96, SDIRY = -0.28, drT = 0;  // 근경~2.2px/s·대각 ~16°·depth^1.7 (눈 피로 완화)

  /* ───────── 통합 현상 페인터 (c=대상 ctx, 중심 0,0 기준·회전은 외부에서) ───────── */
  function paintPhen(c, kind, col, s, ph, idx, t) {
    var k = kind;
    if (k === "nebula") {
      c.globalCompositeOperation = "screen";
      var ncols = ["rgba(24,52,111,", "rgba(109,63,157,", "rgba(47,140,159,", "rgba(176,82,109,"];
      for (var nb = 0; nb < 7; nb++) {
        var na = (nb / 7) * TAU + ph, ndist = (8 + nb * 12) * s;
        var nx = Math.cos(na) * ndist, ny = Math.sin(na) * ndist * 0.7;
        var nr = (42 + (nb % 3) * 30) * s, ncl = ncols[(nb + idx) % 4];
        var gn = c.createRadialGradient(nx, ny, 0, nx, ny, nr);
        gn.addColorStop(0, ncl + (nb === 0 ? "0.07" : "0.026") + ")");
        gn.addColorStop(0.55, ncl + "0.010)"); gn.addColorStop(1, ncl + "0)");
        c.fillStyle = gn; c.beginPath(); c.arc(nx, ny, nr, 0, TAU); c.fill();
      }
      c.globalCompositeOperation = "source-over";
    } else if (k === "spiral") {
      // 실사 나선은하: 황백 벌지 지수감쇠(중심 작고 강) + 기울어진 디스크 + 나선팔 + 먼지대
      c.globalCompositeOperation = "screen";
      c.save(); c.scale(1.45, 0.58);
      var gsp = c.createRadialGradient(0, 0, 0, 0, 0, 54 * s);
      gsp.addColorStop(0, "rgba(255,244,214,0.55)"); gsp.addColorStop(0.10, "rgba(255,228,180,0.28)");
      gsp.addColorStop(0.30, col + "0.10)"); gsp.addColorStop(0.62, col + "0.022)"); gsp.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gsp; c.beginPath(); c.arc(0, 0, 54 * s, 0, TAU); c.fill();
      c.restore();
      for (var sa2 = 0; sa2 < 2; sa2++) {       // 로그 나선팔 2개(청백 점광)
        c.save(); c.rotate(sa2 * Math.PI);
        for (var aa = 0; aa < 42; aa++) {
          var ar = (aa / 42) * 52 * s, ang = aa * 0.46;
          var axx = Math.cos(ang) * ar * 1.45, ayy = Math.sin(ang) * ar * 0.58;
          c.fillStyle = "rgba(212,226,255," + (0.13 * (1 - aa / 48)) + ")"; c.fillRect(axx, ayy, 1.2, 1.2);
        }
        c.restore();
      }
      c.fillStyle = "rgba(255,250,236,0.75)"; c.beginPath(); c.arc(0, 0, 3.2 * s, 0, TAU); c.fill();  // 밝은 핵
      // 먼지대(dust lane): 디스크 가로질러 빛을 깎음(destination-out → 어두운 띠)
      c.globalCompositeOperation = "destination-out"; c.save(); c.scale(1.45, 0.58); c.globalAlpha = 0.5;
      c.fillStyle = "#000"; c.beginPath(); c.arc(0, 4.5 * s, 47 * s, 0, TAU);
      c.arc(0, -50 * s, 40 * s, 0, TAU); c.fill(); c.globalAlpha = 1; c.restore();
      c.globalCompositeOperation = "source-over";
    } else if (k === "elliptical") {
      // 실사 타원은하: 매끈 황백 지수감쇠·기울어진 타원(팔·먼지 없음)
      c.globalCompositeOperation = "screen";
      c.save(); c.scale(1.5, 0.82);
      var ge = c.createRadialGradient(0, 0, 0, 0, 0, 58 * s);
      ge.addColorStop(0, "rgba(255,242,210,0.5)"); ge.addColorStop(0.16, "rgba(255,228,180,0.17)");
      ge.addColorStop(0.5, col + "0.03)"); ge.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = ge; c.beginPath(); c.arc(0, 0, 58 * s, 0, TAU); c.fill(); c.restore();
      c.fillStyle = "rgba(255,248,228,0.5)"; c.beginPath(); c.arc(0, 0, 2.6 * s, 0, TAU); c.fill();
      c.globalCompositeOperation = "source-over";
    } else if (k === "cluster" || k === "web") {
      c.globalCompositeOperation = "screen";
      var seed = idx * 9301 + 49297;
      function srnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var cc = 0; cc < 64; cc++) {
        var rad = (k === "web" ? srnd() * 120 : Math.abs((srnd() * 2 - 1) * (srnd() * 2 - 1)) * 60) * s;
        var th = srnd() * TAU;
        c.fillStyle = col + (0.13 + srnd() * 0.22) + ")";
        c.fillRect(Math.cos(th) * rad, Math.sin(th) * rad, 1.5, 1.5);
      }
      c.globalCompositeOperation = "source-over";
    } else if (k === "giant" || k === "star" || k === "whitedwarf") {
      var rr2 = (k === "giant" ? 16 : k === "whitedwarf" ? 4 : 8) * s;
      var gg = c.createRadialGradient(0, 0, 0, 0, 0, rr2 * 4);
      gg.addColorStop(0, col + "0.42)"); gg.addColorStop(0.22, col + "0.06)"); gg.addColorStop(1, "rgba(0,0,0,0)");
      c.globalCompositeOperation = "screen"; c.fillStyle = gg;
      c.beginPath(); c.arc(0, 0, rr2 * 4, 0, TAU); c.fill();
      c.fillStyle = "rgba(255,253,245,0.60)"; c.beginPath(); c.arc(0, 0, rr2 * 0.6, 0, TAU); c.fill();
      c.globalCompositeOperation = "source-over";
    } else if (k === "pulse" || k === "pulsar") {
      var beat = 0.4 + 0.6 * Math.abs(Math.sin(t * (k === "pulsar" ? 4 : 1.3) + ph));
      var gp = c.createRadialGradient(0, 0, 0, 0, 0, 30 * s * beat);
      gp.addColorStop(0, col + (0.5 * beat) + ")"); gp.addColorStop(1, "rgba(0,0,0,0)");
      c.globalCompositeOperation = "screen"; c.fillStyle = gp;
      c.beginPath(); c.arc(0, 0, 30 * s * beat, 0, TAU); c.fill();
      if (k === "pulsar") {
        c.strokeStyle = col + (0.5 * beat) + ")"; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(-40 * s, 0); c.lineTo(40 * s, 0); c.stroke();
      }
      c.globalCompositeOperation = "source-over";
    } else if (k === "blackhole") {
      c.globalCompositeOperation = "screen";
      var gbh = c.createRadialGradient(0, 0, 12 * s, 0, 0, 30 * s);
      gbh.addColorStop(0, GOLD + "0)"); gbh.addColorStop(0.42, GOLD + "0.18)"); gbh.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gbh; c.save(); c.scale(1, 0.42);
      c.beginPath(); c.arc(0, 0, 30 * s, 0, TAU); c.fill(); c.restore();
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "#05060c"; c.beginPath(); c.arc(0, 0, 12 * s, 0, TAU); c.fill();
    } else if (k === "disk" || k === "ring") {
      c.globalCompositeOperation = "screen";
      var gdr = c.createRadialGradient(0, 0, 14 * s, 0, 0, 30 * s);
      gdr.addColorStop(0, col + "0)"); gdr.addColorStop(0.45, col + "0.16)"); gdr.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gdr; c.save(); c.scale(1, k === "disk" ? 0.4 : 0.85);
      c.beginPath(); c.arc(0, 0, 30 * s, 0, TAU); c.fill(); c.restore();
      c.globalCompositeOperation = "source-over";
    } else if (k === "lens") {
      c.globalCompositeOperation = "screen";
      var gln = c.createRadialGradient(0, 0, 5 * s, 0, 0, 18 * s);
      gln.addColorStop(0, ICE + "0)"); gln.addColorStop(0.5, ICE + "0.06)"); gln.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gln; c.beginPath(); c.arc(0, 0, 18 * s, 0, TAU); c.fill();
      c.globalCompositeOperation = "source-over";
    } else if (k === "jet") {
      c.globalCompositeOperation = "screen";
      var gj = c.createLinearGradient(0, -60 * s, 0, 60 * s);
      gj.addColorStop(0, "rgba(0,0,0,0)"); gj.addColorStop(0.5, col + "0.22)"); gj.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gj; c.fillRect(-2, -60 * s, 4, 120 * s);
      c.fillStyle = col + "0.30)"; c.beginPath(); c.arc(0, 0, 4 * s, 0, TAU); c.fill();
      c.globalCompositeOperation = "source-over";
    } else if (k === "wave") {
      c.globalCompositeOperation = "screen"; c.lineWidth = 1.4;
      var wpul = (Math.sin(t * 0.8 + ph) + 1) * 0.5;
      for (var wr = 1; wr <= 3; wr++) {
        c.strokeStyle = col + (0.42 - wr * 0.1) + ")";
        c.beginPath(); c.arc(0, 0, (13 * wr + wpul * 8) * s, 0, TAU); c.stroke();
      }
      c.globalCompositeOperation = "source-over";
    } else if (k === "aurora") {
      c.globalCompositeOperation = "screen";
      var gau = c.createRadialGradient(0, 0, 0, 0, 0, 46 * s);
      gau.addColorStop(0, col + "0.08)"); gau.addColorStop(0.5, col + "0.03)"); gau.addColorStop(1, col + "0)");
      c.fillStyle = gau; c.save(); c.scale(0.55, 1.5);
      c.beginPath(); c.arc(0, 0, 46 * s, 0, TAU); c.fill(); c.restore();
      c.globalCompositeOperation = "source-over";
    } else if (k === "planet" || k === "ringplanet") {
      var gpl = c.createRadialGradient(-3 * s, -3 * s, 1, 0, 0, 12 * s);
      gpl.addColorStop(0, col + "0.55)"); gpl.addColorStop(1, col + "0.14)");
      c.fillStyle = gpl; c.beginPath(); c.arc(0, 0, 12 * s, 0, TAU); c.fill();
      if (k === "ringplanet") { c.save(); c.rotate(0.4); c.strokeStyle = ICE + "0.5)"; c.lineWidth = 2; c.scale(1, 0.32); c.beginPath(); c.arc(0, 0, 22 * s, 0, TAU); c.stroke(); c.restore(); }
    } else if (k === "belt") {
      c.save(); c.scale(1, 0.4);
      var bseed = idx * 7 + 13;
      for (var bk = 0; bk < 72; bk++) { bseed = (bseed * 9301 + 49297) % 233280; var bt = (bseed / 233280) * TAU, brad = (34 + (bseed % 12)) * s; c.fillStyle = ICE + (0.12 + (bseed % 28) / 100) + ")"; c.fillRect(Math.cos(bt) * brad, Math.sin(bt) * brad, 1.4, 1.4); }
      c.restore();
    } else if (k === "comet") {
      c.globalCompositeOperation = "screen";
      var gc = c.createLinearGradient(0, 0, 50 * s, 14 * s);
      gc.addColorStop(0, ICE + "0.30)"); gc.addColorStop(1, "rgba(0,0,0,0)");
      c.strokeStyle = gc; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(50 * s, 14 * s); c.stroke();
      c.fillStyle = ICE + "0.45)"; c.beginPath(); c.arc(0, 0, 2.4 * s, 0, TAU); c.fill();
      c.globalCompositeOperation = "source-over";
    } else if (k === "supernova") {
      var ex = (t * 0.32 + ph) % 1, fade = 1 - ex;
      c.globalCompositeOperation = "screen";
      var core = c.createRadialGradient(0, 0, 0, 0, 0, 16 * s);
      core.addColorStop(0, "rgba(255,252,240," + (fade * 0.95) + ")"); core.addColorStop(0.45, GOLD + (fade * 0.5) + ")"); core.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = core; c.beginPath(); c.arc(0, 0, 16 * s * (0.45 + fade * 0.55), 0, TAU); c.fill();
      c.strokeStyle = "rgba(255,238,205," + (fade * 0.7) + ")"; c.lineWidth = 2.2 * fade + 0.4;
      c.beginPath(); c.arc(0, 0, ex * 62 * s, 0, TAU); c.stroke();
      c.globalCompositeOperation = "source-over";
    } else if (k === "binary") {
      var bo = t * 1.2 + ph, rO = 12 * s;
      c.fillStyle = GOLD + "0.55)"; c.beginPath(); c.arc(Math.cos(bo) * rO, Math.sin(bo) * rO * 0.5, 4 * s, 0, TAU); c.fill();
      c.fillStyle = ICE + "0.55)"; c.beginPath(); c.arc(-Math.cos(bo) * rO, -Math.sin(bo) * rO * 0.5, 3 * s, 0, TAU); c.fill();
    } else if (k === "transit") {
      c.fillStyle = GOLD + "0.5)"; c.beginPath(); c.arc(0, 0, 12 * s, 0, TAU); c.fill();
      var tox = ((t * 18 + ph * 10) % 50) - 25;
      c.fillStyle = "#05060c"; c.beginPath(); c.arc(tox * s, 0, 3 * s, 0, TAU); c.fill();
    } else if (k === "void") {
      c.fillStyle = "rgba(3,4,10,0.5)"; c.beginPath(); c.arc(0, 0, 40 * s, 0, TAU); c.fill();
      // (회색 테두리 stroke 삭제 — 실사상 보이드는 어두운 영역일 뿐·박사 "회색 원" 지적 반영)
    } else if (k === "meteor") {
      c.globalCompositeOperation = "screen"; c.lineCap = "round";
      for (var mi = 0; mi < 7; mi++) {
        var mph = ((t * 0.55 + mi * 0.37 + ph) % 1);
        var mx = (-46 + mi * 15) * s + mph * 64 * s, my = -46 * s + mph * 104 * s;
        var ma = Math.sin(mph * Math.PI);
        var gm = c.createLinearGradient(mx, my, mx - 20 * s, my - 28 * s);
        gm.addColorStop(0, "rgba(255,250,235," + (ma * 0.9) + ")"); gm.addColorStop(1, "rgba(255,250,235,0)");
        c.strokeStyle = gm; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(mx, my); c.lineTo(mx - 20 * s, my - 28 * s); c.stroke();
      }
      c.globalCompositeOperation = "source-over";
    } else if (k === "station" || k === "ship") {
      paintShipBody(c, 12 * s, ICE, idx % 5);
    }
  }

  /* ───────── 현상 스프라이트 캐시 ───────── */
  function phenExtent(kind, s) {
    switch (kind) {
      case "jet": return 66 * s; case "cluster": case "web": return 128 * s;
      case "nebula": return 112 * s; case "spiral": return 78 * s; case "elliptical": return 86 * s;
      case "giant": case "star": case "whitedwarf": return 68 * s; case "belt": return 50 * s;
      case "aurora": return 74 * s; case "comet": return 58 * s; case "disk": case "ring": return 30 * s;
      case "lens": return 28 * s; case "void": return 44 * s; case "blackhole": return 34 * s;
      case "planet": case "ringplanet": return 26 * s; case "station": case "ship": return 26 * s; default: return 58 * s;
    }
  }
  function getPhenSprite(p) {
    var sb = p.s < 0.95 ? 0 : p.s < 1.3 ? 1 : 2;
    var repS = [0.85, 1.15, 1.55][sb] * (isMobile ? 0.8 : 1);
    var key = p.kind + "|" + p.colIdx + "|" + sb + "|" + (p.idx % 2);
    var sp = phenCache[key];
    if (sp) return sp;
    var ext = Math.min(phenExtent(p.kind, repS), 200);
    var dim = (Math.ceil(ext) * 2) + 6;
    var oc = document.createElement("canvas"); oc.width = dim; oc.height = dim;
    var c = oc.getContext("2d"); c.translate(dim / 2, dim / 2);
    paintPhen(c, p.kind, palette[p.colIdx], repS, p.ph, p.idx, 0);
    sp = { canvas: oc, half: dim / 2 };
    phenCache[key] = sp; return sp;
  }

  /* ───────── 극사실 우주선 동체 페인터 ───────── */
  function paintShipBody(c, sz, tone, shape) {
    var u = sz / 16, hull = "rgba(38,48,70,0.96)"; c.lineJoin = "round"; shape = shape || 0;
    // 미세 그림자 (앰비언트 오클루전)
    c.save(); c.translate(0, u * 1.2); c.globalAlpha = 0.28; c.fillStyle = "rgba(0,0,0,1)";
    c.beginPath(); c.ellipse ? c.ellipse(0, 0, 15 * u, 5 * u, 0, 0, TAU) : c.arc(0, 0, 12 * u, 0, TAU); c.fill(); c.restore();
    if (shape === 1) {
      var gh = c.createLinearGradient(0, -6 * u, 0, 6 * u);
      gh.addColorStop(0, "rgba(96,112,150,0.98)"); gh.addColorStop(0.5, hull); gh.addColorStop(1, "rgba(20,26,40,0.98)");
      c.fillStyle = gh; c.save(); c.scale(1, 0.42); c.beginPath(); c.arc(0, 0, 13 * u, 0, TAU); c.fill(); c.restore();
      var gd = c.createRadialGradient(-1 * u, -2.5 * u, 0, 0, -1.5 * u, 6 * u);
      gd.addColorStop(0, tone + "0.85)"); gd.addColorStop(1, tone + "0.18)");
      c.fillStyle = gd; c.beginPath(); c.arc(0, -1.5 * u, 5 * u, Math.PI, 0); c.fill();
      c.strokeStyle = "rgba(210,228,255,0.7)"; c.lineWidth = Math.max(0.6, u * 0.5); c.save(); c.scale(1, 0.42); c.beginPath(); c.arc(0, 0, 13 * u, 0, TAU); c.stroke(); c.restore();
      for (var w1 = -2; w1 <= 2; w1++) { c.fillStyle = tone + "0.85)"; c.fillRect(w1 * 4 * u - 0.6 * u, 0.4 * u, 1.2 * u, 1.2 * u); }
    } else if (shape === 2) {
      var g2 = c.createLinearGradient(0, -3 * u, 0, 3 * u);
      g2.addColorStop(0, "rgba(104,120,158,0.98)"); g2.addColorStop(0.5, hull); g2.addColorStop(1, "rgba(18,24,38,0.98)");
      c.fillStyle = g2; c.fillRect(-15 * u, -3 * u, 28 * u, 6 * u);
      c.fillStyle = "rgba(150,170,210,0.55)"; c.fillRect(-12 * u, -8 * u, 16 * u, 2.4 * u); c.fillRect(-12 * u, 5.6 * u, 16 * u, 2.4 * u);
      c.strokeStyle = "rgba(200,224,255,0.6)"; c.lineWidth = Math.max(0.6, u * 0.55); c.strokeRect(-15 * u, -3 * u, 28 * u, 6 * u);
      for (var p2 = -10; p2 <= 8; p2 += 4) { c.fillStyle = tone + "0.7)"; c.fillRect(p2 * u, -1 * u, 0.9 * u, 2 * u); }
      var ge2 = c.createRadialGradient(14 * u, 0, 0, 14 * u, 0, 4 * u);
      ge2.addColorStop(0, "rgba(160,230,255,0.95)"); ge2.addColorStop(1, "rgba(120,180,255,0)");
      c.fillStyle = ge2; c.beginPath(); c.arc(13 * u, 0, 4 * u, 0, TAU); c.fill();
    } else if (shape === 3) {
      var g3 = c.createLinearGradient(0, -8 * u, 0, 8 * u);
      g3.addColorStop(0, "rgba(110,126,165,0.98)"); g3.addColorStop(0.5, hull); g3.addColorStop(1, "rgba(16,22,36,0.98)");
      c.fillStyle = g3; c.beginPath(); c.moveTo(17 * u, 0); c.lineTo(-12 * u, -8 * u); c.lineTo(-7 * u, 0); c.lineTo(-12 * u, 8 * u); c.closePath(); c.fill();
      c.strokeStyle = "rgba(205,228,255,0.72)"; c.lineWidth = Math.max(0.6, u * 0.6); c.beginPath(); c.moveTo(17 * u, 0); c.lineTo(-12 * u, -8 * u); c.stroke();
      c.fillStyle = tone + "0.9)"; c.fillRect(3 * u, -0.8 * u, 5 * u, 1.6 * u);
    } else if (shape === 4) {
      c.strokeStyle = tone + "0.78)"; c.lineWidth = Math.max(1, u * 1.8); c.beginPath(); c.arc(0, 0, 11 * u, 0, TAU); c.stroke();
      c.strokeStyle = "rgba(210,228,255,0.4)"; c.lineWidth = Math.max(0.5, u * 0.5); c.beginPath(); c.arc(0, 0, 11 * u, 0, TAU); c.stroke();
      var g4 = c.createRadialGradient(-1.5 * u, -1.5 * u, 0, 0, 0, 5 * u);
      g4.addColorStop(0, "rgba(110,126,165,1)"); g4.addColorStop(1, "rgba(18,24,38,1)");
      c.fillStyle = g4; c.beginPath(); c.arc(0, 0, 4.5 * u, 0, TAU); c.fill();
      c.strokeStyle = tone + "0.5)"; c.lineWidth = Math.max(0.6, u * 0.6); c.beginPath(); c.moveTo(-11 * u, 0); c.lineTo(11 * u, 0); c.moveTo(0, -11 * u); c.lineTo(0, 11 * u); c.stroke();
    } else {
      var g0 = c.createLinearGradient(0, -5 * u, 0, 5 * u);
      g0.addColorStop(0, "rgba(112,128,168,0.98)"); g0.addColorStop(0.45, hull); g0.addColorStop(1, "rgba(16,22,36,0.98)");
      c.fillStyle = g0; c.beginPath();
      c.moveTo(15 * u, 0); c.lineTo(3 * u, -4.5 * u); c.lineTo(-14 * u, -3 * u); c.lineTo(-14 * u, 3 * u); c.lineTo(3 * u, 4.5 * u); c.closePath(); c.fill();
      c.strokeStyle = "rgba(205,228,255,0.6)"; c.lineWidth = Math.max(0.6, u * 0.65);
      c.beginPath(); c.moveTo(15 * u, 0); c.lineTo(3 * u, -4.5 * u); c.lineTo(-14 * u, -3 * u); c.stroke();
      // 솔라 패널 + 패널 라인
      c.fillStyle = "rgba(60,90,140,0.7)"; c.fillRect(-6.5 * u, -11.2 * u, 7 * u, 2.2 * u); c.fillRect(-6.5 * u, 9 * u, 7 * u, 2.2 * u);
      c.strokeStyle = tone + "0.6)"; c.lineWidth = Math.max(0.5, u * 0.55);
      c.beginPath(); c.moveTo(-3 * u, -4 * u); c.lineTo(-3 * u, -10 * u); c.moveTo(-3 * u, 4 * u); c.lineTo(-3 * u, 10 * u); c.stroke();
      // 조종석 창 (따뜻한 빛)
      c.fillStyle = "rgba(255,224,170,0.9)"; c.fillRect(6 * u, -1 * u, 3 * u, 2 * u);
      // 항법등
      c.fillStyle = "rgba(255,90,90,0.95)"; c.fillRect(2 * u, -4.6 * u, 1.4 * u, 1.4 * u);
      c.fillStyle = "rgba(90,255,140,0.95)"; c.fillRect(2 * u, 3.2 * u, 1.4 * u, 1.4 * u);
    }
  }

  /* ───────── 우주선 스프라이트 캐시 (모양×색×크기) ───────── */
  var shipCacheCount = 0, SHIP_CACHE_CAP = isMobile ? 96 : 448;
  function getShipSprite(shape, toneIdx, sb, ri) {
    var key = shape + "|" + toneIdx + "|" + sb + "|" + ri;
    var sp = shipCache[key]; if (sp) return sp;
    if (shipCacheCount >= SHIP_CACHE_CAP) { ri = 1; key = shape + "|" + toneIdx + "|" + sb + "|1"; sp = shipCache[key]; if (sp) return sp; }
    var sz = SHIP_SIZES[sb], ratio = SHIP_RATIOS[ri];
    var pad = sz * 3.0, dim = Math.ceil(pad * 2);
    var oc = document.createElement("canvas"); oc.width = dim; oc.height = dim;
    var c = oc.getContext("2d"); c.translate(dim / 2, dim / 2); c.scale(ratio, 1);
    // 후미 엔진광 (베이크) — 동체는 +x 방향 · core의 0.4배 저alpha (R4: 작은 빛점 안 광학)
    var er = sz * 0.9;
    var eg = c.createRadialGradient(-sz * 0.85, 0, 0, -sz * 0.85, 0, er);
    eg.addColorStop(0, "rgba(150,225,255,0.7)"); eg.addColorStop(0.5, "rgba(95,155,255,0.24)"); eg.addColorStop(1, "rgba(95,155,255,0)");
    c.globalCompositeOperation = "screen"; c.fillStyle = eg; c.beginPath(); c.arc(-sz * 0.85, 0, er, 0, TAU); c.fill();
    c.globalCompositeOperation = "source-over";
    paintShipBody(c, sz, SHIPTONE[toneIdx], shape);
    sp = { canvas: oc, half: dim / 2, sz: sz };
    shipCache[key] = sp; shipCacheCount++; return sp;
  }

  /* ───────── 별: 심도 3레이어 정적 캐시 + 7% 라이브 반짝임 ───────── */
  // 상위 별만 arc(글로우/스파이크). 7배 밀도→글로우 축소(a*0.20·r*2.5·br>0.6 임계는 호출부에서)
  function paintStar(c, x, y, r, a, col, glow, spike) {
    if (glow) { r = r * 1.6; }   // 글로우 헤일로(흰 원) 제거 — 밝은 별은 '큰 점'으로 밝기 계층(박사 "흰 동그라미 삭제")
    c.fillStyle = col + a + ")"; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (spike) { var sl = r * 9; c.strokeStyle = col + (a * 0.3) + ")"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - sl, y); c.lineTo(x + sl, y); c.moveTo(x, y - sl); c.lineTo(x, y + sl); c.stroke(); }
  }
  // 별 7배: 희미한 다수는 ImageData 픽셀 직접 기록(arc 17만 회피·고속), 상위 별만 arc. 트윙클은 뷰포트 cap.
  function buildStars() {
    var total = Math.min(CAP.starMax, Math.floor((W * H) / CAP.starDiv) * quality);
    var pad = stars.pad, lw = W + pad, lh = H + pad;
    var depths = [0.35, 0.6, 1.0];
    stars.layers = []; stars.twinkle = [];
    var bufs = [], bright = [[], [], []];
    for (var L = 0; L < 3; L++) { var o = document.createElement("canvas"); o.width = lw; o.height = lh; stars.layers.push({ cv: o, c: o.getContext("2d"), depth: depths[L] }); bufs.push(o.getContext("2d").createImageData(lw, lh)); }
    var twCap = Math.min(2200, Math.floor((W * H) / 1100));   // 뷰포트 면적 기반(절대 하드코딩 X)
    var twProb = total > 0 ? Math.min(0.95, (twCap / total) * 1.25) : 0;
    for (var i = 0; i < total; i++) {
      var tier = (Math.random() * 3) | 0, depth = depths[tier];
      var br = Math.random(); br = br * br;
      var r = (0.25 + br * 1.5) * (depth * 0.9 + 0.4);
      var x = Math.random() * lw, y = Math.random() * lh;
      var a = Math.min(0.90, 0.05 + br * 0.92);   // 박사 +50% 체감(peak 0.90)·faint 어둠 사수
      var sp = STAR_SPECTRA[starSpec()], pre = "rgba(" + sp[0] + "," + sp[1] + "," + sp[2] + ",";
      var isGlow = br > 0.994, isSpike = !isMobile && br > 0.9985;
      if (stars.twinkle.length < twCap && Math.random() < twProb) {
        stars.twinkle.push({ lx: x, ly: y, r: r, a: a, col: pre, depth: depth, per: rnd(13, 28), ph: Math.random() * TAU, amp: rnd(0.07, 0.15), glow: isGlow });
      } else if (isGlow || isSpike) {
        bright[tier].push({ x: x, y: y, r: r, a: a, pre: pre, glow: isGlow, spike: isSpike });
      } else {
        var pxi = x | 0, pyi = y | 0;
        if (pxi >= 0 && pxi < lw && pyi >= 0 && pyi < lh) {
          var d = bufs[tier].data, idx = (pyi * lw + pxi) * 4, A = a * 255 * (tier === 0 ? 0.5 : 1);
          d[idx] = sp[0]; d[idx + 1] = sp[1]; d[idx + 2] = sp[2]; d[idx + 3] = A;
          if (r > 1.15 && pxi + 1 < lw) { var j = idx + 4; d[j] = sp[0]; d[j + 1] = sp[1]; d[j + 2] = sp[2]; d[j + 3] = A * 0.55; }
        }
      }
    }
    for (var L2 = 0; L2 < 3; L2++) {
      var c2 = stars.layers[L2].c; c2.putImageData(bufs[L2], 0, 0);
      var bb = bright[L2];
      for (var b = 0; b < bb.length; b++) {
        var s = bb[b]; paintStar(c2, s.x, s.y, s.r, s.a, s.pre, s.glow, s.spike);
        // 토러스 경계 복제(wrap 타일 seam 방지): 가장자리 근처 별을 반대편에도
        var ex = s.x < 24 ? lw : s.x > lw - 24 ? -lw : 0, ey = s.y < 24 ? lh : s.y > lh - 24 ? -lh : 0;
        if (ex) paintStar(c2, s.x + ex, s.y, s.r, s.a, s.pre, s.glow, s.spike);
        if (ey) paintStar(c2, s.x, s.y + ey, s.r, s.a, s.pre, s.glow, s.spike);
        if (ex && ey) paintStar(c2, s.x + ex, s.y + ey, s.r, s.a, s.pre, s.glow, s.spike);
      }
    }
  }

  function buildPhenomena() {
    phenomena = [];
    var n = Math.floor(CAP.phen * quality * (homeMode ? 0.95 : 1));
    var dynCap = isMobile ? 5 : 16, dynCount = 0;
    for (var i = 0; i < n; i++) {
      var cobj = CATALOG[(Math.random() * CATALOG.length) | 0];
      // 애니메이션 현상 동시활성 캡 (만장일치 안전장치) — 초과분은 정적 현상으로 재추첨
      if (ANIM[cobj[2]]) { if (dynCount >= dynCap) { var tries = 0; do { cobj = CATALOG[(Math.random() * CATALOG.length) | 0]; tries++; } while (ANIM[cobj[2]] && tries < 8); } if (ANIM[cobj[2]]) dynCount++; }
      var X, Y, tt = 0;
      do { X = rnd(0.03, 0.97) * W; Y = rnd(0.05, 0.95) * H; tt++; }
      while (homeMode && tt < 5 && Math.hypot(X - W / 2, Y - H / 2) < Math.min(W, H) * 0.34 && Math.random() < 0.82);
      var hue = pick(palette);
      // 고정반복 폐기: supernova→정적 초신성 잔해(성운), meteor(유성우)→정적 성단. 폭발/유성은 전역 이벤트가 담당.
      var kind = cobj[2];
      if (kind === "supernova") kind = "nebula"; else if (kind === "meteor") kind = "cluster";
      // 박사 "작은 검은색 원 모두 삭제": void(어두운 원)→성운, transit(통과 검은점)→성단, blackhole(검은코어)→나선은하
      else if (kind === "void") kind = "nebula";
      else if (kind === "transit") kind = "cluster";
      else if (kind === "blackhole") kind = "spiral";
      // 박사 "작은 흰색 동그라미 모두 삭제": 무특징 소형 원반(렌즈·행성·원반·고리)→성단(점무리)
      else if (kind === "lens" || kind === "disk" || kind === "ring") kind = "cluster";
      else if (kind === "planet" || kind === "ringplanet") kind = "star";
      phenomena.push({
        cat: cobj[0], group: cobj[1], kind: kind,
        x: X, y: Y, vx: rnd(-0.08, 0.08), vy: rnd(-0.05, 0.05),
        s: rnd(0.6, 1.6), depth: rnd(0.4, 1.3),
        hue: hue, colIdx: palIdx[hue], rot: Math.random() * TAU, spin: rnd(-0.004, 0.004),
        ph: Math.random() * TAU, freq: rnd(0.6, 1.4), idx: i + 1, show: Math.random() < 0.5,
        // 선별 강조(가시성·계층역전 회피): 대표 현상(은하·거성·성운·블랙홀) 일부만 ×1.3 — "500 신비가 눈에 띄게"
        feat: ((kind === "spiral" || kind === "elliptical" || kind === "giant" || kind === "nebula" || kind === "blackhole") && Math.random() < 0.22) ? 1.3 : 1.0,
        baseA: 0.30, breathAmp: rnd(0.03, 0.07), breathPer: rnd(30, 90)
      });
    }
    buildLabelPool();
  }

  function buildShips() {
    ships = [];
    var n = Math.floor(CAP.ships * quality);
    for (var i = 0; i < n; i++) {
      var roll = Math.random();
      var lod = roll < (1 - CAP.lodGlyph - CAP.lodSprite) ? 0 : roll < (1 - CAP.lodSprite) ? 1 : 2;
      var depth = lod === 0 ? rnd(0.15, 0.45) : lod === 1 ? rnd(0.5, 0.8) : rnd(0.85, 1.3);
      // 매우 느린 항행 (px/초·dt 기반): 70% 0.5~1.4 · 25% 1.4~2.2 · 5% 2.2~2.6
      var sr = Math.random(), sp = sr < 0.7 ? rnd(1.8, 3.6) : sr < 0.95 ? rnd(3.6, 5.6) : rnd(5.6, 6.8);
      ships.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: sp * (Math.random() < 0.5 ? 1 : -1) * depth,
        vy: rnd(-1.0, 1.0) * depth,
        lod: lod, depth: depth,
        size: lod === 0 ? rnd(0.7, 2.0) : rnd(2.5, 5.0),
        shape: (Math.random() * 5) | 0, toneIdx: (Math.random() * SHIPTONE.length) | 0,
        sb: (Math.random() * 3) | 0, ri: (Math.random() * 3) | 0, bright: rnd(0.82, 1.0), blink: Math.random() * TAU,
        warping: 0, warpMax: 0.8
      });
    }
    syncFleetStat();
  }
  function syncFleetStat() { var el = document.getElementById("fleetCount"); if (el) el.textContent = ships.length + ""; }

  /* ───────── 배경 절차 성운 — 오프스크린 1회 베이크 후 초저속 드리프트 drawImage ───────── */
  var bgNeb = [
    { cx: 0.22, cy: 0.26, rr: 0.72, col: "rgba(70,46,128,", a: 0.04 },
    { cx: 0.82, cy: 0.34, rr: 0.64, col: "rgba(38,86,140,", a: 0.03 },
    { cx: 0.6, cy: 0.86, rr: 0.78, col: "rgba(150,118,40,", a: 0.015 }
  ];
  var bgNebCv = null;
  function buildBgNebula() {
    var bw = Math.max(2, Math.ceil(W * 0.5)), bh = Math.max(2, Math.ceil(H * 0.5));
    var o = document.createElement("canvas"); o.width = bw; o.height = bh;
    var c = o.getContext("2d"); c.globalCompositeOperation = "screen";
    for (var i = 0; i < bgNeb.length; i++) {
      var b = bgNeb[i], cx = b.cx * bw, cy = b.cy * bh, rad = b.rr * Math.max(bw, bh);
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, b.col + b.a + ")"); g.addColorStop(0.55, b.col + (b.a * 0.32) + ")"); g.addColorStop(1, b.col + "0)");
      c.fillStyle = g; c.fillRect(0, 0, bw, bh);
    }
    bgNebCv = o;
  }
  function drawBgNebula() {
    if (!bgNebCv) return;
    var dx = Math.sin(T * 0.012) * 42 + px * 0.3, dy = Math.cos(T * 0.009) * 32 + py * 0.3;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(bgNebCv, dx - 30, dy - 30, W + 60, H + 60);
    ctx.globalCompositeOperation = "source-over";
  }

  /* ───────── 연구기관 엣지: 자본흐름 constellation (우측 외곽·텍스트뒤 금지·극저 alpha) ───────── */
  var CONSTEL_NODES = [
    { x: 0.72, y: 0.20, t: "벤처투자" }, { x: 0.88, y: 0.36, t: "펀드결성" },
    { x: 0.80, y: 0.56, t: "회수시장" }, { x: 0.93, y: 0.70, t: "정책금융" },
    { x: 0.66, y: 0.76, t: "딥테크" }, { x: 0.86, y: 0.86, t: "세컨더리" },
    { x: 0.96, y: 0.52, t: "성장자본" }
  ];
  var CONSTEL_EDGES = [[0, 1], [1, 6], [6, 2], [2, 3], [3, 5], [2, 4], [1, 2]];
  var constel = [];
  function buildConstellation() {
    constel = [];
    for (var i = 0; i < CONSTEL_NODES.length; i++) {
      var n = CONSTEL_NODES[i];
      constel.push({ x: n.x * W, y: n.y * H, t: n.t, ph: i * 0.9 });
    }
  }
  function drawConstellation() {
    if (!constel.length) return;
    var pulse = 0.5 + 0.5 * Math.sin(T * 0.22);          // ≈28초 주기
    var a = 0.05 + 0.07 * pulse;                          // ≤0.12
    var ox = px * 0.5, oy = py * 0.5;
    ctx.save();
    ctx.lineWidth = 0.8; ctx.strokeStyle = "rgba(201,162,39," + (a * 0.7) + ")";
    for (var e = 0; e < CONSTEL_EDGES.length; e++) {
      var p1 = constel[CONSTEL_EDGES[e][0]], p2 = constel[CONSTEL_EDGES[e][1]];
      ctx.beginPath(); ctx.moveTo(p1.x + ox, p1.y + oy); ctx.lineTo(p2.x + ox, p2.y + oy); ctx.stroke();
    }
    for (var i = 0; i < constel.length; i++) {
      var nd = constel[i], np = 0.5 + 0.5 * Math.sin(T * 0.22 + nd.ph);
      var na = a * (0.8 + 0.6 * np), nx = nd.x + ox, ny = nd.y + oy;
      var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 7);
      g.addColorStop(0, "rgba(224,196,92," + (na * 1.6) + ")"); g.addColorStop(1, "rgba(224,196,92,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(240,224,170," + (na * 2) + ")"; ctx.beginPath(); ctx.arc(nx, ny, 1.4, 0, TAU); ctx.fill();
      if (!homeMode) {  // /universe 전용 라벨 (홈은 가독성 위해 OFF)
        if (isMobile) {  // 모바일: 예산·충돌 회피 배치(우측 외곽 성좌가 좁은 화면에서 겹치는 문제)
          tryMobLabel("constel", nd.t, nx, ny, "rgba(232,216,172,0.95)");
        } else {
          ctx.globalAlpha = 0.55; ctx.fillStyle = "rgba(224,212,180,0.9)";
          ctx.font = "11px 'Pretendard Variable', ui-sans-serif, sans-serif";
          ctx.fillText(nd.t, nx + 10, ny + 4); ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  /* ───────── 전역 대형 이벤트 (희귀·1회성·동시1): supernova 원형 팽창 / grb 양극 빔 ───────── */
  function spawnBigEvent() {
    // grb ~30%·연속 동일 타입 억제(군집 방지)
    var type = (Math.random() < 0.30 && lastBigType !== "grb") ? "grb" : "supernova";
    if (type === "supernova" && lastBigType === "supernova" && Math.random() < 0.28) type = "grb";
    lastBigType = type;
    var x, y, tt = 0;
    do { x = rnd(0.08, 0.92) * W; y = rnd(0.1, 0.9) * H; tt++; }
    while (tt < 7 && Math.hypot(x - W * 0.4, y - H * 0.46) < Math.min(W, H) * 0.30);  // 좌·중앙 히어로 텍스트 회피
    bigEvent = { type: type, x: x, y: y, life: 0, max: type === "grb" ? 3.6 : 5.6, ang: Math.random() * TAU, s: rnd(1.0, 1.7) };
  }
  function drawBigEvent(e) {
    var x = e.x + px * 0.5, y = e.y + py * 0.5, prog = e.life / e.max, s = e.s, fade = 1 - prog;
    var flash = Math.max(0, 1 - prog * 2.4);   // 초반 단발 섬광(상승-감쇠 1회·초당 3회 미만·밝기 상한)
    ctx.globalCompositeOperation = "screen"; ctx.lineCap = "round";
    if (e.type === "supernova") {
      var core = ctx.createRadialGradient(x, y, 0, x, y, 26 * s);
      core.addColorStop(0, "rgba(255,250,235," + Math.min(0.8, 0.55 * fade + 0.22 * flash) + ")");
      core.addColorStop(0.4, GOLD + (0.38 * fade) + ")"); core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, 26 * s * (0.4 + prog * 0.6), 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,238,205," + (fade * 0.55) + ")"; ctx.lineWidth = 2.4 * fade + 0.5;
      ctx.beginPath(); ctx.arc(x, y, prog * 130 * s, 0, TAU); ctx.stroke();
      ctx.strokeStyle = GOLD + (fade * 0.22) + ")"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, prog * 92 * s, 0, TAU); ctx.stroke();
    } else {  // grb — 양극 상대론적 제트(빔)
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.ang);
      var beamLen = (60 + prog * 130) * s;
      for (var d = -1; d <= 1; d += 2) {
        var gb = ctx.createLinearGradient(0, 0, 0, d * beamLen);
        gb.addColorStop(0, "rgba(196,214,255," + (0.5 * fade) + ")");
        gb.addColorStop(0.5, "rgba(150,180,255," + (0.18 * fade) + ")");
        gb.addColorStop(1, "rgba(150,180,255,0)");
        ctx.fillStyle = gb; ctx.fillRect(-2 * s, 0, 4 * s, d * beamLen);
      }
      var gc2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 14 * s);
      gc2.addColorStop(0, "rgba(235,245,255," + Math.min(0.8, 0.5 * fade + 0.2 * flash) + ")"); gc2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gc2; ctx.beginPath(); ctx.arc(0, 0, 14 * s, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  function spawnShower() {  // 유성우 — 화면 밖 방사점에서 5~8개 ±6° 산발
    var rx = rnd(0.15, 0.85) * W, ry = -40, baseAng = Math.atan2(rnd(H * 0.5, H), rnd(-W * 0.2, W * 0.2)) ;
    var n = 5 + (Math.random() * 4 | 0);
    for (var i = 0; i < n; i++) {
      var ang = baseAng + rnd(-0.10, 0.10), spd = rnd(W * 0.4, W * 0.75);
      showerQueue.push({ delay: i * rnd(0.12, 0.5), x: rx + rnd(-80, 80), y: ry, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, len: rnd(90, 180) * (isMobile ? 0.65 : 1) });
    }
  }

  /* ───────── 현상 인스턴스 렌더 ───────── */
  function drawPhenInstance(p) {
    var x = p.x + px * p.depth * 0.6, y = p.y + py * p.depth * 0.6;
    if (ANIM[p.kind]) {
      ctx.save(); ctx.translate(x, y);
      paintPhen(ctx, p.kind, p.hue, p.s * (isMobile ? 0.8 : 1), p.ph, p.idx, T * (p.freq || 1));
      ctx.restore();
    } else {
      var spr = getPhenSprite(p);
      var a = p.baseA * (p.feat || 1) * (1 + p.breathAmp * Math.sin(T / p.breathPer + p.ph));
      ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
      var screeny = SCREENY[p.kind];
      if (screeny) ctx.globalCompositeOperation = "screen";
      if (ROTATES[p.kind]) { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.drawImage(spr.canvas, -spr.half, -spr.half); ctx.restore(); }
      else ctx.drawImage(spr.canvas, x - spr.half, y - spr.half);
      if (screeny) ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    // 데스크톱 전용 인라인 라벨(밀도=정체성·기존 그대로). 모바일은 frame()의 예산·충돌 회피 패스가 담당.
    if (!homeMode && !isMobile && p.show && p.depth > 0.6) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = "rgba(201,215,232,0.8)";
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("[OBJ-" + ("000" + p.idx).slice(-3) + "] " + p.cat, x + 16, y + 4);
      ctx.globalAlpha = 1;
    }
  }

  /* ───────── 우주선 렌더 ───────── */
  function drawShip(sp) {
    var x = sp.x + px * sp.depth, y = sp.y + py * sp.depth;
    var tone = SHIPTONE[sp.toneIdx];
    if (sp.warping > 0) {
      var prog = 1 - sp.warping / sp.warpMax;
      var env = Math.sin(Math.max(0, Math.min(1, prog)) * Math.PI);
      var ang = Math.atan2(sp.vy, sp.vx);
      var wl = Math.max(W, H) * (0.13 + env * 0.33);
      var wex = x - Math.cos(ang) * wl, wey = y - Math.sin(ang) * wl;
      ctx.globalCompositeOperation = "screen"; ctx.lineCap = "round";
      var wg2 = ctx.createLinearGradient(x, y, wex, wey);
      wg2.addColorStop(0, tone + (env * 0.22) + ")"); wg2.addColorStop(0.6, tone + (env * 0.08) + ")"); wg2.addColorStop(1, tone + "0)");
      ctx.strokeStyle = wg2; ctx.lineWidth = Math.max(4, (8 + sp.size)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(wex, wey); ctx.stroke();
      var wg = ctx.createLinearGradient(x, y, wex, wey);
      wg.addColorStop(0, "rgba(235,246,255," + (env * 0.6) + ")"); wg.addColorStop(0.45, tone + (env * 0.25) + ")"); wg.addColorStop(1, tone + "0)");
      ctx.strokeStyle = wg; ctx.lineWidth = Math.max(1.5, 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(wex, wey); ctx.stroke();
      var whg = ctx.createRadialGradient(x, y, 0, x, y, 10);
      whg.addColorStop(0, "rgba(255,255,255," + (env * 0.65) + ")"); whg.addColorStop(1, "rgba(225,242,255,0)");
      ctx.fillStyle = whg; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    if (sp.lod === 0) {
      ctx.fillStyle = tone + (0.4 + 0.35 * Math.abs(Math.sin(T * 0.8 + sp.blink))) + ")";
      ctx.fillRect(x, y, sp.size, sp.size);
    } else if (sp.lod === 1) {
      ctx.strokeStyle = tone + "0.6)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - sp.size, y); ctx.lineTo(x + sp.size, y); ctx.moveTo(x, y - sp.size * 0.5); ctx.lineTo(x, y + sp.size * 0.5); ctx.stroke();
      ctx.fillStyle = tone + "0.5)"; ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      var spr = getShipSprite(sp.shape, sp.toneIdx, sp.sb, sp.ri);
      ctx.save(); ctx.globalAlpha = sp.bright; ctx.translate(x, y); ctx.rotate(Math.atan2(sp.vy, sp.vx));
      ctx.drawImage(spr.canvas, -spr.half, -spr.half);
      ctx.restore();
    }
  }

  var lastRW = 0, lastRH = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    phenCache = {}; shipCache = {}; shipCacheCount = 0;
    buildBgNebula(); buildConstellation(); buildStars(); buildPhenomena(); buildShips();
    lastRW = W; lastRH = H; computeExclusions();
    perfOut.fullResizes++;
  }
  // iOS 주소창 신축(높이만 소폭 변동) 시: 별·현상·함대 전면 재빌드 없이 캔버스 치수만 갱신 — 덜컹임·재초기화 방지
  function resizeLight() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildBgNebula(); buildConstellation();
    lastRW = W; lastRH = H; computeExclusions();
    perfOut.lightResizes++;
  }

  /* ───────── 루프 ───────── */
  var raf, emaMs = 16, lowAccum = 0;
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05); last = now; T += dt;
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    ctx.clearRect(0, 0, W, H);

    drawBgNebula();

    // 별 시차 드리프트 전진(reduced-motion이면 정지·WCAG)
    if (!reduceMotion) drT += dt;
    // 별 정적 레이어 — 심도별 wrap 드리프트(2×2 타일) + parallax. "모든 별 천천히 과학적 이동"
    // 타일 스텝은 실제 레이어 캔버스 치수 기준(iOS 주소창 신축 resizeLight 시 seam 방지·정상 시 W+pad와 동일)
    var pad = stars.pad;
    var lwS = stars.layers.length ? stars.layers[0].cv.width : W + pad;
    var lhS = stars.layers.length ? stars.layers[0].cv.height : H + pad;
    for (var L = 0; L < stars.layers.length; L++) {
      var ly = stars.layers[L];
      var dsp = STAR_DRIFT * Math.pow(ly.depth, 1.7);
      var ox = (((drT * dsp * SDIRX) % lwS) + lwS) % lwS, oy = (((drT * dsp * SDIRY) % lhS) + lhS) % lhS;
      var bx = -pad / 2 + px * ly.depth * 0.4 + ox, by = -pad / 2 + py * ly.depth * 0.4 + oy;
      // 화면에 걸치는 타일만 그림(컬링) — 보통 1~2장(드리프트 wrap seam 없이 비용 절감)
      for (var tX = bx - lwS; tX < W; tX += lwS) {
        if (tX + lwS <= 0) continue;
        for (var tY = by - lhS; tY < H; tY += lhS) {
          if (tY + lhS <= 0) continue;
          ctx.drawImage(ly.cv, tX, tY);
        }
      }
    }
    for (var ti = 0; ti < stars.twinkle.length; ti++) {
      var tw = stars.twinkle[ti];
      var ds2 = STAR_DRIFT * Math.pow(tw.depth, 1.7), ddx = drT * ds2 * SDIRX, ddy = drT * ds2 * SDIRY;
      var sx = ((((tw.lx + ddx) % lwS) + lwS) % lwS) - pad / 2 + px * tw.depth * 0.4;
      var sy = ((((tw.ly + ddy) % lhS) + lhS) % lhS) - pad / 2 + py * tw.depth * 0.4;
      var tv = tw.a * (1 - tw.amp + tw.amp * (0.5 + 0.5 * Math.sin(T * (TAU / tw.per) + tw.ph)));
      // 글로우 헤일로(흰 원) 제거 — 반짝이는 별도 '점'만(밝은 별은 큰 점)
      ctx.fillStyle = tw.col + tv + ")"; ctx.beginPath(); ctx.arc(sx, sy, tw.glow ? tw.r * 1.6 : tw.r, 0, TAU); ctx.fill();
    }

    // 연구기관 엣지 — 자본흐름 constellation (극저 alpha·우측 외곽)
    if (isMobile) mobLabelReset();   // 프레임당 라벨 레지스트리 초기화(성좌→현상 순 배치)
    drawConstellation();

    // 현상 (초저속 드리프트 + 거의 인지 불가한 회전)
    for (var p = 0; p < phenomena.length; p++) {
      var pp = phenomena[p];
      if (full) {
        pp.rot += pp.spin * dt; pp.x += pp.vx * dt * 28; pp.y += pp.vy * dt * 28;
        if (pp.x < -120) pp.x = W + 120; else if (pp.x > W + 120) pp.x = -120;
        if (pp.y < -120) pp.y = H + 120; else if (pp.y > H + 120) pp.y = -120;
      }
      drawPhenInstance(pp);
    }

    // 모바일 현상 라벨 패스 — depth×feat 상위(최근접·강조) 후보만·예산 3·충돌/금지영역 회피
    if (isMobile && !homeMode) {
      for (var li = 0; li < labelPool.length; li++) {
        if (mobUsed.phen >= MOB_LBL.phen) break;
        var lp = labelPool[li];
        tryMobLabel("phen", "[OBJ-" + ("000" + lp.idx).slice(-3) + "] " + lp.cat,
          lp.x + px * lp.depth * 0.6, lp.y + py * lp.depth * 0.6, "rgba(206,220,238,0.94)");
      }
    }

    // 우주선 함대
    for (var k = 0; k < ships.length; k++) {
      var s = ships[k];
      if (s.warping > 0) {
        s.warping -= dt; s.x += s.vx * 14 * dt; s.y += s.vy * 14 * dt;
        if (s.warping <= 0) activeWarps = Math.max(0, activeWarps - 1);
      } else if (full) {
        s.x += s.vx * dt; s.y += s.vy * dt;
      }
      if (s.x < -60) s.x = W + 60; else if (s.x > W + 60) s.x = -60;
      if (s.y < -60) s.y = H + 60; else if (s.y > H + 60) s.y = -60;
      drawShip(s);
    }

    if (full) {
      // 대형 이벤트 스케줄러 (단일·상태머신·160~280초당 1·동시1·중앙회피)
      if (bigEvent) {
        bigEvent.life += dt; drawBigEvent(bigEvent);
        if (bigEvent.life >= bigEvent.max) { bigEvent = null; bigCool = 10; }   // 종료 후 ±10s shooters 억제
      } else {
        if (bigCool > 0) bigCool -= dt;
        bigTimer -= dt;
        if (bigTimer <= 0) { spawnBigEvent(); bigTimer = rnd(160, 280); }
      }
      // 워프 — 150~240초당 1회·동시 1척 (단 하나의 경이 순간)
      warpTimer -= dt;
      if (warpTimer <= 0 && activeWarps < 1 && ships.length) {
        for (var tryi = 0; tryi < 8; tryi++) { var cand = ships[(Math.random() * ships.length) | 0]; if (cand.lod >= 1 && cand.warping <= 0) { cand.warping = cand.warpMax; activeWarps++; break; } }
        warpTimer = rnd(150, 240);
      }
      // 별똥별 — 단일 60~90초(데)·대형이벤트 활성/직후 ±10s 억제(중앙 과밀 방지)
      var suppress = bigEvent || bigCool > 0;
      shootTimer -= dt;
      if (!suppress && shootTimer <= 0 && shooters.length < 2 && showerQueue.length === 0) {
        var fromLeft = Math.random() < 0.5;
        shooters.push({ x: fromLeft ? rnd(0, W * 0.4) : rnd(W * 0.6, W), y: rnd(-20, H * 0.4), vx: (fromLeft ? 1 : -1) * rnd(W * 0.4, W * 0.7), vy: rnd(H * 0.3, H * 0.55), life: 0, max: rnd(1.0, 1.8), len: rnd(100, 220) * (isMobile ? 0.65 : 1) });
        shootTimer = isMobile ? rnd(90, 150) : rnd(60, 90);
      }
      // 유성우 군집 — 120~180초당 1회·방사점 산발·단일과 쿨다운 분리
      if (showerCool > 0) showerCool -= dt;
      showerTimer -= dt;
      if (!suppress && showerTimer <= 0 && showerQueue.length === 0 && shooters.length === 0) {
        spawnShower(); showerTimer = isMobile ? rnd(180, 300) : rnd(120, 180); showerCool = 30; shootTimer = Math.max(shootTimer, 25);
      }
      // shower 큐 방출 (지연 경과분만)
      for (var qi = showerQueue.length - 1; qi >= 0; qi--) {
        var q = showerQueue[qi]; q.delay -= dt;
        if (q.delay <= 0) { shooters.push({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, life: 0, max: rnd(0.9, 1.5), len: q.len }); showerQueue.splice(qi, 1); }
      }
      ctx.globalCompositeOperation = "screen"; ctx.lineCap = "round";
      for (var si = shooters.length - 1; si >= 0; si--) {
        var sh = shooters[si]; sh.life += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        var saa = Math.sin((sh.life / sh.max) * Math.PI);
        if (saa > 0.01) {
          var sang = Math.atan2(sh.vy, sh.vx), sex = sh.x - Math.cos(sang) * sh.len, sey = sh.y - Math.sin(sang) * sh.len;
          var sg = ctx.createLinearGradient(sh.x, sh.y, sex, sey);
          sg.addColorStop(0, "rgba(255,255,250," + (saa * 0.95) + ")"); sg.addColorStop(0.35, "rgba(201,215,232," + (saa * 0.45) + ")"); sg.addColorStop(1, "rgba(201,215,232,0)");
          ctx.strokeStyle = sg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sex, sey); ctx.stroke();
          var shg = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 6); shg.addColorStop(0, "rgba(255,255,250," + saa + ")"); shg.addColorStop(1, "rgba(255,255,250,0)");
          ctx.fillStyle = shg; ctx.beginPath(); ctx.arc(sh.x, sh.y, 6, 0, TAU); ctx.fill();
        }
        if (sh.life > sh.max || sh.x < -240 || sh.x > W + 240 || sh.y > H + 240) shooters.splice(si, 1);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // 성능 자동 감축
    emaMs += ((dt * 1000) - emaMs) * 0.05;
    if (emaMs > (isMobile ? 30 : 24)) {
      lowAccum += dt;
      if (lowAccum > 3 && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.18);
        if (ships.length > 200) ships.splice(0, Math.floor(ships.length * 0.18));
        if (phenomena.length > 60) { phenomena.splice(0, Math.floor(phenomena.length * 0.18)); buildLabelPool(); }   // 제거된 현상 라벨 잔존 방지
        if (stars.twinkle.length > 40) stars.twinkle.splice(0, Math.floor(stars.twinkle.length * 0.3));
        lowAccum = 0; emaMs = 16;
      }
    } else lowAccum = Math.max(0, lowAccum - dt);

    // 계측 노출(검증·감사용·경량): 프레임시간 EMA·감축계수·화면 내 라벨 수
    perfOut.emaMs = emaMs; perfOut.quality = quality; perfOut.labels = mobRects.length;
    perfOut.fleet = ships.length; perfOut.phen = phenomena.length; perfOut.tx = tx; perfOut.ty = ty;

    if (animate) raf = requestAnimationFrame(frame);
  }
  var perfOut = { emaMs: 16, quality: 1, labels: 0, fleet: 0, phen: 0, tx: 0, ty: 0, fullResizes: 0, lightResizes: 0 };
  window.__vmiPerf = perfOut;

  window.addEventListener("resize", (function () {
    var rt; return function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        // 모바일에서 폭 동일·높이 소폭 변동(주소창 신축)이면 경량 경로 — 우주 재초기화 방지
        if (isMobile && lastRW && window.innerWidth === lastRW && Math.abs(window.innerHeight - lastRH) < 160) resizeLight();
        else resize();
        if (!animate) frame(performance.now());
      }, 200);
    };
  })(), { passive: true });
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;   // 터치는 아래 드래그 parallax 전담(이중 처리 방지)
    tx = (0.5 - e.clientX / window.innerWidth) * 36;
    ty = (0.5 - e.clientY / window.innerHeight) * 36;
  }, { passive: true });
  // 터치 드래그 parallax — 손끝을 따라 공간이 이동(직접 조작 은유). deviceorientation은
  // iOS 13+ 권한 팝업(첫 방문 이탈 위험)으로 배제. passive·스크롤 없음(overflow:hidden)이라 안전.
  var tchX = 0, tchY = 0, tchBX = 0, tchBY = 0;
  window.addEventListener("touchstart", function (e) {
    if (!e.touches.length) return;
    tchX = e.touches[0].clientX; tchY = e.touches[0].clientY; tchBX = tx; tchBY = ty;
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (!e.touches.length) return;
    var nx2 = tchBX + (e.touches[0].clientX - tchX) * 0.10;
    var ny2 = tchBY + (e.touches[0].clientY - tchY) * 0.10;
    tx = nx2 < -22 ? -22 : nx2 > 22 ? 22 : nx2;
    ty = ny2 < -22 ? -22 : ny2 > 22 ? 22 : ny2;
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); }
    else if (animate) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  resize();
  if (!animate) { frame(performance.now()); }     // reduced-motion: 완전 정지 1프레임
  else { last = performance.now(); raf = requestAnimationFrame(frame); }  // ambient(또는 full) 루프

  var cntEl = document.getElementById("phenCount");
  if (cntEl) cntEl.textContent = CATALOG.length + "";
})();
