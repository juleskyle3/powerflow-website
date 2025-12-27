// ============================================
// MAIN JAVASCRIPT FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const headerOffset = 80;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Scroll Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements with animate-on-scroll class
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Counter Animation for Stats
    const statNumbers = document.querySelectorAll('.stat-number');
    const animateCounter = (element) => {
        const target = parseInt(element.textContent.replace(/\D/g, ''));
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                if (element.textContent.includes('+')) {
                    element.textContent = Math.floor(current) + '+';
                } else if (element.textContent.includes('%')) {
                    element.textContent = Math.floor(current) + '%';
                } else if (element.textContent.includes('/')) {
                    element.textContent = element.textContent.replace(/\d+/, Math.floor(current));
                } else {
                    element.textContent = Math.floor(current);
                }
                requestAnimationFrame(updateCounter);
            } else {
                if (element.textContent.includes('+')) {
                    element.textContent = target + '+';
                } else if (element.textContent.includes('%')) {
                    element.textContent = target + '%';
                } else if (element.textContent.includes('/')) {
                    element.textContent = element.textContent.replace(/\d+/, target);
                } else {
                    element.textContent = target;
                }
            }
        };

        updateCounter();
    };

    // Observe stat numbers
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });

    // Form Validation
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form elements
            const name = document.getElementById('name');
            const email = document.getElementById('email');
            const message = document.getElementById('message');
            const formMessage = document.getElementById('formMessage');

            // Basic validation
            let isValid = true;

            if (!name.value.trim()) {
                isValid = false;
                name.style.borderColor = 'var(--error-color)';
            } else {
                name.style.borderColor = 'var(--border-color)';
            }

            if (!email.value.trim() || !email.value.includes('@')) {
                isValid = false;
                email.style.borderColor = 'var(--error-color)';
            } else {
                email.style.borderColor = 'var(--border-color)';
            }

            if (!message.value.trim()) {
                isValid = false;
                message.style.borderColor = 'var(--error-color)';
            } else {
                message.style.borderColor = 'var(--border-color)';
            }

            if (isValid) {
                // Show success message
                formMessage.textContent = 'Thank you for your message! We will get back to you soon.';
                formMessage.className = 'form-message success';
                contactForm.reset();

                // In production, send form data to server
                // fetch('/api/contact', {
                //     method: 'POST',
                //     body: new FormData(contactForm)
                // });
            } else {
                formMessage.textContent = 'Please fill in all required fields correctly.';
                formMessage.className = 'form-message error';
            }
        });
    }

    // Back to Top Button (if exists)
    const backToTopBtn = document.querySelector('.back-to-top');
    if (backToTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Lazy Loading Images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Add animation classes on scroll
    const sections = document.querySelectorAll('.section-padding, .service-detail, .expertise-section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('section-fade-in', 'visible');
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => {
        section.classList.add('section-fade-in');
        sectionObserver.observe(section);
    });

    // LinkedIn preview modal: intercept clicks on LinkedIn social links
    (function() {
        const profileUrl = 'https://www.linkedin.com/in/kyle-jules-3kgl';

        // Create modal HTML and append to body
        function createModal() {
            const wrapper = document.createElement('div');
            wrapper.id = 'linkedin-preview-overlay';
            wrapper.className = 'linkedin-overlay';
            wrapper.style.display = 'none';
            wrapper.innerHTML = `
                <div class="linkedin-modal" role="dialog" aria-modal="true" aria-labelledby="linkedin-title">
                    <button class="linkedin-close" aria-label="Close">&times;</button>
                    <div class="linkedin-content">
                        <img src="images/logo.jpg" alt="Kyle Jules" class="linkedin-avatar">
                        <h3 id="linkedin-title">Kyle Jules</h3>
                        <p class="linkedin-headline">Power Flow Services Ltd — Technical Services</p>
                        <p class="linkedin-bio">Follow us on LinkedIn for company updates, product news, and service announcements.</p>
                        <div class="linkedin-actions">
                            <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary linkedin-open">Open on LinkedIn</a>
                            <button class="btn btn-outline-secondary linkedin-close-btn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper);

            // Event listeners for close/open
            const overlay = wrapper;
            const closeButtons = wrapper.querySelectorAll('.linkedin-close, .linkedin-close-btn');
            closeButtons.forEach(btn => btn.addEventListener('click', hideModal));
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) hideModal();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && overlay.style.display === 'flex') hideModal();
            });
        }

        function showModal(profileHref) {
            const overlay = document.getElementById('linkedin-preview-overlay') || null;
            if (!overlay) return;
            // If a custom href provided, update the Open button
            if (profileHref) {
                const openBtn = overlay.querySelector('.linkedin-open');
                if (openBtn) openBtn.href = profileHref;
            }
            overlay.style.display = 'flex';
        }

        function hideModal() {
            const overlay = document.getElementById('linkedin-preview-overlay') || null;
            if (!overlay) return;
            overlay.style.display = 'none';
        }

        // Initialize modal
        createModal();

        // Attach delegated click handler for LinkedIn anchors (keeps href as fallback)
        document.body.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (!a) return;
            const aria = (a.getAttribute('aria-label') || '').toLowerCase();
            const href = a.getAttribute('href') || profileUrl;
            if (aria.includes('linkedin')) {
                // Prevent immediate navigation; show preview instead
                e.preventDefault();
                showModal(href);
            }
        });
    })();
});

