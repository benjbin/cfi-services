// API Route Vercel pour envoyer l'email de contact
import { Resend } from 'resend';

export default async function handler(req, res) {
  // Vérifier que c'est une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  // Validation des données
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  // Validation de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  try {
    // Utiliser Resend pour envoyer l'email
    // Configurez RESEND_API_KEY dans les variables d'environnement Vercel
    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailContent = `
      <h2>Nouveau message de contact depuis le site CFI Services</h2>
      <p><strong>Nom :</strong> ${name}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Message :</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">Ce message a été envoyé depuis le formulaire de contact du site CFI Services.</p>
    `;

    const { data, error } = await resend.emails.send({
      from: 'CFI Services <noreply@cfi-services.fr>', // Vous devrez vérifier ce domaine sur Resend
      to: ['gladys.lemoine@cfi-services.fr'],
      subject: `Nouveau message de contact - ${name}`,
      html: emailContent,
      replyTo: email, // Permet de répondre directement à l'expéditeur
    });

    if (error) {
      console.error('Erreur Resend:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Message envoyé avec succès',
      id: data?.id 
    });

  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de l\'envoi de l\'email' });
  }
}
