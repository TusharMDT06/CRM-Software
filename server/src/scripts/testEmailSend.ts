import dotenv from 'dotenv';
dotenv.config();

import { Resend } from 'resend';

async function main() {
  console.log('Testing Resend email delivery...');
  
  if (!process.env.RESEND_API_KEY) {
    console.error('Error: RESEND_API_KEY is not defined in .env');
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const toEmail = process.argv[2] || 'tusharmedatwal06@gmail.com';
  const fromEmail = process.env.EMAIL_FROM || 'Flowdesk CRM <onboarding@resend.dev>';

  console.log(`Sending test email from: ${fromEmail}`);
  console.log(`Sending test email to: ${toEmail}`);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: 'Flowdesk CRM - Live Email Delivery Test Successful! 🎉',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
            <div style="width: 32px; height: 32px; background: #000; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 16px; text-align: center; line-height: 32px;">F</div>
            <span style="font-size: 20px; font-weight: 700; color: #0f172a; margin-left: 8px;">Flowdesk CRM</span>
          </div>

          <h2 style="color: #0f172a; font-size: 22px; margin-top: 0;">Email Delivery is Working! 🎉</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Hello Tushar,
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Aapka Resend email integration <strong>Flowdesk CRM</strong> me live test ho chuka hai aur successfully deliver ho raha hai.
          </p>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #166534; font-weight: 600; font-size: 14px;">
              ✓ Live Delivery Status: SUCCESS
            </p>
            <p style="margin: 6px 0 0 0; color: #4b5563; font-size: 13px;">
              <strong>Recipient:</strong> ${toEmail}
            </p>
            <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 13px;">
              <strong>Sent via:</strong> Resend API (${fromEmail})
            </p>
            <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 13px;">
              <strong>Timestamp:</strong> ${new Date().toLocaleString()}
            </p>
          </div>

          <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
            Flowdesk CRM Notifications, Invoices, Support Ticket Replies, and Invitation emails are now fully operational.
          </p>
        </div>
      `,
      text: `Flowdesk CRM - Live Email Delivery Test Successful!\n\nHello Tushar,\n\nAapka Resend email integration Flowdesk CRM me successfully deliver ho chuka hai.\nRecipient: ${toEmail}\nSent at: ${new Date().toLocaleString()}`,
    });

    if (result.error) {
      console.error('Resend Error:', result.error);
      process.exit(1);
    }

    console.log('✅ Email sent successfully!');
    console.log('Delivery ID:', result.data?.id);
    console.log(`Please check the inbox of: ${toEmail}`);
  } catch (error: any) {
    console.error('Failed to send email:', error);
    process.exit(1);
  }
}

main();
