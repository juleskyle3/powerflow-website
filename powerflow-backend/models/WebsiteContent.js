const mongoose = require('mongoose');

const websiteContentSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'main',
  },
  hero: {
    title: { type: String, default: 'Power Flow Services Ltd', maxlength: 250 },
    subtitle: { type: String, default: 'Technical Maintenance Services & Equipment Supply', maxlength: 300 },
    description: { type: String, default: 'Reliable Service. Quality Equipment. Expert Solutions.', maxlength: 1000 },
    primaryButtonText: { type: String, default: 'Get Started', maxlength: 120 },
    secondaryButtonText: { type: String, default: 'Our Services', maxlength: 120 },
  },
  about: {
    title: { type: String, default: 'About Power Flow Services Ltd', maxlength: 250 },
    subtitle: { type: String, default: 'Your Trusted Technical Maintenance Partner', maxlength: 300 },
    description: {
      type: String,
      default: 'Power Flow Services Ltd provides reliable technical maintenance services and equipment supply across electrical, electronic, and plumbing systems. We are committed to helping homes, businesses, and industries run smoothly with minimal downtime and maximum efficiency.',
      maxlength: 3000,
    },
    additionalDescription: {
      type: String,
      default: 'With years of experience and a team of certified professionals, we deliver exceptional service quality that exceeds expectations.',
      maxlength: 3000,
    },
  },
  contact: {
    primaryPhone: { type: String, default: '+250 781 393 649', maxlength: 50 },
    secondaryPhone: { type: String, default: '+250 790 419 970', maxlength: 50 },
    emailAddress: { type: String, default: 'powerflowservicesltd@gmail.com', maxlength: 320 },
    address: { type: String, default: 'Kigali - Gasabo - Kimihurura', maxlength: 500 },
    websiteUrl: { type: String, default: 'https://www.powerflowservices.com', maxlength: 500 },
  },
  social: {
    linkedinUrl: { type: String, default: 'https://www.linkedin.com/in/kyle-jules-3kgl', maxlength: 500 },
    facebookUrl: { type: String, default: 'https://facebook.com/powerflowservices', maxlength: 500 },
    twitterUrl: { type: String, default: 'https://twitter.com/powerflowservices', maxlength: 500 },
    instagramUrl: { type: String, default: 'https://instagram.com/powerflowservices', maxlength: 500 },
  },
  seo: {
    metaTitle: { type: String, default: 'Power Flow Services Ltd - Technical Maintenance & Equipment Supply', maxlength: 300 },
    metaKeywords: { type: String, default: 'electrical maintenance, plumbing services, electronic equipment, technical maintenance, Rwanda, Kigali', maxlength: 1000 },
    metaDescription: { type: String, default: 'Power Flow Services Ltd - Technical Maintenance Services & Equipment Supply. Reliable Service. Quality Equipment. Expert Solutions.', maxlength: 1000 },
  },
}, {
  timestamps: true,
});

websiteContentSchema.index({ key: 1 }, { unique: true });

const WebsiteContent = mongoose.model('WebsiteContent', websiteContentSchema);

module.exports = WebsiteContent;
