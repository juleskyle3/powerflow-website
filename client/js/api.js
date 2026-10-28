// Backend API URL - calls backend directly, no proxy needed
function resolveApiBaseUrl() {
  const hostname = window.location.hostname;

  // Local development: localhost and devices on the same private network
  // (e.g. a phone opening http://192.168.x.x:3000) use the local backend.
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isPrivateNetwork = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

  if (isLocalHost || isPrivateNetwork) {
    return `http://${hostname}:5050/api`;
  }

  return 'https://api.powerflowservicesltd.com/api';
}

const API_BASE_URL = resolveApiBaseUrl();

class APIService {
  async getAllProducts(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/products?${query}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async getProductsByCategory(category) {
    try {
      const response = await fetch(`${API_BASE_URL}/products?category=${category}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }
}

const apiService = new APIService();
