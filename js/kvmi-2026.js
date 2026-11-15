/* 벤처시장연구원 2026 개편 페이지 공용 스크립트 (의존성 0, CSP script-src 'self')
   1) 모바일 메뉴  2) 머리글 펼침 메뉴  3) 연구성과 검색·필터·정렬
   JS가 없거나 실패해도 메뉴와 연구성과 전체 목록은 HTML 그대로 보인다.
   - 메뉴 숨김(.kv-js)은 kv-early.js 가 첫 그리기 전에 붙인다. 메뉴 단추 처리기를 붙이면 곧바로 머리글에 kv-nav-ready 를 붙이고,
     load 때까지 그 표시가 없으면 kv-early.js 가 최소한의 열기·닫기 처리기를 붙인다(단추가 없으면 kv-js 를 떼어 메뉴를 펼친다). */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("kv-js");

  /* 1·2. 메뉴: 모바일 펼침과 하위 메뉴(details)의 닫기·포커스를 한곳에서 처리한다 */
  var header = document.querySelector(".kv-header");
  var toggle = document.getElementById("kvNavToggle");
  var nav = document.getElementById("kvNav");
  var groups = Array.prototype.slice.call(document.querySelectorAll(".kv-nav__group"));
  var mq = window.matchMedia ? window.matchMedia("(min-width: 1081px)") : null;
  var isOpen = function () { return !!header && header.classList.contains("is-open"); };
  var setOpen = function (open) {
    if (!header || !toggle) return;
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? toggle.getAttribute("data-close") : toggle.getAttribute("data-open"));
  };
  var closeGroups = function (except) {
    groups.forEach(function (g) { if (g !== except && g.open) g.open = false; });
  };
  /* 메뉴를 닫는다. restore 면 숨겨질 요소 안에 있던 포커스를 보이는 토글로 옮긴다 */
  var closeNav = function (restore) {
    var inside = nav && nav.contains(document.activeElement);
    closeGroups(null);
    setOpen(false);
    if (restore && inside && toggle && !(mq && mq.matches)) toggle.focus();
  };
  if (header && toggle && nav) {
    toggle.addEventListener("click", function () {
      if (isOpen()) closeNav(false); else setOpen(true);
    });
    header.classList.add("kv-nav-ready"); /* 단추 처리기를 붙인 즉시 표시한다. 뒤의 초기화가 실패해도 kv-early.js 가 처리기를 하나 더 붙이지 않게(판정 r6 A·T01) */
    /* 폭이 줄어 메뉴가 숨으면 브라우저가 폭 변경 알림보다 먼저 포커스를 body 로 넘길 때가 있다(실측 2026-11-15).
       그래서 «메뉴 안에 포커스가 있었는가»를 따로 기억한다. 다른 곳으로 옮기거나 메뉴 밖을 누르면 지운다. */
    var navFocus = false;
    nav.addEventListener("focusin", function () { navFocus = true; });
    nav.addEventListener("focusout", function (e) { if (e.relatedTarget && !nav.contains(e.relatedTarget)) navFocus = false; });
    document.addEventListener("pointerdown", function (e) { if (!nav.contains(e.target)) navFocus = false; });
    var moveIfLost = function () {
      var a = document.activeElement;
      if (isOpen() || (mq && mq.matches)) return;
      if (nav.contains(a) || ((!a || a === document.body) && navFocus)) toggle.focus();
    };
    var onWidth = function () {
      if (mq && mq.matches) { setOpen(false); return; }      /* 데스크톱으로: 펼침 상태 해제 */
      moveIfLost();                                           /* 모바일로: 숨은 메뉴 안 포커스를 토글로 */
      if (window.requestAnimationFrame) window.requestAnimationFrame(moveIfLost);
    };
    if (mq) { if (mq.addEventListener) mq.addEventListener("change", onWidth); else if (mq.addListener) mq.addListener(onWidth); }
  }
  groups.forEach(function (g) {
    g.addEventListener("toggle", function () { if (g.open) closeGroups(g); });
  });
  document.addEventListener("click", function (e) {
    groups.forEach(function (g) { if (g.open && !g.contains(e.target)) g.open = false; });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var openGroup = groups.filter(function (g) { return g.open; })[0];
    if (openGroup) {                                          /* 하위 메뉴가 열려 있으면 그것만 닫는다 */
      openGroup.open = false;
      var s = openGroup.querySelector("summary");
      if (s) s.focus();
      return;
    }
    if (isOpen()) { setOpen(false); if (toggle) toggle.focus(); }
  });

  /* 3. 연구성과 검색·필터·정렬 */
  var db = document.getElementById("kvDb");
  if (!db) return;
  var list = document.getElementById("kvWorks");
  var items = Array.prototype.slice.call(list.querySelectorAll(".kv-work"));
  var form = document.getElementById("kvFilters"); /* div role=search — 전송하지 않는 검색 상자 */
  var q = document.getElementById("kvQ");
  var year = document.getElementById("kvYear");
  var author = document.getElementById("kvAuthor");
  var sort = document.getElementById("kvSort");
  var count = document.getElementById("kvCount");
  var empty = document.getElementById("kvEmpty");
  var reset = document.getElementById("kvReset");
  var more = document.getElementById("kvMore");
  var moreCount = document.getElementById("kvMoreCount");
  if (!list || !form || !q || !year || !author || !sort || !count || !empty || !reset) return;
  var areaOrder = (db.getAttribute("data-area-order") || "").split("|");

  var checked = function (name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; });
  };
  var norm = function (s) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var tight = function (s) { return norm(s).replace(/ /g, ""); };
  /* 검색용 문자열은 처음 한 번만 만든다 */
  items.forEach(function (li) {
    li._kvText = norm(li.getAttribute("data-text"));
    li._kvTight = li._kvText.replace(/ /g, "");
  });

  /* 주소 동기화: 선택형 조건만 쓴다. 자유 입력 검색어(q)는 주소·방문기록에 남기지 않는다(기존 q 링크 읽기는 유지) */
  var urlTimer = null;
  var syncUrl = function (y, a, areas, types, mode) {
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      try {
        if (typeof URLSearchParams !== "function" || !window.history || !window.history.replaceState) return;
        var p = new URLSearchParams();
        if (y) p.set("year", y);
        if (a) p.set("author", a);
        areas.forEach(function (x) { p.append("area", x); });
        types.forEach(function (x) { p.append("type", x); });
        if (mode !== "new") p.set("sort", mode);
        var qs = p.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
      } catch (err) { /* 주소 갱신 실패는 목록 갱신과 무관하다 */ }
    }, 250);
  };

  var lastSort = null;
  var resort = function (mode) {
    if (mode === lastSort) return;                         /* 정렬 기준이 바뀔 때만 노드를 옮긴다 */
    lastSort = mode;
    var key = function (el) { return +((el.getAttribute("data-date") || "").replace(/-/g, "") + "00000000").slice(0, 8); };
    items.slice().sort(function (p, r) {
      var py = key(p), ry = key(r);
      if (mode === "topic") {
        var pa = areaOrder.indexOf(p.getAttribute("data-areas").split("|")[0]);
        var ra = areaOrder.indexOf(r.getAttribute("data-areas").split("|")[0]);
        if (pa !== ra) return pa - ra;
        return ry - py;
      }
      return mode === "old" ? py - ry : ry - py;
    }).forEach(function (li) { list.appendChild(li); });
  };

  /* 주소의 #pub-… 대상이 조건 때문에 숨으면 알린다 */
  var hashNote = document.createElement("p");
  hashNote.className = "kv-hashnote";
  hashNote.setAttribute("role", "status");
  hashNote.hidden = true;
  list.parentNode.insertBefore(hashNote, list);
  var checkHash = function () {
    var id = (window.location.hash || "").slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target || items.indexOf(target) === -1 || !target.hidden) { hashNote.hidden = true; hashNote.textContent = ""; return; }
    hashNote.textContent = "주소에 연결된 연구성과가 현재 조건에서 빠져 있습니다. ";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "kv-reset kv-reset--inline";
    b.textContent = "조건 해제하고 보기";
    b.addEventListener("click", function () { clearAll(); apply(true); target.scrollIntoView(); var a = target.querySelector("a"); if (a) a.focus(); });
    hashNote.appendChild(b);
    hashNote.hidden = false;
  };

  var apply = function (updateUrl) {
    var term = norm(q.value), termTight = tight(q.value);
    var y = year.value, a = author.value;
    var areas = checked("area"), types = checked("type");
    var shown = 0;
    items.forEach(function (li) {
      var ok = true;
      if (term && li._kvText.indexOf(term) === -1 && li._kvTight.indexOf(termTight) === -1) ok = false; /* «크라우드 펀딩»↔«크라우드펀딩» */
      if (ok && y && li.getAttribute("data-year") !== y) ok = false;
      if (ok && a && li.getAttribute("data-authors").split("|").indexOf(a) === -1) ok = false;
      if (ok && areas.length) {
        var la = li.getAttribute("data-areas").split("|");
        ok = areas.some(function (x) { return la.indexOf(x) !== -1; });
      }
      if (ok && types.length && types.indexOf(li.getAttribute("data-type")) === -1) ok = false;
      li.hidden = !ok;
      if (ok) shown++;
    });
    resort(sort.value);
    count.textContent = String(shown);
    empty.hidden = shown !== 0;
    var nMore = (y ? 1 : 0) + (a ? 1 : 0) + areas.length + types.length;
    if (moreCount) moreCount.textContent = nMore ? " · " + nMore + "개 적용" : "";
    checkHash();
    if (updateUrl) syncUrl(y, a, areas, types, sort.value);
  };

  var clearAll = function () {
    q.value = "";
    year.selectedIndex = 0; author.selectedIndex = 0; sort.selectedIndex = 0;
    Array.prototype.slice.call(form.querySelectorAll('input[type="checkbox"]')).forEach(function (i) { i.checked = false; });
  };

  /* 주소 매개변수로 초기 상태 복원(홈의 «분야별 실적 보기» 링크 등) — 값은 비교에만 쓰고 선택자에 넣지 않는다 */
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get("q")) q.value = params.get("q");
    if (params.get("year")) year.value = params.get("year");
    if (params.get("author")) author.value = params.get("author");
    if (params.get("sort")) sort.value = params.get("sort");
    var setChecks = function (name, values) {
      Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]')).forEach(function (i) {
        if (values.indexOf(i.value) !== -1) i.checked = true;
      });
    };
    setChecks("area", params.getAll("area"));
    setChecks("type", params.getAll("type"));
    /* 목록에 없는 값이 주소로 들어오면 선택 상자를 전체로 되돌린다 */
    [year, author, sort].forEach(function (s) { if (s.selectedIndex === -1) s.selectedIndex = 0; });
  } catch (err) { /* 오래된 브라우저: 전체 목록 유지 */ }

  /* 좁은 화면에서는 상세 조건을 접어 목록이 먼저 보이게 한다(적용된 조건이 있으면 펼친 채로) */
  if (more && window.matchMedia && window.matchMedia("(max-width: 767px)").matches &&
      !year.value && !author.value && !checked("area").length && !checked("type").length) {
    more.open = false;
  }

  /* 입력: 한글 조합 중에는 갱신을 미루고 조합이 끝나면 한 번 갱신한다. 선택 상자·체크는 change 로만 */
  var composing = false;
  q.addEventListener("compositionstart", function () { composing = true; });
  q.addEventListener("compositionend", function () { composing = false; apply(true); });
  q.addEventListener("input", function (e) { if (composing || e.isComposing) return; apply(true); });
  form.addEventListener("change", function (e) { if (e.target === q) return; apply(true); });
  reset.addEventListener("click", function () { clearAll(); apply(true); q.focus(); });
  window.addEventListener("hashchange", checkHash);
  apply(false);
})();
