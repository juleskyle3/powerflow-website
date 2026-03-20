const WebsiteContent = require('../models/WebsiteContent');
const { AppError } = require('../middleware/errorMiddleware');

const websiteContentController = {};

const SECTION_FIELDS = {
  hero: ['title', 'subtitle', 'description', 'primaryButtonText', 'secondaryButtonText'],
  about: ['title', 'subtitle', 'description', 'additionalDescription'],
  contact: ['primaryPhone', 'secondaryPhone', 'emailAddress', 'address', 'websiteUrl'],
  social: ['linkedinUrl', 'facebookUrl', 'twitterUrl', 'instagramUrl'],
  seo: ['metaTitle', 'metaKeywords', 'metaDescription'],
};

const FIELD_LIMITS = {
  hero: {
    title: 250,
    subtitle: 300,
    description: 1000,
    primaryButtonText: 120,
    secondaryButtonText: 120,
  },
  about: {
    title: 250,
    subtitle: 300,
    description: 3000,
    additionalDescription: 3000,
  },
  contact: {
    primaryPhone: 50,
    secondaryPhone: 50,
    emailAddress: 320,
    address: 500,
    websiteUrl: 500,
  },
  social: {
    linkedinUrl: 500,
    facebookUrl: 500,
    twitterUrl: 500,
    instagramUrl: 500,
  },
  seo: {
    metaTitle: 300,
    metaKeywords: 1000,
    metaDescription: 1000,
  },
};

function sanitizeString(value, limit = 1000) {
  return String(value ?? '')
    .trim()
    .slice(0, limit);
}

function getEmptyContentShape() {
  return Object.keys(SECTION_FIELDS).reduce((acc, section) => {
    acc[section] = {};
    return acc;
  }, {});
}

function normalizeContent(doc) {
  const raw = doc ? doc.toObject() : getEmptyContentShape();
  const normalized = {};

  Object.entries(SECTION_FIELDS).forEach(([section, fields]) => {
    normalized[section] = {};
    fields.forEach((field) => {
      normalized[section][field] = sanitizeString(raw?.[section]?.[field], getFieldLimit(section, field));
    });
  });

  return normalized;
}

function pickSectionPayload(section, payload) {
  const fields = SECTION_FIELDS[section] || [];
  const normalizedPayload = {};

  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload || {}, field)) {
      normalizedPayload[field] = sanitizeString(payload[field], getFieldLimit(section, field));
    }
  });

  return normalizedPayload;
}

async function getOrCreateWebsiteContent() {
  let doc = await WebsiteContent.findOne({ key: 'main' });
  if (!doc) {
    doc = await WebsiteContent.create({ key: 'main' });
  }
  return doc;
}

websiteContentController.getWebsiteContent = async (req, res, next) => {
  try {
    const doc = await getOrCreateWebsiteContent();

    res.status(200).json({
      success: true,
      data: {
        content: normalizeContent(doc),
      },
    });
  } catch (error) {
    next(error);
  }
};

websiteContentController.updateWebsiteContentSection = async (req, res, next) => {
  try {
    const section = sanitizeString(req.params.section, 40).toLowerCase();
    if (!SECTION_FIELDS[section]) {
      throw new AppError(`Invalid section. Allowed sections: ${Object.keys(SECTION_FIELDS).join(', ')}`, 400);
    }

    const payload = pickSectionPayload(section, req.body || {});
    if (Object.keys(payload).length === 0) {
      throw new AppError(`No valid fields provided for section "${section}"`, 400);
    }

    const doc = await getOrCreateWebsiteContent();
    const currentSection = normalizeContent(doc)[section];
    doc[section] = {
      ...currentSection,
      ...payload,
    };

    await doc.save();

    res.status(200).json({
      success: true,
      message: `${section} content updated successfully`,
      data: {
        content: normalizeContent(doc),
      },
    });
  } catch (error) {
    next(error);
  }
};

websiteContentController.updateWebsiteContent = async (req, res, next) => {
  try {
    const doc = await getOrCreateWebsiteContent();
    const input = req.body || {};

    Object.keys(SECTION_FIELDS).forEach((section) => {
      if (!input[section] || typeof input[section] !== 'object') return;
      const sectionPayload = pickSectionPayload(section, input[section]);
      if (Object.keys(sectionPayload).length === 0) return;

      doc[section] = {
        ...normalizeContent(doc)[section],
        ...sectionPayload,
      };
    });

    await doc.save();

    res.status(200).json({
      success: true,
      message: 'Website content updated successfully',
      data: {
        content: normalizeContent(doc),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = websiteContentController;
function getFieldLimit(section, field) {
  return FIELD_LIMITS?.[section]?.[field] || 1000;
}
