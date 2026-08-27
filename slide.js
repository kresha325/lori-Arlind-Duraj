(function () {
  const SLIDE_MS = 8000;
  const CURSOR_IDLE_MS = 2500;

  const els = {
    card: document.getElementById('slideCard'),
    img: document.getElementById('slideImg'),
    priceCard: document.getElementById('slidePriceCard'),
    counter: document.getElementById('slideCounter'),
    toast: document.getElementById('downloadToast'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    fsGate: document.getElementById('fsGate'),
    btnEnterFs: document.getElementById('btnEnterFs'),
  };

  let slides = [];
  let index = 0;
  let paused = false;
  let slideTimer = null;
  let fadeTimer = null;
  let cursorTimer = null;

  function showToast(msg, ms) {
    if (!els.toast) return;
    els.toast.hidden = false;
    els.toast.textContent = msg;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, ms || 3200);
  }

  function preloadNeighbors() {
    if (!slides.length) return;
    const next = slides[(index + 1) % slides.length];
    const prev = slides[(index - 1 + slides.length) % slides.length];
    [next, prev].forEach((item) => {
      if (!item || !item.image) return;
      const img = new Image();
      img.src = item.image;
    });
  }

  function formatPrice(price) {
    return Number(price).toFixed(2) + '€';
  }

  function renderPrices(item) {
    const card = els.priceCard;
    if (!card) return;
    const prices = item.prices || [];
    if (!prices.length) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }

    const multi = prices.length > 1 || (prices[0] && prices[0].label);
    card.className = 'slide-price-card' + (multi ? '' : ' is-single');
    card.hidden = false;
    card.innerHTML = prices
      .map((p) => {
        const label = p.label
          ? `<span class="slide-price-label">${p.label}</span>`
          : '';
        return (
          `<div class="slide-price-row">` +
          label +
          `<span class="slide-price-value">${formatPrice(p.price)}</span>` +
          `</div>`
        );
      })
      .join('');
  }

  function paintItem(item) {
    els.img.src = item.image;
    els.img.alt = item.id || 'LORI';
    els.counter.textContent = `${index + 1} / ${slides.length}`;
    renderPrices(item);
  }

  function renderSlide() {
    const item = slides[index];
    if (!item) return;

    stopSlideTimer();
    clearTimeout(fadeTimer);
    els.card.classList.add('is-fading');
    fadeTimer = setTimeout(() => {
      paintItem(item);
      els.card.classList.remove('is-fading');
      preloadNeighbors();
      restartSlideTimer();
    }, 280);
  }

  function stopSlideTimer() {
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = null;
  }

  function restartSlideTimer() {
    stopSlideTimer();
    if (paused) return;
    slideTimer = setTimeout(() => go(1), SLIDE_MS);
  }

  function go(delta) {
    if (!slides.length) return;
    stopSlideTimer();
    index = (index + delta + slides.length) % slides.length;
    renderSlide();
  }

  function togglePause() {
    paused = !paused;
    if (paused) stopSlideTimer();
    else restartSlideTimer();
  }

  function revealCursor() {
    document.body.classList.add('show-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => {
      document.body.classList.remove('show-cursor');
    }, CURSOR_IDLE_MS);
  }

  async function loadSlides() {
    if (window.SLIDES_DATA) return window.SLIDES_DATA;
    const res = await fetch('assets/data/slides.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Slides nuk u ngarkuan');
    return res.json();
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }

  function updateFsUi() {
    const on = isFullscreen();
    document.body.classList.toggle('is-fullscreen', on);
    if (els.fsGate) els.fsGate.classList.toggle('is-hidden', on);
    if (els.btnFullscreen) {
      els.btnFullscreen.textContent = on ? 'Dil' : 'Full Screen';
    }
  }

  async function enterFullscreen() {
    if (isFullscreen()) {
      updateFsUi();
      return true;
    }
    const root = document.documentElement;
    try {
      if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen)
        await Promise.resolve(root.webkitRequestFullscreen());
      else if (root.msRequestFullscreen)
        await Promise.resolve(root.msRequestFullscreen());
      else {
        document.body.classList.add('is-fullscreen');
        if (els.fsGate) els.fsGate.classList.add('is-hidden');
        return false;
      }
      updateFsUi();
      return isFullscreen();
    } catch (err) {
      updateFsUi();
      return false;
    }
  }

  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    } catch (err) {}
    updateFsUi();
  }

  async function toggleFullscreen() {
    if (isFullscreen()) await exitFullscreen();
    else await enterFullscreen();
  }

  function setupAutoFullscreen() {
    updateFsUi();
    enterFullscreen();
    setTimeout(() => enterFullscreen(), 400);
    setTimeout(() => enterFullscreen(), 1200);

    const onGesture = () => {
      if (!isFullscreen()) enterFullscreen();
    };
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((evt) => {
      document.addEventListener(evt, onGesture, { capture: true, passive: true });
    });

    if (els.btnEnterFs) {
      els.btnEnterFs.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        enterFullscreen();
      });
    }
    if (els.fsGate) {
      els.fsGate.addEventListener('click', () => enterFullscreen());
    }

    document.addEventListener('fullscreenchange', updateFsUi);
    document.addEventListener('webkitfullscreenchange', updateFsUi);
  }

  async function init() {
    setupAutoFullscreen();

    try {
      slides = await loadSlides();
      if (!slides.length) {
        showToast('Nuk ka slide.');
        return;
      }
      index = 0;
      paintItem(slides[0]);
      preloadNeighbors();
      restartSlideTimer();
    } catch (err) {
      console.error(err);
      showToast('Gabim: slides nuk u ngarkuan.');
    }

    if (els.btnFullscreen) {
      els.btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
    }

    document.body.classList.add('show-cursor');
    document.addEventListener('mousemove', revealCursor);
    document.addEventListener('touchstart', revealCursor, { passive: true });
    revealCursor();

    const dl = document.getElementById('btnDownloadMp4');
    if (dl) {
      dl.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('keydown', (e) => {
      revealCursor();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    });
  }

  init();
})();
