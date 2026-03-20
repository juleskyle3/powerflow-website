const net = require('net');
const tls = require('tls');
const readline = require('readline');
const { once } = require('events');
const fs = require('fs');
const path = require('path');
const gmailService = require('./gmailService');

const DEFAULT_INVOICE_SENDER_EMAIL = 'powerflowservicesltd@gmail.com';
const DEFAULT_INVOICE_SENDER_NAME = 'Power Flow Services Ltd';

function parseFrom(fromInput, fallbackEmail) {
  const raw = (fromInput || '').trim();
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    const email = match[2].trim();
    return {
      name: name || 'Power Flow Services',
      email: email || fallbackEmail,
      formatted: `"${name || DEFAULT_INVOICE_SENDER_NAME}" <${email || fallbackEmail}>`,
    };
  }

  if (raw.includes('@')) {
    return {
      name: DEFAULT_INVOICE_SENDER_NAME,
      email: raw,
      formatted: `"${DEFAULT_INVOICE_SENDER_NAME}" <${raw}>`,
    };
  }

  return {
    name: DEFAULT_INVOICE_SENDER_NAME,
    email: fallbackEmail,
    formatted: `"${DEFAULT_INVOICE_SENDER_NAME}" <${fallbackEmail}>`,
  };
}

function createLineReader(stream) {
  const queue = [];
  const waiters = [];
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const onLine = (line) => {
    if (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter.resolve(line);
      return;
    }
    queue.push(line);
  };

  const onError = (error) => {
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter.reject(error);
    }
  };

  rl.on('line', onLine);
  stream.on('error', onError);

  return {
    async nextLine() {
      if (queue.length > 0) {
        return queue.shift();
      }

      return new Promise((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
    close() {
      rl.close();
      stream.off('error', onError);
    },
  };
}

function assertResponseCode(response, expectedCodes, commandLabel) {
  if (expectedCodes.includes(response.code)) {
    return;
  }

  throw new Error(
    `SMTP command failed (${commandLabel}): ${response.code} ${response.lines.join(' | ')}`
  );
}

async function readResponse(nextLine) {
  const firstLine = await nextLine();

  if (!/^\d{3}[\s-]/.test(firstLine)) {
    throw new Error(`Unexpected SMTP response: ${firstLine}`);
  }

  const code = Number(firstLine.slice(0, 3));
  const lines = [firstLine];

  if (firstLine[3] === '-') {
    while (true) {
      const line = await nextLine();
      lines.push(line);
      if (line.startsWith(`${code} `)) {
        break;
      }
    }
  }

  return { code, lines };
}

function writeLine(socket, command) {
  return new Promise((resolve, reject) => {
    socket.write(`${command}\r\n`, 'utf8', (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function writeRaw(socket, payload) {
  return new Promise((resolve, reject) => {
    socket.write(payload, 'utf8', (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function wrapBase64(base64Text, width = 76) {
  const rows = [];
  for (let i = 0; i < base64Text.length; i += width) {
    rows.push(base64Text.slice(i, i + width));
  }
  return rows.join('\r\n');
}

function dotStuff(text) {
  return text.replace(/(^|\r\n)\./g, '$1..');
}

function buildMessage({ from, to, subject, html, text, attachmentBuffer, attachmentName }) {
  const boundary = `----=_PowerFlow_${Date.now().toString(16)}`;
  const encodedAttachment = wrapBase64(attachmentBuffer.toString('base64'));

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    '',
    encodedAttachment,
    '',
    `--${boundary}--`,
    '',
  ];

  return dotStuff(lines.join('\r\n'));
}

async function openSocket({ host, port, secure }) {
  if (secure) {
    const socket = tls.connect({ host, port, servername: host });
    await once(socket, 'secureConnect');
    return socket;
  }

  const socket = net.createConnection({ host, port });
  await once(socket, 'connect');
  return socket;
}

async function upgradeToTLS(socket, host) {
  const secureSocket = tls.connect({ socket, servername: host });
  await once(secureSocket, 'secureConnect');
  return secureSocket;
}

async function sendMessageViaSmtp({ host, port, secure, user, password, from, to, message, clientHost }) {
  let socket = await openSocket({ host, port, secure });
  let reader = createLineReader(socket);

  const nextLine = () => reader.nextLine();

  try {
    let response = await readResponse(nextLine);
    assertResponseCode(response, [220], 'connect');

    await writeLine(socket, `EHLO ${clientHost}`);
    response = await readResponse(nextLine);
    assertResponseCode(response, [250], 'EHLO');

    if (!secure) {
      await writeLine(socket, 'STARTTLS');
      response = await readResponse(nextLine);
      assertResponseCode(response, [220], 'STARTTLS');

      reader.close();
      socket = await upgradeToTLS(socket, host);
      reader = createLineReader(socket);

      await writeLine(socket, `EHLO ${clientHost}`);
      response = await readResponse(() => reader.nextLine());
      assertResponseCode(response, [250], 'EHLO (TLS)');
    }

    await writeLine(socket, 'AUTH LOGIN');
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [334], 'AUTH LOGIN');

    await writeLine(socket, Buffer.from(user, 'utf8').toString('base64'));
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [334], 'AUTH LOGIN username');

    await writeLine(socket, Buffer.from(password, 'utf8').toString('base64'));
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [235], 'AUTH LOGIN password');

    await writeLine(socket, `MAIL FROM:<${from}>`);
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [250], 'MAIL FROM');

    await writeLine(socket, `RCPT TO:<${to}>`);
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [250, 251], 'RCPT TO');

    await writeLine(socket, 'DATA');
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [354], 'DATA');

    await writeRaw(socket, `${message}\r\n.\r\n`);
    response = await readResponse(() => reader.nextLine());
    assertResponseCode(response, [250], 'DATA body');

    await writeLine(socket, 'QUIT');
    await readResponse(() => reader.nextLine());
  } finally {
    reader.close();
    if (!socket.destroyed) {
      socket.end();
    }
  }
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
      && process.env.SMTP_PORT
      && process.env.SMTP_USER
      && process.env.SMTP_PASSWORD
      && process.env.SMTP_FROM
  );
}

function isGoogleCredentialsPresent() {
  // Render-friendly: allow env-only Gmail OAuth credentials.
  const envClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const envClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const envRedirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (envClientId && envClientSecret && envRedirectUri) {
    return true;
  }

  const configuredPath = process.env.GOOGLE_CREDENTIALS_PATH || 'credentials.json';
  const credentialsPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(path.join(__dirname, '..', configuredPath));

  return fs.existsSync(credentialsPath);
}

function isEmailConfigured() {
  const provider = String(process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

  if (provider === 'gmail-oauth') {
    return isGoogleCredentialsPresent();
  }

  if (provider === 'smtp') {
    return isSmtpConfigured();
  }

  return isSmtpConfigured() || isGoogleCredentialsPresent();
}

async function sendInvoiceEmail({
  customerEmail,
  customerName,
  invoiceNumber,
  orderId,
  orderTotal,
  invoiceBuffer,
}) {
  const firstUrl = (value) => String(value || '').split(',')[0].trim();
  const publicBaseUrl = (
    firstUrl(process.env.PUBLIC_APP_URL)
    || firstUrl(process.env.FRONTEND_PUBLIC_URL)
    || firstUrl(process.env.FRONTEND_URL)
    || firstUrl(process.env.BACKEND_PUBLIC_URL)
    || 'http://localhost:3000'
  ).replace(/\/+$/, '');

  // Point to the public website (recommended) because it proxies `/api/*` to the backend.
  const invoiceUrl = `${publicBaseUrl}/api/orders/${orderId}/invoice`;
  const subject = `Your Power Flow Invoice ${invoiceNumber}`;

  const textBody = [
    `Dear ${customerName},`,
    '',
    `Thank you for your order with Power Flow Services Ltd.`,
    `Invoice Number: ${invoiceNumber}`,
    `Order Total: RWF ${Number(orderTotal || 0).toLocaleString('en-US')}`,
    '',
    `Your invoice PDF is attached to this email.`,
    `You can also download it from: ${invoiceUrl}`,
    '',
    'Regards,',
    'Power Flow Services Ltd',
    '+250 781 393 649',
  ].join('\n');

  const htmlBody = `
<div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 640px; margin: 0 auto;">
  <h2 style="color: #1e3a8a; margin-bottom: 8px;">Power Flow Services Ltd</h2>
  <p style="margin: 0 0 16px;">Dear ${customerName},</p>
  <p style="margin: 0 0 12px;">Thank you for your order. Your invoice is ready.</p>
  <div style="background: #f8fafc; border: 1px solid #dbe3f0; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
    <p style="margin: 0 0 6px;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
    <p style="margin: 0;"><strong>Order Total:</strong> RWF ${Number(orderTotal || 0).toLocaleString('en-US')}</p>
  </div>
  <p style="margin: 0 0 14px;">The PDF invoice is attached. You can also download it here:</p>
  <p style="margin: 0 0 18px;"><a href="${invoiceUrl}" style="color: #1e3a8a;">${invoiceUrl}</a></p>
  <p style="margin: 0;">Regards,<br><strong>Power Flow Services Ltd</strong><br>+250 781 393 649</p>
</div>
`.trim();

  const provider = String(process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
  const forceGmailOAuth = provider === 'gmail-oauth';
  const forceSmtp = provider === 'smtp';

  if (forceGmailOAuth) {
    const gmailOnlyStatus = await gmailService.getAuthStatus();
    if (!gmailOnlyStatus.configured) {
      throw new Error(`Gmail OAuth is required but not configured: ${gmailOnlyStatus.error || 'missing credentials'}`);
    }

    await gmailService.sendEmail(
      customerEmail,
      subject,
      textBody,
      {
        html: htmlBody,
        from: process.env.GMAIL_SENDER_EMAIL
          || process.env.SMTP_FROM
          || process.env.SMTP_USER
          || DEFAULT_INVOICE_SENDER_EMAIL,
        attachments: [
          {
            filename: `${invoiceNumber}.pdf`,
            contentType: 'application/pdf',
            content: invoiceBuffer,
          },
        ],
      }
    );
    return;
  }

  // Primary provider in auto mode: Gmail API OAuth 2.0
  const gmailStatus = forceSmtp
    ? { configured: false }
    : await gmailService.getAuthStatus();

  if (gmailStatus.configured && !forceSmtp) {
    try {
      await gmailService.sendEmail(
        customerEmail,
        subject,
        textBody,
        {
          html: htmlBody,
          from: process.env.GMAIL_SENDER_EMAIL
            || process.env.SMTP_FROM
            || process.env.SMTP_USER
            || DEFAULT_INVOICE_SENDER_EMAIL,
          attachments: [
            {
              filename: `${invoiceNumber}.pdf`,
              contentType: 'application/pdf',
              content: invoiceBuffer,
            },
          ],
        }
      );
      return;
    } catch (gmailError) {
      // Fallback to SMTP if Gmail API cannot send.
      if (!isSmtpConfigured()) {
        throw new Error(`Gmail API send failed and SMTP fallback is not configured: ${gmailError.message}`);
      }
    }
  }

  if (!isSmtpConfigured()) {
    throw new Error('No email provider configured. Configure Gmail OAuth (/auth/google) or SMTP settings.');
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = parseFrom(process.env.SMTP_FROM, smtpUser || DEFAULT_INVOICE_SENDER_EMAIL);

  const message = buildMessage({
    from: smtpFrom.formatted,
    to: customerEmail,
    subject,
    text: textBody,
    html: htmlBody,
    attachmentBuffer: invoiceBuffer,
    attachmentName: `${invoiceNumber}.pdf`,
  });

  await sendMessageViaSmtp({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    password: smtpPassword,
    from: smtpFrom.email,
    to: customerEmail,
    message,
    clientHost: process.env.SMTP_CLIENT_NAME || 'localhost',
  });
}

module.exports = {
  isEmailConfigured,
  sendInvoiceEmail,
};
