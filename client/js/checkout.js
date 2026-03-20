document.addEventListener("DOMContentLoaded", () => {
    const cartTableBody = document.querySelector("#cart-table tbody");
    const subtotalElement = document.querySelector("#subtotal");
    const taxElement = document.querySelector("#tax");
    const totalElement = document.querySelector("#total");

    // Load cart from localStorage (used by products page ShoppingCart)
    function loadCartItems() {
        return JSON.parse(localStorage.getItem('powerflow_cart')) || [];
    }

    function saveCartItems(items) {
        localStorage.setItem('powerflow_cart', JSON.stringify(items));
    }

    function renderCartTable() {
        const items = loadCartItems();
        cartTableBody.innerHTML = '';
        if (items.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" class="text-center text-muted">Your cart is empty</td>';
            cartTableBody.appendChild(tr);
            subtotalElement.textContent = 'RWF 0';
            taxElement.textContent = 'RWF 0';
            totalElement.textContent = 'RWF 0';
            return;
        }
        let subtotal = 0;
        items.forEach((item, idx) => {
            const { product, price, quantity } = item;
            const lineTotal = price * quantity;
            subtotal += lineTotal;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${product}</td>
                <td><input type="number" min="1" value="${quantity}" data-index="${idx}" class="cart-qty" style="width:60px;"></td>
                <td>RWF ${price.toLocaleString()}</td>
                <td>RWF ${lineTotal.toLocaleString()}</td>
                <td><button class="btn btn-sm btn-danger remove-item" data-index="${idx}"><i class="fas fa-trash"></i></button></td>
            `;
            cartTableBody.appendChild(tr);
        });
        const tax = Math.floor(subtotal * 0.1);
        const grand = subtotal + tax;
        subtotalElement.textContent = `RWF ${subtotal.toLocaleString()}`;
        taxElement.textContent = `RWF ${tax.toLocaleString()}`;
        totalElement.textContent = `RWF ${grand.toLocaleString()}`;

        // attach listeners for inputs & remove buttons
        cartTableBody.querySelectorAll('.cart-qty').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const newQty = parseInt(e.target.value) || 1;
                items[index].quantity = newQty;
                saveCartItems(items);
                renderCartTable();
            });
        });
        cartTableBody.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                items.splice(index, 1);
                saveCartItems(items);
                renderCartTable();
            });
        });
    }

    // initially render cart
    renderCartTable();

    const checkoutForm = document.querySelector("#checkout-form");
    const invoiceSection = document.querySelector("#invoice-section");
    const checkoutFormContainer = document.querySelector("#checkout-form-container");
    checkoutForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = document.querySelector("#name").value.trim();
        const email = document.querySelector("#email").value.trim();
        const phone = document.querySelector("#phone").value.trim();
        if (!name || !email || !phone) {
            alert("Please fill out all required fields.");
            return;
        }
        const invoiceNumber = document.querySelector("#invoice-number");
        invoiceNumber.textContent = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
        const subtotal = document.querySelector("#subtotal").textContent;
        const tax = document.querySelector("#tax").textContent;
        const total = document.querySelector("#total").textContent;
        const invoiceDetails = document.querySelector("#invoice-details");
        invoiceDetails.innerHTML = `
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Subtotal:</strong> ${subtotal}</p>
            <p><strong>Tax:</strong> ${tax}</p>
            <p><strong>Total:</strong> ${total}</p>
        `;
        checkoutFormContainer.style.display = "none";
        invoiceSection.style.display = "block";
    });
    document.querySelector("#print-invoice").addEventListener("click", () => {
        window.print();
    });
});