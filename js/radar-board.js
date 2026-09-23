    // radar.json(법제처 키워드 관측·국회 미연동) → 분야별 관측 대장 렌더. 절차 판단 0·원문 필드만.
    (function () {
      function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
      function safeUrl(u){
        try { var url=new URL(u); if(!/^https?:$/.test(url.protocol) || !/^(www\.)?law\.go\.kr$/.test(url.hostname) || url.username || url.password || /\/DRF\/|[?&]OC=|lawService\.do/i.test(u)) throw new Error(); url.protocol="https:"; return url.href; }
        catch(e){ return "https://www.law.go.kr"; }
      }
      function fmtDate(d){ var m=String(d||"").replace(/[-.]/g,"").match(/^(\d{4})(\d{2})(\d{2})$/); return m? m[1]+"."+m[2]+"."+m[3] : String(d||""); }
      // 분야 키워드 매핑 (법령·안건명 → 4개 분야, 그 외 기타)
      function fieldOf(t){
        t = t||"";
        if(/가상자산|디지털자산/.test(t)) return "crypto";
        if(/신기술사업금융|기술보증|여신전문/.test(t)) return "techfin";
        if(/벤처투자|벤처기업|창업|모태펀드|벤처펀드|조건부지분/.test(t)) return "venture";
        if(/자본시장|금융투자업/.test(t)) return "capital";
        return "etc";
      }
      function fieldLabel(f){ return {venture:"벤처투자·벤처기업",crypto:"가상자산·디지털자산",techfin:"신기술금융·기술보증",capital:"자본시장",etc:"기타"}[f]||"기타"; }
      // 절차단계 배지: 원문 시행일(ef_date) 확인분만 사실 표시, 그 외 「절차단계 미확인」
      function statusBadge(r){
        if(r.hold) return '<span class="badge hold">확인보류</span>';
        var days=daysUntil(r.ef_date);
        if(days!==null){
          return days>0 ? '<span class="badge upcoming">공개자료상 시행 예정</span>'
                          : '<span class="badge arrived">공개자료상 시행일 도래</span>';
        }
        return '<span class="badge unconfirmed">절차단계 미확인</span>';
      }
      function daysUntil(d){
        var m=String(d||"").replace(/[-.]/g,"").match(/^(\d{4})(\d{2})(\d{2})$/); if(!m) return null;
        var t=new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
        if(t.getUTCFullYear()!==+m[1] || t.getUTCMonth()!==+m[2]-1 || t.getUTCDate()!==+m[3]) return null;
        var parts={}; new Intl.DateTimeFormat("en",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).forEach(function(p){parts[p.type]=p.value;});
        var today=Date.UTC(+parts.year,+parts.month-1,+parts.day);
        return Math.round((t.getTime()-today)/86400000);
      }
      function gate(r){
        var src = r.dept ? esc(r.dept) : "법제처";
        var checked = r.collected_date || META_DATE;
        var ef = daysUntil(r.ef_date)!==null ? "🗓️ 자료상 시행 "+fmtDate(r.ef_date) : "🗓️ 시행일 미확인";
        return '<div class="gate"><span>🏛️ <b>'+(r.dept?'소관':'출처')+'</b> '+src+'</span><span>자동수집 · 원문 확인 필요</span><span>🗓️ 수집일 '+esc(checked)+'</span><span>'+ef+'</span></div>';
      }
      function card(r){
        var titleTxt = esc(r.title);
        var days = r.hold ? null : daysUntil(r.ef_date);
        var daysTxt = (days!==null && days>0) ? '<div class="days">자료상 시행예정일까지 '+days+'일</div>' : '';
        return '<div class="law-item" data-field="'+fieldOf(r.title)+'"><div><div class="t">'+titleTxt+'</div>'+gate(r)+daysTxt+
               '</div><div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">'+statusBadge(r)+
               '<a class="src" href="'+esc(safeUrl(r.link))+'" target="_blank" rel="noopener">원문 →</a></div></div>';
      }
      var META_DATE = "";
      var BOARD = [];
      var activeField = "all";
      function applyFilter(f){
        var items = document.querySelectorAll("#board .law-item");
        var shown=0;
        items.forEach(function(el){
          var ok = (f==="all") || (el.getAttribute("data-field")===f);
          el.style.display = ok ? "" : "none"; if(ok) shown++;
        });
        document.getElementById("board-c").textContent = shown+"건";
        var board=document.getElementById("board");
        if(shown===0 && !board.querySelector(".empty-f")) {
          var e=document.createElement("div"); e.className="empty empty-f"; e.textContent="표시할 수집 항목이 없습니다 (해당 분야)."; board.appendChild(e);
        } else { var ex=board.querySelector(".empty-f"); if(ex && shown>0) ex.remove(); }
      }
      var updateStatus=document.getElementById("radarUpdateStatus");
      if(updateStatus){
        fetch("/data/radar_status.json?cb="+Date.now()).then(function(r){if(!r.ok) throw new Error(); return r.json();}).then(function(s){
          var when=(s.updated_at||"").slice(0,10);
          var suffix=/^\d{4}-\d{2}-\d{2}$/.test(when) ? " (상태 기록일: "+when+")" : "";
          if(s.status==="hold") updateStatus.textContent="핵심 8개 법령·발의 의안: 2026.8.23 확인 / 관측 보드: 2026.9.18 수집. 최신 개정은 법제처 원문에서 확인하세요.";
          else if(s.status==="ok") updateStatus.textContent="최근 갱신 점검이 완료됐습니다. 자료별 수집일과 원문을 확인해 주세요."+suffix;
          else updateStatus.textContent="갱신 상태를 확인할 수 없습니다. 아래 자료의 수집일과 원문을 확인해 주세요.";
        }).catch(function(){updateStatus.textContent="갱신 상태를 불러오지 못했습니다. 아래 자료의 수집일과 원문을 확인해 주세요.";});
      }
      fetch("/data/radar.json?cb="+Date.now()).then(function(r){if(!r.ok) throw new Error(); return r.json();}).then(function(d){
        META_DATE = d.collected_date||"";
        document.getElementById("meta").innerHTML =
          '게시 자료 수집일 <b>'+esc(d.collected_date||"")+'</b> · 출처 <b>'+esc(d.source||"법제처 국가법령정보")+'</b> · 관측 키워드 <b>'+esc((d.keywords&&d.keywords.length)?d.keywords.join("·"):"벤처투자·벤처기업·가상자산·신기술사업금융 등")+'</b> · 현재 효력과 개정 여부는 원문에서 확인하세요.';
        // recent/upcoming/ppc 통합
        BOARD = [].concat(d.recent||[], d.upcoming||[]);
        var board=document.getElementById("board");
        if(!BOARD.length){ board.innerHTML='<div class="empty">표시할 수집 항목이 없습니다.</div>'; }
        else { board.innerHTML = BOARD.map(card).join(""); }
        applyFilter(activeField);
        // 캘린더: 원문 시행일 확인 + 미래 항목만
        var cal = (d.upcoming||[]).concat(d.recent||[]).filter(function(r){ var days=daysUntil(r.ef_date); return !r.hold && days!==null && days>0; });
        var calEl=document.getElementById("cal");
        if(!cal.length){ calEl.innerHTML='<div class="empty">수집 자료 중 오늘(한국시간) 이후로 기재된 시행 예정 항목이 없습니다. 자료상 시행일이 지난 항목은 위 관측 보드에서 확인할 수 있으며, 현재 효력은 원문을 확인해 주세요.</div>'; }
        else {
          cal.sort(function(a,b){ return (a.ef_date||"").localeCompare(b.ef_date||""); });
          calEl.innerHTML = cal.map(function(r){
            var dys=daysUntil(r.ef_date);
            return '<div class="cal-item"><span class="ct">'+esc(r.title)+'</span><span class="cd">시행 '+fmtDate(r.ef_date)+(dys!==null&&dys>=0?' · 시행예정일까지 '+dys+'일':'')+'</span></div>';
          }).join("");
        }
        document.getElementById("cal-c").textContent = cal.length+"건";
      }).catch(function(){
        document.getElementById("meta").innerHTML='<span>데이터를 불러오지 못했습니다. 원문은 <a href="https://www.law.go.kr" target="_blank" rel="noopener" style="color:var(--gold-soft)">국가법령정보센터</a>에서 확인하세요.</span>';
        document.getElementById("board").innerHTML=''; document.getElementById("cal").innerHTML='';
      });
      // 분야 필터 버튼
      document.querySelectorAll("#fieldFilter button").forEach(function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-field") === activeField)); });
      document.getElementById("fieldFilter").addEventListener("click", function(e){
        var btn=e.target.closest("button"); if(!btn) return;
        this.querySelectorAll("button").forEach(function(b){ b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        activeField = btn.getAttribute("data-field");
        applyFilter(activeField);
      });
    })();
