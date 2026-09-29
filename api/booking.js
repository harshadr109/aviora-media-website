// api/booking.js
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {}
};

function cleanInput(val) {
  if (typeof val !== 'string') return '';
  return sanitizeHtml(val.trim(), SANITIZE_OPTIONS).slice(0, 500);
}

export default async function handler(req, res) {
  // CORS & Methods
  res.setHeader('Access-Control-Allow-Origin', 'https://avioramedia.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fullname, email, phone, packageType, eventDetails, state, city, venue, eventDate, callTime } = req.body;

    // Strict Validation & Sanitization
    const data = {
      fullname: cleanInput(fullname),
      email: cleanInput(email),
      phone: cleanInput(phone).replace(/[^0-9]/g, ''),
      packageType: cleanInput(packageType),
      eventDetails: cleanInput(eventDetails),
      state: cleanInput(state),
      city: cleanInput(city),
      venue: cleanInput(venue),
      eventDate: cleanInput(eventDate),
      callTime: cleanInput(callTime)
    };

    if (!data.fullname || !data.phone || data.phone.length !== 10 || !data.packageType) {
      return res.status(400).json({ error: 'Invalid or incomplete form data.' });
    }

    const leadSummary = `*NEW BOOKING ENQUIRY - AVIORA MEDIA*\n\n` +
      `• *Client:* ${data.fullname}\n` +
      `• *Phone:* +91 ${data.phone}\n` +
      `• *Email:* ${data.email}\n` +
      `• *Package:* ${data.packageType}\n` +
      `• *Location:* ${data.venue}, ${data.city}, ${data.state}\n` +
      `• *Date:* ${data.eventDate}\n` +
      `• *Call Window:* ${data.callTime}\n` +
      `• *Brief:* ${data.eventDetails}`;

    // Dual Notification Channel 1: WhatsApp Dispatch (Meta Cloud API)
    const waPromise = process.env.META_WA_TOKEN ? fetch(`https://graph.facebook.com/v21.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.META_WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: process.env.ADMIN_PHONE_NUMBER, // e.g. 916364402815
        type: "text",
        text: { body: leadSummary }
      })
    }) : Promise.resolve();

    // Dual Notification Channel 2: Lead Confirmation Email
    const emailPromise = process.env.RESEND_API_KEY ? fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Aviora Media <bookings@avioramedia.com>',
        to: [process.env.ADMIN_EMAIL, data.email],
        subject: `Shoot Reservation: ${data.packageType} - ${data.fullname}`,
        text: leadSummary
      })
    }) : Promise.resolve();

    await Promise.allSettled([waPromise, emailPromise]);

    return res.status(200).json({
      success: true,
      message: 'Enquiry confirmed. WhatsApp dispatch ready.',
      clientPayload: data
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal dispatch error.' });
  }
}
