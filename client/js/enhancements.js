// ============================================
// WEBSITE ENHANCEMENTS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // ====================
    // PERFORMANCE OPTIMIZATIONS
    // ====================

    // Lazy Load Images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });

        document.querySelectorAll('img[data-src], img[loading="lazy"]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // ====================
    // INTERACTIVE FEATURES
    // ====================

    // Newsletter Subscription
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const emailInput = this.querySelector('input[type="email"]');
            const email = emailInput.value.trim();
            
            if (email && validateEmail(email)) {
                // Show success message
                const successMessage = this.querySelector('.newsletter-success');
                const errorMessage = this.querySelector('.newsletter-error');
                
                if (successMessage) successMessage.style.display = 'block';
                if (errorMessage) errorMessage.style.display = 'none';
                
                // Clear input
                emailInput.value = '';
                
                // Track event (Google Analytics)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'newsletter_signup', {
                        'email': email
                    });
                }
            } else {
                // Show error message
                const errorMessage = this.querySelector('.newsletter-error');
                if (errorMessage) errorMessage.style.display = 'block';
            }
        });
    }

    // Search Functionality
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm.length > 2) {
                performSearch(searchTerm);
            } else {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
        });
        
        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-container')) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
        });
    }

    // ====================
    // ACCESSIBILITY ENHANCEMENTS
    // ====================

    // Add keyboard accessibility to dropdown menus
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('[data-bs-toggle="dropdown"]');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' || e.key === 'Tab') {
                    menu.classList.remove('show');
                }
            });
        }
    });

    // Improve focus indicators
    const focusableElements = document.querySelectorAll('a, button, input, select, textarea');
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.classList.add('focus-visible');
        });
        
        element.addEventListener('blur', function() {
            this.classList.remove('focus-visible');
        });
    });

    // ====================
    // UTILITY FUNCTIONS
    // ====================

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function performSearch(term) {
        // Simple search implementation
        // In production, this would fetch results from a server
        const searchableContent = [
            { title: 'Electrical Maintenance', url: 'services.html#electrical', type: 'Service' },
            { title: 'Electronic Maintenance', url: 'services.html#electronic', type: 'Service' },
            { title: 'Plumbing Maintenance', url: 'services.html#plumbing', type: 'Service' },
            { title: 'Control Panels & Automation', url: 'products.html', type: 'Product' },
            { title: 'CCTV Systems', url: 'products.html', type: 'Product' },
            { title: 'Alarm Systems', url: 'products.html', type: 'Product' },
            { title: 'HVAC Controls', url: 'products.html', type: 'Product' },
            { title: 'About Power Flow', url: 'about.html', type: 'Page' },
            { title: 'Contact Us', url: 'contact.html', type: 'Page' }
        ];

        const results = searchableContent.filter(item => 
            item.title.toLowerCase().includes(term)
        );

        displaySearchResults(results);
    }

    function displaySearchResults(results) {
        if (searchResults) {
            if (results.length > 0) {
                let html = '<div class="search-results-list">';
                results.forEach(result => {
                    html += `
                        <a href="${result.url}" class="search-result-item">
                            <div class="search-result-title">${result.title}</div>
                            <div class="search-result-type">${result.type}</div>
                        </a>
                    `;
                });
                html += '</div>';
                searchResults.innerHTML = html;
                searchResults.style.display = 'block';
            } else {
                searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
                searchResults.style.display = 'block';
            }
        }
    }

    // ====================
    // SOCIAL MEDIA INTEGRATION
    // ====================

    // Add social share buttons to products and services
    const shareButtons = document.querySelectorAll('.share-button');
    shareButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const url = window.location.href;
            const title = document.title;
            
            const socialType = this.dataset.social;
            let shareUrl = '';
            
            switch(socialType) {
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                    break;
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                    break;
                case 'linkedin':
                    shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                    break;
                case 'whatsapp':
                    shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' - ' + url)}`;
                    break;
            }
            
            if (shareUrl) {
                window.open(shareUrl, '_blank', 'width=600,height=400');
            }
        });
    });

    // ====================
    // ANALYTICS AND TRACKING
    // ====================

    // Track scroll depth
    let scrollDepthTracked = false;
    window.addEventListener('scroll', function() {
        if (!scrollDepthTracked && window.pageYOffset > window.innerHeight * 0.5) {
            scrollDepthTracked = true;
            if (typeof gtag !== 'undefined') {
                gtag('event', 'scroll_depth', {
                    'depth': '50%'
                });
            }
        }
    });

    // Track time on page
    let timeOnPage = 0;
    setInterval(() => {
        timeOnPage++;
        if (timeOnPage >= 30 && timeOnPage % 30 === 0) {
            if (typeof gtag !== 'undefined') {
                gtag('event', 'time_on_page', {
                    'minutes': Math.floor(timeOnPage / 60)
                });
            }
        }
    }, 1000);

    // ====================
    // ERROR HANDLING
    // ====================

    // Handle image loading errors
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            // Replace broken images with placeholder
            this.src = `https://via.placeholder.com/${this.width || 400}x${this.height || 300}/1e3a8a/ffffff?text=Image+Not+Found`;
            this.alt = 'Image not available';
        });
    });

    console.log('Power Flow Services - Website enhancements loaded');
});
