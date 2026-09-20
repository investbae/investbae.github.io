    // 벤처기업 지표 막대 — 중기부 벤처기업명단(2026-05-21) 전수 39,668개사 직접 집계. 무의존·CSP안전.
    (function () {
      var TOTAL = 39668;
      var types = [["혁신성장유형",25592,64.5],["벤처투자유형",8594,21.7],["연구개발유형",5258,13.3],["예비벤처유형",224,0.6]];
      var regions = [["경기",12726,32.1,1],["서울",11179,28.2,1],["인천",1873,4.7,1],["부산",1741,4.4,0],["대전",1552,3.9,0],["경남",1471,3.7,0],["경북",1395,3.5,0],["충남",1344,3.4,0],["대구",1223,3.1,0],["충북",996,2.5,0],["전북",959,2.4,0],["전남",751,1.9,0],["강원",736,1.9,0],["광주",709,1.8,0],["울산",496,1.3,0],["제주",291,0.7,0],["세종",226,0.6,0]];
      var inds = [["제조업",21856,55.1],["정보처리·소프트웨어",8687,21.9],["기타",4419,11.1],["도·소매업",1854,4.7],["연구개발서비스",1596,4.0],["건설·운수업",1072,2.7],["농·어·임·광업",184,0.5]];
      var CAPS = { typeBars: "벤처확인유형별 분포", regionBars: "지역별 분포", indBars: "업종별 분포" };
      function bars(elId, rows) {
        var el = document.getElementById(elId); if (!el) return;
        rows.forEach(function (r) {
          var name = r[0], cnt = r[1], pct = r[2], metro = (r[3] === 1);
          var row = document.createElement("div"); row.className = "ind-row";
          var lab = document.createElement("div"); lab.className = "lab";
          lab.textContent = name + (metro ? " (수도권)" : "");   // 색상 외 텍스트 보조(색각 이상 대응)
          var track = document.createElement("div"); track.className = "ind-track";
          var bar = document.createElement("div"); bar.className = "ind-bar" + (metro ? " metro" : "");
          bar.style.width = pct + "%";
          track.appendChild(bar);
          var val = document.createElement("div"); val.className = "ind-val";
          val.appendChild(document.createTextNode(pct.toFixed(1) + "% "));
          var sm = document.createElement("small"); sm.textContent = "(" + cnt.toLocaleString() + ")";
          val.appendChild(sm);
          row.appendChild(lab); row.appendChild(track); row.appendChild(val);
          el.appendChild(row);
        });
      }
      bars("typeBars", types);
      bars("regionBars", regions);
      bars("indBars", inds);
    })();
