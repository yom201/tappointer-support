// Tap Pointer home page: in-browser preview of the mobile editor's tap effects.
(() => {
  'use strict';
  const COLORS = { green: '#30d158', blue: '#0a84ff', red: '#ff453a' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now();
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Canvas layer that draws Tap / Area / Swipe effects in normalized (0..1) coordinates.
  class Stage {
    constructor(canvas, options = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ size: 0.3, minSize: 56, maxSize: 130 }, options);
      this.effects = [];
      this.overlay = null; // optional function(ctx, w, h, t) drawn under effects
      this.visible = false;
      this.running = false;
      this.resize();
      new ResizeObserver(() => { this.resize(); this.loop(); }).observe(canvas);
      new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) this.loop();
      }).observe(canvas);
    }

    get d() { return clamp(this.w * this.o.size, this.o.minSize, this.o.maxSize); }

    resize() {
      const r = this.c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.w = r.width; this.h = r.height;
      this.c.width = Math.max(1, Math.round(r.width * dpr));
      this.c.height = Math.max(1, Math.round(r.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    add(effect) {
      const life = { tap: 1150, area: 1500, swipe: 1400 }[effect.kind] || 1200;
      this.effects.push(Object.assign({ t: now(), life }, effect));
      this.loop();
    }

    loop() {
      if (this.running) return;
      this.running = true;
      const step = () => {
        this.draw(now());
        // Keep animating only while something is moving and the canvas is on screen.
        if (this.visible && (this.effects.length || this.keepAlive)) requestAnimationFrame(step);
        else this.running = false;
      };
      requestAnimationFrame(step);
    }

    draw(t) {
      const { ctx, w, h } = this;
      ctx.clearRect(0, 0, w, h);
      if (this.overlay) this.overlay(ctx, w, h, t);
      this.effects = this.effects.filter(e => t - e.t < e.life);
      for (const e of this.effects) {
        const p = clamp((t - e.t) / e.life, 0, 1);
        if (e.kind === 'area') this.drawArea(e, p);
        else if (e.kind === 'swipe') this.drawSwipe(e, p);
        else this.drawTap(e, p);
      }
    }

    drawTap(e, p) {
      const { ctx, w, h, d } = this;
      const x = e.x * w, y = e.y * h, fade = 1 - p;
      ctx.lineWidth = Math.max(2.5, d * 0.045);
      ctx.strokeStyle = rgba(e.color, fade);
      ctx.shadowColor = rgba(e.color, 0.8 * fade);
      ctx.shadowBlur = d * 0.18;
      ctx.beginPath();
      ctx.arc(x, y, (d / 2) * (0.2 + 0.8 * easeOut(p)), 0, Math.PI * 2);
      ctx.stroke();
      const p2 = clamp((p - 0.18) / 0.82, 0, 1);
      if (p2 > 0) {
        ctx.lineWidth = Math.max(1.5, d * 0.025);
        ctx.strokeStyle = rgba(e.color, 0.6 * (1 - p2));
        ctx.beginPath();
        ctx.arc(x, y, (d / 2) * (0.2 + 0.8 * easeOut(p2)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(e.color, 0.5 * fade);
      ctx.beginPath();
      ctx.arc(x, y, d * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
      ctx.beginPath();
      ctx.arc(x, y, d * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    drawArea(e, p) {
      const { ctx, w, h } = this;
      const a = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
      const grow = 1 + 0.04 * (1 - easeOut(Math.min(1, p / 0.25)));
      const rw = e.w * w * grow, rh = e.h * h * grow;
      const x = e.x * w - rw / 2, y = e.y * h - rh / 2;
      roundRect(ctx, x, y, rw, rh, Math.min(14, rh / 3));
      ctx.fillStyle = rgba(e.color, 0.16 * a);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(e.color, a);
      ctx.shadowColor = rgba(e.color, 0.8 * a);
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    drawSwipe(e, p) {
      const { ctx, w, h, d } = this;
      const move = ease(clamp(p / 0.7, 0, 1));
      const fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      const x1 = e.x * w, y1 = e.y * h, x2 = e.x2 * w, y2 = e.y2 * h;
      const cx = x1 + (x2 - x1) * move, cy = y1 + (y2 - y1) * move;
      const grad = ctx.createLinearGradient(x1, y1, cx, cy);
      grad.addColorStop(0, rgba(e.color, 0));
      grad.addColorStop(1, rgba(e.color, 0.9 * fade));
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(5, d * 0.12);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.fillStyle = rgba(e.color, 0.55 * fade);
      ctx.shadowColor = rgba(e.color, 0.9 * fade);
      ctx.shadowBlur = d * 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
      ctx.beginPath();
      ctx.arc(cx, cy, d * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const relPoint = (el, ev) => {
    const r = el.getBoundingClientRect();
    return { x: clamp((ev.clientX - r.left) / r.width, 0, 1), y: clamp((ev.clientY - r.top) / r.height, 0, 1) };
  };

  // 1. Hero: ripples play on the phone screen; visitors can tap to add their own.
  const heroCanvas = document.getElementById('hero-fx');
  if (heroCanvas) {
    const hero = new Stage(heroCanvas, { size: 0.3 });
    const screen = heroCanvas.parentElement;
    const palette = [COLORS.green, COLORS.blue, COLORS.red];
    // Points on the dashboard screenshot (normalized to the image).
    const spots = [[0.344, 0.375], [0.458, 0.662], [0.278, 0.887], [0.84, 0.152], [0.8, 0.79], [0.3, 0.54], [0.24, 0.256]];
    let userUntil = 0, colorIndex = 0;
    screen.addEventListener('pointerdown', ev => {
      const pt = relPoint(heroCanvas, ev);
      userUntil = now() + 2500;
      hero.add({ kind: 'tap', x: pt.x, y: pt.y, color: palette[colorIndex++ % palette.length] });
    });
    if (!reduceMotion) {
      (async () => {
        for (let i = 0; ; i++) {
          await wait(1050);
          if (!hero.visible || now() < userUntil || document.hidden) continue;
          const [x, y] = spots[i % spots.length];
          hero.add({ kind: 'tap', x, y, color: palette[i % palette.length] });
        }
      })();
    }
  }

  // 2. Try it: a simplified editor with a timeline and playback.
  const tryRoot = document.getElementById('try-editor');
  if (tryRoot) {
    const $ = s => tryRoot.querySelector(s);
    const canvas = $('#try-fx');
    const video = canvas.parentElement;
    const stage = new Stage(canvas, { size: 0.3, minSize: 60, maxSize: 110 });
    const track = $('.tl-track'), head = $('.tl-head'), timeOut = $('.tl-time'), countOut = $('.tl-count');
    const playBtn = $('[data-act="play"]'), hint = $('.try-hint'), note = $('.try-note');
    const DURATION = 10, GAP = 1.2, FIRST = 0.6, MAX = 8;
    const LABEL = { tap: 'T', area: 'A', swipe: 'S' };
    let tool = 'tap', color = 'green', events = [], playing = null, playT = 0;

    const fmt = s => `00:${String(Math.floor(s)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
    const setHead = s => {
      playT = s;
      head.style.left = `${(s / DURATION) * 100}%`;
      timeOut.textContent = `${fmt(s)} / ${fmt(DURATION)}`;
    };
    const say = text => { note.textContent = text; };

    const render = () => {
      track.querySelectorAll('.tl-mark').forEach(m => m.remove());
      events.forEach((e, i) => {
        const m = document.createElement('b');
        m.className = 'tl-mark';
        m.style.left = `${(e.time / DURATION) * 100}%`;
        m.style.setProperty('--c', COLORS[e.color]);
        m.textContent = LABEL[e.kind];
        m.title = `${e.kind} at ${fmt(e.time)}`;
        if (i === events.length - 1 && e.fresh) { m.classList.add('drop'); e.fresh = false; }
        track.appendChild(m);
      });
      countOut.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
      playBtn.disabled = events.length === 0;
      stage.loop();
    };

    // Faint guides for placed events, so the visitor can see where they are.
    stage.overlay = (ctx, w, h) => {
      if (playing) return;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.font = '700 12px -apple-system, "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      events.forEach((e, i) => {
        const c = COLORS[e.color];
        ctx.strokeStyle = rgba(c, 0.75);
        if (e.kind === 'area') {
          roundRect(ctx, (e.x - e.w / 2) * w, (e.y - e.h / 2) * h, e.w * w, e.h * h, 10);
          ctx.stroke();
        } else {
          if (e.kind === 'swipe') {
            ctx.beginPath(); ctx.moveTo(e.x * w, e.y * h); ctx.lineTo(e.x2 * w, e.y2 * h); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(e.x * w, e.y * h, 13, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(c, 0.95);
        ctx.fillText(String(i + 1), e.x * w, e.y * h);
      });
      ctx.restore();
    };

    const effectOf = e => Object.assign({}, e, { color: COLORS[e.color] });

    const addEvent = (kind, a, b) => {
      if (events.length >= MAX) { say(`This demo holds up to ${MAX} events. Press Clear to start again.`); return; }
      const time = events.length ? events[events.length - 1].time + GAP : FIRST;
      const e = { kind, color, time, fresh: true, x: a.x, y: a.y };
      if (kind === 'area') {
        const dragged = b && Math.abs(b.x - a.x) > 0.06 && Math.abs(b.y - a.y) > 0.04;
        e.w = dragged ? Math.abs(b.x - a.x) : 0.62;
        e.h = dragged ? Math.abs(b.y - a.y) : 0.12;
        e.x = dragged ? (a.x + b.x) / 2 : clamp(a.x, e.w / 2 + 0.03, 0.97 - e.w / 2);
        e.y = dragged ? (a.y + b.y) / 2 : clamp(a.y, e.h / 2 + 0.03, 0.97 - e.h / 2);
      } else if (kind === 'swipe') {
        const dragged = b && Math.hypot(b.x - a.x, b.y - a.y) > 0.06;
        e.x2 = dragged ? b.x : a.x;
        e.y2 = dragged ? b.y : clamp(a.y - 0.25, 0.05, 1);
        if (!dragged && e.y2 > a.y - 0.08) { e.y2 = clamp(a.y + 0.25, 0, 0.95); }
      }
      events.push(e);
      stage.add(effectOf(e));
      setHead(time);
      hint.hidden = true;
      say(`${events.length} of ${MAX}: ${kind[0].toUpperCase() + kind.slice(1)} at ${fmt(time)}. Press Play to watch them in order.`);
      render();
    };

    const stop = () => {
      if (!playing) return;
      cancelAnimationFrame(playing.raf);
      playing = null;
      stage.keepAlive = false;
      playBtn.textContent = 'Play';
      playBtn.setAttribute('aria-pressed', 'false');
      tryRoot.classList.remove('is-playing');
      stage.loop();
    };

    const play = () => {
      if (playing) { stop(); return; }
      if (!events.length) return;
      const end = Math.min(DURATION, events[events.length - 1].time + 1.3);
      const startAt = now();
      let fired = 0;
      playing = { raf: 0 };
      stage.keepAlive = true;
      playBtn.textContent = 'Stop';
      playBtn.setAttribute('aria-pressed', 'true');
      tryRoot.classList.add('is-playing');
      stage.loop();
      const step = () => {
        if (!playing) return;
        const s = (now() - startAt) / 1000;
        setHead(Math.min(s, end));
        while (fired < events.length && events[fired].time <= s) {
          stage.add(effectOf(events[fired]));
          const marks = track.querySelectorAll('.tl-mark');
          if (marks[fired]) { marks[fired].classList.remove('hit'); void marks[fired].offsetWidth; marks[fired].classList.add('hit'); }
          fired++;
        }
        if (s >= end) { stop(); return; }
        playing.raf = requestAnimationFrame(step);
      };
      playing.raf = requestAnimationFrame(step);
    };

    // Pointer input on the video: tap adds an event; dragging sets a swipe path or an area.
    let downAt = null;
    video.addEventListener('pointerdown', ev => {
      stop();
      downAt = relPoint(canvas, ev);
      video.setPointerCapture(ev.pointerId);
    });
    video.addEventListener('pointerup', ev => {
      if (!downAt) return;
      const up = relPoint(canvas, ev);
      addEvent(tool, downAt, up);
      downAt = null;
    });
    video.addEventListener('pointercancel', () => { downAt = null; });
    video.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      stop();
      addEvent(tool, { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4 });
    });

    tryRoot.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      tool = b.dataset.tool;
      tryRoot.querySelectorAll('[data-tool]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    tryRoot.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
      color = b.dataset.color;
      tryRoot.querySelectorAll('[data-color]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
    playBtn.addEventListener('click', play);
    $('[data-act="undo"]').addEventListener('click', () => {
      stop();
      events.pop();
      setHead(events.length ? events[events.length - 1].time : 0);
      say(events.length ? `${events.length} of ${MAX} events.` : 'Tap the video to add an event.');
      render();
    });
    $('[data-act="clear"]').addEventListener('click', () => {
      stop();
      events = [];
      setHead(0);
      hint.hidden = false;
      say('Tap the video to add an event.');
      render();
    });

    // Start with a short example so Play works right away.
    events = [
      { kind: 'tap', color: 'green', time: FIRST, x: 0.28, y: 0.36 },
      { kind: 'area', color: 'blue', time: FIRST + GAP, x: 0.5, y: 0.655, w: 0.92, h: 0.12 },
      { kind: 'swipe', color: 'red', time: FIRST + GAP * 2, x: 0.5, y: 0.78, x2: 0.5, y2: 0.5 },
    ];
    setHead(0);
    render();
    hint.hidden = false;

    // Play the example once when the section first comes into view.
    if (!reduceMotion) {
      const io = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { io.disconnect(); setTimeout(() => { if (!playing && events.length) play(); }, 500); }
      }, { threshold: 0.5 });
      io.observe(tryRoot);
    }
  }

  // 3. Workflow: each step animates when it scrolls into view, and replays on return.
  const steps = document.querySelector('.steps.animated');
  if (steps) {
    const items = [...steps.children];
    const bar = steps.querySelector('.wf-bar i'), pct = steps.querySelector('.wf-pct');
    // Keep the percentage in step with the CSS progress bar.
    let raf = 0;
    const syncPct = () => {
      cancelAnimationFrame(raf);
      const tick = () => {
        const m = getComputedStyle(bar).transform.match(/matrix\(([^,]+)/);
        const v = Math.round((m ? parseFloat(m[1]) : 1) * 100);
        pct.textContent = `${v}%`;
        if (v < 100 && bar.closest('li').classList.contains('play')) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io3 = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('play');
        if (bar && e.target.contains(bar)) { if (reduceMotion) pct.textContent = '100%'; else syncPct(); }
      } else if (!reduceMotion) {
        e.target.classList.remove('play');
      }
    }), { threshold: 0.5 });
    items.forEach(li => io3.observe(li));
  }

  // 5. Fade sections in as they scroll into view (same as the Mac page).
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();
