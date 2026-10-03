/* No text, source links or numerical facts are modified. */
(() => {
  'use strict';
  const root = document.querySelector('body.cosmic-home');
  const hero = root && root.querySelector('.report-hero');
  if (!hero || !window.matchMedia || !window.IntersectionObserver ||
      !Element.prototype.animate || getComputedStyle(root).getPropertyValue('--kv-motion-css').trim() !== '1') return;
  const pref = matchMedia('(prefers-reduced-motion: reduce)');
  const english = document.documentElement.lang === 'en';
  const active = new Map();
  let paused = false, printing = false;
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'kv-motion-toggle';
  const finish = (within) => {
    for (const [animation, element] of active) {
      if (!within || within === element || within.contains(element) || element.contains(within)) {
        animation.cancel(); active.delete(animation);
      }
    }
  };
  const running = () => !paused && !pref.matches && !document.hidden && !printing;
  const sync = () => {
    root.classList.toggle('kv-motion-running', running());
    control.hidden = pref.matches;
    control.setAttribute('aria-pressed', String(paused));
    control.textContent = english ? (paused ? 'Resume motion' : 'Pause motion') : (paused ? '움직임 재생' : '움직임 멈추기');
    if (!running()) finish();
  };
  control.addEventListener('click', () => {
    paused = !paused;
    sync();
  });
  const ambient = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('kv-motion-inview', entry.isIntersecting);
  });
  const entrance = new IntersectionObserver(entries => {
    let stagger = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entrance.unobserve(entry.target);
      if (!running() || entry.target.contains(document.activeElement) || entry.target.id === location.hash.slice(1)) continue;
      const animation = entry.target.animate([{transform:'translateY(16px)'},{transform:'translateY(0)'}],
        {duration:600, delay:Math.min(stagger++ * 80,160), easing:'cubic-bezier(.2,.7,.2,1)'});
      active.set(animation, entry.target);
      animation.onfinish = animation.oncancel = () => active.delete(animation);
    }
  }, {threshold:.08});
  // Install every stop mechanism before starting any visible motion.
  pref.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', event => finish(event.target));
  window.addEventListener('hashchange', () => finish());
  window.addEventListener('beforeprint', () => { printing = true; sync(); });
  window.addEventListener('afterprint', () => { printing = false; sync(); });
  const art = document.createElement('div');
  art.className = 'kv-motion-art'; art.setAttribute('aria-hidden','true');
  for (const className of ['kv-motion-orbit','kv-motion-orbit kv-motion-orbit--second','kv-motion-light']) {
    const shape = document.createElement('span'); shape.className = className; art.append(shape);
  }
  hero.append(art);
  hero.querySelector('.report-actions').after(control);
  root.classList.add('kv-motion-ready');
  sync();
  ambient.observe(hero);
  const universe = root.querySelector('.cx-universe');
  if (universe) ambient.observe(universe);
  for (const element of root.querySelectorAll('.report-kicker, .report-hero h1, #main h2, .cx-data-link, .cx-area')) {
    element.dataset.kvEntrance = ''; entrance.observe(element);
  }
})();
