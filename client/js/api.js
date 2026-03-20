// ============================================
// API Integration for Power Flow Services
// ============================================

const API_BASE_URL = 'http://localhost:5001/api';

const api = {
  // ============ AUTHENTICATION ============
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async register(name, email, password, phone, address) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone, address }),
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async logout() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getCurrentUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get user error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // ============ PRODUCTS ============
  async getProducts(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/products?${searchParams}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get products error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get product error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async searchProducts(query, params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/products/search/${query}?${searchParams}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Search products error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getProductsByCategory(category, params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/products/category/${category}?${searchParams}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get products by category error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // ============ ORDERS ============
  async createOrder(orderData) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Create order error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getOrders(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/orders?${searchParams}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get orders error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getOrderById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
        method: 'GET',
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Get order error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async downloadInvoice(orderId) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return { success: true };
      } else {
        return { success: false, error: 'Failed to download invoice' };
      }
    } catch (error) {
      console.error('Download invoice error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // ============ REVIEWS ============
  async addProductReview(productId, rating, comment) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comment }),
        credentials: 'include',
      });
      return await response.json();
    } catch (error) {
      console.error('Add review error:', error);
      return { success: false, error: 'Network error' };
    }
  },

  // ============ UTILITY ============
  async getHealthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      return { success: false, error: 'Network error' };
    }
  },
};

// Check if backend is available
async function checkBackendHealth() {
  const result = await api.getHealthCheck();
  return result.success;
}

// Initialize API configuration
function initializeAPI(config = {}) {
  if (config.baseUrl) {
    API_BASE_URL = config.baseUrl;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, checkBackendHealth, initializeAPI };
}
