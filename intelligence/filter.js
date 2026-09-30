"use strict";
const form = document.getElementById("filter");
const rows = [...document.querySelectorAll(".issue")];
const english = document.documentElement.lang.toLowerCase().startsWith("en");
function apply() {
  const q = document.getElementById("query").value.trim().toLocaleLowerCase();
  const topic = document.getElementById("topic").value;
  const publisher = document.getElementById("publisher").value;
  let count = 0;
  for (const row of rows) {
    const show = (!q || row.textContent.toLocaleLowerCase().includes(q)) &&
      (!topic || row.dataset.topic.split(" ").includes(topic)) &&
      (!publisher || row.dataset.publisher === publisher);
    row.hidden = !show;
    if (show) count++;
  }
  document.getElementById("result-count").textContent = english ?
    String(count) + " results" : (q || topic || publisher ? "검색 결과 " : "전체 ") + count + "건";
  document.getElementById("empty").hidden = count !== 0;
}
form.addEventListener("submit", e => { e.preventDefault(); apply(); });
form.addEventListener("input", apply);
form.addEventListener("change", apply);
form.addEventListener("reset", () => setTimeout(apply, 0));
// History traversal can restore controls after pageshow dispatch.
window.addEventListener("pageshow", () => setTimeout(apply, 0));
apply();
