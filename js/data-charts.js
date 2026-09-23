    // 연도별 추이 라인(2020~2025·광의 신규 벤처투자·중기부 공표 수치). 인라인 SVG·무의존·CSP안전.
    (function () {
      var svg = document.getElementById("trendChart");
      if (!svg) return;
      var NS = "http://www.w3.org/2000/svg";
      var rows = Array.from(document.querySelectorAll("#annual-source-table tbody tr"));
      if (!rows.length) return;
      var yrs = rows.map(function (row) { return row.dataset.year; });
      var inv = rows.map(function (row) { return Number(row.dataset.investment) / 10000; });
      var W = 720, H = 360, padL = 48, padR = 24, padT = 30, padB = 46, maxV = 18;
      function X(i) { return padL + (W - padL - padR) * (i / (yrs.length - 1)); }
      function Y(v) { return H - padB - (H - padT - padB) * (v / maxV); }
      function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
      for (var g = 0; g <= 18; g += 3) {
        svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: Y(g), x2: W - padR, y2: Y(g) }));
        var yl = el("text", { class: "ax-lab", x: padL - 9, y: Y(g) + 4, "text-anchor": "end" }); yl.textContent = g; svg.appendChild(yl);
      }
      yrs.forEach(function (yr, i) { var t = el("text", { class: "ax-lab", x: X(i), y: H - padB + 22, "text-anchor": "middle" }); t.textContent = yr; svg.appendChild(t); });
      var dd = inv.map(function (v, i) { return (i ? "L" : "M") + X(i) + " " + Y(v); }).join(" ");
      svg.appendChild(el("path", { d: dd + " L" + X(inv.length - 1) + " " + Y(0) + " L" + X(0) + " " + Y(0) + " Z", fill: "#C9A227", "fill-opacity": "0.10", stroke: "none" }));
      svg.appendChild(el("path", { d: dd, fill: "none", stroke: "#C9A227", "stroke-width": "2.8", "stroke-linejoin": "round", "stroke-linecap": "round" }));
      inv.forEach(function (v, i) {
        svg.appendChild(el("circle", { cx: X(i), cy: Y(v), r: "4.2", fill: "#C9A227" }));
        var lab = el("text", { class: "pt-lab", x: X(i), y: Y(v) - 12, "text-anchor": "middle", fill: "#fff" }); lab.textContent = v.toFixed(1); svg.appendChild(lab);
      });
      var pk = el("text", { class: "anno", x: X(1), y: Y(15.9) - 30, "text-anchor": "middle" }); pk.textContent = "▲ 2021 정점"; svg.appendChild(pk);
    })();
    // 1분기 동일 분기 비교 막대(인라인 SVG·무의존·CSP안전). 데이터=중기부 공표 수치(사실).
    (function () {
      var svg = document.getElementById("qChart");
      if (!svg) return;
      var NS = "http://www.w3.org/2000/svg";
      // 화면의 억원 원자료 표에서 읽어 차트와 표의 값이 갈라지지 않게 한다.
      var rows = document.querySelectorAll("#q1-source-table tbody tr");
      if (rows.length !== 2) return;
      var groups = Array.from(rows, function (row) {
        return { label: row.querySelector("th").textContent,
          a: Number(row.dataset.before) / 10000, b: Number(row.dataset.after) / 10000 };
      });
      var W = 560, H = 300, padL = 44, padR = 20, padT = 24, padB = 50, maxV = 5;
      function Y(v) { return H - padB - (H - padT - padB) * (v / maxV); }
      function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
      for (var g = 0; g <= 5; g++) {
        svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: Y(g), x2: W - padR, y2: Y(g) }));
        var yl = el("text", { class: "ax-lab", x: padL - 9, y: Y(g) + 4, "text-anchor": "end" }); yl.textContent = g; svg.appendChild(yl);
      }
      var bw = 54, gap = 26, groupW = bw * 2 + gap, startX = padL + 60;
      groups.forEach(function (grp, gi) {
        var gx = startX + gi * (groupW + 90);
        [["a", "#5b86c9", "2025 1Q"], ["b", "#C9A227", "2026 1Q"]].forEach(function (d, di) {
          var v = grp[d[0]], x = gx + di * (bw + gap), h = Y(0) - Y(v);
          svg.appendChild(el("rect", { x: x, y: Y(v), width: bw, height: h, rx: 4, fill: d[1] }));
          var vl = el("text", { class: "pt-lab", x: x + bw / 2, y: Y(v) - 8, "text-anchor": "middle", fill: "#fff" }); vl.textContent = v.toFixed(1); svg.appendChild(vl);
          var cl = el("text", { class: "bar-cap", x: x + bw / 2, y: H - padB + 18, "text-anchor": "middle" }); cl.textContent = d[2]; svg.appendChild(cl);
        });
        var gl = el("text", { class: "ax-lab", x: gx + groupW / 2, y: H - padB + 38, "text-anchor": "middle", fill: "#c7cfdd" }); gl.textContent = grp.label; svg.appendChild(gl);
      });
    })();
    // 연속 분기 추이 2024 1Q~2026 1Q (중기부 분기 발표·조원·2025 4Q 단독 공표값 없음 공백). 영역 그라데이션.
    (function () {
      var svg = document.getElementById("q3Chart"); if (!svg) return;
      var NS = "http://www.w3.org/2000/svg";
      var labs = ["'24 1Q", "2Q", "3Q", "4Q", "'25 1Q", "2Q", "3Q", "'26 1Q"]; var v = [2.0, 3.5, 3.2, 3.3, 2.68, 3.07, 4.04, 3.3];
      var W = 720, H = 320, padL = 40, padR = 22, padT = 24, padB = 44, maxV = 5;
      function X(i) { return padL + (W - padL - padR) * (i / (labs.length - 1)); }
      function Y(val) { return H - padB - (H - padT - padB) * (val / maxV); }
      function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
      for (var g = 0; g <= 5; g++) { svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: Y(g), x2: W - padR, y2: Y(g) })); var yl = el("text", { class: "ax-lab", x: padL - 8, y: Y(g) + 4, "text-anchor": "end" }); yl.textContent = g; svg.appendChild(yl); }
      labs.forEach(function (lb, i) { var t = el("text", { class: "ax-lab", x: X(i), y: H - padB + 22, "text-anchor": "middle" }); t.setAttribute("font-size", "11"); t.textContent = lb; svg.appendChild(t); });
      var defs = el("defs", {}); var grad = el("linearGradient", { id: "q3Grad", x1: "0", y1: "0", x2: "0", y2: "1" });
      grad.appendChild(el("stop", { offset: "0%", "stop-color": "#C9A227", "stop-opacity": ".28" }));
      grad.appendChild(el("stop", { offset: "100%", "stop-color": "#C9A227", "stop-opacity": "0" }));
      defs.appendChild(grad); svg.appendChild(defs);
      var cont = v.slice(0, 7);  // 2024 1Q~2025 3Q 연속
      var dd = cont.map(function (val, i) { return (i ? "L" : "M") + X(i) + " " + Y(val); }).join(" ");
      svg.appendChild(el("path", { d: dd + " L" + X(6) + " " + Y(0) + " L" + X(0) + " " + Y(0) + " Z", fill: "url(#q3Grad)", stroke: "none" }));
      svg.appendChild(el("path", { d: dd, fill: "none", stroke: "#C9A227", "stroke-width": "3", "stroke-linejoin": "round", "stroke-linecap": "round" }));
      svg.appendChild(el("path", { d: "M" + X(6) + " " + Y(v[6]) + "L" + X(7) + " " + Y(v[7]), fill: "none", stroke: "#C9A227", "stroke-width": "2.4", "stroke-dasharray": "5 4" })); // 2025 4Q 공백 점선
      v.forEach(function (val, i) {
        var prov = (i === 7);
        svg.appendChild(el("circle", { cx: X(i), cy: Y(val), r: "4", fill: prov ? "#1F3864" : "#C9A227", stroke: "#C9A227", "stroke-width": prov ? "2" : "0" }));
        var lab = el("text", { class: "pt-lab", x: X(i), y: Y(val) - 11, "text-anchor": "middle", fill: "#fff" }); lab.setAttribute("font-size", "11"); lab.textContent = val.toFixed(2).replace(/0$/, ""); svg.appendChild(lab);
      });
      var gn = el("text", { x: (X(6) + X(7)) / 2, y: Y(4.6), "text-anchor": "middle", fill: "#8b97ad" }); gn.setAttribute("font-size", "10"); gn.textContent = "'25 4Q 단독 공표값 없음"; svg.appendChild(gn);
    })();
    // 2025년 분기별 흐름 (1~3분기·중기부 공표·조원). 막대.
    (function () {
      var svg = document.getElementById("q25Chart"); if (!svg) return;
      var NS = "http://www.w3.org/2000/svg";
      var labs = ["2020", "2021", "2022", "2023", "2024", "2025"]; var v = [2.2, 4.3, 2.6, 3.2, 3.2, 4.0];
      var W = 560, H = 280, padL = 40, padR = 20, padT = 24, padB = 46, maxV = 5;
      function Y(val) { return H - padB - (H - padT - padB) * (val / maxV); }
      function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
      for (var g = 0; g <= 5; g++) { svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: Y(g), x2: W - padR, y2: Y(g) })); var yl = el("text", { class: "ax-lab", x: padL - 8, y: Y(g) + 4, "text-anchor": "end" }); yl.textContent = g; svg.appendChild(yl); }
      var bw = 46, gap = (W - padL - padR - bw * 6) / 7;
      v.forEach(function (val, i) { var x = padL + gap + i * (bw + gap); var h = Y(0) - Y(val); svg.appendChild(el("rect", { x: x, y: Y(val), width: bw, height: h, rx: 5, fill: "#5b86c9" })); var vl = el("text", { class: "pt-lab", x: x + bw / 2, y: Y(val) - 8, "text-anchor": "middle", fill: "#fff" }); vl.textContent = val.toFixed(1); svg.appendChild(vl); var cl = el("text", { class: "ax-lab", x: x + bw / 2, y: H - padB + 20, "text-anchor": "middle" }); cl.textContent = labs[i]; svg.appendChild(cl); });
    })();
    // 벤처투자·펀드 지수 추이(2020=100·투자/펀드/종합 3선). 중기부 「벤처투자 동향」 재구성. 무의존·CSP안전.
    (function () {
      var svg = document.getElementById("idxChart"); if (!svg) return;
      var NS = "http://www.w3.org/2000/svg";
      var rows = Array.from(document.querySelectorAll("#annual-source-table tbody tr"));
      if (!rows.length) return;
      var yrs = rows.map(function (row) { return Number(row.dataset.year); });
      var baseInv = Number(rows[0].dataset.investment), baseFund = Number(rows[0].dataset.fund);
      var inv = rows.map(function (row) { return Number(row.dataset.investment) / baseInv * 100; });
      var fund = rows.map(function (row) { return Number(row.dataset.fund) / baseFund * 100; });
      var comp = inv.map(function (value, i) { return (value + fund[i]) / 2; });
      var W = 720, H = 360, padL = 44, padR = 96, padT = 24, padB = 46, maxV = 210;
      function X(i) { return padL + (W - padL - padR) * (i / (yrs.length - 1)); }
      function Y(v) { return H - padB - (H - padT - padB) * (v / maxV); }
      function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
      for (var g = 0; g <= 200; g += 50) {
        svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: Y(g), x2: W - padR, y2: Y(g) }));
        var yl = el("text", { class: "ax-lab", x: padL - 8, y: Y(g) + 4, "text-anchor": "end" }); yl.textContent = g; svg.appendChild(yl);
      }
      yrs.forEach(function (yr, i) { var t = el("text", { class: "ax-lab", x: X(i), y: H - padB + 22, "text-anchor": "middle" }); t.textContent = yr; svg.appendChild(t); });
      function line(arr, color, w, dash) {
        var d = arr.map(function (v, i) { return (i ? "L" : "M") + X(i) + " " + Y(v); }).join(" ");
        var p = el("path", { d: d, fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round" });
        if (dash) p.setAttribute("stroke-dasharray", dash);
        svg.appendChild(p);
      }
      var defs = el("defs", {}); var grad = el("linearGradient", { id: "idxGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
      grad.appendChild(el("stop", { offset: "0%", "stop-color": "#C9A227", "stop-opacity": ".30" }));
      grad.appendChild(el("stop", { offset: "100%", "stop-color": "#C9A227", "stop-opacity": "0" }));
      defs.appendChild(grad); svg.appendChild(defs);
      var area = comp.map(function (v, i) { return (i ? "L" : "M") + X(i) + " " + Y(v); }).join(" ") + " L" + X(5) + " " + Y(0) + " L" + X(0) + " " + Y(0) + " Z";
      svg.appendChild(el("path", { d: area, fill: "url(#idxGrad)", stroke: "none" }));
      line(inv, "#5b86c9", "1.8", "2 3");
      line(fund, "#8a7bb8", "1.8", "9 5");
      line(comp.slice(0, 5), "#C9A227", "3", "");              // 2020~2024 확정(실선)
      svg.appendChild(el("path", { d: "M" + X(4) + " " + Y(comp[4]) + "L" + X(5) + " " + Y(comp[5]), fill: "none", stroke: "#C9A227", "stroke-width": "3", "stroke-dasharray": "5 4" })); // 2024~2025 잠정(점선)
      comp.forEach(function (v, i) {
        var prov = (i === 5);
        svg.appendChild(el("circle", { cx: X(i), cy: Y(v), r: "4", fill: prov ? "#1F3864" : "#C9A227", stroke: "#C9A227", "stroke-width": prov ? "2" : "0" }));
        var lab = el("text", { class: "pt-lab", x: X(i), y: Y(v) - 11, "text-anchor": "middle", fill: "#fff" }); lab.textContent = v.toFixed(1) + (prov ? "*" : ""); svg.appendChild(lab);
      });
      var note = el("text", { class: "ax-lab", x: X(5), y: Y(comp[5]) + 22, "text-anchor": "middle", fill: "#8b97ad" }); note.textContent = "*잠정"; svg.appendChild(note);
      [["투자·펀드 지수", "#C9A227", comp[5]], ["투자지수", "#5b86c9", inv[5]], ["펀드지수", "#8a7bb8", fund[5]]].forEach(function (s, i) {
        var ly = padT + 6 + i * 18;
        svg.appendChild(el("line", { x1: W - padR + 8, y1: ly, x2: W - padR + 24, y2: ly, stroke: s[1], "stroke-width": "3" }));
        var t = el("text", { class: "ax-lab", x: W - padR + 28, y: ly + 4 }); t.textContent = s[0]; svg.appendChild(t);
      });
    })();
