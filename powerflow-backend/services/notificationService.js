const axios = require('axios');
const Order = require('../models/Order');
const gmailService = require('./gmailService');
const { isEmailConfigured, isSmtpConfigured, sendTransactionalEmail } = require('./emailService');

const COMPANY = {
  name: 'Power Flow Services Ltd',
  shortName: 'Power Flow',
  address: 'Kigali - Gasabo - Kimihurura',
  phone: '+250 781 393 649',
  email: 'powerflowservicesltd@gmail.com',
  website: 'https://www.powerflowservicesltd.com',
};

const BRAND = {
  primary: '#4c62a8',
  primaryDark: '#38497f',
  ink: '#111827',
  body: '#374151',
  muted: '#6b7280',
  border: '#e5e7eb',
  soft: '#f5f7fc',
  success: '#047857',
  warning: '#b45309',
  danger: '#b91c1c',
};

const ALERT_STATUS = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const DEFAULT_ALERT_EMAIL = COMPANY.email;
const DEFAULT_ALERT_PHONE = '+250781393649';
const DEFAULT_ADMIN_ORDERS_URL = 'https://admin.powerflowservicesltd.com/pages/orders.html';

function boolEnv(name, fallback) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function sanitizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  const amount = Number(value);
  return `RWF ${Number.isFinite(amount) ? amount.toLocaleString('en-US') : '0'}`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Kigali',
    timeZoneName: 'short',
  });
}

function normalizePhone(raw) {
  let value = sanitizeText(raw).replace(/[\s().-]+/g, '');
  if (!value) return '';

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith('0')) {
    const countryCode = sanitizeText(process.env.SMS_DEFAULT_COUNTRY_CODE || '250').replace(/\D/g, '') || '250';
    value = `+${countryCode}${value.replace(/^0+/, '')}`;
  } else if (!value.startsWith('+')) {
    const countryCode = sanitizeText(process.env.SMS_DEFAULT_COUNTRY_CODE || '250').replace(/\D/g, '') || '250';
    // Avoid doubling the country code when the number already includes it.
    value = value.startsWith(countryCode)
      ? `+${value}`
      : `+${countryCode}${value.replace(/^0+/, '')}`;
  }

  return value;
}

function getAlertConfig() {
  return {
    email: sanitizeText(process.env.ADMIN_ALERT_EMAIL, DEFAULT_ALERT_EMAIL) || DEFAULT_ALERT_EMAIL,
    phone: normalizePhone(process.env.ADMIN_ALERT_PHONE || DEFAULT_ALERT_PHONE),
    emailEnabled: boolEnv('ADMIN_ALERT_EMAIL_ENABLED', true),
    smsEnabled: boolEnv('ADMIN_ALERT_SMS_ENABLED', true),
    adminOrdersUrl: sanitizeText(process.env.ADMIN_ORDERS_URL, DEFAULT_ADMIN_ORDERS_URL) || DEFAULT_ADMIN_ORDERS_URL,
  };
}

function getSmsConfig() {
  const baseUrl = sanitizeText(process.env.AFRICASTALKING_BASE_URL, 'https://api.africastalking.com')
    .replace(/\/+$/, '') || 'https://api.africastalking.com';

  return {
    username: sanitizeText(process.env.AFRICASTALKING_USERNAME),
    apiKey: sanitizeText(process.env.AFRICASTALKING_API_KEY),
    senderId: sanitizeText(process.env.AFRICASTALKING_SENDER_ID),
    baseUrl,
    timeoutMs: Number(process.env.SMS_REQUEST_TIMEOUT_MS || 15000),
  };
}

function isSmsConfigured() {
  const config = getSmsConfig();
  return Boolean(config.username && config.apiKey && config.baseUrl);
}

function isGmailProvider() {
  const provider = sanitizeText(process.env.EMAIL_PROVIDER, 'auto').toLowerCase();
  if (provider === 'gmail-oauth') return true;
  if (provider === 'smtp') return false;
  return true;
}

function buildAdminOrderUrl(order) {
  const config = getAlertConfig();

  try {
    const url = new URL(config.adminOrdersUrl);
    if (order && order._id) {
      url.searchParams.set('order', String(order._id));
    }
    return url.toString();
  } catch (_) {
    return config.adminOrdersUrl;
  }
}

function buildOrderAlertText(order, invoiceUrl) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.map((item) => {
    const name = sanitizeText(item.productName || item.productId?.name, 'Product');
    const quantity = Number(item.quantity || 0);
    const lineTotal = Number(item.price || 0) * quantity;
    return `- ${quantity} x ${name} (${formatCurrency(item.price)}) = ${formatCurrency(lineTotal)}`;
  });

  return [
    `${COMPANY.name.toUpperCase()} - NEW ORDER ALERT`,
    '',
    `Order: ${sanitizeText(order.invoiceNumber, '-')}`,
    `Placed: ${formatDateTime(order.createdAt)}`,
    `Customer: ${sanitizeText(order.customerName, '-')}`,
    `Email: ${sanitizeText(order.customerEmail, '-')}`,
    `Phone: ${sanitizeText(order.customerPhone, '-')}`,
    `Delivery: ${sanitizeText(order.customerAddress, '-')}`,
    `Shipping: ${sanitizeText(order.shippingMethod, 'Standard')}`,
    '',
    'ITEMS',
    ...(itemLines.length ? itemLines : ['- No items recorded']),
    '',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Delivery: ${formatCurrency(order.shippingCost)}`,
    `Tax: ${formatCurrency(order.tax)}`,
    `TOTAL: ${formatCurrency(order.totalAmount)}`,
    '',
    order.notes ? `Customer notes: ${sanitizeText(order.notes)}` : '',
    '',
    `Open this order in the admin portal: ${buildAdminOrderUrl(order)}`,
    invoiceUrl ? `Download the invoice PDF: ${invoiceUrl}` : '',
    '',
    'This alert was sent automatically when the order was placed.',
  ].filter(Boolean).join('\n');
}

function buildOrderAlertHtml(order, invoiceUrl) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const adminOrderUrl = buildAdminOrderUrl(order);
  const orderNumber = sanitizeText(order.invoiceNumber, 'New order');
  const customerName = sanitizeText(order.customerName, 'Customer');

  const itemRows = items.length
    ? items.map((item) => {
      const name = sanitizeText(item.productName || item.productId?.name, 'Product');
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.price || 0);
      const lineTotal = unitPrice * quantity;

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BRAND.ink};">
            <strong style="font-weight:600;">${escapeHtml(name)}</strong>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BRAND.body};text-align:center;white-space:nowrap;">
            ${quantity}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BRAND.body};text-align:right;white-space:nowrap;">
            ${escapeHtml(formatCurrency(unitPrice))}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BRAND.ink};text-align:right;white-space:nowrap;font-weight:600;">
            ${escapeHtml(formatCurrency(lineTotal))}
          </td>
        </tr>
      `;
    }).join('')
    : `
      <tr>
        <td colspan="4" style="padding:18px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.muted};">
          No items were recorded for this order.
        </td>
      </tr>
    `;

  const totalRow = (label, value, options = {}) => `
    <tr>
      <td style="padding:${options.total ? '12px 0 0' : '5px 0'};font-family:Arial,Helvetica,sans-serif;font-size:${options.total ? '15px' : '13px'};line-height:20px;color:${options.total ? BRAND.ink : BRAND.muted};text-align:right;font-weight:${options.total ? '700' : '400'};">
        ${escapeHtml(label)}
      </td>
      <td style="padding:${options.total ? '12px 0 0' : '5px 0'};font-family:Arial,Helvetica,sans-serif;font-size:${options.total ? '18px' : '13px'};line-height:20px;color:${options.total ? BRAND.primary : BRAND.body};text-align:right;white-space:nowrap;font-weight:${options.total ? '700' : '600'};">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;

  const detailRow = (label, value, isLast = false) => `
    <tr>
      <td style="padding:7px 0;${isLast ? '' : `border-bottom:1px solid ${BRAND.border};`}font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${BRAND.muted};width:112px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:7px 0;${isLast ? '' : `border-bottom:1px solid ${BRAND.border};`}font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${BRAND.ink};vertical-align:top;">
        ${value}
      </td>
    </tr>
  `;

  const metricCell = (label, value) => `
    <td width="33.33%" style="padding:18px 14px;background:${BRAND.soft};border-right:1px solid #e8edf7;text-align:center;vertical-align:top;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.muted};">
        ${escapeHtml(label)}
      </div>
      <div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};">
        ${escapeHtml(value)}
      </div>
    </td>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>New order ${escapeHtml(orderNumber)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    New order ${escapeHtml(orderNumber)} from ${escapeHtml(customerName)} - ${escapeHtml(formatCurrency(order.totalAmount))}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f8;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,0.12);">
          <tr>
            <td style="background-color:${BRAND.primary};padding:26px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;vertical-align:middle;">
                    <div style="font-size:12px;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;opacity:0.82;">Power Flow</div>
                    <div style="margin-top:3px;font-size:19px;line-height:24px;font-weight:700;letter-spacing:0.4px;">SERVICES LTD</div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:8px 13px;border-radius:999px;background-color:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;letter-spacing:1.2px;text-transform:uppercase;color:#ffffff;font-weight:700;">
                      New order
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 32px 4px;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.ink};">
                New order received
              </h1>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:${BRAND.body};">
                ${escapeHtml(customerName)} just placed order <strong style="color:${BRAND.primary};">${escapeHtml(orderNumber)}</strong> on the website.
              </p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                Placed ${escapeHtml(formatDateTime(order.createdAt))}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e8edf7;border-radius:12px;overflow:hidden;">
                <tr>
                  ${metricCell('Order total', formatCurrency(order.totalAmount))}
                  ${metricCell('Items', String(itemCount))}
                  ${metricCell('Status', sanitizeText(order.status, 'Pending'))}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 0;">
              <h2 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};">
                Customer &amp; delivery
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.soft};border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${detailRow('Customer', `<strong style="font-weight:600;color:${BRAND.ink};">${escapeHtml(customerName)}</strong>`)}
                      ${detailRow('Email', `<a href="mailto:${escapeHtml(sanitizeText(order.customerEmail))}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(sanitizeText(order.customerEmail, '-'))}</a>`)}
                      ${detailRow('Phone', `<a href="tel:${escapeHtml(sanitizeText(order.customerPhone))}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(sanitizeText(order.customerPhone, '-'))}</a>`)}
                      ${detailRow('Delivery', escapeHtml(sanitizeText(order.customerAddress, '-')))}
                      ${detailRow('Shipping', escapeHtml(sanitizeText(order.shippingMethod, 'Standard')), true)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 0;">
              <h2 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};">
                Order items
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <th align="left" style="padding:10px 0 8px;border-bottom:2px solid #edf0f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;">Product</th>
                  <th align="center" style="padding:10px 0 8px;border-bottom:2px solid #edf0f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;width:52px;">Qty</th>
                  <th align="right" style="padding:10px 0 8px;border-bottom:2px solid #edf0f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;width:105px;">Unit price</th>
                  <th align="right" style="padding:10px 0 8px;border-bottom:2px solid #edf0f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.muted};font-weight:700;width:105px;">Amount</th>
                </tr>
                ${itemRows}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
                <tr>
                  <td width="58%"></td>
                  <td width="42%">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${totalRow('Subtotal', formatCurrency(order.subtotal))}
                      ${totalRow('Delivery', formatCurrency(order.shippingCost))}
                      ${Number(order.tax || 0) > 0 ? totalRow('Tax', formatCurrency(order.tax)) : ''}
                      ${totalRow('Total', formatCurrency(order.totalAmount), { total: true })}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${sanitizeText(order.notes) ? `
          <tr>
            <td style="padding:22px 32px 0;">
              <div style="padding:14px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#92400e;">
                <strong style="display:block;margin-bottom:3px;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;">Customer notes</strong>
                ${escapeHtml(sanitizeText(order.notes))}
              </div>
            </td>
          </tr>
          ` : ''}

          <tr>
            <td align="center" style="padding:28px 32px 10px;">
              <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;padding:14px 26px;border-radius:9px;background-color:${BRAND.primary};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none;">
                Open order in Admin Portal
              </a>
              ${invoiceUrl ? `
              <div style="margin-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                or <a href="${escapeHtml(invoiceUrl)}" style="color:${BRAND.primary};text-decoration:underline;">download the invoice PDF</a>
              </div>
              ` : ''}
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 28px;">
              <div style="border-top:1px solid ${BRAND.border};padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:${BRAND.muted};text-align:center;">
                <strong style="color:${BRAND.body};">${escapeHtml(COMPANY.name)}</strong><br>
                ${escapeHtml(COMPANY.address)} &nbsp;|&nbsp; ${escapeHtml(COMPANY.phone)}<br>
                <a href="mailto:${escapeHtml(COMPANY.email)}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(COMPANY.email)}</a>
                &nbsp;|&nbsp;
                <a href="${escapeHtml(COMPANY.website)}" style="color:${BRAND.primary};text-decoration:none;">powerflowservicesltd.com</a>
                <div style="margin-top:10px;color:#9ca3af;">
                  This alert was sent automatically when the order was placed. Do not reply to this email.
                </div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOrderAlertEmail(order, invoiceUrl = '') {
  const orderNumber = sanitizeText(order?.invoiceNumber, 'New order').replace(/[\r\n]+/g, ' ');
  const customerName = sanitizeText(order?.customerName, 'Customer').replace(/[\r\n]+/g, ' ');

  return {
    subject: `New order ${orderNumber} - ${formatCurrency(order?.totalAmount)} - ${customerName}`,
    text: buildOrderAlertText(order, invoiceUrl),
    html: buildOrderAlertHtml(order, invoiceUrl),
  };
}

function buildTestAlertEmail() {
  const config = getAlertConfig();

  return {
    subject: 'Test alert - Power Flow admin notifications',
    text: [
      'POWER FLOW SERVICES LTD - TEST ALERT',
      '',
      'This is a test of the admin order notification system.',
      `Recipient: ${config.email}`,
      `Sent: ${formatDateTime(new Date())}`,
      '',
      'If you received this email, branded order alert emails are working.',
    ].join('\n'),
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#eef2f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f8;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND.primary};padding:24px 30px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
              <div style="font-size:11px;letter-spacing:2.2px;text-transform:uppercase;opacity:0.82;">Power Flow</div>
              <div style="margin-top:3px;font-size:18px;font-weight:700;">SERVICES LTD</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:23px;line-height:30px;color:${BRAND.ink};">Test alert</h1>
              <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.body};">
                This is a test of the admin order notification system. If you received this message, order alert emails are configured correctly.
              </p>
              <div style="padding:14px 16px;background-color:${BRAND.soft};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.body};">
                <strong style="color:${BRAND.ink};">Recipient:</strong> ${escapeHtml(config.email)}<br>
                <strong style="color:${BRAND.ink};">Sent:</strong> ${escapeHtml(formatDateTime(new Date()))}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:${BRAND.muted};">
              ${escapeHtml(COMPANY.name)} &nbsp;|&nbsp; ${escapeHtml(COMPANY.phone)} &nbsp;|&nbsp; ${escapeHtml(COMPANY.email)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

async function sendSmsAlert(message) {
  const config = getSmsConfig();
  const alertConfig = getAlertConfig();

  if (!isSmsConfigured()) {
    throw new Error('SMS alerts are not configured. Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY.');
  }

  if (!alertConfig.phone) {
    throw new Error('No admin phone number is configured. Set ADMIN_ALERT_PHONE.');
  }

  const form = new URLSearchParams();
  form.append('username', config.username);
  form.append('to', alertConfig.phone);
  form.append('message', message);
  if (config.senderId) {
    form.append('from', config.senderId);
  }

  const response = await axios.post(
    `${config.baseUrl}/version1/messaging`,
    form.toString(),
    {
      headers: {
        apiKey: config.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: config.timeoutMs,
      validateStatus: () => true,
    }
  );

  const responseMessage = sanitizeText(response.data?.SMSMessageData?.Message);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Africa's Talking returned HTTP ${response.status}${responseMessage ? `: ${responseMessage}` : ''}`
    );
  }

  const recipients = response.data?.SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('Africa\'s Talking accepted the request but returned no recipients.');
  }

  const failed = recipients.find((recipient) => String(recipient.status || '').toLowerCase() !== 'success');
  if (failed) {
    throw new Error(
      `SMS delivery failed: ${sanitizeText(failed.status, 'Unknown status')}${failed.statusCode ? ` (${failed.statusCode})` : ''}`
    );
  }

  return {
    messageId: recipients[0].messageId || null,
    network: recipients[0].network || null,
    cost: recipients[0].cost || null,
  };
}

function toErrorText(error) {
  const message = sanitizeText(error?.message || error || 'Unknown notification error');
  return message.slice(0, 900);
}

async function sendEmailResult({ subject, text, html }) {
  const config = getAlertConfig();

  if (!config.emailEnabled) {
    return { status: ALERT_STATUS.SKIPPED, error: 'Admin email alerts are disabled.' };
  }

  if (!config.email) {
    return { status: ALERT_STATUS.SKIPPED, error: 'No admin alert email is configured.' };
  }

  try {
    const result = await sendTransactionalEmail({
      to: config.email,
      subject,
      text,
      html,
    });

    return { status: ALERT_STATUS.SENT, provider: result?.provider || null, error: '' };
  } catch (error) {
    return { status: ALERT_STATUS.FAILED, error: toErrorText(error) };
  }
}

async function sendSmsResult(message) {
  const config = getAlertConfig();

  if (!config.smsEnabled) {
    return { status: ALERT_STATUS.SKIPPED, error: 'Admin SMS alerts are disabled.' };
  }

  if (!config.phone) {
    return { status: ALERT_STATUS.SKIPPED, error: 'No admin alert phone number is configured.' };
  }

  if (!isSmsConfigured()) {
    return {
      status: ALERT_STATUS.SKIPPED,
      error: 'SMS is enabled but Africa\'s Talking credentials are not configured.',
    };
  }

  try {
    const result = await sendSmsAlert(message);
    return { status: ALERT_STATUS.SENT, provider: 'africastalking', ...result, error: '' };
  } catch (error) {
    return { status: ALERT_STATUS.FAILED, error: toErrorText(error) };
  }
}

function buildOrderSmsText(order) {
  const orderNumber = sanitizeText(order.invoiceNumber, 'new order');
  const customerName = sanitizeText(order.customerName, 'a customer');
  const itemCount = (Array.isArray(order.items) ? order.items : [])
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return `POWER FLOW: New order ${orderNumber} from ${customerName}. Total ${formatCurrency(order.totalAmount)}. ${itemCount} item(s). Open the admin portal to process it.`;
}

async function deliverOrderAlert(order, options = {}) {
  const { invoiceUrl = '', trigger = 'automatic' } = options;
  const emailPayload = buildOrderAlertEmail(order, invoiceUrl);
  const smsText = buildOrderSmsText(order);

  const [emailResult, smsResult] = await Promise.all([
    sendEmailResult(emailPayload),
    sendSmsResult(smsText),
  ]);

  const now = new Date();
  const update = {
    adminAlertEmailStatus: emailResult.status,
    adminAlertEmailSentAt: emailResult.status === ALERT_STATUS.SENT ? now : null,
    adminAlertEmailError: emailResult.status === ALERT_STATUS.SENT ? '' : emailResult.error,
    adminAlertSmsStatus: smsResult.status,
    adminAlertSmsSentAt: smsResult.status === ALERT_STATUS.SENT ? now : null,
    adminAlertSmsError: smsResult.status === ALERT_STATUS.SENT ? '' : smsResult.error,
    adminAlertLastAttemptAt: now,
    adminAlertLastTrigger: sanitizeText(trigger, 'automatic').slice(0, 50),
  };

  if (order && order._id) {
    await Order.updateOne({ _id: order._id }, { $set: update });
  }

  return {
    email: emailResult,
    sms: smsResult,
    attemptedAt: now.toISOString(),
  };
}

async function sendTestAlert(channel = 'both') {
  const normalized = ['email', 'sms', 'both'].includes(String(channel).toLowerCase())
    ? String(channel).toLowerCase()
    : 'both';

  const results = {};

  if (normalized === 'email' || normalized === 'both') {
    const payload = buildTestAlertEmail();
    results.email = await sendEmailResult(payload);
  }

  if (normalized === 'sms' || normalized === 'both') {
    results.sms = await sendSmsResult(
      `POWER FLOW: Test alert. Admin SMS notifications are working. ${formatDateTime(new Date())}`
    );
  }

  return results;
}

async function getNotificationStatus() {
  const config = getAlertConfig();
  const email = {
    enabled: config.emailEnabled,
    configured: isEmailConfigured(),
    provider: isGmailProvider() ? 'gmail-oauth' : 'smtp',
    authorized: null,
    ready: false,
    recipient: config.email,
    sender: sanitizeText(
      process.env.GMAIL_SENDER_EMAIL
      || process.env.SMTP_FROM
      || process.env.SMTP_USER
      || COMPANY.email
    ),
    error: '',
  };

  if (email.provider === 'gmail-oauth') {
    try {
      const gmailStatus = await gmailService.getAuthStatus();
      const provider = sanitizeText(process.env.EMAIL_PROVIDER, 'auto').toLowerCase();

      // In auto mode, fall back to reporting SMTP when Gmail credentials are
      // absent but SMTP is configured.
      if (provider === 'auto' && !gmailStatus.configured && isSmtpConfigured()) {
        email.provider = 'smtp';
        email.configured = true;
        email.authorized = null;
        email.ready = email.enabled && email.configured;
      } else {
        email.configured = Boolean(gmailStatus.configured);
        email.authorized = Boolean(gmailStatus.authorized);
        email.ready = email.enabled && email.configured && email.authorized;
        email.recipient = config.email;
        email.sender = gmailStatus.configuredSender || email.sender;
        email.error = gmailStatus.authorizationError || '';
        email.oauthAccountEmail = gmailStatus.oauthAccountEmail || null;
      }
    } catch (error) {
      email.error = toErrorText(error);
      email.ready = false;
    }
  } else {
    email.authorized = null;
    email.ready = email.enabled && email.configured;
  }

  const smsConfig = getSmsConfig();
  const sms = {
    enabled: config.smsEnabled,
    configured: isSmsConfigured(),
    provider: 'africastalking',
    ready: config.smsEnabled && isSmsConfigured() && Boolean(config.phone),
    recipient: config.phone,
    senderId: smsConfig.senderId || null,
    sandbox: /sandbox\.africastalking\.com/i.test(smsConfig.baseUrl),
    error: '',
  };

  if (sms.enabled && !sms.configured) {
    sms.error = 'Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY to enable SMS alerts.';
  }

  return {
    recipients: {
      email: config.email,
      phone: config.phone,
    },
    email,
    sms,
    adminOrdersUrl: config.adminOrdersUrl,
  };
}

module.exports = {
  ALERT_STATUS,
  buildOrderAlertEmail,
  buildOrderAlertText,
  buildOrderSmsText,
  deliverOrderAlert,
  getAlertConfig,
  getNotificationStatus,
  isSmsConfigured,
  sendTestAlert,
};
