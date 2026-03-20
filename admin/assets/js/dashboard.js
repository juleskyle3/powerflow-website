// Dashboard functionality
class AdminDashboard {
    constructor() {
        this.init();
    }

    init() {
        this.loadUserInfo();
        this.loadStats();
        this.loadRecentOrders();
        this.bindEvents();
    }

    loadUserInfo() {
        const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
        const userNameEl = document.getElementById('userName');
        if (userNameEl && user.name) {
            userNameEl.textContent = user.name;
        }
    }

    async loadStats() {
        try {
            // Simulate API call to get stats
            const stats = await this.fetchStats();
            
            // Update stats cards
            document.getElementById('totalOrders').textContent = stats.orders;
            document.getElementById('totalProducts').textContent = stats.products;
            document.getElementById('totalUsers').textContent = stats.users;
            document.getElementById('totalRevenue').textContent = `$${stats.revenue}K`;
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async fetchStats() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Return mock data (replace with actual API call)
        return {
            orders: Math.floor(Math.random() * 200) + 100,
            products: Math.floor(Math.random() * 50) + 50,
            users: Math.floor(Math.random() * 300) + 200,
            revenue: (Math.random() * 20 + 10).toFixed(1)
        };
    }

    async loadRecentOrders() {
        try {
            const orders = await this.fetchRecentOrders();
            this.renderOrdersTable(orders);
        } catch (error) {
            console.error('Error loading recent orders:', error);
        }
    }

    async fetchRecentOrders() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Return mock data (replace with actual API call)
        return [
            {
                id: 'ORD-001',
                customer: 'John Doe',
                product: 'Electrical Panel',
                amount: 450.00,
                status: 'completed',
                date: '2024-01-15'
            },
            {
                id: 'ORD-002',
                customer: 'Jane Smith',
                product: 'CCTV System',
                amount: 890.00,
                status: 'pending',
                date: '2024-01-14'
            },
            {
                id: 'ORD-003',
                customer: 'Mike Johnson',
                product: 'Water Heater',
                amount: 320.00,
                status: 'processing',
                date: '2024-01-13'
            },
            {
                id: 'ORD-004',
                customer: 'Sarah Wilson',
                product: 'Lighting System',
                amount: 275.00,
                status: 'completed',
                date: '2024-01-12'
            }
        ];
    }

    renderOrdersTable(orders) {
        const tableBody = document.getElementById('recentOrdersTable');
        if (!tableBody) return;

        tableBody.innerHTML = orders.map(order => `
            <tr>
                <td>#${order.id}</td>
                <td>${order.customer}</td>
                <td>${order.product}</td>
                <td>$${order.amount.toFixed(2)}</td>
                <td>${this.getStatusBadge(order.status)}</td>
                <td>${order.date}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="dashboard.viewOrder('${order.id}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getStatusBadge(status) {
        const badges = {
            completed: '<span class="badge bg-success">Completed</span>',
            pending: '<span class="badge bg-warning">Pending</span>',
            processing: '<span class="badge bg-info">Processing</span>',
            cancelled: '<span class="badge bg-danger">Cancelled</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    viewOrder(orderId) {
        // Navigate to order details page
        window.location.href = `pages/orders.html?id=${orderId}`;
    }

    bindEvents() {
        // Refresh stats every 30 seconds
        setInterval(() => {
            this.loadStats();
        }, 30000);

        // Handle sidebar navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Remove active class from all links
                navLinks.forEach(l => l.classList.remove('active'));
                // Add active class to clicked link
                e.target.classList.add('active');
            });
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});