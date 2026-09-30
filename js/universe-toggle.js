(function () {
  "use strict";
  var key = "vmiMotion", btn = document.getElementById("uToggle");
  if (!btn) return;
  var preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var playing = true;
  try { playing = localStorage.getItem(key) !== "off"; } catch (e) {}
  var status = document.createElement("span");
  status.id = "uMotionStatus";
  status.setAttribute("role", "status");
  status.style.display = "block";
  var hint = document.querySelector(".u-hint");
  if (hint) { hint.appendChild(status); btn.setAttribute("aria-describedby", status.id); }
  function refresh() {
    var active = playing && !preference.matches;
    var label = preference.matches ? "기기의 동작 줄이기 설정에 따라 움직임을 멈췄습니다" :
      (active ? "우주 효과 멈추기" : "우주 효과 재생");
    btn.textContent = active ? "⏸" : "▶";
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.setAttribute("aria-disabled", String(preference.matches));
    status.textContent = preference.matches ? label : "";
  }
  refresh();
  btn.addEventListener("click", function () {
    if (preference.matches) return;
    playing = !playing;
    try { localStorage.setItem(key, playing ? "on" : "off"); } catch (e) {}
    refresh();
    window.dispatchEvent(new CustomEvent("vmi-motion-change", { detail: { playing: playing } }));
  });
  if (preference.addEventListener) preference.addEventListener("change", refresh);
  else preference.addListener(refresh);
})();
