// Cart Management System with server-side stock reservations.
//
// Product.stock is the physical stock on hand. While items sit in a cart the
// backend holds them in StockReservation, and Product.reserved tracks those
// holds. Availability shown to customers is `stock - reserved`, so adding an
// item immediately lowers the number every other customer sees.

class CartManager {
  constructor() {
    this.cart = this.loadCart();
    this.cartId = this.loadCartId();
    this.availableStock = new Map();
    this.cartRevision = 0;
    this.syncChain = Promise.resolve();
    this.syncTimer = null;
    this.pollTimer = null;
    this.lastSyncAt = 0;
    this.reservationMinutes = 15;
    this.init();
  }

  get apiBaseUrl() {
    if (typeof API_BASE_URL === 'string' && API_BASE_URL) {
      return API_BASE_URL.replace(/\/+$/, '');
    }

    if (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
      return String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '');
    }

    return 'https://api.powerflowservicesltd.com/api';
  }

  init() {
    this.updateCartCount();
    this.bindEvents();
    this.updateReservationNote();
    this.startPolling();

    // Refresh holds as soon as the page opens. This also repairs carts whose
    // reservation expired while the customer was away.
    if (this.cart.length > 0) {
      this.syncCart({ silent: true, notify: true });
    }
  }

  generateCartId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `cart-${window.crypto.randomUUID()}`;
    }

    const random = Math.random().toString(36).slice(2, 12);
    return `cart-${Date.now().toString(36)}-${random}`;
  }

  loadCartId() {
    const stored = localStorage.getItem('powerflow_cart_id');
    if (stored && /^[A-Za-z0-9_-]{8,100}$/.test(stored)) {
      return stored;
    }

    const cartId = this.generateCartId();
    localStorage.setItem('powerflow_cart_id', cartId);
    return cartId;
  }

  getCartId() {
    return this.cartId;
  }

  loadCart() {
    try {
      const cartData = localStorage.getItem('powerflow_cart');
      const parsed = cartData ? JSON.parse(cartData) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && item.productId)
        .map((item) => ({
          ...item,
          productId: String(item.productId),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          price: Number(item.price) || 0,
        }));
    } catch (error) {
      console.warn('Could not read the saved cart:', error);
      return [];
    }
  }

  saveCartLocal() {
    localStorage.setItem('powerflow_cart', JSON.stringify(this.cart));
    this.updateCartCount();
  }

  saveCart() {
    this.cartRevision += 1;
    this.saveCartLocal();
    this.scheduleSync({ notify: true });
  }

  scheduleSync({ delay = 350, notify = false } = {}) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncCart({ silent: true, notify });
    }, delay);
  }

  startPolling() {
    if (this.pollTimer) return;

    // Light polling keeps counts fresh when other customers place orders.
    this.pollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.cart.length === 0) return;
      if (Date.now() - this.lastSyncAt < 20000) return;
      this.syncCart({ silent: true });
    }, 25000);

    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (this.cart.length === 0) return;
      if (Date.now() - this.lastSyncAt < 10000) return;
      this.syncCart({ silent: true });
    };

    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
  }

  getAvailableStock(productId) {
    const key = String(productId);
    return this.availableStock.has(key) ? this.availableStock.get(key) : undefined;
  }

  setAvailableStock(productId, value) {
    const key = String(productId);
    const quantity = Math.max(0, Math.floor(Number(value) || 0));
    this.availableStock.set(key, quantity);
  }

  adjustAvailableStock(productId, delta) {
    const current = this.getAvailableStock(productId);
    if (current === undefined) return;

    this.setAvailableStock(productId, Math.max(0, current + delta));
  }

  addToCart(productId, productName, price, image, options = {}) {
    const id = String(productId);
    const name = String(productName || 'Product');
    const existingItem = this.cart.find((item) => item.productId === id);

    let available = this.getAvailableStock(id);
    if (available === undefined && Number.isFinite(Number(options.availableStock))) {
      available = Math.max(0, Math.floor(Number(options.availableStock)));
      this.setAvailableStock(id, available);
    }

    // `available` is the number of additional units this cart may take.
    if (available !== undefined && available < 1) {
      this.showNotification(`Only ${existingItem?.quantity || 0} of ${name} can be reserved.`, 'warning');
      this.syncCart({ silent: true, notify: true });
      return false;
    }

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        productId: id,
        name,
        price: Number(price) || 0,
        image: image || 'https://via.placeholder.com/100',
        quantity: 1,
      });
    }

    this.adjustAvailableStock(id, -1);
    this.cartRevision += 1;
    this.saveCartLocal();
    this.renderCart();
    this.scheduleSync({ notify: true });
    this.showNotification(`${name} added to cart!`, 'success');

    return true;
  }

  removeFromCart(productId) {
    const id = String(productId);
    const item = this.cart.find((entry) => entry.productId === id);

    if (item) {
      this.adjustAvailableStock(id, item.quantity);
    }

    this.cart = this.cart.filter((entry) => entry.productId !== id);
    this.cartRevision += 1;
    this.saveCartLocal();
    this.renderCart();
    this.scheduleSync({ notify: true });
  }

  updateQuantity(productId, quantity) {
    const id = String(productId);
    const item = this.cart.find((entry) => entry.productId === id);
    if (!item) return;

    const previousQuantity = item.quantity;
    let nextQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(nextQuantity)) return;

    if (nextQuantity <= 0) {
      this.removeFromCart(id);
      return;
    }

    const available = this.getAvailableStock(id);
    if (available !== undefined) {
      const maxQuantity = previousQuantity + available;
      if (nextQuantity > maxQuantity) {
        nextQuantity = maxQuantity;
        this.showNotification(`Only ${maxQuantity} of ${item.name} can be reserved.`, 'warning');
      }
    }

    if (nextQuantity <= 0) {
      this.removeFromCart(id);
      return;
    }

    const delta = nextQuantity - previousQuantity;
    item.quantity = nextQuantity;

    if (available !== undefined) {
      this.setAvailableStock(id, Math.max(0, available - delta));
    }

    this.cartRevision += 1;
    this.saveCartLocal();
    this.renderCart();
    this.scheduleSync({ notify: true });
  }

  clearCart({ release = true } = {}) {
    const previousCartId = this.cartId;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    this.cart = [];
    this.availableStock.clear();
    this.cartRevision += 1;
    this.saveCartLocal();
    this.renderCart();

    // Use a fresh cart id so a late DELETE can never release reservations for
    // items the customer adds after clearing.
    this.cartId = this.generateCartId();
    localStorage.setItem('powerflow_cart_id', this.cartId);

    if (release && previousCartId) {
      this.releaseCartId(previousCartId);
    }
  }

  async releaseCartId(cartId) {
    try {
      await fetch(`${this.apiBaseUrl}/cart/${encodeURIComponent(cartId)}`, {
        method: 'DELETE',
        keepalive: true,
      });
    } catch (error) {
      // Expiry cleanup will release any hold that could not be deleted now.
      console.warn('Could not release cart stock:', error.message);
    }
  }

  getCart() {
    return this.cart;
  }

  getTotal() {
    return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getItemCount() {
    return this.cart.reduce((count, item) => count + item.quantity, 0);
  }

  updateCartCount() {
    const countElements = document.querySelectorAll('.cart-count, #cartCount');
    const count = this.getItemCount();
    countElements.forEach((el) => {
      el.textContent = count;
      el.style.display = count > 0 ? 'inline-block' : 'none';
    });
  }

  updateReservationNote() {
    const minutes = this.reservationMinutes || 15;
    document.querySelectorAll('[data-reservation-minutes]').forEach((el) => {
      el.textContent = `${minutes} minute${minutes === 1 ? '' : 's'}`;
    });
  }

  bindEvents() {
    document.addEventListener('click', (event) => {
      const addButton = event.target.closest('.add-to-cart');
      if (addButton && !addButton.disabled) {
        const productId = addButton.dataset.productId;
        const productName = addButton.dataset.productName;
        const price = addButton.dataset.price;
        const image = addButton.dataset.image;
        const availableStock = addButton.dataset.availableStock;

        if (productId && productName && price !== undefined) {
          this.addToCart(productId, productName, price, image, { availableStock });
        }
        return;
      }

      const actionButton = event.target.closest('[data-cart-action]');
      if (actionButton) {
        const productId = actionButton.dataset.productId;
        const action = actionButton.dataset.cartAction;

        if (action === 'increase') {
          const item = this.cart.find((entry) => entry.productId === productId);
          if (item) this.updateQuantity(productId, item.quantity + 1);
        } else if (action === 'decrease') {
          const item = this.cart.find((entry) => entry.productId === productId);
          if (item) this.updateQuantity(productId, item.quantity - 1);
        } else if (action === 'remove') {
          this.removeFromCart(productId);
        }
        return;
      }

      const cartBtn = event.target.closest('#cartBtn');
      if (cartBtn) {
        window.location.href = 'checkout.html';
      }
    });

    document.addEventListener('change', (event) => {
      const input = event.target.closest('[data-cart-quantity]');
      if (!input) return;

      this.updateQuantity(input.dataset.cartQuantity, input.value);
    });

    window.addEventListener('storage', (event) => {
      if (event.key === 'powerflow_cart') {
        this.cart = this.loadCart();
        this.cartRevision += 1;
        this.renderCart();
        this.updateCartCount();
        this.scheduleSync({ notify: false });
      }

      if (event.key === 'powerflow_cart_id' && event.newValue) {
        this.cartId = event.newValue;
      }
    });
  }

  /**
   * Queue a cart sync. Calls are serialized so a checkout request always sees
   * the result of any sync that was already in flight.
   */
  syncCart({ silent = false, notify = false, attempts = 2 } = {}) {
    const run = async () => {
      let result = null;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        result = await this.performSync({ silent, notify });
        if (!result || !result.stale) break;
      }

      return result;
    };

    this.syncChain = this.syncChain.then(run, run);
    return this.syncChain;
  }

  async performSync({ silent = false, notify = false } = {}) {
    if (!this.cartId) {
      this.cartId = this.loadCartId();
    }

    if (this.cart.length === 0) {
      this.availableStock.clear();
    }

    const revision = this.cartRevision;
    const requestItems = this.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    try {
      // An empty cart is still synced so the backend releases any holds left
      // behind when the customer removed the last item.
      const response = await fetch(`${this.apiBaseUrl}/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: this.cartId,
          items: requestItems,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.success) {
        const message = payload?.error?.message || payload?.message || `Cart sync failed (${response.status})`;
        throw new Error(message);
      }

      const data = payload.data || {};
      this.reservationMinutes = Math.max(1, Math.floor(Number(data.reservationMinutes) || this.reservationMinutes));
      this.lastSyncAt = Date.now();
      this.updateReservationNote();

      // The customer changed the cart while this request was in flight. Drop
      // the stale result and sync again with the latest quantities.
      if (revision !== this.cartRevision) {
        this.scheduleSync({ delay: 0, notify });
        return { ...data, stale: true };
      }

      this.applyServerCart(data, { notify });
      return data;
    } catch (error) {
      this.lastSyncAt = Date.now();
      if (!silent) {
        console.warn('Cart stock sync failed:', error.message);
      }
      return { error: error.message, stale: false };
    }
  }

  applyServerCart(data, { notify = false } = {}) {
    const serverItems = Array.isArray(data.items) ? data.items : [];
    const serverById = new Map(
      serverItems.map((item) => [String(item.productId), item])
    );
    const namesById = new Map(this.cart.map((item) => [item.productId, item.name]));

    let changed = false;

    this.cart.forEach((item) => {
      const serverItem = serverById.get(item.productId);

      if (!serverItem || Number(serverItem.quantity) <= 0) {
        item.removeAfterSync = true;
        changed = true;
        return;
      }

      const nextQuantity = Math.max(1, Math.floor(Number(serverItem.quantity)));
      if (item.quantity !== nextQuantity) {
        changed = true;
      }

      item.quantity = nextQuantity;
      item.availableStock = Math.max(0, Math.floor(Number(serverItem.availableStock) || 0));
      item.stock = Math.max(0, Math.floor(Number(serverItem.stock) || 0));
      item.reservedUntil = serverItem.expiresAt || null;

      if (serverItem.name) item.name = serverItem.name;
      if (serverItem.price !== undefined && serverItem.price !== null) {
        item.price = Number(serverItem.price) || 0;
      }
      if (serverItem.image) item.image = serverItem.image;
    });

    this.cart = this.cart.filter((item) => !item.removeAfterSync);

    serverItems.forEach((item) => {
      this.setAvailableStock(item.productId, item.availableStock);
    });

    if (changed) {
      this.saveCartLocal();
    }

    this.renderCart();
    this.emitStockUpdate(serverItems);
    this.updateReservationNote();

    if (notify) {
      this.notifyAdjustments(data.adjustments || [], namesById);
    }
  }

  notifyAdjustments(adjustments, namesById) {
    if (!Array.isArray(adjustments) || adjustments.length === 0) return;

    const messages = adjustments.map((adjustment) => {
      const name = namesById.get(String(adjustment.productId)) || 'An item';

      if (adjustment.reason === 'product-unavailable') {
        return `${name} is no longer available and was removed from your cart.`;
      }

      if (Number(adjustment.quantity) <= 0) {
        return `${name} is out of stock and was removed from your cart.`;
      }

      return `Only ${adjustment.quantity} × ${name} could be reserved, so your cart was updated.`;
    });

    this.showNotification(messages[0], 'warning');
  }

  emitStockUpdate(items) {
    const detail = {
      cartId: this.cartId,
      items: (Array.isArray(items) ? items : []).map((item) => ({
        productId: String(item.productId),
        quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
        availableStock: Math.max(0, Math.floor(Number(item.availableStock) || 0)),
        stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
      })),
    };

    document.dispatchEvent(new CustomEvent('cart:stock-updated', { detail }));
  }

  renderCart() {
    const cartContainer = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const emptyCart = document.getElementById('emptyCart');
    const cartContent = document.getElementById('cartContent');

    if (!cartContainer) return;

    if (this.cart.length === 0) {
      if (emptyCart) emptyCart.style.display = 'block';
      if (cartContent) cartContent.style.display = 'none';
      return;
    }

    if (emptyCart) emptyCart.style.display = 'none';
    if (cartContent) cartContent.style.display = 'block';

    cartContainer.innerHTML = this.cart.map((item) => {
      const available = Number.isFinite(Number(item.availableStock))
        ? Math.max(0, Math.floor(Number(item.availableStock)))
        : null;
      const maxQuantity = available === null ? null : item.quantity + available;
      const stockNote = available === null
        ? ''
        : available > 0
          ? `<span class="cart-item-stock text-success"><i class="fas fa-box me-1"></i>${available} more available</span>`
          : '<span class="cart-item-stock text-warning"><i class="fas fa-lock me-1"></i>All available stock is in your cart</span>';

      return `
        <div class="cart-item" data-product-id="${this.escapeHtml(item.productId)}">
          <div class="cart-item-image">
            <img src="${this.escapeHtml(item.image)}" alt="${this.escapeHtml(item.name)}" onerror="this.src='https://via.placeholder.com/100'">
          </div>
          <div class="cart-item-details">
            <h5 class="cart-item-name">${this.escapeHtml(item.name)}</h5>
            <p class="cart-item-price">RWF ${item.price.toLocaleString()}</p>
            ${stockNote}
          </div>
          <div class="cart-item-quantity">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-cart-action="decrease" data-product-id="${this.escapeHtml(item.productId)}">
              <i class="fas fa-minus"></i>
            </button>
            <input type="number" class="form-control form-control-sm" value="${item.quantity}"
                   data-cart-quantity="${this.escapeHtml(item.productId)}"
                   min="1" ${maxQuantity === null ? '' : `max="${maxQuantity}"`}
                   style="width: 60px; text-align: center;">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-cart-action="increase" data-product-id="${this.escapeHtml(item.productId)}"
                    ${available !== null && available <= 0 ? 'disabled' : ''}>
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="cart-item-total">
            <strong>RWF ${(item.price * item.quantity).toLocaleString()}</strong>
          </div>
          <div class="cart-item-remove">
            <button type="button" class="btn btn-sm btn-danger" data-cart-action="remove" data-product-id="${this.escapeHtml(item.productId)}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (cartTotal) {
      cartTotal.textContent = `RWF ${this.getTotal().toLocaleString()}`;
    }
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showNotification(message, type = 'success') {
    const icons = {
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      danger: 'fa-circle-exclamation',
      info: 'fa-circle-info',
    };

    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px; max-width: 420px;';
    notification.innerHTML = `
      <i class="fas ${icons[type] || icons.info} me-2"></i>${this.escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
  }
}

// Initialize cart manager
const cartManager = new CartManager();
