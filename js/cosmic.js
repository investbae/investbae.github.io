/* KVMI: decorative orbital motion; native navigation and content work without JS. */
(() => {
  'use strict';
  const root = document.querySelector('.cosmic-home');
  const control = document.querySelector('.cx-motion');
  if (!root || !control) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const en = document.documentElement.lang === 'en';
  let paused = false;
  function sync() {
    const stopped = paused || preference.matches || document.hidden;
    root.classList.toggle('cx-animate', !stopped);
    control.hidden = preference.matches;
    control.setAttribute('aria-pressed', String(paused));
    control.textContent = paused ? (en ? 'Resume motion' : '움직임 재생') : (en ? 'Pause motion' : '움직임 멈추기');
  }
  control.addEventListener('click', () => { paused = !paused; sync(); });
  if (preference.addEventListener) preference.addEventListener('change', sync);
  else preference.addListener(sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
