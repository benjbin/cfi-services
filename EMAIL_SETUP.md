# Configuration de l'envoi d'email - Formulaire de contact

## Option 1 : Utiliser Resend (Recommandé - Plus simple)

### Étape 1 : Créer un compte Resend
1. Allez sur [resend.com](https://resend.com)
2. Créez un compte gratuit (100 emails/jour gratuits)
3. Vérifiez votre domaine ou utilisez le domaine de test fourni

### Étape 2 : Obtenir la clé API
1. Dans le dashboard Resend, allez dans "API Keys"
2. Créez une nouvelle clé API
3. Copiez la clé

### Étape 3 : Configurer sur Vercel
1. Allez sur votre projet Vercel : https://vercel.com/benjamins-projects-73fdca16/cfi-services/settings/environment-variables
2. Ajoutez une variable d'environnement :
   - **Key** : `RESEND_API_KEY`
   - **Value** : Votre clé API Resend
   - **Environment** : Production, Preview, Development (cochez les 3)
3. Cliquez sur "Save"

### Étape 4 : Redéployer
1. Allez dans "Deployments"
2. Cliquez sur "Redeploy" du dernier déploiement
3. Ou faites un nouveau push Git

### Étape 5 : Modifier l'email "from" dans l'API
Dans `api/contact.js`, modifiez la ligne :
```javascript
from: 'CFI Services <noreply@cfi-services.fr>',
```
Remplacez par votre domaine vérifié sur Resend, ou utilisez le domaine de test fourni par Resend.

---

## Option 2 : Utiliser Nodemailer avec Gmail SMTP

### Étape 1 : Créer un mot de passe d'application Gmail
1. Allez sur votre compte Google : https://myaccount.google.com/
2. Activez la validation en 2 étapes si ce n'est pas déjà fait
3. Allez dans "Sécurité" → "Mots de passe des applications"
4. Créez un nouveau mot de passe d'application
5. Copiez le mot de passe généré

### Étape 2 : Configurer sur Vercel
1. Allez sur votre projet Vercel → Settings → Environment Variables
2. Ajoutez ces variables :
   - **SMTP_HOST** : `smtp.gmail.com`
   - **SMTP_PORT** : `587`
   - **SMTP_USER** : Votre adresse Gmail (ex: votre-email@gmail.com)
   - **SMTP_PASS** : Le mot de passe d'application généré
3. Cochez Production, Preview, Development
4. Cliquez sur "Save"

### Étape 3 : Renommer le fichier API
Renommez `api/contact-nodemailer.js` en `api/contact.js` (ou modifiez le code dans `api/contact.js`)

### Étape 4 : Installer nodemailer
Ajoutez dans `package.json` :
```json
"dependencies": {
  "nodemailer": "^6.9.7"
}
```

### Étape 5 : Redéployer
Redéployez le projet sur Vercel.

---

## Option 3 : Utiliser EmailJS (Sans backend)

Si vous préférez une solution sans backend, vous pouvez utiliser EmailJS directement depuis le frontend.

### Modification du script.js pour EmailJS

Remplacez le code du formulaire dans `script.js` par :

```javascript
// Installer EmailJS : npm install @emailjs/browser
// Ou ajouter via CDN dans contact.html :
// <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

if (contactForm) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    // Initialiser EmailJS (remplacez par votre public key)
    emailjs.init("VOTRE_PUBLIC_KEY");
    
    var btn = this.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    
    try {
      await emailjs.send(
        'VOTRE_SERVICE_ID',  // Service ID EmailJS
        'VOTRE_TEMPLATE_ID', // Template ID EmailJS
        {
          from_name: this.querySelector('#name').value,
          from_email: this.querySelector('#email').value,
          message: this.querySelector('#message').value,
          to_email: 'gladys.lemoine@cfi-services.fr'
        }
      );
      
      btn.textContent = 'Message envoyé !';
      btn.style.background = 'var(--cfi-purple)';
      contactForm.reset();
      
      setTimeout(function () {
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.background = '';
      }, 3000);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'envoi. Veuillez réessayer.');
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}
```

---

## Test

Une fois configuré, testez le formulaire :
1. Remplissez tous les champs
2. Cliquez sur "Envoyer"
3. Vérifiez que l'email arrive bien à gladys.lemoine@cfi-services.fr

## Dépannage

- **Erreur 500** : Vérifiez que les variables d'environnement sont bien configurées sur Vercel
- **Email non reçu** : Vérifiez les logs Vercel dans l'onglet "Functions" → "Logs"
- **Erreur d'authentification** : Vérifiez que les clés API sont correctes
