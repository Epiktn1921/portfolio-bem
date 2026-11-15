/*
 * Общий скрипт для всех страниц сайта.
 * Каждая часть сначала проверяет, есть ли на странице нужный блок,
 * поэтому один файл подключается и на главной, и на внутренних страницах.
 * Скрипт меняет только модификаторы БЭМ (например, scrub__word--active, fan--open),
 * а внешний вид для каждого состояния описан в CSS блока.
 */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Настройки устройства: отключены ли анимации и есть ли мышь
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------- hero: видео на фоне ---------- */
  var video = $('#heroVideo');
  if (video) {
    video.muted = true;
    if (reduce) { video.removeAttribute('autoplay'); video.pause(); }
    else {
      var p = video.play && video.play();
      if (p && p.catch) p.catch(function () {
        var go = function () { video.play(); };
        document.addEventListener('touchstart', go, { once: true });
        document.addEventListener('click', go, { once: true });
      });
    }
  }

  /* ---------- hero: буквы заголовка меняют шрифты ---------- */
  var FONTS = ['display', 'pixel', 'cond'];
  var chars = [];
  $$('.hero__row').forEach(function (row) {
    var word = row.getAttribute('data-word');
    var fonts = row.getAttribute('data-fonts').split(',');
    var hot = +row.getAttribute('data-hot');
    word.split('').forEach(function (letter, i) {
      var s = document.createElement('span');
      s.className = 'hero__char hero__char--' + fonts[i] + (i === hot ? ' hero__char--hot' : '');
      s.textContent = letter;
      s.addEventListener('pointerenter', function () { swapFont(s); });
      row.appendChild(s);
      chars.push(s);
    });
  });
  function swapFont(s) {
    var cur = FONTS.filter(function (f) { return s.classList.contains('hero__char--' + f); })[0];
    var next = FONTS[(FONTS.indexOf(cur) + 1 + Math.floor(Math.random() * 2)) % 3];
    s.classList.remove('hero__char--' + cur);
    s.classList.add('hero__char--' + next);
    s.classList.toggle('hero__char--hot', Math.random() < .35);
  }
  if (chars.length && !reduce) {
    setInterval(function () {
      if (!document.hidden) swapFont(chars[Math.floor(Math.random() * chars.length)]);
    }, 1400);
  }

  /* ---------- hero: рисованные линии ---------- */
  var squiggles = $('#squiggles');
  if (squiggles) {
    [[0, 120, 1000, 90], [0, 470, 1000, 520], [120, 0, 260, 600], [760, 0, 880, 600]].forEach(function (s, k) {
      var d = '', n = 46;
      for (var i = 0; i <= n; i++) {
        var t = i / n, x = s[0] + (s[2] - s[0]) * t, y = s[1] + (s[3] - s[1]) * t;
        var a = Math.sin(t * Math.PI * (5 + k)) * 18 + Math.sin(t * 37 + k) * 7;
        if (Math.abs(s[2] - s[0]) < 300) x += a; else y += a;
        d += (i ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      squiggles.appendChild(path);
      if (!reduce) {
        var L = path.getTotalLength();
        path.style.strokeDasharray = L;
        path.style.strokeDashoffset = L;
        path.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(.6,0,.2,1) ' + (0.3 + k * 0.25) + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { path.style.strokeDashoffset = 0; }); });
      }
    });
  }

  /* ---------- sticker: стикеры можно перетаскивать ---------- */
  $$('.sticker').forEach(function (st) {
    var sx = 0, sy = 0, ox = 0, oy = 0, id = null;
    st.addEventListener('pointerdown', function (e) {
      id = e.pointerId; st.setPointerCapture(id); st.classList.add('sticker--dragging');
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(st.style.getPropertyValue('--dx')) || 0;
      oy = parseFloat(st.style.getPropertyValue('--dy')) || 0;
    });
    st.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      st.style.setProperty('--dx', (ox + e.clientX - sx) + 'px');
      st.style.setProperty('--dy', (oy + e.clientY - sy) + 'px');
    });
    var end = function () { id = null; st.classList.remove('sticker--dragging'); };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
  });
  // Параллакс: стикеры слегка смещаются за мышью
  var hero = $('.hero');
  if (hero && fine && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width - .5, my = (e.clientY - r.top) / r.height - .5;
      $$('.sticker', hero).forEach(function (st) {
        var d = +st.getAttribute('data-depth') || 0;
        st.style.setProperty('--px', (mx * d) + 'px');
        st.style.setProperty('--py', (my * d) + 'px');
      });
    });
  }

  /* ---------- scrub: цитата проявляется по словам при прокрутке ---------- */
  var scrub = $('.scrub'), words = [];
  if (scrub) {
    var frag = document.createDocumentFragment();
    Array.prototype.slice.call(scrub.childNodes).forEach(function (node) {
      var accent = node.nodeType === 1;
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span');
        w.className = 'scrub__word' + (accent ? ' scrub__word--accent' : '');
        w.textContent = part;
        frag.appendChild(w);
        words.push(w);
      });
    });
    scrub.textContent = '';
    scrub.appendChild(frag);
    if (reduce) words.forEach(function (w) { w.classList.add('scrub__word--active'); });
  }

  /* ---------- reveal и счётчики: появление при прокрутке ---------- */
  if (hasIO && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('reveal--hidden'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('reveal--hidden'); io.observe(el); }
    });

    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        counter.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-count'), from = to > 1000 ? to - 30 : 0, t0 = performance.now();
        (function tick(now) {
          var p = Math.min(1, (now - t0) / 1300);
          el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: .6 });
    $$('[data-count]').forEach(function (el) { counter.observe(el); });
  }

  /* ---------- header: полоса прогресса чтения + scrub ---------- */
  var progress = $('#progress'), ticking = false;
  function onScroll() {
    ticking = false;
    var max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    if (scrub && !reduce) {
      var r = scrub.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
      var n = Math.round(p * words.length);
      words.forEach(function (w, i) { w.classList.toggle('scrub__word--active', i < n); });
    }
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- toast + кнопка «Скопировать почту» ---------- */
  var toast = $('#toast'), toastTimer;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('toast--visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('toast--visible'); }, 2200);
  }
  var copyButton = $('#copyButton');
  if (copyButton) copyButton.addEventListener('click', function () {
    var email = $('#mail').textContent;
    var fallback = function () {
      var range = document.createRange(); range.selectNodeContents($('#mail'));
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      say('Почта выделена, нажми Ctrl+C');
    };
    try { navigator.clipboard.writeText(email).then(function () { say('Почта скопирована'); }, fallback); }
    catch (err) { fallback(); }
  });

  /* ---------- magnet: кнопка тянется за курсором ---------- */
  var magnet = $('#magnet');
  if (magnet && fine && !reduce) {
    magnet.addEventListener('pointermove', function (e) {
      var r = magnet.getBoundingClientRect();
      magnet.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .3) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3) + 'px)';
    });
    magnet.addEventListener('pointerleave', function () { magnet.style.transform = ''; });
  }

  /* ---------- cursor-label: подпись у курсора ---------- */
  var cursor = $('#cursorLabel');
  if (cursor && fine) {
    var tx = 0, ty = 0, cx = 0, cy = 0;
    document.addEventListener('pointermove', function (e) {
      tx = e.clientX + 18; ty = e.clientY + 22;
      var t = e.target.closest ? e.target.closest('[data-cursor]') : null;
      if (t) { cursor.textContent = t.getAttribute('data-cursor'); cursor.classList.add('cursor-label--visible'); }
      else cursor.classList.remove('cursor-label--visible');
    });
    (function loop() {
      cx += (tx - cx) * .25; cy += (ty - cy) * .25;
      cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px';
      requestAnimationFrame(loop);
    })();
  }

  /* ========== Дальше — только страница «Дизайн» ========== */
  var lightbox = $('#lightbox');
  var worksBox = $('#works');
  if (!lightbox || !worksBox) return;

  /* ---------- lightbox: просмотр работы крупно ---------- */
  var list = [], index = 0, lastFocus = null, onStep = null;
  var lbImage = $('#lightboxImage');
  function render() {
    var it = list[index];
    lbImage.src = it.src; lbImage.alt = it.alt || it.title;
    lbImage.style.animation = 'none'; void lbImage.offsetWidth; lbImage.style.animation = '';
    $('#lightboxTitle').textContent = it.title;
    $('#lightboxType').textContent = it.type;
    $('#lightboxCount').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
  }
  function openLightbox(items, start, stepHandler) {
    list = items; index = Math.max(0, start); onStep = stepHandler || null;
    lastFocus = document.activeElement;
    render();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lightboxClose').focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    lbImage.removeAttribute('src');
    if (lastFocus) lastFocus.focus();
  }
  function step(d) {
    index = (index + d + list.length) % list.length;
    render();
    if (onStep) onStep(index);
  }
  $('#lightboxClose').addEventListener('click', closeLightbox);
  $('#lightboxPrev').addEventListener('click', function () { step(-1); });
  $('#lightboxNext').addEventListener('click', function () { step(1); });
  $('#lightboxStage').addEventListener('click', function (e) { if (e.target === this) closeLightbox(); });
  var touchX = null;
  $('#lightboxStage').addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  $('#lightboxStage').addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* ---------- deck: слайдер презентации ---------- */
  var SLIDES = ['Кто владеет результатом?', 'Изображения и цифровой арт', 'Текст и копирайтинг', 'Открытый код',
    'Прецедент с обезьяной', 'Обучение на чужих данных', 'Автор всегда человек', 'Как защитить свои права',
    'Будущее регулирования', 'Заключение'];
  var slidePath = function (i, thumb) { return 'images/slides/slide-' + String(i + 1).padStart(2, '0') + (thumb ? '-thumb' : '') + '.jpg'; };
  var slideItems = SLIDES.map(function (title, i) {
    return { src: slidePath(i), title: title, type: 'Кто владеет результатом? · слайд ' + (i + 1) + ' из ' + SLIDES.length };
  });
  var stage = $('#deckStage'), bars = $('#deckBars'), thumbs = $('#deckThumbs');
  var deckIndex = 0, deckImages = [], deckBars = [], deckThumbs = [], deckStart = 0, deckHover = false, DECK_MS = 4200;

  SLIDES.forEach(function (title, i) {
    var im = document.createElement('img');
    im.className = 'deck__slide'; im.alt = 'Слайд ' + (i + 1) + ': ' + title; im.decoding = 'async';
    stage.insertBefore(im, bars); deckImages.push(im);
    var bar = document.createElement('i'); bar.className = 'deck__bar'; bars.appendChild(bar); deckBars.push(bar);
    var tb = document.createElement('button');
    tb.type = 'button'; tb.className = 'deck__thumb'; tb.setAttribute('aria-label', 'Слайд ' + (i + 1) + ': ' + title);
    var ti = document.createElement('img'); ti.className = 'deck__thumb-image'; ti.src = slidePath(i, true); ti.alt = '';
    tb.appendChild(ti);
    tb.addEventListener('click', function () { showSlide(i); });
    thumbs.appendChild(tb); deckThumbs.push(tb);
  });
  function showSlide(i) {
    deckIndex = (i + SLIDES.length) % SLIDES.length;
    deckImages.forEach(function (im, k) {
      // Ленивая загрузка: подставляем картинку только текущему и соседним слайдам
      if (Math.abs(k - deckIndex) <= 1 && !im.getAttribute('src')) im.src = slidePath(k);
      im.classList.toggle('deck__slide--active', k === deckIndex);
    });
    deckBars.forEach(function (b, k) { b.style.setProperty('--fill', k < deckIndex ? 1 : 0); });
    deckThumbs.forEach(function (t, k) {
      t.classList.toggle('deck__thumb--active', k === deckIndex);
      t.setAttribute('aria-current', k === deckIndex ? 'true' : 'false');
    });
    $('#deckCount').textContent = String(deckIndex + 1).padStart(2, '0') + '/' + SLIDES.length;
    $('#deckCaption').textContent = SLIDES[deckIndex];
    deckStart = performance.now();
  }
  function deckInView() { var r = stage.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0; }
  function deckLoop(now) {
    var running = lightbox.hidden && !document.hidden && !deckHover && deckInView();
    if (running) {
      var p = (now - deckStart) / DECK_MS;
      if (p >= 1) { showSlide(deckIndex + 1); p = 0; }
      deckBars[deckIndex].style.setProperty('--fill', p.toFixed(3));
    } else {
      var f = parseFloat(deckBars[deckIndex].style.getPropertyValue('--fill')) || 0;
      deckStart = now - f * DECK_MS;
    }
    requestAnimationFrame(deckLoop);
  }
  showSlide(0);
  $('#deckPrev').addEventListener('click', function (e) { e.stopPropagation(); showSlide(deckIndex - 1); });
  $('#deckNext').addEventListener('click', function (e) { e.stopPropagation(); showSlide(deckIndex + 1); });
  stage.addEventListener('click', function () { openLightbox(slideItems, deckIndex, showSlide); });
  stage.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') deckHover = true; });
  stage.addEventListener('pointerleave', function () { deckHover = false; });
  var swipeX = null;
  stage.addEventListener('touchstart', function (e) { swipeX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (swipeX === null) return;
    var dx = e.changedTouches[0].clientX - swipeX;
    if (Math.abs(dx) > 40) { e.preventDefault(); showSlide(deckIndex + (dx < 0 ? 1 : -1)); }
    swipeX = null;
  });
  if (!reduce) requestAnimationFrame(deckLoop);

  /* ---------- filters + works: фильтр галереи ---------- */
  var works = $$('.work', worksBox);
  var CATS = [['all', 'Все'], ['poster', 'Постеры'], ['print', 'Полиграфия'], ['logo', 'Логотипы'],
    ['cover', 'Обложки и иллюстрации'], ['deck', 'Презентации'], ['digital', 'Digital'], ['merch', 'Мерч']];
  var filters = $('#filters');
  CATS.forEach(function (c, i) {
    var n = c[0] === 'all' ? works.length : works.filter(function (w) { return w.getAttribute('data-cat') === c[0]; }).length;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'filters__button' + (i === 0 ? ' filters__button--active' : '');
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.setAttribute('data-filter', c[0]);
    b.innerHTML = c[1] + ' <small class="filters__count">' + n + '</small>';
    filters.appendChild(b);
  });
  // Делегирование: один обработчик на весь блок filters
  filters.addEventListener('click', function (e) {
    var b = e.target.closest('.filters__button'); if (!b) return;
    $$('.filters__button', filters).forEach(function (x) {
      x.classList.toggle('filters__button--active', x === b);
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    var f = b.getAttribute('data-filter');
    works.forEach(function (w, i) {
      var show = f === 'all' || w.getAttribute('data-cat') === f;
      w.hidden = !show;
      w.classList.remove('work--appear');
      if (show && !reduce) { void w.offsetWidth; w.style.animationDelay = (i % 6) * 40 + 'ms'; w.classList.add('work--appear'); }
    });
  });

  var isDeck = function (w) { return $('.work__button', w).hasAttribute('data-deck'); };
  var itemOf = function (w) {
    var im = $('.work__image', w);
    return { src: im.getAttribute('src'), alt: im.alt, title: $('.work__title', w).textContent, type: $('.work__type', w).textContent };
  };
  works.forEach(function (w) {
    $('.work__button', w).addEventListener('click', function () {
      if (isDeck(w)) { openLightbox(slideItems, 0, showSlide); return; }
      var visible = works.filter(function (x) { return !x.hidden && !isDeck(x); });
      openLightbox(visible.map(itemOf), visible.indexOf(w));
    });
  });
  // Наклон карточки за мышью
  if (fine && !reduce) $$('.work__button').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--tx', ((e.clientX - r.left) / r.width - .5) * 10 + 'deg');
      b.style.setProperty('--ty', -((e.clientY - r.top) / r.height - .5) * 10 + 'deg');
    });
    b.addEventListener('pointerleave', function () { b.style.setProperty('--tx', '0deg'); b.style.setProperty('--ty', '0deg'); });
  });

  /* ---------- fan: веер избранных работ ---------- */
  var fan = $('#fan'), FAN = [10, 17, 8, 13, 19, 2];
  var flat = works.filter(function (x) { return !isDeck(x); });
  FAN.forEach(function (wi, k) {
    var w = works[wi]; if (!w) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fan__card';
    b.setAttribute('data-cursor', 'открыть');
    b.setAttribute('aria-label', 'Открыть: ' + $('.work__title', w).textContent);
    var off = k - (FAN.length - 1) / 2;
    b.style.cssText = '--i:' + k + ';--x:calc(' + off + ' * min(13vw, 176px));--y:' + (off * off * 7) + 'px;--r:' + (off * 7) + 'deg;--x0:' + (off * 6) + 'px;--r0:' + (off * 2) + 'deg';
    var img = document.createElement('img');
    img.className = 'fan__image'; img.src = $('.work__image', w).getAttribute('src'); img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', function () { openLightbox(flat.map(itemOf), flat.indexOf(w)); });
    fan.appendChild(b);
  });
  if (reduce || !hasIO) fan.classList.add('fan--open');
  else new IntersectionObserver(function (es) {
    es.forEach(function (e) { fan.classList.toggle('fan--open', e.isIntersecting); });
  }, { threshold: .3 }).observe(fan);

  /* ---------- клавиатура ---------- */
  document.addEventListener('keydown', function (e) {
    if (!lightbox.hidden) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      return;
    }
    if (deckInView() && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) showSlide(deckIndex + (e.key === 'ArrowRight' ? 1 : -1));
  });
})();
