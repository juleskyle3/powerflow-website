// Cart Management System
class CartManager {
  constructor() {
    this.cart = this.loadCart();
    this.init();
  }

  init() {
    this.updateCartCount();
    this.bindEvents();
  }

  loadCart() {
    const cartData = localStorage.getItem('powerflow_cart');
    return cartData ? JSON.parse(cartData) : [];
  }

  saveCart() {
    localStorage.setItem('powerflow_cart', JSON.stringify(this.cart));
    this.updateCartCount();
  }

  addToCart(productId, productName, price, image) {
    const existingItem = this.cart.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        productId,
        name: productName,
        price: parseFloat(price),
        image: image || 'https://via.placeholder.com/100',
        quantity: 1
      });
    }
    
    this.saveCart();
    this.showNotification(`${productName} added to cart!`, 'success');
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.productId !== productId);
    this.saveCart();
    this.renderCart();
  }

  updateQuantity(productId, quantity) {
    const item = this.cart.find(item => item.productId === productId);
    if (item) {
      item.quantity = parseInt(quantity);
      if (item.quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        this.saveCart();
        this.renderCart();
      }
    }
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
    this.renderCart();
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
    countElements.forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'inline-block' : 'none';
    });
  }

  bindEvents() {
    // Add to cart buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.add-to-cart')) {
        const btn = e.target.closest('.add-to-cart');
        const productId = btn.dataset.productId;
        const productName = btn.dataset.productName;
        const price = btn.dataset.price;
        const image = btn.dataset.image;
        
        if (productId && productName && price) {
          this.addToCart(productId, productName, price, image);
        }
      }
    });

    // Cart button click
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        window.location.href = 'checkout.html';
      });
    }
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

    cartContainer.innerHTML = this.cart.map(item => `
      <div class="cart-item" data-product-id="${item.productId}">
        <div class="cart-item-image">
          <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100'">
        </div>
        <div class="cart-item-details">
          <h5 class="cart-item-name">${item.name}</h5>
          <p class="cart-item-price">RWF ${item.price.toLocaleString()}</p>
        </div>
        <div class="cart-item-quantity">
          <button class="btn btn-sm btn-outline-secondary" onclick="cartManager.updateQuantity('${item.productId}', ${item.quantity - 1})">
            <i class="fas fa-minus"></i>
          </button>
          <input type="number" class="form-control form-control-sm" value="${item.quantity}" 
                 onchange="cartManager.updateQuantity('${item.productId}', this.value)" min="1" style="width: 60px; text-align: center;">
          <button class="btn btn-sm btn-outline-secondary" onclick="cartManager.updateQuantity('${item.productId}', ${item.quantity + 1})">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="cart-item-total">
          <strong>RWF ${(item.price * item.quantity).toLocaleString()}</strong>
        </div>
        <div class="cart-item-remove">
          <button class="btn btn-sm btn-danger" onclick="cartManager.removeFromCart('${item.productId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (cartTotal) {
      cartTotal.textContent = `RWF ${this.getTotal().toLocaleString()}`;
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
      <i class="fas fa-check-circle me-2"></i>${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
}

// Initialize cart manager
const cartManager = new CartManager();