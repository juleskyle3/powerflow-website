// ============================================
// SLIDER FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const heroSlides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    let slideInterval;

    // Auto-slide functionality (if multiple slides exist)
    if (heroSlides.length > 1) {
        function showSlide(index) {
            heroSlides.forEach((slide, i) => {
                slide.classList.remove('active');
                if (i === index) {
                    slide.classList.add('active');
                }
            });
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % heroSlides.length;
            showSlide(currentSlide);
        }

        function startSlider() {
            slideInterval = setInterval(nextSlide, 5000); // Change slide every 5 seconds
        }

        function stopSlider() {
            clearInterval(slideInterval);
        }

        // Start auto-slide
        startSlider();

        // Pause on hover
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            heroSection.addEventListener('mouseenter', stopSlider);
            heroSection.addEventListener('mouseleave', startSlider);
        }
    }

    // Testimonials Slider (if exists)
    const testimonialsSlider = document.querySelector('.testimonials-slider');
    if (testimonialsSlider) {
        const testimonials = testimonialsSlider.querySelectorAll('.testimonial');
        let currentTestimonial = 0;

        function showTestimonial(index) {
            testimonials.forEach((testimonial, i) => {
                testimonial.classList.remove('active');
                if (i === index) {
                    testimonial.classList.add('active');
                }
            });
        }

        function nextTestimonial() {
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(currentTestimonial);
        }

        // Auto-rotate testimonials
        if (testimonials.length > 1) {
            setInterval(nextTestimonial, 4000);
        }
    }
});

