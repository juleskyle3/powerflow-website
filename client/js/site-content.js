(function () {
  const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5050/api'
    : 'https://api.powerflowservicesltd.com/api';

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function phoneToTel(phone) {
    return normalizeText(phone).replace(/[^+\d]/g, '');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = normalizeText(value);
    if (next) el.textContent = next;
  }

  function setMeta(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = normalizeText(value);
    if (!next) return;

    if (el.tagName === 'TITLE') {
      el.textContent = next;
      return;
    }

    el.setAttribute('content', next);
  }

  function setPhone(role, phone) {
    const normalizedPhone = normalizeText(phone);
    if (!normalizedPhone) return;

    const tel = phoneToTel(normalizedPhone);
    document.querySelectorAll(`[data-content="phone-${role}"]`).forEach((el) => {
      if (el.tagName === 'A' && tel) {
        el.setAttribute('href', `tel:${tel}`);
      }
      el.textContent = normalizedPhone;
    });

    document.querySelectorAll(`[data-phone-href="${role}"]`).forEach((el) => {
      if (tel) {
        el.setAttribute('href', `tel:${tel}`);
      }
    });
  }

  function setEmail(email) {
    const normalizedEmail = normalizeText(email);
    if (!normalizedEmail) return;

    document.querySelectorAll('[data-content="email"]').forEach((el) => {
      if (el.tagName === 'A') {
        el.setAttribute('href', `mailto:${normalizedEmail}`);
      }
      el.textContent = normalizedEmail;
    });
  }

  function setAddress(address) {
    const normalizedAddress = normalizeText(address);
    if (!normalizedAddress) return;

    document.querySelectorAll('[data-content="address"]').forEach((el) => {
      el.textContent = normalizedAddress;
    });
  }

  function setWebsite(websiteUrl) {
    const normalizedUrl = normalizeText(websiteUrl);
    if (!normalizedUrl) return;

    const label = normalizedUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');

    document.querySelectorAll('[data-content="website"]').forEach((el) => {
      if (el.tagName === 'A') {
        el.setAttribute('href', normalizedUrl);
      }
      el.textContent = label || normalizedUrl;
    });
  }

  function setSocialLink(selector, url) {
    const normalizedUrl = normalizeText(url);
    document.querySelectorAll(selector).forEach((el) => {
      if (normalizedUrl) {
        el.setAttribute('href', normalizedUrl);
        el.style.removeProperty('display');
      } else {
        el.style.display = 'none';
      }
    });
  }

  function applyContent(content) {
    const hero = content?.hero || {};
    const about = content?.about || {};
    const contact = content?.contact || {};
    const social = content?.social || {};
    const seo = content?.seo || {};

    setMeta('metaTitleTag', seo.metaTitle);
    setMeta('metaDescriptionTag', seo.metaDescription);
    setMeta('metaKeywordsTag', seo.metaKeywords);

    setText('heroTitleText', hero.title);
    setText('heroSubtitleText', hero.subtitle);
    setText('heroDescriptionText', hero.description);
    setText('heroPrimaryBtnText', hero.primaryButtonText);
    setText('heroSecondaryBtnText', hero.secondaryButtonText);

    setText('aboutTitleText', about.title);
    setText('aboutSubtitleText', about.subtitle);
    setText('aboutDescriptionText', about.description);
    setText('aboutAdditionalText', about.additionalDescription);

    const companyName = normalizeText(hero.title);
    if (companyName) {
      document.querySelectorAll('[data-content="company-name"]').forEach((el) => {
        el.textContent = companyName;
      });
    }

    const footerDescription = [normalizeText(hero.subtitle), normalizeText(hero.description)]
      .filter(Boolean)
      .join('. ')
      .replace(/\.\s*\./g, '. ');
    setText('footerDescriptionText', footerDescription);

    setPhone('primary', contact.primaryPhone);
    setPhone('secondary', contact.secondaryPhone);
    setEmail(contact.emailAddress);
    setAddress(contact.address);
    setWebsite(contact.websiteUrl);

    setSocialLink('[data-social="linkedin"]', social.linkedinUrl);
    setSocialLink('[data-social="facebook"]', social.facebookUrl);
    setSocialLink('[data-social="twitter"]', social.twitterUrl);
    setSocialLink('[data-social="instagram"]', social.instagramUrl);

    const followWrap = document.getElementById('followLinkedinWrap');
    const followLinks = document.querySelectorAll('[data-social="linkedin-text"]');
    const linkedinUrl = normalizeText(social.linkedinUrl);
    if (linkedinUrl) {
      followLinks.forEach((link) => {
        link.setAttribute('href', linkedinUrl);
      });
      if (followWrap) {
        followWrap.style.removeProperty('display');
      }
    } else if (followWrap) {
      followWrap.style.display = 'none';
    }
  }

  async function loadSiteContent() {
    try {
      const response = await fetch(`${API_BASE_URL}/content`, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.success || !payload.data?.content) {
        throw new Error('Invalid content payload');
      }

      applyContent(payload.data.content);
    } catch (error) {
      console.warn('Website content API unavailable. Using static fallback content.', error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', loadSiteContent);
})();
