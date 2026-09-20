/* 벤처시장연구원 — 정적 사이트 인터랙션 (의존성 0, vanilla JS) */
(function () {
  "use strict";

  /* 1. 모바일 네비 토글
   *
   * ★[2026-08-23] 닫힌 시트의 링크 12개가 **탭 포커스를 받고 있었다**(브라우저 실측).
   *   transform: translateY(-130%) 는 눈에서만 치울 뿐 접근성 트리에서 빼지 못한다.
   *   키보드 사용자는 보이지 않는 링크 12개를 지나야 본문에 닿았다.
   *
   * 설계 — 검사(GPT-5.6) 적대검수 반영:
   *   ① 상태 변경 경로를 **setMenuOpen() 하나로** 모은다. 종전에는 네 곳(토글·링크·외부
   *      클릭·ESC)이 각자 classList 와 aria 를 만져, 한 곳만 빠뜨려도 상태가 어긋났다.
   *   ② inert 는 **즉시** 걸고 visibility 는 **닫힘 전환이 끝난 뒤** 숨긴다.
   *      둘을 함께 즉시 적용하면 닫힘 애니메이션이 통째로 사라진다(검사 지적).
   *   ③ 브레이크포인트를 넘을 때 **포커스를 잃지 않는다.** inert 를 걸기 전에
   *      그 안에 포커스가 있으면 토글 버튼으로 옮긴다(검사 지적 — 신규 회귀였다).
   *   ④ 데스크톱으로 넓어지면 열림 상태를 **명시적으로 해제**한다. 남겨 두면 다시
   *      좁혔을 때 저절로 열린 메뉴가 된다.
   *   ⑤ JS 가 죽어도 최소 방어가 남도록 CSS 가 [inert] 를 시각적으로도 숨긴다.
   */
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("navMenu");
  if (toggle && menu && !menu.hasAttribute("data-persistent")) {
    /* ★[검사 2회전 ⑥] JS 가 죽으면 오프캔버스 시트가 화면 밖에 남고, inert 도 못 걸어
     *   보이지 않는 링크가 탭에 계속 노출된다. reconcile() 호출은 "JS 가 끝까지 정상 실행될 때"만
     *   막는다 — 초기화 자체가 실패하는 경로는 못 막는다.
     *   → **점진적 향상**: 이 지점에 도달했다는 것 자체가 JS 가 살아 있다는 증거이므로
     *     루트에 nav-js 를 붙이고, CSS 의 오프캔버스 규칙을 그때만 적용한다.
     *     JS 가 없으면 내비는 평범한 세로 목록으로 **보이는 채** 남는다(접근 가능·정상).
     */
    document.documentElement.classList.add("nav-js");

    var MOBILE = "(max-width: 1099px)";
    var mq = window.matchMedia(MOBILE);
    var hideTimer = null;
    var onEnd = null;

    function isMobile() { return mq.matches; }

    /* 닫힘 전환이 끝난 뒤에 시각적으로 숨긴다. 즉시 숨기면 애니메이션이 유실된다.
     *
     * ★[검사 2회전] 처음엔 transitionDuration 을 parseFloat 로 읽었다. 복수 transition 에서
     *   틀린다 — "0.1s, 0.8s" 를 100ms 로 읽어 두 번째 전환 도중 숨기고, "0s, 200ms" 는 0 으로
     *   읽어 즉시 숨긴다(실측 3/7 오답). transition-delay 도 통째로 무시했다.
     *   → **transitionend 를 1순위**로 쓰고, 계산 타이머는 **안전장치**로만 둔다.
     *     타이머 값은 delay+duration 의 **최댓값**으로 계산한다(CSS 목록 반복 매칭 포함).
     */
    function toMs(token) {
      var v = parseFloat(token);
      if (!isFinite(v)) return 0;
      return /ms\s*$/.test(token) ? v : v * 1000;
    }

    function transitionEndMs() {
      var list = [], delays = [], i;
      try {
        var cs = getComputedStyle(menu);
        list = String(cs.transitionDuration || "0s").split(",");
        delays = String(cs.transitionDelay || "0s").split(",");
      } catch (e) { return 0; }
      var max = 0;
      for (i = 0; i < list.length; i++) {
        /* CSS 는 짧은 목록을 반복해 맞춘다 — delay 개수가 적으면 순환 참조한다. */
        var d = delays.length ? delays[i % delays.length] : "0s";
        var total = toMs(list[i]) + Math.max(0, toMs(d));
        if (total > max) max = total;
      }
      return isFinite(max) && max > 0 ? max : 0;
    }

    function clearHide() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (onEnd) { menu.removeEventListener("transitionend", onEnd);
                   menu.removeEventListener("transitioncancel", onEnd); onEnd = null; }
    }

    function scheduleHide() {
      clearHide();
      var ms = transitionEndMs();
      if (ms <= 0) { menu.classList.add("nav__menu--hidden"); return; }

      /* 1순위: 실제 전환 종료 이벤트. 계산이 틀려도 여기서 정확히 잡힌다. */
      onEnd = function (e) {
        if (e.target !== menu) return;              /* 자식의 전환은 무시한다 */
        clearHide();
        if (!menu.classList.contains("open")) menu.classList.add("nav__menu--hidden");
      };
      menu.addEventListener("transitionend", onEnd);
      menu.addEventListener("transitioncancel", onEnd);

      /* 2순위(안전장치): 이벤트가 오지 않는 경우 — 탭 비활성·transition 미발생 등 */
      hideTimer = setTimeout(function () {
        clearHide();
        if (!menu.classList.contains("open")) menu.classList.add("nav__menu--hidden");
      }, ms + 80);
    }

    /* 유일한 상태 변경 경로. 다른 곳에서 classList 를 직접 만지지 아니한다. */
    function setMenuOpen(next, opts) {
      opts = opts || {};
      var mobile = isMobile();
      var open = mobile && !!next;

      menu.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");

      if (mobile && !open) {
        /* inert 를 걸기 전에 포커스를 꺼낸다 — 안에 두면 포커스가 body 로 사라진다. */
        if (menu.contains(document.activeElement)) {
          try { toggle.focus(); } catch (e) { /* 포커스 실패는 치명적이지 않다 */ }
        }
        menu.setAttribute("inert", "");
        scheduleHide();
      } else {
        clearHide();
        menu.classList.remove("nav__menu--hidden");
        menu.removeAttribute("inert");
      }
      if (open && opts.focusFirst) {
        var first = menu.querySelector("a, button");
        if (first) { try { first.focus(); } catch (e) {} }
      }
    }

    /* 뷰포트가 바뀌면 상태를 다시 맞춘다. 데스크톱에서는 항상 열림 해제·inert 해제. */
    function reconcile() { setMenuOpen(false); }

    toggle.addEventListener("click", function () {
      setMenuOpen(!menu.classList.contains("open"));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a") && menu.classList.contains("open")) setMenuOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (menu.classList.contains("open") &&
          !e.target.closest("#navMenu") && !e.target.closest("#navToggle")) setMenuOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) setMenuOpen(false);
    });
    /* 포커스 트랩 — 시트 열림 중 Tab 순환 (toggle → 항목 → toggle)·모바일 접근성 (2026-07-22) */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !menu.classList.contains("open")) return;
      var items = menu.querySelectorAll("a, button");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) { e.preventDefault(); toggle.focus(); }
        else if (active === toggle) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last) { e.preventDefault(); toggle.focus(); }
        else if (active === toggle) { e.preventDefault(); first.focus(); }
      }
    });

    /* 구형 Safari 는 MediaQueryList.addEventListener 가 없다. 없으면 addListener 로 내려간다.
       둘 다 없으면 resize 로 받는다 — 어느 경우에도 예외로 초기화가 중단되지 않아야 한다. */
    if (mq.addEventListener) mq.addEventListener("change", reconcile);
    else if (mq.addListener) mq.addListener(reconcile);
    else window.addEventListener("resize", reconcile);

    /* bfcache 복원 시에도 상태를 다시 맞춘다(뒤로가기로 돌아오면 클래스가 남아 있다). */
    window.addEventListener("pageshow", function (event) {
      // Initial asset loading must not close a menu the visitor already opened.
      if (event.persisted) reconcile();
    });

    reconcile();   /* 초기 상태 확정 */
  }

  /* 2. 헤더 스크롤 그림자 */
  var header = document.getElementById("header");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* 3. Reveal on scroll (IntersectionObserver, graceful degradation) */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    // 폴백: 모두 표시
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* Email draft workflow is provided by email-draft.js. */

  /* 6. 대표 사진 로드 실패 시 이니셜 폴백 (인라인 onerror 제거·CSP script-src 'self' 강화·2026-07-03) */
  (function () {
    var photos = document.querySelectorAll(".leader__photo");
    Array.prototype.forEach.call(photos, function (img) {
      img.addEventListener("error", function () { img.remove(); });
      if (img.complete && img.naturalWidth === 0) img.remove();
    });
  })();
})();
