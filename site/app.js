/* Idea X quiz-funnel clone — flow logic.
   One page, four screens: start → quiz → analyzing → result.
   Answers live in sessionStorage under "q-*" keys, exactly like the original,
   so the summary slide and the paywall can mirror them back.
   Append ?reset to the URL to start over. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.sessionStorage;

  const CONFIG = { currency: 'eur', analyzingMs: 10170, timerMs: 600000 };

  if (/[?&]reset\b/.test(location.search)) {
    S.clear();
    history.replaceState(null, '', location.pathname);
  }

  /* ---------------- screens ---------------- */
  const SCREENS = {
    start: { el: $('#screen-start'), body: 'body-dots' },
    quiz: { el: $('#screen-quiz'), body: 'body-dots gray-ui2' },
    analyzing: { el: $('#screen-analyzing'), body: 'body-dots gray' },
    result: { el: $('#screen-result'), body: 'body-dots' },
  };
  let current = null;
  function go(name) {
    Object.entries(SCREENS).forEach(([k, s]) => { s.el.hidden = k !== name; });
    document.body.className = SCREENS[name].body;
    window.scrollTo(0, 0);
    S.setItem('screen', name);
    current = name;
    if (name === 'quiz') quiz.enter();
    if (name === 'analyzing') analyzing.enter();
    if (name === 'result') result.enter();
  }

  /* ---------------- conditional blocks (data-show-if-key / value) ---------------- */
  function reflectAnswers(root, fallbacks = {}) {
    const keys = new Set([...Object.keys(S).filter(k => k.startsWith('q-')), ...Object.keys(fallbacks)]);
    keys.forEach(key => {
      let stored = S.getItem(key);
      if (stored === null && key in fallbacks) stored = fallbacks[key];
      $$(`[data-show-if-key="${key}"]`, root).forEach(el => { el.style.display = 'none'; });
      if (!stored) return;
      let val; try { val = JSON.parse(stored); } catch { val = stored; }
      (Array.isArray(val) ? val : [val]).forEach(v => {
        $$(`[data-show-if-key="${key}"][data-show-if-value="${CSS.escape(String(v))}"]`, root)
          .forEach(el => { el.style.display = 'flex'; });
      });
    });
  }

  /* ---------------- 1. start ---------------- */
  $$('#screen-start .level-option').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      S.setItem('q-funnel-answer', a.dataset.answerId || 'no-experience');
      S.setItem('questionOrder', '0');
      go('quiz');
    });
  });

  /* ---------------- 2. quiz ---------------- */
  const quiz = (() => {
    const root = $('#screen-quiz');
    const slides = $$('[data-slide]', root);
    const sections = $$('.slides_section', root);
    const lines = $$('.section_progress_line', root);
    const back = $('[data-back-button]', root);
    const name = $('[data-dynamic-name]', root);
    let order = 0;

    function save() {
      slides.forEach(slide => {
        const id = slide.dataset.slide;
        const checked = $$('[data-checkbox].checked', slide).map(c => c.dataset.checkbox);
        if (checked.length) S.setItem(id, JSON.stringify(checked));
        const radio = $('[data-radio].selected', slide);
        if (radio) S.setItem(id, radio.dataset.radio);
      });
      S.setItem('questionOrder', String(order));
    }

    function progress() {
      const slide = slides[order];
      const cur = slide.closest('.slides_section');
      sections.forEach((sec, i) => {
        const secSlides = $$('[data-slide]', sec);
        let pct;
        if (sec === cur) pct = (secSlides.indexOf(slide) + 1) / secSlides.length * 100;
        else pct = sections.indexOf(sec) < sections.indexOf(cur) ? 100 : 0;
        lines[i].style.transform = `translateX(-${100 - pct}%)`;
      });
      name.textContent = cur.dataset.section;
    }

    function render() {
      slides.forEach((s, i) => {
        s.classList.remove('active', 'previous', 'next');
        s.classList.add(i === order ? 'active' : i < order ? 'previous' : 'next');
        if (i === order) s.scrollTop = 0;
      });
      progress();
      back.classList.add('show'); // first slide goes back to the hero screen
      reflectAnswers(root);
    }

    function next() {
      save();
      if (order < slides.length - 1) { order++; S.setItem('questionOrder', String(order)); render(); }
    }

    function checkboxes(slide) {
      const btn = $('[data-next-button]', slide);
      if (!btn) return;
      const any = $$('[data-checkbox].checked', slide).length > 0;
      btn.classList.toggle('disabled', !any);
      const other = $('[data-target="show-object"]', slide);
      const box = $('[data-object]', slide);
      if (other && box) box.classList.toggle('show', other.classList.contains('checked'));
    }

    $$('[data-radio]', root).forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const slide = el.closest('[data-slide]');
        $$('[data-radio]', slide).forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        save();
        // last question links to /analyzing on the live site
        if (el.tagName === 'A' || order === slides.length - 1) { setTimeout(() => go('analyzing'), 180); return; }
        setTimeout(next, 180);
      });
    });

    $$('[data-checkbox]', root).forEach(el => {
      el.addEventListener('click', () => {
        el.classList.toggle('checked');
        const slide = el.closest('[data-slide]');
        checkboxes(slide);
        const checked = $$('[data-checkbox].checked', slide).map(c => c.dataset.checkbox);
        if (checked.length) S.setItem(slide.dataset.slide, JSON.stringify(checked)); else S.removeItem(slide.dataset.slide);
      });
    });

    $$('[data-skip-button]', root).forEach(el => {
      el.addEventListener('click', () => {
        const slide = el.closest('[data-slide]');
        $$('[data-checkbox]', slide).forEach(c => c.classList.remove('checked'));
        S.setItem(slide.dataset.slide, el.dataset.skipButton);
        next();
      });
    });

    $$('[data-next-button]', root).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); next(); }));
    $$('[data-go-to-slide]', root).forEach(btn => btn.addEventListener('click', () => {
      save();
      order = Math.max(0, parseInt(btn.dataset.goToSlide, 10) - 1);
      render();
    }));

    back.addEventListener('click', () => {
      save();
      if (order > 0) { order--; S.setItem('questionOrder', String(order)); render(); }
      else go('start');
    });

    function restore() {
      order = Math.min(Math.max(parseInt(S.getItem('questionOrder') || '0', 10) || 0, 0), slides.length - 1);
      slides.forEach(slide => {
        const saved = S.getItem(slide.dataset.slide);
        if (saved) {
          let arr = null; try { arr = JSON.parse(saved); } catch { }
          if (Array.isArray(arr)) $$('[data-checkbox]', slide).forEach(c => c.classList.toggle('checked', arr.includes(c.dataset.checkbox)));
          else $$('[data-radio]', slide).forEach(r => r.classList.toggle('selected', r.dataset.radio === saved));
        }
        if ($('[data-checkbox]', slide)) checkboxes(slide);
      });
      render();
    }
    return { enter: restore };
  })();

  /* ---------------- 3. analyzing ---------------- */
  const analyzing = (() => {
    const root = $('#screen-analyzing');
    const circle = $('.circle-progress', root);
    const number = $('#progress-number', root);
    const items = $$('.q-preference-item', root);
    let ring, timer;
    function build() {
      if (ring) return;
      const ns = 'http://www.w3.org/2000/svg';
      ring = document.createElementNS(ns, 'svg');
      ring.setAttribute('class', 'ring'); ring.setAttribute('viewBox', '0 0 160 160');
      const mk = (cls) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', 80); c.setAttribute('cy', 80); c.setAttribute('r', 72); c.setAttribute('class', cls); return c; };
      ring.append(mk('ring-bg'), mk('ring-fg'));
      circle.appendChild(ring);
    }
    function enter() {
      build();
      clearInterval(timer);
      items.forEach(i => i.classList.remove('is-done'));
      const fg = $('.ring-fg', ring);
      const t0 = performance.now();
      const C = 452.4;
      timer = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / CONFIG.analyzingMs);
        number.textContent = Math.floor(p * 100);
        fg.style.strokeDashoffset = C * (1 - p);
        items.forEach((it, i) => { if (p >= (i + 1) / items.length - 0.02) it.classList.add('is-done'); });
        if (p >= 1) { clearInterval(timer); setTimeout(() => go('result'), 350); }
      }, 60);
    }
    return { enter };
  })();

  /* ---------------- 4. result (paywall) ---------------- */
  const result = (() => {
    const root = $('#screen-result');
    const FALLBACKS = { 'q-anything-else': 'Lack of time and focus', 'q-goal': 'Grow in my current role', 'q-time': '10 mins / day' };
    let timerId;

    // currency: one block visible
    function currency() {
      $$('.pricing-tabs[data-dynamic-currency]', root).forEach(b => {
        b.classList.toggle('is-active', b.dataset.dynamicCurrency === CONFIG.currency);
      });
    }

    // Webflow tabs (the three plan cards)
    $$('.w-tabs', root).forEach(tabs => {
      const links = $$('.w-tab-link', tabs);
      const panes = $$('.w-tab-pane', tabs);
      links.forEach(link => link.addEventListener('click', e => {
        e.preventDefault();
        links.forEach(l => l.classList.toggle('w--current', l === link));
        panes.forEach(p => p.classList.toggle('w--tab-active', p.dataset.wTab === link.dataset.wTab));
      }));
    });

    // countdown (10:00) – the live page runs three copies of the same timer
    function countdown() {
      clearInterval(timerId);
      const end = Date.now() + CONFIG.timerMs;
      const pad = n => (n < 10 ? '0' : '') + n;
      const tick = () => {
        const d = Math.max(0, end - Date.now());
        const m = pad(Math.floor(d / 60000)), s = pad(Math.floor(d % 60000 / 1000));
        ['1', '2', '3'].forEach(i => { const me = $('#minutes' + i), se = $('#seconds' + i); if (me) me.textContent = m; if (se) se.textContent = s; });
        if (d === 0) clearInterval(timerId);
      };
      tick(); timerId = setInterval(tick, 1000);
    }

    // anchors: sticky timer / sticky button scroll to #pricing
    $$('a[href="#pricing"]', root).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const target = $('#pricing', root) || $('.section-pricing', root);
      target && target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    // plan CTA → checkout modal
    $$('.pricing-cta', root).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const tabs = a.closest('.w-tabs');
      const card = $('.w-tab-link.w--current', tabs);
      const text = sel => { const el = $(sel, card); return el ? el.textContent.trim() : ''; };
      const prices = $$('.discount-price-text .geist-14px', card).map(el => el.textContent.trim());
      const cur = $('.tag-price-content .geist-14px', card);
      const sym = cur ? cur.textContent.trim() : '€';
      const perDay = `${sym}${text('.geist-pricing-price')}.${$$('.tag-price-content .geist-14px', card)[1]?.textContent.trim() || ''}/Day`;
      openCheckout({
        title: text('.plan-title-tag .geist-18-px').replace(/s$/i, '').toLowerCase().replace(' ', '-'),
        badge: text('.uui-badge-small-success-2') || '',
        old: prices[0] || '', new: prices[1] || '', perDay,
      });
    }));

    $$('[data-legal]', root).forEach(a => a.addEventListener('click', e => e.preventDefault()));

    function enter() {
      currency();
      reflectAnswers(root, FALLBACKS);
      countdown();
    }
    return { enter };
  })();

  /* ---------------- checkout modal ---------------- */
  const ck = $('#checkout');
  const email = $('#ck-email');
  const cont = $('#ck-continue');
  const note = $('.ck-note', ck);
  function openCheckout(p) {
    $('[data-ck="title"]', ck).textContent = p.title || '4-week';
    const badge = $('[data-ck="badge"]', ck); badge.textContent = p.badge; badge.hidden = !p.badge;
    $('[data-ck="perday"]', ck).textContent = p.perDay;
    $('[data-ck="old"]', ck).textContent = p.old;
    $('[data-ck="new"]', ck).textContent = p.new;
    $('[data-ck="new2"]', ck).textContent = p.new;
    note.hidden = true; email.value = ''; cont.disabled = true;
    ck.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(() => email.focus(), 50);
  }
  function closeCheckout() { ck.hidden = true; document.body.style.overflow = ''; }
  $$('[data-ck-close]', ck).forEach(el => el.addEventListener('click', closeCheckout));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ck.hidden) closeCheckout(); });
  email.addEventListener('input', () => { cont.disabled = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()); });
  cont.addEventListener('click', () => { note.hidden = false; });

  /* ---------------- boot ---------------- */
  const saved = S.getItem('screen');
  go(saved && SCREENS[saved] && saved !== 'analyzing' ? saved : 'start');
})();
