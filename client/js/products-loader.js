// Products Loader - Fetches products from API and renders them
class ProductsLoader {
  constructor() {
    this.products = [];
    this.productsById = new Map();
    this.loading = false;
    this.detailsModal = null;
    this.modalProductId = null;
    this.stockPollTimer = null;
    this.lastStockRefresh = 0;
    this.bindStockUpdates();
    this.startStockPolling();
  }

  getAvailableStock(product) {
    const raw = product?.availableStock ?? product?.stock ?? 0;
    return Math.max(0, Math.floor(Number(raw) || 0));
  }

  getStockBadgeClass(quantity) {
    if (quantity <= 0) return 'bg-danger';
    if (quantity <= 5) return 'bg-warning text-dark';
    return 'bg-success';
  }

  getStockBadgeLabel(quantity) {
    return quantity > 0 ? `${quantity} in stock` : 'Out of stock';
  }

  bindStockUpdates() {
    document.addEventListener('cart:stock-updated', (event) => {
      this.applyStockUpdates(event.detail?.items);
    });

    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastStockRefresh < 15000) return;
      this.refreshStock();
    };

    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
  }

  startStockPolling() {
    if (this.stockPollTimer) return;

    // Other customers' carts and orders change availability constantly, so
    // refresh badges periodically without re-rendering the whole grid.
    this.stockPollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.refreshStock();
    }, 30000);
  }

  applyStockUpdates(items) {
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      if (!item || !item.productId) return;
      this.updateStockDom(item.productId, item.availableStock);
    });
  }

  updateStockDom(productId, availableStock) {
    const id = String(productId);
    const quantity = Math.max(0, Math.floor(Number(availableStock) || 0));
    const product = this.productsById.get(id);

    if (product) {
      product.availableStock = quantity;
    }

    document.querySelectorAll(`[data-stock-badge="${id}"]`).forEach((badge) => {
      badge.className = `badge ${this.getStockBadgeClass(quantity)}`;
      badge.textContent = this.getStockBadgeLabel(quantity);
    });

    document.querySelectorAll(`.add-to-cart[data-product-id="${id}"]`).forEach((button) => {
      button.dataset.availableStock = String(quantity);
      button.disabled = quantity <= 0;

      const label = button.querySelector('[data-stock-button-label]');
      if (label) {
        label.textContent = quantity > 0 ? 'Add to Cart' : 'Out of Stock';
      }
    });

    if (this.modalProductId === id) {
      const modalStock = document.querySelector('[data-modal-stock]');
      if (modalStock) {
        modalStock.textContent = quantity > 0 ? `${quantity} available` : 'Out of stock';
      }
    }
  }

  async refreshStock() {
    if (this.loading) return;

    try {
      const response = await apiService.getAllProducts({ limit: 200, sort: '-createdAt' });
      if (!response.success) return;

      const products = response.data.products || [];
      this.products = products;
      this.productsById = new Map(products.map((product) => [product._id, product]));
      this.lastStockRefresh = Date.now();

      products.forEach((product) => {
        this.updateStockDom(product._id, this.getAvailableStock(product));
      });
    } catch (error) {
      console.warn('Could not refresh product stock:', error);
    }
  }

  async loadAllProducts() {
    if (this.loading) return;

    this.loading = true;
    this.showLoading();

    try {
      const response = await apiService.getAllProducts({ limit: 200, sort: '-createdAt' });

      if (response.success) {
        this.products = response.data.products || [];
        this.productsById = new Map(this.products.map((product) => [product._id, product]));
        this.renderProductsByCategory();
      } else {
        this.showError('Failed to load products.');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      this.showError('Unable to connect to server. Please try again later.');
    } finally {
      this.loading = false;
      this.hideLoading();
    }
  }

  renderProductsByCategory() {
    const categories = {
      electronic: [],
      electrical: [],
      plumbing: [],
      other: [],
    };

    this.products.forEach((product) => {
      const key = product?.category;
      if (key && categories[key]) {
        categories[key].push(product);
        return;
      }

      categories.other.push(product);
    });

    this.renderCategory('electronic', categories.electronic);
    this.renderCategory('electrical', categories.electrical);
    this.renderCategory('plumbing', categories.plumbing);
    this.renderOtherCategory(categories.other);
  }

  renderCategory(category, products) {
    const container = document.querySelector(`.${category}-products-grid`);
    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = '<p class="text-center text-muted py-5">No products available in this category.</p>';
      return;
    }

    container.innerHTML = products.map((product) => this.createProductCard(product)).join('');
    this.attachEventListeners();
  }

  renderOtherCategory(products) {
    const section = document.getElementById('otherProductsSection');
    const container = document.querySelector('.other-products-grid');
    if (!section || !container) return;

    if (!Array.isArray(products) || products.length === 0) {
      section.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    section.style.display = '';
    container.innerHTML = products.map((product) => this.createProductCard(product)).join('');
    this.attachEventListeners();
  }

  getPlaceholderImage() {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%231e3a8a%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23fff%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EProduct%3C/text%3E%3C/svg%3E';
  }

  normalizeAssetUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';

    // Avoid mixed-content on https sites when the backend generated http URLs.
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && raw.startsWith('http://')) {
      return `https://${raw.slice('http://'.length)}`;
    }

    return raw;
  }

  getPrimaryImage(product) {
    if (product.image) return this.normalizeAssetUrl(product.image);
    if (Array.isArray(product.images) && product.images.length > 0) return this.normalizeAssetUrl(product.images[0]);
    return this.getPlaceholderImage();
  }

  toList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  createProductCard(product) {
    const primaryImage = this.getPrimaryImage(product);
    const availableStock = this.getAvailableStock(product);
    const brand = product.brand ? `<span class="product-chip"><i class="fas fa-industry"></i>${this.escapeHtml(product.brand)}</span>` : '';
    const warranty = product.warranty ? `<span class="product-chip"><i class="fas fa-shield-alt"></i>${this.escapeHtml(product.warranty)}</span>` : '';

    return `
      <article class="product-card" data-product-id="${product._id}">
        <div class="product-image">
          <img src="${primaryImage}" alt="${this.escapeHtml(product.name)}"
               onerror="this.src='${this.getPlaceholderImage()}'">
        </div>
        <div class="product-content">
          <h3 class="product-name">${this.escapeHtml(product.name)}</h3>
          <p class="product-description">${this.escapeHtml(product.description || '')}</p>
          <div class="product-card-meta">${brand}${warranty}</div>
          <div class="product-price">
            <span class="price">RWF ${Number(product.price || 0).toLocaleString()}</span>
          </div>
          <div class="product-stock">
            <span class="badge ${this.getStockBadgeClass(availableStock)}" data-stock-badge="${product._id}">
              ${this.getStockBadgeLabel(availableStock)}
            </span>
          </div>
          <div class="product-actions">
            <button class="btn btn-primary btn-sm add-to-cart"
                    data-product-id="${product._id}"
                    data-product-name="${this.escapeHtml(product.name)}"
                    data-price="${Number(product.price || 0)}"
                    data-image="${primaryImage}"
                    data-available-stock="${availableStock}"
                    ${availableStock === 0 ? 'disabled' : ''}>
              <i class="fas fa-cart-plus me-1"></i><span data-stock-button-label>${availableStock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>
            <button class="btn btn-outline-primary btn-sm view-product"
                    data-product-id="${product._id}">
              <i class="fas fa-eye me-1"></i>View
            </button>
            <button class="btn btn-outline-secondary btn-sm inquire-product"
                    data-product-name="${this.escapeHtml(product.name)}">
              <i class="fas fa-comment-dots me-1"></i>Inquire
            </button>
          </div>
        </div>
      </article>
    `;
  }

  buildSpecsHtml(specifications) {
    const specs = (Array.isArray(specifications) ? specifications : [])
      .map((spec) => {
        if (typeof spec === 'object' && spec !== null) {
          const key = this.escapeHtml(spec.name || 'Specification');
          const value = this.escapeHtml(spec.value || 'N/A');
          return `<li><span>${key}</span><strong>${value}</strong></li>`;
        }

        if (typeof spec === 'string' && spec.trim()) {
          const [name, ...rest] = spec.split(':');
          if (rest.length > 0) {
            return `<li><span>${this.escapeHtml(name.trim())}</span><strong>${this.escapeHtml(rest.join(':').trim())}</strong></li>`;
          }
          return `<li><span>Specification</span><strong>${this.escapeHtml(spec.trim())}</strong></li>`;
        }

        return '';
      })
      .filter(Boolean);

    if (specs.length === 0) {
      return '<li><span>Specifications</span><strong>Not provided</strong></li>';
    }

    return specs.join('');
  }

  buildGalleryHtml(product) {
    const images = [this.getPrimaryImage(product), ...this.toList(product.images).map((url) => this.normalizeAssetUrl(url))]
      .filter((image, index, list) => list.indexOf(image) === index);

    return images.map((image) => `
      <button type="button" class="detail-thumb" data-image="${image}">
        <img src="${image}" alt="${this.escapeHtml(product.name)} image" onerror="this.src='${this.getPlaceholderImage()}'">
      </button>
    `).join('');
  }

  buildProductDetailsTemplate(product) {
    const primaryImage = this.getPrimaryImage(product);
    const availableStock = this.getAvailableStock(product);
    const tags = this.toList(product.tags);
    const dimensions = product.dimensions || {};

    const details = [
      product.brand ? `<li><span>Brand</span><strong>${this.escapeHtml(product.brand)}</strong></li>` : '',
      product.sku ? `<li><span>SKU</span><strong>${this.escapeHtml(product.sku)}</strong></li>` : '',
      product.warranty ? `<li><span>Warranty</span><strong>${this.escapeHtml(product.warranty)}</strong></li>` : '',
      Number.isFinite(Number(product.weight)) && Number(product.weight) > 0
        ? `<li><span>Weight</span><strong>${Number(product.weight)} kg</strong></li>`
        : '',
      dimensions.length || dimensions.width || dimensions.height
        ? `<li><span>Dimensions</span><strong>${[dimensions.length || '-', dimensions.width || '-', dimensions.height || '-'].join(' x ')} cm</strong></li>`
        : '',
      `<li><span>Category</span><strong>${this.escapeHtml(product.category || 'General')}</strong></li>`,
      `<li><span>Stock</span><strong data-modal-stock>${availableStock > 0 ? `${availableStock} available` : 'Out of stock'}</strong></li>`,
    ].filter(Boolean).join('');

    return `
      <div class="product-details-layout">
        <div class="product-details-gallery">
          <div class="product-main-image-wrap">
            <img id="productMainImage" src="${primaryImage}" alt="${this.escapeHtml(product.name)}" onerror="this.src='${this.getPlaceholderImage()}'">
          </div>
          <div class="product-thumb-grid">
            ${this.buildGalleryHtml(product)}
          </div>
        </div>
        <div class="product-details-content">
          <div class="product-details-header">
            <h2>${this.escapeHtml(product.name)}</h2>
            <p>${this.escapeHtml(product.description || 'No description available.')}</p>
            <div class="product-details-price">RWF ${Number(product.price || 0).toLocaleString()}</div>
          </div>

          <ul class="product-meta-list">
            ${details}
          </ul>

          <div class="product-specs-block">
            <h6><i class="fas fa-list-check me-2"></i>Specifications</h6>
            <ul class="product-meta-list compact">
              ${this.buildSpecsHtml(product.specifications)}
            </ul>
          </div>

          ${tags.length > 0 ? `
            <div class="product-tags-wrap">
              ${tags.map((tag) => `<span class="product-tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-primary add-to-cart"
                    data-product-id="${product._id}"
                    data-product-name="${this.escapeHtml(product.name)}"
                    data-price="${Number(product.price || 0)}"
                    data-image="${primaryImage}"
                    data-available-stock="${availableStock}"
                    ${availableStock === 0 ? 'disabled' : ''}>
              <i class="fas fa-cart-plus me-2"></i><span data-stock-button-label>${availableStock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>
            <button class="btn btn-outline-secondary inquire-product" data-product-name="${this.escapeHtml(product.name)}">
              <i class="fas fa-envelope me-2"></i>Request Information
            </button>
          </div>
        </div>
      </div>
    `;
  }

  openProductDetails(productId) {
    const product = this.productsById.get(productId);
    if (!product) return;

    const body = document.getElementById('productDetailsBody');
    if (!body) return;

    this.modalProductId = productId;
    body.innerHTML = this.buildProductDetailsTemplate(product);

    body.querySelectorAll('.detail-thumb').forEach((thumbButton) => {
      thumbButton.addEventListener('click', () => {
        const selectedImage = thumbButton.dataset.image;
        const mainImage = document.getElementById('productMainImage');
        if (mainImage && selectedImage) {
          mainImage.src = selectedImage;
        }
      });
    });

    body.querySelectorAll('.inquire-product').forEach((button) => {
      button.addEventListener('click', (event) => {
        const productName = event.currentTarget.dataset.productName;
        this.inquireProduct(productName);
      });
    });

    const modalEl = document.getElementById('productDetailsModal');
    if (!modalEl) return;

    if (!this.detailsModal) {
      this.detailsModal = new bootstrap.Modal(modalEl);
      modalEl.addEventListener('hidden.bs.modal', () => {
        this.modalProductId = null;
      });
    }

    this.detailsModal.show();
  }

  attachEventListeners() {
    document.querySelectorAll('.view-product').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        this.openProductDetails(event.currentTarget.dataset.productId);
      });
    });

    document.querySelectorAll('.inquire-product').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        this.inquireProduct(event.currentTarget.dataset.productName);
      });
    });
  }

  inquireProduct(productName) {
    window.location.href = `contact.html?product=${encodeURIComponent(productName || '')}`;
  }

  showLoading() {
    document.querySelectorAll('.products-grid').forEach((grid) => {
      grid.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin fs-1"></i><p class="mt-2">Loading products...</p></div>';
    });
  }

  hideLoading() {
    // Loading is replaced by content.
  }

  showError(message) {
    document.querySelectorAll('.products-grid').forEach((grid) => {
      grid.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const productsLoader = new ProductsLoader();
  productsLoader.loadAllProducts();
});
