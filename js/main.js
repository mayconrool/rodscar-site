/* =========================================================
   RODSCAR — scroll cinema + efeitos
   Um progresso p (0..1) por cena comanda vídeo, texto e detalhes.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- helpers (declarados ANTES de qualquer bind) ---------- */
  var WA = '5598987496911';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function range(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function sectionProgress(el) {
    var r = el.getBoundingClientRect();
    var scrollable = el.offsetHeight - window.innerHeight;
    return scrollable > 0 ? clamp01(-r.top / scrollable) : 0;
  }
  function viewProgress(el) { // 0 quando o topo entra pela base, 1 quando a base sai pelo topo
    var r = el.getBoundingClientRect(), vh = window.innerHeight;
    return clamp01((vh - r.top) / (vh + r.height));
  }
  function brl(n) { return 'R$ ' + n.toLocaleString('pt-BR'); }
  function kmFmt(n) { return n.toLocaleString('pt-BR') + ' km'; }
  function waLink(msg) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg); }

  /* Carrega o vídeo como Blob (buscável em qualquer servidor, inclusive sem Range) */
  function loadVideo(video, onProgress) {
    var url = video.dataset.src;
    return new Promise(function (resolve) {
      function direto() { video.src = url; video.load(); resolve(); }
      if (!window.fetch || !window.URL || !window.ReadableStream) { direto(); return; }
      fetch(url).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        var total = +res.headers.get('Content-Length') || 0;
        var reader = res.body.getReader(), got = 0, chunks = [];
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            chunks.push(r.value); got += r.value.length;
            if (total && onProgress) onProgress(got / total);
            return pump();
          });
        }
        return pump().then(function () { return new Blob(chunks, { type: 'video/mp4' }); });
      }).then(function (blob) {
        video.src = URL.createObjectURL(blob); video.load();
        if (onProgress) onProgress(1);
        resolve();
      }).catch(direto);
    });
  }

  /* ---------- partículas: fumaça e faíscas ---------- */
  function makeSmokeSprite(rgb) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + rgb + ',.55)'); gr.addColorStop(.45, 'rgba(' + rgb + ',.22)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
  }
  function Fx(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.ps = []; this.visible = false;
    this.smoke = makeSmokeSprite('210,210,215'); this.smokeRed = makeSmokeSprite('255,60,40');
    this.resize();
  }
  Fx.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = this.c.clientWidth; this.h = this.c.clientHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  Fx.prototype.puff = function (x, y, opt) {
    opt = opt || {};
    this.ps.push({ k: 's', x: x, y: y, vx: (opt.vx || 0) + (Math.random() - .5) * 40, vy: (opt.vy || -30) - Math.random() * 40,
      r: (opt.r || 60) * (.6 + Math.random() * .8), gr: opt.gr || 90, life: 0, max: (opt.max || 2.6) * (.7 + Math.random() * .6),
      a: opt.a || .7, red: !!opt.red, rot: Math.random() * 6.28 });
  };
  Fx.prototype.spark = function (x, y, speed) {
    var ang = Math.random() * 6.28, v = (speed || 400) * (.4 + Math.random());
    this.ps.push({ k: 'k', x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0, max: .5 + Math.random() * .7, len: 6 + Math.random() * 14 });
  };
  Fx.prototype.step = function (dt) {
    var g = this.g; g.clearRect(0, 0, this.w, this.h);
    for (var i = this.ps.length - 1; i >= 0; i--) {
      var p = this.ps[i]; p.life += dt;
      if (p.life >= p.max) { this.ps.splice(i, 1); continue; }
      var t = p.life / p.max;
      if (p.k === 's') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; p.r += p.gr * dt;
        g.globalAlpha = p.a * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (1 - t);
        g.drawImage(p.red ? this.smokeRed : this.smoke, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = 1 - t; g.globalCompositeOperation = 'lighter';
        g.strokeStyle = t < .3 ? 'rgb(255,230,160)' : 'rgb(255,90,30)'; g.lineWidth = 2;
        var n = Math.hypot(p.vx, p.vy) || 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / n * p.len, p.y - p.vy / n * p.len); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.globalAlpha = 1;
    if (this.ps.length > 420) this.ps.splice(0, this.ps.length - 420);
  };

  /* ---------- elementos ---------- */
  var nav = $('#nav'), redline = $('#redline'), waFloat = $('#waFloat');
  var loader = $('#loader'), loaderArc = $('#loaderArc'), loaderPct = $('#loaderPct');

  /* ---------- cenas ---------- */
  var scenes = $$('.scene').map(function (el) {
    return {
      el: el, video: $('video', el), poster: $('.scene__poster', el), lines: $$('.scene__line', el),
      end: parseFloat(el.dataset.end || '0.7'), duration: 0, ready: false, p: 0, last: -1, hook: null
    };
  });
  function markReady(s) {
    if (s.ready) return;
    var v = s.video;
    s.duration = v.duration || s.duration || 0;
    if (!s.duration) return;
    s.ready = true; v.classList.add('is-ready');
    if (v.videoWidth) console.info('[rodscar] ' + s.el.id + ' ' + v.videoWidth + 'x' + v.videoHeight + ' ' + s.duration.toFixed(2) + 's');
    s.last = -1; requestApply();
  }
  scenes.forEach(function (s) {
    var v = s.video;
    if (v.readyState >= 1 && v.duration) s.duration = v.duration;
    v.addEventListener('loadedmetadata', function () { s.duration = v.duration; if (v.readyState >= 2) markReady(s); });
    v.addEventListener('loadeddata', function () { markReady(s); });
    v.addEventListener('canplaythrough', function () { markReady(s); });
  });

  /* ---------- carregamento: hero primeiro, depois as outras cenas ---------- */
  var hero = scenes[0], loaderDone = false;
  function setLoader(f) {
    var pct = Math.round(f * 100);
    loaderArc.setAttribute('stroke-dasharray', (424 * f).toFixed(1) + ' 566');
    loaderPct.textContent = pct + '%';
  }
  function hideLoader() {
    if (loaderDone) return; loaderDone = true;
    setLoader(1); setTimeout(function () { loader.classList.add('is-gone'); }, 250);
    requestApply();
  }
  hero.video.addEventListener('canplaythrough', hideLoader);
  setTimeout(hideLoader, 6000); // rede lenta: libera assim mesmo (poster cobre)
  loadVideo(hero.video, setLoader).then(function () {
    if (hero.video.readyState >= 4) hideLoader();
    return loadVideo(scenes[1].video);
  }).then(function () { return loadVideo(scenes[2].video); });

  /* ---------- velocímetro (ticks) ---------- */
  (function buildSpeedo() {
    var g = $('#speedoTicks'), html = '';
    for (var i = 0; i <= 28; i++) {
      var a = (-225 + i * (270 / 28)) * Math.PI / 180, major = i % 4 === 0;
      var r1 = major ? 62 : 67, r2 = 72;
      var x1 = 100 + Math.cos(a) * r1, y1 = 100 + Math.sin(a) * r1, x2 = 100 + Math.cos(a) * r2, y2 = 100 + Math.sin(a) * r2;
      html += '<line class="speedo__tick' + (i >= 24 ? ' speedo__tick--red' : '') + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
      if (major) {
        var lx = 100 + Math.cos(a) * 50, ly = 100 + Math.sin(a) * 50 + 3;
        html += '<text class="speedo__lbl" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '">' + (i * 10) + '</text>';
      }
    }
    g.innerHTML = html;
  })();
  var speedoArc = $('#speedoArc'), speedoNeedle = $('#speedoNeedle'), speedoVal = $('#speedoVal');
  var signal = $('#signal'), signalTxt = $('#signalTxt'), heroFlash = $('#heroFlash'), scrollHint = $('#scrollHint');

  /* ---------- conta-giros (ignição) ---------- */
  var tachoSegs = [];
  (function buildTacho() {
    var svg = $('#tachoSvg'), html = '', N = 24;
    for (var i = 0; i < N; i++) {
      var w = 9, gap = 3.4, x = i * (w + gap), h = 18 + Math.pow(i / (N - 1), 1.6) * 66;
      html += '<rect class="tacho__seg' + (i >= N - 5 ? ' is-red' : '') + '" x="' + x.toFixed(1) + '" y="' + (90 - h).toFixed(1) + '" width="' + w + '" height="' + h.toFixed(1) + '" rx="1.5" transform="skewX(-12)"/>';
    }
    svg.innerHTML = html; tachoSegs = $$('rect', svg);
  })();
  var tachoVal = $('#tachoVal');

  /* ---------- facetas (cena R) ---------- */
  var facets = [['#f1', '#f1v', 0.05, 0.4], ['#f2', '#f2v', 0.25, 0.6], ['#f3', '#f3v', 0.45, 0.8]].map(function (f) {
    return { bar: $(f[0]), val: $(f[1]), a: f[2], b: f[3] };
  });

  /* ---------- efeitos de partícula ---------- */
  var heroFx = new Fx($('#heroFx')), rFx = new Fx($('#rFx')), finalFx = new Fx($('#finalFx'));
  var fxList = [heroFx, rFx, finalFx];
  if ('IntersectionObserver' in window) {
    var fxIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { fxList.forEach(function (f) { if (f.c === e.target) f.visible = e.isIntersecting; }); });
      kickLoop();
    });
    fxList.forEach(function (f) { fxIO.observe(f.c); });
  }
  var rBurstArmed = true;

  /* ---------- hooks de cada cena (tudo lê o MESMO p) ---------- */
  hero.hook = function (p, vel) {
    // semáforo
    var st = p < 0.22 ? 'red' : p < 0.29 ? 'yellow' : 'green';
    if (signal.dataset.state !== st) { signal.dataset.state = st; signalTxt.textContent = st === 'red' ? 'Aguarde' : st === 'yellow' ? 'Atenção' : 'Acelera'; }
    // velocímetro: só sobe depois do verde
    var v = Math.pow(range(p, 0.28, 1), 1.35);
    var kmh = Math.round(v * 280);
    speedoArc.setAttribute('stroke-dasharray', (376.99 * v).toFixed(1) + ' 502.65');
    speedoNeedle.style.transform = 'rotate(' + (-135 + v * 270).toFixed(2) + 'deg)';
    speedoVal.textContent = kmh;
    // flash do escapamento
    var burn = range(p, 0.4, 0.5);
    heroFlash.style.opacity = (burn * (0.25 + Math.min(.6, vel * 0.0006) + Math.random() * .12)).toFixed(3);
    scrollHint.style.opacity = p > 0.02 ? 0 : 1;
  };
  rHook();
  function rHook() {
    scenes[1].hook = function (p) {
      facets.forEach(function (f) {
        var t = easeOutExpo(range(p, f.a, f.b));
        f.bar.style.transform = 'scaleX(' + t.toFixed(3) + ')';
        f.val.textContent = Math.round(t * 100) + '%';
      });
      if (p > 0.8 && rBurstArmed) {
        rBurstArmed = false;
        if (!reduce) { var cx = rFx.w * .5, cy = rFx.h * .5; for (var i = 0; i < 70; i++) rFx.spark(cx + (Math.random() - .5) * 120, cy + (Math.random() - .5) * 120, 520); for (var j = 0; j < 8; j++) rFx.puff(cx, cy, { red: true, r: 90, gr: 160, a: .5, vy: 0, max: 1.6 }); kickLoop(); }
      }
      if (p < 0.7) rBurstArmed = true;
    };
  }
  scenes[2].hook = function (p) {
    var rpm = range(p, 0.12, 0.85);
    rpm = rpm < 0.15 ? rpm * 2.4 : 0.36 + (rpm - 0.15) / 0.85 * 0.64; // tranco da partida e depois sobe
    var on = Math.round(rpm * tachoSegs.length);
    for (var i = 0; i < tachoSegs.length; i++) tachoSegs[i].classList.toggle('is-on', i < on);
    tachoVal.textContent = (rpm * 8).toFixed(1);
  };

  /* ---------- outros elementos ligados ao scroll ---------- */
  var parallax = $$('[data-parallax]');
  var steps = $('#steps'), trackPath = $('#trackPath'), trackLen = 0;
  if (trackPath && trackPath.getTotalLength) {
    trackLen = trackPath.getTotalLength();
    trackPath.style.strokeDasharray = trackLen + ' ' + trackLen;
    trackPath.style.strokeDashoffset = trackLen;
  }

  /* ---------- laço de scroll ---------- */
  var ticking = false, lastY = window.scrollY, lastT = performance.now(), vel = 0;
  function requestApply() {
    if (document.hidden) { apply(); return; }   // painel oculto não entrega rAF
    if (!ticking) {
      ticking = true;
      var id = requestAnimationFrame(apply);
      // painéis/abas em segundo plano podem segurar o rAF: aplica mesmo assim
      setTimeout(function () { if (ticking) { cancelAnimationFrame(id); apply(); } }, 120);
    }
  }
  function apply() {
    ticking = false;
    var now = performance.now(), y = window.scrollY, dt = Math.max(1, now - lastT);
    vel = vel * .6 + (Math.abs(y - lastY) / dt * 1000) * .4; lastY = y; lastT = now;

    // barra de giro + nav
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    redline.style.transform = 'scaleX(' + (docH > 0 ? y / docH : 0).toFixed(4) + ')';
    nav.classList.toggle('is-solid', y > 40);
    waFloat.classList.toggle('is-on', y > window.innerHeight * 4.2);

    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > window.innerHeight + 50) return;
      var p = sectionProgress(s.el); s.p = p;
      if (s.ready && s.duration && Math.abs(p - s.last) > 0.0005) {
        s.video.currentTime = Math.min(s.duration - 0.02, p * s.duration);
        s.last = p;
        if (s.poster && p > 0.002) s.poster.style.visibility = 'hidden';
      }
      s.lines.forEach(function (el) {
        el.classList.toggle('is-on', p >= parseFloat(el.dataset.from) && p < parseFloat(el.dataset.to));
      });
      s.el.classList.toggle('is-end', p >= s.end);
      if (s.hook) s.hook(p, vel);
    });

    // paralaxe leve
    if (!reduce) parallax.forEach(function (img) {
      var p = viewProgress(img.parentElement), amt = parseFloat(img.dataset.parallax) || 40;
      img.style.transform = 'translate3d(0,' + ((p - .5) * amt).toFixed(1) + 'px,0) scale(1.12)';
    });

    // trilha do "como funciona"
    if (steps && trackLen) {
      var sp = range(viewProgress(steps), 0.15, 0.55);
      trackPath.style.strokeDashoffset = (trackLen * (1 - sp)).toFixed(1);
    }
    kickLoop();
  }
  window.addEventListener('scroll', requestApply, { passive: true });
  window.addEventListener('resize', function () { fxList.forEach(function (f) { f.resize(); }); requestApply(); });
  document.addEventListener('visibilitychange', requestApply);

  /* ---------- laço de partículas (só roda com efeito visível) ---------- */
  var loopOn = false, prevT = 0;
  function kickLoop() {
    if (reduce || loopOn || document.hidden) return;
    var need = fxList.some(function (f) { return f.visible || f.ps.length; });
    if (!need) return;
    loopOn = true; prevT = performance.now(); requestAnimationFrame(loop);
  }
  function loop(t) {
    var dt = Math.min(.05, (t - prevT) / 1000); prevT = t;
    // fumaça de pneu no hero: depende do progresso e da velocidade do scroll
    if (heroFx.visible) {
      var p = hero.p, burn = range(p, 0.42, 0.55);
      var rate = burn * (1.2 + Math.min(4, vel / 600));
      if (p >= 0.995) rate = burn * .5;
      var w = heroFx.w, h = heroFx.h;
      while (rate > 0) {
        if (Math.random() < rate) {
          var side = Math.random();
          var x = side < .4 ? w * (.25 + Math.random() * .2) : side < .8 ? w * (.62 + Math.random() * .2) : Math.random() * w;
          heroFx.puff(x, h * (.82 + Math.random() * .2), { vx: (x < w / 2 ? -1 : 1) * (30 + Math.random() * 60), vy: -20 - Math.random() * 30, r: 70, gr: 120, a: .55, max: 3 });
        }
        rate -= 1;
      }
      vel *= .96;
    }
    // fumaça ambiente no CTA final
    if (finalFx.visible && Math.random() < .35) {
      finalFx.puff(Math.random() * finalFx.w, finalFx.h + 20, { vy: -40, r: 90, gr: 60, a: .35, max: 5, red: Math.random() < .35 });
    }
    fxList.forEach(function (f) { if (f.visible || f.ps.length) f.step(dt); });
    var need = fxList.some(function (f) { return f.visible || f.ps.length; });
    if (need && !document.hidden) requestAnimationFrame(loop); else loopOn = false;
  }

  /* ---------- reveal com stagger + contadores ---------- */
  var data = window.RODSCAR_ESTOQUE || [];
  var nCarros = data.filter(function (v) { return v.tipo === 'carro'; }).length;
  var nMotos = data.length - nCarros;
  function countUp(el, to) {
    if (reduce) { el.textContent = to; return; }
    var t0 = performance.now();
    (function f(t) {
      var k = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(easeOutExpo(k) * to);
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  function revealAll(nodes) {
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in'); io.unobserve(e.target);
        $$('[data-count],[data-count-to]', e.target).forEach(function (c) {
          var to = c.dataset.count === 'carros' ? nCarros : c.dataset.count === 'motos' ? nMotos : +c.dataset.countTo;
          countUp(c, to);
        });
      });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }
  revealAll($$('.rv'));

  /* ---------- estoque ---------- */
  var grid = $('#grid'), fMarca = $('#fMarca'), fPreco = $('#fPreco'), fOrdem = $('#fOrdem'), tabs = $$('.tab');
  var state = { tipo: 'todos' };
  $('#cTodos').textContent = data.length; $('#cCarros').textContent = nCarros; $('#cMotos').textContent = nMotos;
  function fillMarcas() {
    var cur = fMarca.value;
    var marcas = data.filter(function (v) { return state.tipo === 'todos' || v.tipo === state.tipo; })
      .map(function (v) { return v.marca; }).filter(function (m, i, a) { return a.indexOf(m) === i; }).sort();
    fMarca.innerHTML = '<option value="">Todas</option>' + marcas.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    if (marcas.indexOf(cur) > -1) fMarca.value = cur;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function msgFor(v) { return 'Olá, Rodscar! Tenho interesse no ' + v.marca + ' ' + v.modelo + ' ' + v.ano + ' (' + v.cor + ', ' + kmFmt(v.km) + ') anunciado por ' + brl(v.preco) + '. Ainda está disponível?'; }
  function render() {
    var faixa = fPreco.value ? fPreco.value.split('-').map(Number) : null;
    var list = data.map(function (v, i) { v._i = i; return v; }).filter(function (v) {
      return (state.tipo === 'todos' || v.tipo === state.tipo) && (!fMarca.value || v.marca === fMarca.value) && (!faixa || (v.preco >= faixa[0] && v.preco <= faixa[1]));
    });
    var o = fOrdem.value;
    list.sort(function (a, b) { return o === 'menor' ? a.preco - b.preco : o === 'maior' ? b.preco - a.preco : o === 'km' ? a.km - b.km : b.ano - a.ano || a.km - b.km; });
    if (!list.length) { grid.innerHTML = '<p class="empty">Nenhum veículo com esses filtros. <a href="' + waLink('Olá, Rodscar! Estou procurando um veículo, podem me ajudar?') + '" target="_blank" rel="noopener" style="color:var(--red-hot)">Fale com a gente</a> que buscamos para você.</p>'; return; }
    grid.innerHTML = list.map(function (v, n) {
      return '<article class="card" style="--i:' + n + '">' +
        '<div class="card__media" data-open="' + v._i + '" role="button" tabindex="0" aria-label="Ver detalhes de ' + esc(v.marca + ' ' + v.modelo) + '">' +
          '<img src="' + esc(v.foto) + '" alt="' + esc(v.marca + ' ' + v.modelo + ' ' + v.ano + ', cor ' + v.cor) + '" loading="lazy" width="1200" height="900">' +
          '<div class="card__badges"><span class="badge">' + (v.tipo === 'moto' ? 'Moto' : 'Carro') + '</span>' + (v.destaque ? '<span class="badge badge--red">' + esc(v.destaque) + '</span>' : '') + '</div>' +
          '<span class="exhaust" aria-hidden="true"><i class="flame flame--3"></i><i class="flame"></i><i class="flame flame--2"></i></span>' +
        '</div>' +
        '<div class="card__body">' +
          '<div><div class="card__brand">' + esc(v.marca) + '</div><h3 class="card__model">' + esc(v.modelo) + '</h3></div>' +
          '<div class="specs"><div class="spec"><small>Ano</small><b>' + v.ano + '</b></div><div class="spec"><small>Cor</small><b>' + esc(v.cor) + '</b></div><div class="spec"><small>Km</small><b>' + v.km.toLocaleString('pt-BR') + '</b></div></div>' +
          '<div class="card__foot"><div class="price"><small>Preço</small><strong class="num">' + brl(v.preco) + '</strong></div>' +
          '<a class="btn btn--red card__btn" href="' + waLink(msgFor(v)) + '" target="_blank" rel="noopener">Tenho interesse</a></div>' +
        '</div></article>';
    }).join('');
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.toggle('is-on', x === t); x.setAttribute('aria-selected', x === t); });
      state.tipo = t.dataset.tipo; fillMarcas(); render();
    });
  });
  [fMarca, fPreco, fOrdem].forEach(function (s) { s.addEventListener('change', render); });
  fillMarcas(); render();

  /* ---------- modal ---------- */
  var modal = $('#modal'), lastFocus = null;
  function openModal(i) {
    var v = data[i]; if (!v) return;
    lastFocus = document.activeElement;
    $('#mImg').src = v.foto; $('#mImg').alt = v.marca + ' ' + v.modelo;
    $('#mBrand').textContent = v.marca; $('#mTitle').textContent = v.modelo;
    $('#mSpecs').innerHTML = [['Ano', v.ano], ['Marca', v.marca], ['Cor', v.cor], ['Km', v.km.toLocaleString('pt-BR')], ['Tipo', v.tipo === 'moto' ? 'Moto' : 'Carro'], ['Modelo', v.modelo]]
      .map(function (s) { return '<div class="spec"><small>' + s[0] + '</small><b>' + esc(s[1]) + '</b></div>'; }).join('');
    $('#mPrice').textContent = brl(v.preco);
    $('#mWa').href = waLink(msgFor(v));
    modal.hidden = false; setTimeout(function () { modal.classList.add('is-open'); }, 20);
    document.body.style.overflow = 'hidden'; $('#mClose').focus();
  }
  function closeModal() {
    modal.classList.remove('is-open'); document.body.style.overflow = '';
    setTimeout(function () { modal.hidden = true; }, 400);
    if (lastFocus) lastFocus.focus();
  }
  grid.addEventListener('click', function (e) { var m = e.target.closest('[data-open]'); if (m) openModal(+m.dataset.open); });
  grid.addEventListener('keydown', function (e) { var m = e.target.closest('[data-open]'); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(+m.dataset.open); } });
  $('#mClose').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

  /* ---------- formulário de venda → WhatsApp ---------- */
  $('#formVenda').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, d = function (n) { return (f.elements[n].value || '').trim(); };
    if (!d('modelo')) { f.elements.modelo.focus(); f.elements.modelo.setAttribute('aria-invalid', 'true'); return; }
    var tipo = f.querySelector('input[name="tipo"]:checked').value;
    var msg = 'Olá, Rodscar!' + (d('nome') ? ' Sou ' + d('nome') + '.' : '') + ' Quero ' + d('interesse').toLowerCase() + ' meu veículo.\n' +
      '• Tipo: ' + tipo + '\n• Marca/modelo: ' + d('modelo') + (d('ano') ? '\n• Ano: ' + d('ano') : '') + (d('km') ? '\n• Km: ' + d('km') : '') + '\nPodem me passar uma avaliação?';
    window.open(waLink(msg), '_blank', 'noopener');
  });

  /* inicia */
  requestApply();
})();
