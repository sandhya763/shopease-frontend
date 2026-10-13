const API = "http://localhost:5000/api";
let products = [];
let cart = [];

const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
const grid = document.getElementById("product-grid");
const cartItems = document.getElementById("cart-items");
const notice = document.getElementById("notice");

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Is the backend running?");
  return data;
}

async function loadProducts() {
  try {
    products = await request("/products");
    renderProducts();
    await loadCart();
  } catch (error) {
    grid.innerHTML = `<p class="status">Could not connect to the back end. Start the backend server and refresh this page.<br><br><small>${error.message}</small></p>`;
  }
}

function renderProducts() {
  grid.innerHTML = products.map(p => `
    <article class="product-card">
      <div class="product-visual">${p.emoji}</div>
      <div class="product-info">
        <span class="product-category">${p.category}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="product-bottom"><span class="price">${money(p.price)}</span>
        <button class="add-button" data-add="${p.id}">+ Add to cart</button></div>
      </div>
    </article>`).join("");
  grid.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", async () => {
    try { await request("/cart/items", { method: "POST", body: JSON.stringify({ productId: Number(btn.dataset.add), quantity: 1 }) }); await loadCart(); notice.textContent = "Added to your cart."; }
    catch (e) { notice.textContent = e.message; }
  }));
}

async function loadCart() {
  const data = await request("/cart");
  cart = data.items;
  renderCart(data);
}

function renderCart(data) {
  document.getElementById("cart-count").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (!cart.length) {
    cartItems.innerHTML = '<p class="empty">Your cart is waiting for its first find.</p>';
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-row">
        <div class="mini-visual">${item.emoji}</div>
        <div><h4>${escapeHtml(item.name)}</h4><small>${money(item.price)} each</small>
          <div class="quantity"><button aria-label="Decrease quantity" data-qty="${item.productId}" data-delta="-1">−</button><span>${item.quantity}</span><button aria-label="Increase quantity" data-qty="${item.productId}" data-delta="1">+</button>
          <button class="remove-button" data-remove="${item.productId}">Remove</button></div>
        </div><div class="row-price">${money(item.price * item.quantity)}</div>
      </div>`).join("");
    cartItems.querySelectorAll("[data-qty]").forEach(btn => btn.addEventListener("click", async () => {
      const item = cart.find(x => x.productId === Number(btn.dataset.qty));
      const quantity = item.quantity + Number(btn.dataset.delta);
      try {
        if (quantity <= 0) await request(`/cart/items/${item.productId}`, { method: "DELETE" });
        else await request(`/cart/items/${item.productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
        await loadCart();
      } catch (e) { notice.textContent = e.message; }
    }));
    cartItems.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", async () => {
      try { await request(`/cart/items/${btn.dataset.remove}`, { method: "DELETE" }); await loadCart(); }
      catch (e) { notice.textContent = e.message; }
    }));
  }
  document.getElementById("subtotal").textContent = money(data.subtotal || 0);
  document.getElementById("total").textContent = money(data.subtotal || 0);
}

document.getElementById("clear-cart").addEventListener("click", async () => {
  try { await request("/cart", { method: "DELETE" }); await loadCart(); notice.textContent = "Cart cleared."; }
  catch (e) { notice.textContent = e.message; }
});

document.getElementById("checkout-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!cart.length) { notice.textContent = "Add at least one product before placing an order."; return; }
  const form = new FormData(event.currentTarget);
  const customer = { name: form.get("name").trim(), email: form.get("email").trim(), address: form.get("address").trim() };
  try {
    const result = await request("/orders", { method: "POST", body: JSON.stringify(customer) });
    notice.textContent = `Order placed successfully! Demo order ID: ${result.order.id}. Total: ${money(result.order.total)}.`;
    event.currentTarget.reset();
    await loadCart();
  } catch (e) { notice.textContent = e.message; }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
loadProducts();
