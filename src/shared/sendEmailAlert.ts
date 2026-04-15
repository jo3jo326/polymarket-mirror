import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailAlert(subject: string, body: string, to?: string) {
  try {
    await resend.emails.send({
      from: 'Trade Alerts <onboarding@resend.dev>', // You can use your verified sender
      to: to || process.env.ALERT_EMAIL!,
      subject,
      html: `<pre>${body}</pre>`,
    });
    console.log('Email alert sent');
  } catch (err) {
    console.error('Email alert error:', err);
  }
}
