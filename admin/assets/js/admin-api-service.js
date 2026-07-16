const ADMIN_API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5050/api'
  : 'https://api.powerflowservicesltd.com/api';

class AdminAPIService {
  async getAllProducts(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${ADMIN_API_BASE_URL}/products?${query}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products/${id}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async uploadProductImages(formData) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products/upload-images`, {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      console.error('Error uploading product images:', error);
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products/${id}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  async getProductStats() {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/products`);
      const data = await response.json();
      if (data.success) {
        const products = data.data.products;
        return {
          total: products.length,
          active: products.filter(p => p.isActive).length,
          outOfStock: products.filter(p => p.stock === 0).length,
          categories: this.groupByCategory(products)
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  groupByCategory(products) {
    return products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});
  }

  async getAllOrders(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${ADMIN_API_BASE_URL}/orders?${query}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderById(id) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/orders/${id}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  }

  async updateOrderStatus(id, payload) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  async deleteOrder(id) {
    try {
      let response = await fetch(`${ADMIN_API_BASE_URL}/orders/${id}`, {
        method: 'DELETE',
      });

      // Fallback for environments where DELETE is restricted/auth-protected.
      if (response.status === 401 || response.status === 405) {
        response = await fetch(`${ADMIN_API_BASE_URL}/orders/${id}/delete`, {
          method: 'POST',
        });
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  async getWebsiteContent() {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/content`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching website content:', error);
      throw error;
    }
  }

  async updateWebsiteContentSection(section, payload) {
    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/content/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await response.json();
    } catch (error) {
      console.error(`Error updating website content section "${section}":`, error);
      throw error;
    }
  }
}

const adminAPIService = new AdminAPIService();
