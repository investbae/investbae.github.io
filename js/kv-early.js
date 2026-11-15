/* 첫 그리기 전에 kv-js 표시를 붙여 모바일 메뉴가 펼쳐졌다 접히는 레이아웃 이동(CLS)을 막는다. CSP script-src 'self' 안의 외부 파일.
   대체 경로(3회전 T01): load 때까지 머리글에 메뉴 초기화 표시(kv-nav-ready)가 없으면 kvmi-2026.js 가 실패한 것으로 보고,
   여기서 최소한의 메뉴 열기·닫기만 붙인다(메뉴를 펼쳐 놓으면 그 순간 레이아웃이 크게 움직이므로 접힌 채 단추를 살린다).
   단추가 없으면 kv-js 를 떼어 메뉴를 펼친다. 이 파일 자체가 실행되지 않으면 처음부터 메뉴가 펼쳐진 상태다. */
document.documentElement.classList.add("kv-js");
window.addEventListener("load", function () {
  var h = document.querySelector(".kv-header");
  if (!h || h.classList.contains("kv-nav-ready")) return;
  var t = document.getElementById("kvNavToggle");
  if (!t) { document.documentElement.classList.remove("kv-js"); return; }
  t.addEventListener("click", function () {
    var open = !h.classList.contains("is-open");
    h.classList.toggle("is-open", open);
    t.setAttribute("aria-expanded", open ? "true" : "false");
  });
  h.classList.add("kv-nav-ready", "kv-nav-fallback");
});
