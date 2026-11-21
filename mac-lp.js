// Tap Pointer for Mac landing page: in-browser simulation of the Mac app's pointer effects.
(() => {
  'use strict';
  const COLORS = { green: '#30d158', blue: '#0a84ff', red: '#ff453a', yellow: '#ffd60a' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now();
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  class FX {
    constructor(canvas, options = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({
        color: COLORS.green, size: 110, duration: 1.2, left: 'ripple', right: 'ripple',
        trail: true, trailWidth: 6, keepTrail: false, follow: false, followSize: 64,
        followOpacity: 0.22, cursor: true, ref: 1000,
      }, options);
      this.effects = [];
      this.trails = [];
      this.pos = { x: 0.5, y: 0.5 };
      this.dragging = null;
      this.user = false;
      this.visible = false;
      this.running = false;
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) this.loop();
      }).observe(canvas);
    }

    get k() { return Math.max(0.42, Math.min(1.2, this.w / this.o.ref)); }

    resize() {
      const r = this.c.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      this.w = r.width; this.h = r.height;
      this.c.width = Math.max(1, Math.round(r.width * d));
      this.c.height = Math.max(1, Math.round(r.height * d));
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    click(button) {
      if (this.o.keepTrail) this.trails = [];
      this.effects.push({ x: this.pos.x, y: this.pos.y, t: now(), b: button });
    }

    down(button) {
      this.click(button);
      if (!this.o.trail) return;
      this.dragging = { pts: [{ x: this.pos.x, y: this.pos.y, t: now() }], done: false };
      this.trails.push(this.dragging);
    }

    point() {
      if (this.dragging) this.dragging.pts.push({ x: this.pos.x, y: this.pos.y, t: now() });
    }

    up() {
      if (this.dragging) { this.dragging.done = true; this.dragging.end = now(); }
      this.dragging = null;
    }

    loop() {
      if (this.running) return;
      this.running = true;
      const step = () => {
        this.draw(now());
        if (this.visible) requestAnimationFrame(step); else this.running = false;
      };
      requestAnimationFrame(step);
    }

    draw(t) {
      const { ctx, w, h, o, k } = this;
      ctx.clearRect(0, 0, w, h);
      const life = o.duration * 1000;

      // Drag trails: a single line that fades from its oldest part.
      for (const tr of this.trails) {
        if (!o.keepTrail) tr.pts = tr.pts.filter(p => t - p.t < life);
        const pts = tr.pts;
        if (pts.length < 2) continue;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, o.trailWidth * k);
        for (let i = 1; i < pts.length; i++) {
          const a = o.keepTrail ? 0.9 : 0.9 * (1 - (t - pts[i].t) / life);
          ctx.strokeStyle = rgba(o.color, a);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x * w, pts[i - 1].y * h);
          ctx.lineTo(pts[i].x * w, pts[i].y * h);
          ctx.stroke();
        }
      }
      this.trails = this.trails.filter(tr => !tr.done || tr.pts.length > 1 || tr === this.dragging);
      if (!o.trail) this.trails = [];

      // Spotlight that follows the pointer.
      if (o.follow) {
        ctx.fillStyle = rgba(o.color, o.followOpacity);
        ctx.beginPath();
        ctx.arc(this.pos.x * w, this.pos.y * h, (o.followSize * k) / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Click effects.
      this.effects = this.effects.filter(e => t - e.t < life);
      for (const e of this.effects) {
        const p = (t - e.t) / life;
        const x = e.x * w, y = e.y * h;
        const style = e.b === 'R' ? o.right : o.left;
        const fade = 1 - p;
        const d = o.size * k;
        ctx.setLineDash(e.b === 'R' ? [Math.max(4, 7 * k), Math.max(3, 5 * k)] : []);
        if (style === 'ripple') {
          ctx.lineWidth = Math.max(2, 4 * k);
          ctx.strokeStyle = rgba(o.color, fade);
          ctx.beginPath();
          ctx.arc(x, y, (d / 2) * (0.2 + 0.8 * easeOut(p)), 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = rgba(o.color, 0.42 * fade);
          ctx.beginPath();
          ctx.arc(x, y, d * 0.16, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const r = d * 0.2;
          ctx.fillStyle = rgba(o.color, 0.45 * fade);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, 2.5 * k);
          ctx.strokeStyle = rgba(o.color, fade);
          ctx.stroke();
          if (style === 'labeledCircle') {
            ctx.setLineDash([]);
            ctx.fillStyle = `rgba(255,255,255,${fade})`;
            ctx.font = `800 ${Math.round(r * 0.95)}px -apple-system, "Helvetica Neue", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(e.b, x, y + 1);
          }
        }
        ctx.setLineDash([]);
      }

      // Simulated macOS arrow pointer (hidden while the visitor drives it).
      if (o.cursor && !this.user) this.drawCursor(this.pos.x * w, this.pos.y * h, Math.max(0.75, 1.25 * k));
    }

    drawCursor(x, y, s) {
      const { ctx } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(5.5, 17); ctx.lineTo(9.5, 26);
      ctx.lineTo(13, 24.5); ctx.lineTo(9, 15.8); ctx.lineTo(16, 15.8); ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fill();
      ctx.restore();
    }

    // Scripted motion; stops early when the visitor takes over.
    moveTo(x, y, ms) {
      const sx = this.pos.x, sy = this.pos.y, t0 = now();
      return new Promise(resolve => {
        const step = () => {
          if (this.user) return resolve();
          const p = Math.min(1, (now() - t0) / ms);
          const e = ease(p);
          this.pos.x = sx + (x - sx) * e;
          this.pos.y = sy + (y - sy) * e;
          this.point();
          if (p < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    async path(points, ms) {
      const each = ms / points.length;
      for (const [x, y] of points) {
        if (this.user) return;
        await this.moveTo(x, y, each);
      }
    }

    async run(script) {
      if (reduceMotion) { this.pos = { x: 0.55, y: 0.5 }; this.loop(); return; }
      for (;;) {
        if (this.user || !this.visible) { await wait(400); continue; }
        await script(this);
      }
    }

    interactive(el) {
      let idle;
      const rel = ev => {
        const r = this.c.getBoundingClientRect();
        this.pos = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
      };
      const takeOver = () => {
        this.user = true;
        clearTimeout(idle);
        idle = setTimeout(() => { if (!this.dragging) this.user = false; }, 2500);
      };
      el.addEventListener('pointermove', ev => { if (ev.pointerType === 'touch' && !this.dragging) return; takeOver(); rel(ev); this.point(); });
      el.addEventListener('pointerdown', ev => {
        takeOver(); rel(ev);
        el.setPointerCapture(ev.pointerId);
        this.down(ev.button === 2 ? 'R' : 'L');
      });
      const release = () => { this.up(); takeOver(); };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('contextmenu', ev => ev.preventDefault());
    }
  }

  // Scripts for each demo canvas.
  const scripts = {
    async hero(fx) {
      await fx.moveTo(0.36, 0.3, 900); fx.click('L'); await wait(900);
      await fx.moveTo(0.66, 0.5, 900); fx.click('L'); await wait(900);
      await fx.moveTo(0.8, 0.36, 700); fx.click('R'); await wait(1000);
      await fx.moveTo(0.3, 0.84, 900);
      fx.down('L');
      await fx.path([[0.38, 0.8], [0.48, 0.86], [0.58, 0.8], [0.7, 0.86], [0.82, 0.8]], 1600);
      fx.up(); await wait(1300);
    },
    async spotlight(fx) {
      const t0 = now();
      while (!fx.user && now() - t0 < 6000) {
        const a = (now() - t0) / 1000;
        await fx.moveTo(0.5 + 0.3 * Math.sin(a * 1.3), 0.5 + 0.25 * Math.sin(a * 2.1), 120);
      }
    },
    async clicks(fx) {
      await fx.moveTo(0.3, 0.4, 600); fx.click('L'); await wait(700);
      await fx.moveTo(0.68, 0.38, 600); fx.click('R'); await wait(700);
      await fx.moveTo(0.5, 0.68, 600); fx.click('L'); await wait(300); fx.click('L'); await wait(900);
    },
    async trail(fx) {
      await fx.moveTo(0.18, 0.62, 500);
      fx.down('L');
      await fx.path([[0.3, 0.35], [0.45, 0.3], [0.55, 0.55], [0.68, 0.7], [0.82, 0.4]], 1800);
      fx.up(); await wait(1400);
    },
    async style(fx) {
      await fx.moveTo(0.32, 0.55, 500); fx.click('L'); await wait(1100);
      await fx.moveTo(0.68, 0.55, 500); fx.click('R'); await wait(1100);
    },
    async play(fx) {
      await fx.moveTo(0.3, 0.32, 800); fx.click('L'); await wait(fx.o.duration * 500 + 300);
      await fx.moveTo(0.7, 0.4, 800); fx.click('R'); await wait(fx.o.duration * 500 + 300);
      await fx.moveTo(0.22, 0.75, 700);
      fx.down('L');
      await fx.path([[0.35, 0.62], [0.5, 0.78], [0.65, 0.62], [0.8, 0.74]], 1600);
      fx.up(); await wait(Math.max(900, fx.o.duration * 1000));
    },
  };

  const fxByName = {};
  document.querySelectorAll('canvas.fx').forEach(canvas => {
    const name = canvas.dataset.demo;
    const opts = JSON.parse(canvas.dataset.opts || '{}');
    const fx = new FX(canvas, opts);
    fxByName[name] = fx;
    if (canvas.hasAttribute('data-interactive')) fx.interactive(canvas.parentElement);
    fx.run(scripts[canvas.dataset.script || name]);
  });

  // Playground controls drive the playground canvas.
  const play = fxByName.play;
  if (play) {
    document.querySelectorAll('[data-ctl]').forEach(el => {
      const key = el.dataset.ctl;
      const out = document.querySelector(`output[for="${el.id}"]`);
      const show = v => { if (out) out.value = out.dataset.fmt.replace('{v}', v); };
      if (el.matches('input[type="range"]')) {
        const set = () => {
          const v = Number(el.value);
          play.o[key] = key === 'followOpacity' ? v / 100 : v;
          show(key === 'duration' ? v.toFixed(1) : v);
        };
        el.addEventListener('input', set); set();
      } else if (el.matches('input[type="checkbox"]')) {
        const set = () => {
          play.o[key] = el.checked;
          const sub = document.querySelector(`[data-sub="${key}"]`);
          if (sub) sub.hidden = !el.checked;
        };
        el.addEventListener('change', set); set();
      } else {
        el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          play.o[key] = key === 'color' ? COLORS[b.dataset.v] : b.dataset.v;
          if (key === 'color') document.querySelectorAll('canvas.fx').forEach(c => { if (fxByName[c.dataset.demo]) fxByName[c.dataset.demo].o.color = COLORS[b.dataset.v]; });
        }));
      }
    });
  }

  // Recording flow: capture choice → countdown → REC with audio → stop keys → MP4.
  const rec = document.getElementById('rec');
  if (rec) {
    const $ = s => rec.querySelector(s);
    const frame = $('.cap-frame'), label = $('.cap-label'), count = $('.count');
    const pill = $('.rec-pill'), meter = $('.meter'), keys = $('.keys'), mp4 = $('.mp4');
    const timer = pill.querySelector('span');
    const feats = [...rec.closest('#record').querySelectorAll('.feat')];
    const on = i => feats.forEach((f, j) => f.classList.toggle('on', j === i));
    const preview = document.createElement('div');
    preview.className = 'rec-preview';
    preview.hidden = true;
    preview.setAttribute('aria-hidden', 'true');
    rec.append(preview);
    const modes = [
      { box: [0, 0, 100, 100], text: label.dataset.full, dash: false },
      { box: [50, 30, 42, 56], text: label.dataset.window, dash: false },
      { box: [12, 24, 40, 44], text: label.dataset.region, dash: true },
    ];
    const setFrame = ({ box: [l, t, wd, ht], text, dash }) => {
      Object.assign(frame.style, { left: l + '%', top: t + '%', width: wd + '%', height: ht + '%', opacity: 1 });
      frame.classList.toggle('dash', dash);
      label.textContent = text;
      label.style.opacity = 1;
    };
    const keyRow = (html) => { keys.innerHTML = html; keys.classList.add('show'); return [...keys.querySelectorAll('.kbd')]; };
    const press = async (ks, delay) => { ks.forEach(k => k.classList.add('hit')); await delay(220); ks.forEach(k => k.classList.remove('hit')); };
    const startKeys = '<span class="kbd">⌘</span><span class="kbd">⇧</span><span class="kbd">R</span>';
    const total = 5;
    const leftWord = pill.dataset.left || 'left', leftFirst = pill.dataset.leftFirst === '1';
    const showTime = (s, stopTimer = false) => {
      const elapsed = `00:0${s}`;
      const remaining = `00:0${total - s}`;
      timer.textContent = stopTimer
        ? `${elapsed} · ${leftFirst ? `${leftWord} ${remaining}` : `${remaining} ${leftWord}`}`
        : elapsed;
    };
    const showRecording = () => { pill.classList.add('show'); meter.classList.add('show'); };
    const resetScene = () => {
      [count, keys, pill, meter, mp4].forEach(el => el.classList.remove('show'));
      frame.style.opacity = 0;
      label.style.opacity = 0;
      preview.hidden = true;
      preview.className = 'rec-preview';
      preview.replaceChildren();
      on(-1);
    };
    let visible = false;
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(rec);
    let autoStop = true;

    const captureModes = async delay => {
      for (const mode of modes) { setFrame(mode); await delay(1300); }
    };
    const countdown = async delay => {
      const start = keyRow(startKeys);
      await delay(500); await press(start, delay); await delay(300);
      keys.classList.remove('show'); label.style.opacity = 0;
      for (const n of ['3', '2', '1']) {
        count.textContent = n; count.classList.add('show'); await delay(650);
        count.classList.remove('show'); await delay(200);
      }
    };
    const cycle = async delay => {
      on(0);
      await captureModes(delay);
      on(3);
      await countdown(delay);
      on(1);
      showRecording();
      autoStop = !autoStop;
      if (autoStop) {
        on(3);
        for (let s = 0; s <= total; s++) { showTime(s, true); await delay(s === total ? 500 : 650); }
      } else {
        for (let s = 0; s <= 3; s++) { showTime(s); await delay(s === 3 ? 400 : 750); }
        on(2);
        await delay(900);
        on(3);
        const stop = keyRow('<span class="kbd">esc</span>');
        await delay(400); await press(stop, delay); await delay(120); await press(stop, delay); await delay(300);
      }
      pill.classList.remove('show'); meter.classList.remove('show'); keys.classList.remove('show');
      frame.style.opacity = 0;
      mp4.classList.add('show'); await delay(2200);
      mp4.classList.remove('show'); await delay(500);
    };
    const autoplay = async delay => {
      if (reduceMotion) { setFrame(modes[1]); showTime(0); showRecording(); return; }
      for (;;) {
        if (visible) await cycle(delay);
        else await delay(400);
      }
    };

    // Only one playback owns the screen. Switching cancels its pending timer.
    let playback;
    const playRecording = async playScene => {
      playback?.abort();
      playback = new AbortController();
      const { signal } = playback;
      const delay = ms => new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => { clearTimeout(timerId); reject(signal.reason); };
        const timerId = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
        signal.addEventListener('abort', abort, { once: true });
      });
      resetScene();
      try { await playScene(delay); }
      catch (error) { if (error !== signal.reason) throw error; }
    };
    const playFeature = async (button, index, delay) => {
      if (!reduceMotion) {
        while (!visible) await delay(200);
      }
      on(index);
      switch (button.dataset.recordingFeature) {
      case 'capture':
        if (reduceMotion) setFrame(modes[2]);
        else await captureModes(delay);
        break;
      case 'audio':
        showTime(0);
        showRecording();
        break;
      case 'quality':
        preview.classList.add('quality');
        preview.textContent = button.querySelector('.feat-summary').textContent.trim();
        preview.hidden = false;
        break;
      case 'controls':
        if (!reduceMotion) await countdown(delay);
        showTime(0, true);
        showRecording();
        break;
      case 'camera':
        preview.classList.add('camera');
        preview.append(button.querySelector('svg').cloneNode(true));
        preview.hidden = false;
        break;
      }
      if (reduceMotion) return;
      await delay(5500);
      resetScene();
      await autoplay(delay);
    };

    let expanded;
    feats.forEach((button, index) => {
      if (!button.matches('button[data-recording-feature]')) return;
      const detail = document.getElementById(button.getAttribute('aria-controls'));
      button.addEventListener('click', () => {
        const wasExpanded = expanded?.button === button;
        if (expanded) {
          expanded.button.setAttribute('aria-expanded', 'false');
          expanded.detail.hidden = true;
          expanded = undefined;
        }
        if (wasExpanded) {
          playRecording(autoplay);
          return;
        }
        expanded = { button, detail };
        button.setAttribute('aria-expanded', 'true');
        detail.hidden = false;
        playRecording(delay => playFeature(button, index, delay));
      });
    });
    playRecording(autoplay);
  }

  // Fade sections in as they scroll into view.
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();
