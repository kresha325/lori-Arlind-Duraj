(function () {
  const SLIDE_MS = 8000;
  const CURSOR_IDLE_MS = 2500;

  const els = {
    card: document.getElementById('slideCard'),
    img: document.getElementById('slideImg'),
    category: document.getElementById('slideCategory'),
    name: document.getElementById('slideName'),
    price: document.getElementById('slidePrice'),
    counter: document.getElementById('slideCounter'),
    toast: document.getElementById('downloadToast'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    fsGate: document.getElementById('fsGate'),
    btnEnterFs: document.getElementById('btnEnterFs'),
  };

  let products = [];
  let index = 0;
  let paused = false;
  let slideTimer = null;
  let fadeTimer = null;
  let cursorTimer = null;

  function flattenMenu(data) {
    const SIZE_RE = /\s+(e|i)\s+(Vogel|Vogël|Mesme|Mesem|Madhe|Madh)$/i;

    function sizeLabel(raw) {
      const s = String(raw).toLowerCase();
      if (s.startsWith('vog')) return 'Vogël';
      if (s.startsWith('mes')) return 'Mesme';
      if (s.startsWith('mad')) return 'Madhe';
      return raw;
    }

    const groups = new Map();
    const order = [];

    Object.keys(data).forEach((category) => {
      (data[category] || []).forEach((item) => {
        const match = item.name.match(SIZE_RE);
        const base = match
          ? item.name.replace(SIZE_RE, '').trim()
          : item.name;
        const key = category + '|' + base.toLowerCase();

        if (!groups.has(key)) {
          groups.set(key, {
            name: base,
            image: item.image,
            category,
            prices: [],
          });
          order.push(key);
        }

        const group = groups.get(key);
        if (match) {
          group.prices.push({
            label: sizeLabel(match[2]),
            price: item.price,
          });
        } else {
          group.prices.push({ label: null, price: item.price });
        }
      });
    });

    return order.map((key) => groups.get(key));
  }

  function formatPrice(price) {
    return Number(price).toFixed(2) + '€';
  }

  function renderPrices(item) {
    const prices = item.prices || [{ label: null, price: item.price }];
    const hasSizes = prices.length > 1 || (prices[0] && prices[0].label);

    if (!hasSizes) {
      els.price.className = 'slide-price';
      els.price.textContent = formatPrice(prices[0].price);
      return;
    }

    els.price.className = 'slide-price slide-price-multi';
    els.price.innerHTML = prices
      .map(
        (p) =>
          `<div class="slide-price-item">` +
          `<span class="slide-price-label">${p.label || ''}</span>` +
          `<span class="slide-price-value">${formatPrice(p.price)}</span>` +
          `</div>`
      )
      .join('');
  }

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
    if (!products.length) return;
    const next = products[(index + 1) % products.length];
    const prev = products[(index - 1 + products.length) % products.length];
    [next, prev].forEach((item) => {
      if (!item || !item.image) return;
      const img = new Image();
      img.src = item.image;
    });
  }

  function paintItem(item) {
    els.img.src = item.image;
    els.img.alt = item.name;
    els.category.textContent = item.category || '';
    els.name.textContent = item.name || '';
    renderPrices(item);
    els.counter.textContent = `${index + 1} / ${products.length}`;
  }

  function renderSlide() {
    const item = products[index];
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
    if (!products.length) return;
    stopSlideTimer();
    index = (index + delta + products.length) % products.length;
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

  async function loadMenu() {
    if (window.MENU_DATA) return window.MENU_DATA;
    const res = await fetch('assets/data/menu.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Menu nuk u ngarkua');
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
      const data = await loadMenu();
      products = flattenMenu(data);
      if (!products.length) {
        showToast('Nuk ka produkte në menu.');
        return;
      }
      index = 0;
      paintItem(products[0]);
      preloadNeighbors();
      restartSlideTimer();
    } catch (err) {
      console.error(err);
      showToast('Gabim: menuja nuk u ngarkua.');
    }

    if (els.btnFullscreen) {
      els.btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
    }

    document.addEventListener('mousemove', revealCursor);
    document.addEventListener('touchstart', revealCursor, { passive: true });
    revealCursor();

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
