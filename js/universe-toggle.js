(function () {
  "use strict";
  var key = "vmiMotion", btn = document.getElementById("uToggle");
  if (!btn) return;
  btn.hidden = false;                                  // HTML은 스크립트 없이 숨긴 상태로 둔다(P2-E1-F01).
  var preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var playing = true, unavailable = false;
  try { playing = localStorage.getItem(key) !== "off"; } catch (e) {}
  var status = document.createElement("span");
  status.id = "uMotionStatus";
  status.setAttribute("role", "status");
  status.style.display = "block";
  var hint = document.querySelector(".u-hint");
  if (hint) { hint.appendChild(status); btn.setAttribute("aria-describedby", status.id); }
  function refresh() {
    if (unavailable) return;
    var active = playing && !preference.matches;
    var label = "우주 효과 일시정지";
    var note = preference.matches ? "기기의 동작 줄이기 설정에 따라 움직임을 멈췄습니다" : "";
    btn.textContent = active ? "⏸" : "▶";
    btn.setAttribute("aria-pressed", String(!active));
    btn.setAttribute("aria-label", label);
    btn.title = active ? "우주 효과 멈추기" : "우주 효과 재생";
    btn.setAttribute("aria-disabled", String(preference.matches));
    status.textContent = note;
  }
  refresh();
  function disable() {                                // 캔버스를 쓸 수 없으면 재생 제어를 숨기고 설명은 보존한다.
    unavailable = true;
    btn.hidden = true;
    btn.setAttribute("aria-disabled", "true");
    if (hint) {
      Array.prototype.slice.call(hint.childNodes).forEach(function (n) { if (n !== status) hint.removeChild(n); });
    }
    status.textContent = "이 브라우저에서는 움직이는 효과를 표시할 수 없어 정적 화면만 보여 줍니다.";
  }
  if (document.documentElement.getAttribute("data-universe-canvas") === "off") disable();
  window.addEventListener("vmi-canvas-unavailable", disable);
  btn.addEventListener("click", function () {
    if (preference.matches || unavailable) return;
    playing = !playing;
    try { localStorage.setItem(key, playing ? "on" : "off"); } catch (e) {}
    refresh();
    window.dispatchEvent(new CustomEvent("vmi-motion-change", { detail: { playing: playing } }));
  });
  if (preference.addEventListener) preference.addEventListener("change", refresh);
  else preference.addListener(refresh);
})();
