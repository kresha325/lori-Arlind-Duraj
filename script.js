// LORI Pizzeria & Rent - Main JS
const menuGrid = document.getElementById('menuGrid');
const categoryFilter = document.getElementById('categoryFilter');
const cartBtn = document.getElementById('cartBtn');
const cartModal = document.getElementById('cartModal');
const closeCartModal = document.getElementById('closeCartModal');
const cartCount = document.getElementById('cartCount');
const cartItemsDiv = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const orderForm = document.getElementById('orderForm');
const sendWhatsApp = document.getElementById('sendWhatsApp');
const sendSMS = document.getElementById('sendSMS');
const sendViber = document.getElementById('sendViber');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('searchInput');
const darkModeToggle = document.getElementById('darkModeToggle');

// Product Modal
const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const modalProductImg = document.getElementById('modalProductImg');
const modalProductName = document.getElementById('modalProductName');
const modalProductDesc = document.getElementById('modalProductDesc');
const modalProductPrice = document.getElementById('modalProductPrice');
const modalAddToCart = document.getElementById('modalAddToCart');

let menuData = [];
let filteredMenu = [];
let categories = [];
let cart = [];
let selectedProduct = null;

// Load menu data
fetch('assets/data/menu.json')
  .then(res => res.json())
  .then(data => {
    menuData = data;
    categories = [...new Set(menuData.map(item => item.category))];
    renderCategories();
    renderMenu(menuData);
  });

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
    filteredMenu = menuData;
  } else {
    filteredMenu = menuData.filter(item => item.category === category);
  }
  renderMenu(filteredMenu);
}

function renderMenu(menu) {
  menuGrid.innerHTML = '';
  if (menu.length === 0) {
    menuGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Nuk u gjet asnjë produkt.</p>';
    return;
  }
  menu.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => openProductModal(item);
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="product-img">
      <div class="product-info">
        <div class="product-title">${item.name}</div>
        <div class="product-desc">${item.description}</div>
        <div class="product-price">${item.price}€</div>
        <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${idx});">Shto në Shportë</button>
      </div>
    `;
    menuGrid.appendChild(card);
  });
}

function openProductModal(item) {
  selectedProduct = item;
  modalProductImg.src = item.image;
  modalProductName.textContent = item.name;
  modalProductDesc.textContent = item.description;
  modalProductPrice.textContent = item.price + '€';
  productModal.classList.add('show');
}
closeProductModal.onclick = () => productModal.classList.remove('show');
window.onclick = e => {
  if (e.target === productModal) productModal.classList.remove('show');
  if (e.target === cartModal) cartModal.classList.remove('show');
};
modalAddToCart.onclick = () => {
  addToCart(menuData.indexOf(selectedProduct));
  productModal.classList.remove('show');
};

function addToCart(idx) {
  const item = menuData[idx];
  const found = cart.find(p => p.name === item.name);
  if (found) {
    found.qty++;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  updateCart();
  showToast('U shtua në shportë!');
}

function updateCart() {
  cartCount.textContent = cart.reduce((a, b) => a + b.qty, 0);
  cartItemsDiv.innerHTML = '';
  if (cart.length === 0) {
    cartItemsDiv.innerHTML = '<p>Shporta është bosh.</p>';
    cartTotal.textContent = '0€';
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
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">-</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        </div>
        <div class="cart-item-price">${item.price * item.qty}€</div>
        <button class="delete-item" onclick="deleteCartItem(${idx})">&times;</button>
      </div>
    `;
    cartItemsDiv.appendChild(div);
  });
  cartTotal.textContent = cart.reduce((a, b) => a + b.price * b.qty, 0) + '€';
}
window.changeQty = function(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCart();
};
window.deleteCartItem = function(idx) {
  cart.splice(idx, 1);
  updateCart();
};
cartBtn.onclick = () => {
  cartModal.classList.add('show');
  updateCart();
};
closeCartModal.onclick = () => cartModal.classList.remove('show');

// Order message generation
function generateOrderMessage() {
  const name = document.getElementById('clientName').value.trim();
  const address = document.getElementById('clientAddress').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();
  let msg = 'Porosi nga web\n\nRestoranti: LORI Pizzeria & Rent\n\n';
  if (name || address || notes) {
    msg += 'Klienti:\n';
    if (name) msg += 'Emri: ' + name + '\n';
    if (address) msg += 'Adresa: ' + address + '\n';
    if (notes) msg += 'Shenime: ' + notes + '\n';
    msg += '\n';
  }
  msg += 'Porosia:\n';
  cart.forEach(item => {
    msg += `- ${item.name} x${item.qty} = ${item.price * item.qty}€\n`;
  });
  msg += `\nTotali: ${cart.reduce((a, b) => a + b.price * b.qty, 0)}€`;
  return msg;
}
function sendOrder(platform) {
  if (cart.length === 0) return showToast('Shporta është bosh!');
  const msg = encodeURIComponent(generateOrderMessage());
  let url = '';
  if (platform === 'whatsapp') url = `https://wa.me/?text=${msg}`;
  if (platform === 'sms') url = `sms:?body=${msg}`;
  if (platform === 'viber') url = `viber://forward?text=${msg}`;
  window.open(url, '_blank');
  clearCart();
  showToast('Porosia u dërgua me sukses!');
}
sendWhatsApp.onclick = () => sendOrder('whatsapp');
sendSMS.onclick = () => sendOrder('sms');
sendViber.onclick = () => sendOrder('viber');
function clearCart() {
  cart = [];
  updateCart();
  orderForm.reset();
}
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}
// Search functionality
searchInput.addEventListener('input', e => {
  const val = e.target.value.toLowerCase();
  const list = filteredMenu.length ? filteredMenu : menuData;
  renderMenu(list.filter(item => item.name.toLowerCase().includes(val) || item.description.toLowerCase().includes(val)));
});
// Smooth scroll for menu button
const scrollBtn = document.querySelector('.scroll-btn');
if (scrollBtn) {
  scrollBtn.onclick = e => {
    e.preventDefault();
    document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
  };
}
// Dark mode toggle
function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  localStorage.setItem('darkMode', on ? '1' : '0');
}
darkModeToggle.onclick = () => setDarkMode(!document.body.classList.contains('dark'));
window.onload = () => {
  setDarkMode(localStorage.getItem('darkMode') === '1');
};
