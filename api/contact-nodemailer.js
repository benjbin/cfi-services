// Alternative avec Nodemailer (si vous préférez utiliser Gmail SMTP)
// Cette version utilise nodemailer avec Gmail SMTP
// Plus simple à configurer si vous avez un compte Gmail

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  try {
    const nodemailer = require('nodemailer');

    // Configuration du transporteur email
    // Vous devrez configurer ces variables dans Vercel :
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true pour 465, false pour autres ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Mot de passe d'application Gmail
      },
    });

    const mailOptions = {
      from: `"CFI Services" <${process.env.SMTP_USER}>`,
      to: 'gladys.lemoine@cfi-services.fr',
      replyTo: email,
      subject: `Nouveau message de contact - ${name}`,
      html: `
        <h2>Nouveau message de contact depuis le site CFI Services</h2>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Message :</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Ce message a été envoyé depuis le formulaire de contact du site CFI Services.</p>
      `,
      text: `
Nouveau message de contact depuis le site CFI Services

Nom : ${name}
Email : ${email}

Message :
${message}

---
Ce message a été envoyé depuis le formulaire de contact du site CFI Services.
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true, 
      message: 'Message envoyé avec succès' 
    });

  } catch (error) {
    console.error('Erreur envoi email:', error);
    return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
  }
}
