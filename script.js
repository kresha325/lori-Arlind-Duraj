
// Add missing toggleDarkMode function to fix ReferenceError
function toggleDarkMode() {
  setDarkMode(!document.body.classList.contains('dark'));
}

// Always reload cart from localStorage for 1:1 state
function reloadCart() {
  try {
    const savedCart = localStorage.getItem('lori_cart');
    cart = savedCart ? JSON.parse(savedCart) : [];
  } catch { cart = []; }
}

window.updateCartPageUI = function() {
  reloadCart();
  const cartInfo = document.getElementById('cartInfo');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartTotal = document.getElementById('cartTotal');
  if (!cartInfo || !cartItemsList || !cartTotal) return;
  cartInfo.textContent = `You have ${cart.length} item${cart.length !== 1 ? 's' : ''} in your cart`;
  cartItemsList.innerHTML = '';
  let total = 0;
  cart.forEach((item, idx) => {
    total += item.price * item.qty;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="cart-item-img" />
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-desc">${item.description || ''}</div>
      </div>
      <div class="cart-item-controls">
        <div class="cart-item-qty">
          <button class="qty-btn" data-action="decrement" data-idx="${idx}">-</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-action="increment" data-idx="${idx}">+</button>
        </div>
        <span class="cart-item-price">${(item.price * item.qty).toFixed(2)}€</span>
        <button class="delete-item" data-action="delete" data-idx="${idx}"><i class='fa fa-trash'></i></button>
      </div>
    `;
    cartItemsList.appendChild(div);
  });
  cartTotal.textContent = total.toFixed(2) + '€';

  // Add event listeners for +, -, and delete
  cartItemsList.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-idx'), 10);
      if (this.getAttribute('data-action') === 'increment') window.changeQty(idx, 1);
      if (this.getAttribute('data-action') === 'decrement') window.changeQty(idx, -1);
    });
  });
  cartItemsList.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-idx'), 10);
      window.deleteCartItem(idx);
    });
  });
};
// LORI Pizzeria & Rent - Main JS

// Dynamically load navbar and footer on every page
window.addEventListener('DOMContentLoaded', function () {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (navbarPlaceholder) {
    fetch('navbar.html')
      .then(res => res.text())
      .then(html => {
        navbarPlaceholder.innerHTML = html;
        if (typeof initNavbarEvents === 'function') initNavbarEvents();
      });
  }
  if (footerPlaceholder) {
    fetch('footer.html')
      .then(res => res.text())
      .then(html => {
        footerPlaceholder.innerHTML = html;
      });
  }
});
const menuGrid = document.getElementById('menuGrid');
const categoryFilter = document.getElementById('categoryFilter');

// State variables (must be visible to all functions)
let menuData = [];
let filteredMenu = [];
let categories = [];
let cart = [];
let selectedProduct = null;
// Initial cart load
reloadCart();

// Add to cart function (by id for uniqueness)
window.addToCart = function(idx) {
  reloadCart();
  const flatMenu = flattenMenu(menuData);
  const item = flatMenu[idx];
  if (!item) return;
  const found = cart.find(p => p.id === item.id);
  if (found) {
    found.qty++;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart();
  updateCart();
  showToast('U shtua në shportë!');
};

// Change quantity
window.changeQty = function(idx, delta) {
  reloadCart();
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
  updateCart();
  if (typeof updateCartPageUI === 'function') updateCartPageUI();
};

// Delete cart item
window.deleteCartItem = function(idx) {
  reloadCart();
  cart.splice(idx, 1);
  saveCart();
  updateCart();
  if (typeof updateCartPageUI === 'function') updateCartPageUI();
};

// Save cart
function saveCart() {
  try {
    localStorage.setItem('lori_cart', JSON.stringify(cart));
  } catch {}
}

// Show toast
function showToast(msg) {
  if (window.toast) {
    window.toast.textContent = msg;
    window.toast.classList.add('show');
    setTimeout(() => window.toast.classList.remove('show'), 2200);
  }
}

// Cart logic (must be available everywhere)
function updateCart() {
  reloadCart();
  const cartCountEl = window.cartCount || document.getElementById('cartCount');
  const cartItemsDivEl = window.cartItemsDiv || document.getElementById('cartItems');
  const cartTotalEl = window.cartTotal || document.getElementById('cartTotal');
  if (cartCountEl) cartCountEl.textContent = cart.reduce((a, b) => a + b.qty, 0);
  if (cartItemsDivEl && cartTotalEl) {
    cartItemsDivEl.innerHTML = '';
    if (cart.length === 0) {
      cartItemsDivEl.innerHTML = '<p>Shporta është bosh.</p>';
      cartTotalEl.textContent = '0€';
      return;
    }
    cart.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <img src="${item.image}" class="cart-item-img" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-desc">${item.description}</div>
        </div>
        <div class="cart-item-controls">
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="window.changeQty(${idx}, -1)">-</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="window.changeQty(${idx}, 1)">+</button>
          </div>
          <div class="cart-item-price">${item.price * item.qty}€</div>
          <button class="delete-item" onclick="window.deleteCartItem(${idx})">&times;</button>
        </div>
      `;
      cartItemsDivEl.appendChild(div);
    });
    cartTotalEl.textContent = cart.reduce((a, b) => a + b.price * b.qty, 0) + '€';
    saveCart();
  }
}

// Only run menu logic if menuGrid and categoryFilter exist (i.e., on menu.html)
if (menuGrid && categoryFilter) {

  // Smooth scroll for menu button
  const scrollBtn = document.querySelector('.scroll-btn');
  if (scrollBtn) {
    scrollBtn.onclick = e => {
      e.preventDefault();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
    };
  }
}

// Funksion për të inicializuar eventet e navbar-it pasi të jetë ngarkuar dinamikisht
function initNavbarEvents() {
  window.cartBtn = document.getElementById('cartBtn');
  window.cartModal = document.getElementById('cartModal');
  window.closeCartModal = document.getElementById('closeCartModal');
  window.cartCount = document.getElementById('cartCount');
  window.cartItemsDiv = document.getElementById('cartItems');
  window.cartTotal = document.getElementById('cartTotal');
  window.darkModeToggle = document.getElementById('darkModeToggle');
  window.searchInput = document.getElementById('searchInput');
  window.toast = document.getElementById('toast');

  if (window.cartBtn) {
    window.cartBtn.onclick = () => {
      window.location.href = 'cart.html';
    };
  }
  if (window.closeCartModal && window.cartModal) {
    window.closeCartModal.onclick = () => window.cartModal.classList.remove('show');
  }
  if (window.darkModeToggle) {
    window.darkModeToggle.onclick = toggleDarkMode;
  }
}

// Inicializo eventet e navbar-it gjithmonë pasi të jetë ngarkuar script.js
window.addEventListener('DOMContentLoaded', function() {
  if (typeof initNavbarEvents === 'function') {
    initNavbarEvents();
  }
});


// Product Modal and Menu logic (only if elements exist)
const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const modalProductImg = document.getElementById('modalProductImg');
const modalProductName = document.getElementById('modalProductName');
const modalProductDesc = document.getElementById('modalProductDesc');
const modalProductPrice = document.getElementById('modalProductPrice');
const modalAddToCart = document.getElementById('modalAddToCart');

if (menuGrid && categoryFilter) {

  // Load menu data
  fetch('assets/data/menu.json')
    .then(res => res.json())
    .then(data => {
      menuData = data;
      categories = Object.keys(menuData);
      filteredMenu = flattenMenu(menuData);
      renderCategories();
      renderMenu(filteredMenu);
    });

  // Flattens the menu data from {category: [items]} to [{...item, category}]
  function flattenMenu(data) {
    let result = [];
    Object.keys(data).forEach(category => {
      data[category].forEach(item => {
        result.push({ ...item, category });
      });
    });
    return result;
  }

  function renderCategories() {
    categoryFilter.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'category-btn active';
    allBtn.textContent = 'Të gjitha';
    allBtn.onclick = () => filterByCategory('Të gjitha');
    categoryFilter.appendChild(allBtn);
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.textContent = cat;
      btn.onclick = () => filterByCategory(cat);
      categoryFilter.appendChild(btn);
    });
  }

  function filterByCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    [...categoryFilter.children].find(btn => btn.textContent === category).classList.add('active');

    if (category === 'Të gjitha') {
      filteredMenu = flattenMenu(menuData);
    } else {
      filteredMenu = menuData[category] || [];
    }

    renderMenu(
      category === 'Të gjitha'
        ? flattenMenu(menuData)
        : filteredMenu.map(item => ({ ...item, category }))
    );
  }

  function renderMenu(menu) {
    menuGrid.innerHTML = '';
    if (menu.length === 0) {
      menuGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Nuk u gjet asnjë produkt.</p>';
      return;
    }
    // Always flatten menuData once for reliable indexing
    const flatMenu = flattenMenu(menuData);
    menu.forEach((item) => {
      // Find the unique index in the flat menu (by name and category)
      const globalIndex = flatMenu.findIndex(p => p.name === item.name && p.category === item.category);
      const card = document.createElement('div');
      card.className = 'product-card';
      card.onclick = () => openProductModal(item);
      card.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="product-img">
        <div class="product-info">
          <div class="product-title">${item.name}</div>
          <div class="product-desc">${item.description}</div>
          <div class="product-price">${item.price}€</div>
          <button class="add-to-cart-btn" data-index="${globalIndex}">Shto në Shportë</button>
        </div>
      `;
      menuGrid.appendChild(card);
    });
    // Attach event listeners for all add-to-cart buttons
    menuGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idx = parseInt(this.getAttribute('data-index'), 10);
        if (!isNaN(idx)) window.addToCart(idx);
      });
    });
  }

  function openProductModal(item) {
    selectedProduct = item;
    if (modalProductImg) modalProductImg.src = item.image;
    if (modalProductName) modalProductName.textContent = item.name;
    if (modalProductDesc) modalProductDesc.textContent = item.description;
    if (modalProductPrice) modalProductPrice.textContent = item.price + '€';
    if (productModal) productModal.classList.add('show');
  }
  if (closeProductModal && productModal) closeProductModal.onclick = () => productModal.classList.remove('show');
  window.onclick = e => {
    if (productModal && e.target === productModal) productModal.classList.remove('show');
    if (cartModal && e.target === cartModal) cartModal.classList.remove('show');
  };
  if (modalAddToCart && productModal) modalAddToCart.onclick = () => {
    addToCart(menuData.indexOf(selectedProduct));
    productModal.classList.remove('show');
  };

  // Search functionality
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const val = e.target.value.toLowerCase();
      const list = filteredMenu.length ? filteredMenu : menuData;
      renderMenu(list.filter(item => item.name.toLowerCase().includes(val) || item.description.toLowerCase().includes(val)));
    });
  }

  // Smooth scroll for menu button
  const scrollBtn = document.querySelector('.scroll-btn');
  if (scrollBtn) {
    scrollBtn.onclick = e => {
      e.preventDefault();
      document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
    };
  }
}



// ...removed duplicate cartBtn and closeCartModal event handlers...

// Order message generation
function generateOrderMessage() {
  const name = document.getElementById('clientName').value.trim();
  const address = document.getElementById('clientAddress').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();
  let msg = 'Porosi nga web\n\n';
  if (name || address || notes) {
    msg += 'Klienti:\n';
    if (name) msg += 'Emri: ' + name + '\n';
    if (address) msg += 'Adresa: ' + address + '\n';
    if (notes) msg += 'Shenime: ' + notes + '\n';
    msg += '\n';
  }
  cart.forEach(item => {
    msg += `${item.name} x${item.qty}\n`;
  });
  msg += `totali per pagese ${cart.reduce((a, b) => a + b.price * b.qty, 0).toFixed(2)}`;
  return msg;
}
function sendOrder(platform) {
  if (cart.length === 0) return showToast('Shporta është bosh!');
  const msg = encodeURIComponent(generateOrderMessage());
  let url = '';
  if (platform === 'whatsapp') url = `https://wa.me/38344373797?text=${msg}`;
  if (platform === 'sms') url = `sms:+38344373797?body=${msg}`;
  if (platform === 'viber') url = `viber://chat?number=%2B38344373797&text=${msg}`;
  window.open(url, '_blank');
  clearCart();
  showToast('Porosia u dërgua me sukses!');
}
if (typeof sendWhatsApp !== 'undefined' && sendWhatsApp)
  sendWhatsApp.onclick = () => sendOrder('whatsapp');
if (typeof sendSMS !== 'undefined' && sendSMS)
  sendSMS.onclick = () => sendOrder('sms');
if (typeof sendViber !== 'undefined' && sendViber)
  sendViber.onclick = () => sendOrder('viber');
function clearCart() {
  cart = [];
  saveCart();
  updateCart();
  orderForm.reset();
}
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
// Search functionality (already handled inside menuGrid/categoryFilter block)
// ...existing code...
// Dark mode toggle
// Save cart to localStorage
function saveCart() {
  try {
    localStorage.setItem('lori_cart', JSON.stringify(cart));
  } catch {}
}
function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  localStorage.setItem('darkMode', on ? '1' : '0');
}
if (typeof darkModeToggle !== 'undefined' && darkModeToggle) {
  darkModeToggle.onclick = () => setDarkMode(!document.body.classList.contains('dark'));
}
window.onload = () => {
  setDarkMode(localStorage.getItem('darkMode') === '1');
  updateCart();
};
