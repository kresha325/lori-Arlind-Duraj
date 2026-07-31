(function () {
  const SLIDE_MS = 8000;
  const CURSOR_IDLE_MS = 2500;

  const els = {
    card: document.getElementById('slideCard'),
    img: document.getElementById('slideImg'),
    category: document.getElementById('slideCategory'),
    name: document.getElementById('slideName'),
    desc: document.getElementById('slideDesc'),
    price: document.getElementById('slidePrice'),
    counter: document.getElementById('slideCounter'),
    toast: document.getElementById('downloadToast'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnPause: document.getElementById('btnPause'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    btnDownload: document.getElementById('btnDownload'),
  };

  let products = [];
  let index = 0;
  let paused = false;
  let slideTimer = null;
  let fadeTimer = null;
  let cursorTimer = null;
  let menuData = null;

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
            description: item.description,
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

  function renderSlide() {
    const item = products[index];
    if (!item) return;

    stopSlideTimer();
    clearTimeout(fadeTimer);
    els.card.classList.add('is-fading');
    fadeTimer = setTimeout(() => {
      els.img.src = item.image;
      els.img.alt = item.name;
      els.category.textContent = item.category || '';
      els.name.textContent = item.name || '';
      els.desc.textContent = item.description || '';
      renderPrices(item);
      els.counter.textContent = `${index + 1} / ${products.length}`;
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
    els.btnPause.textContent = paused ? '▶' : '⏸';
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
    if (window.MENU_DATA) {
      menuData = window.MENU_DATA;
      return menuData;
    }
    const res = await fetch('assets/data/menu.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Menu nuk u ngarkua');
    menuData = await res.json();
    return menuData;
  }

  async function loadScriptText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Nuk u gjet: ' + url);
    return res.text();
  }

  async function loadBinary(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Nuk u gjet: ' + url);
    return res.arrayBuffer();
  }

  async function downloadForUSB() {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip nuk u ngarkua. Kontrollo internetin dhe provo përsëri.');
      return;
    }
    if (!menuData) {
      showToast('Menuja nuk është gati ende.');
      return;
    }

    els.btnDownload.disabled = true;
    showToast('Duke përgatitur ZIP për USB…', 60000);

    try {
      const zip = new JSZip();
      const [htmlTpl, cssText, jsText] = await Promise.all([
        loadScriptText('slide.html'),
        loadScriptText('slide.css'),
        loadScriptText('slide.js'),
      ]);

      // Offline package: embed menu so file:// works without fetch
      const offlineHtml = htmlTpl
        .replace(
          '<script src="slide.js"></script>',
          `<script>window.MENU_DATA = ${JSON.stringify(menuData)};</script>\n    <script src="slide.js"></script>`
        )
        .replace(
          '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
          '<!-- JSZip omitted in offline package -->'
        );

      zip.file('slide.html', offlineHtml);
      zip.file('slide.css', cssText);
      zip.file('slide.js', jsText);
      zip.file('assets/data/menu.json', JSON.stringify(menuData, null, 2));
      zip.file(
        'LESOMua.txt',
        [
          'LORI TV Slider — paketa për USB',
          '',
          '1. Nxirr (extract) këtë ZIP në USB.',
          '2. Hap slide.html me Chrome / browser në:',
          '   - Smart TV me browser',
          '   - Firestick / Android TV box',
          '   - Laptop të lidhur me HDMI te TV',
          '',
          'Shënim: TV klasik që lexon vetëm foto/video NUK hap HTML.',
          'Alternativë e thjeshtë: hap picerialori.com/slide në browser të TV.',
          '',
          'Kontrollet: shigjetat ← → , hapësirë = pause, F = full screen.',
        ].join('\n')
      );

      const imagePaths = [
        ...new Set(
          products
            .map((p) => p.image)
            .concat(['assets/images/logo.png'])
            .filter(Boolean)
        ),
      ];

      let done = 0;
      for (const path of imagePaths) {
        try {
          const buf = await loadBinary(path);
          zip.file(path, buf);
        } catch (e) {
          console.warn('Skip image', path, e);
        }
        done += 1;
        showToast(`Duke shkarkuar foto… ${done}/${imagePaths.length}`, 60000);
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lori-tv-slider.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);

      showToast('U shkarkua lori-tv-slider.zip — nxirre në USB dhe hap slide.html');
    } catch (err) {
      console.error(err);
      showToast('Shkarkimi dështoi. Provo përsëri nga sajti online.');
    } finally {
      els.btnDownload.disabled = false;
    }
  }

  function toggleFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      root.requestFullscreen?.() || root.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  async function init() {
    try {
      const data = await loadMenu();
      products = flattenMenu(data);
      if (!products.length) {
        showToast('Nuk ka produkte në menu.');
        return;
      }
      index = 0;
      // First paint without fade delay
      const item = products[0];
      els.img.src = item.image;
      els.img.alt = item.name;
      els.category.textContent = item.category || '';
      els.name.textContent = item.name || '';
      els.desc.textContent = item.description || '';
      renderPrices(item);
      els.counter.textContent = `1 / ${products.length}`;
      preloadNeighbors();
      restartSlideTimer();
    } catch (err) {
      console.error(err);
      showToast('Gabim: menuja nuk u ngarkua.');
    }

    els.btnPrev.addEventListener('click', () => go(-1));
    els.btnNext.addEventListener('click', () => go(1));
    els.btnPause.addEventListener('click', togglePause);
    els.btnFullscreen.addEventListener('click', toggleFullscreen);
    els.btnDownload.addEventListener('click', downloadForUSB);

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
