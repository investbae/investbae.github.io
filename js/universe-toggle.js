    (function () {
      var KEY = "vmiMotion", btn = document.getElementById("uToggle");
      var playing; try { playing = localStorage.getItem(KEY) !== "off"; } catch (e) { playing = true; }
      function refresh(){ btn.textContent = playing ? "⏸" : "▶"; btn.setAttribute("aria-pressed", playing ? "true":"false"); btn.title = playing ? "정지" : "움직이기"; }
      refresh();
      btn.addEventListener("click", function(){ playing=!playing; try{localStorage.setItem(KEY, playing?"on":"off");}catch(e){} location.reload(); });
    })();
