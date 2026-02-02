# CFI Services - Site Web

Site web professionnel pour CFI Services, imprimeur spécialisé en impression tout support à Belfort.

## 🚀 Technologies

- HTML5 sémantique
- CSS3 moderne (variables CSS, Grid, Flexbox)
- JavaScript vanilla (ES6+)
- Animations CSS fluides
- SEO optimisé (Schema.org, Open Graph, meta tags)
- Responsive design (mobile-first)

## 📁 Structure du projet

```
site/
├── index.html              # Page d'accueil
├── contact.html             # Page de contact
├── mentions-legales.html    # Mentions légales
├── styles.css               # Styles principaux
├── script.js                # JavaScript
├── assets/                  # Assets statiques
│   └── logo.png
├── src/                     # Ressources
│   ├── img/                 # Images
│   └── video/               # Vidéos
├── sitemap.xml              # Sitemap SEO
├── robots.txt               # Robots.txt
├── vercel.json              # Configuration Vercel
└── README.md                # Documentation

```

## 🛠️ Développement local

1. Cloner le repository :
```bash
git clone https://github.com/benjbin/cfi-services.git
cd cfi-services
```

2. Ouvrir le projet :
```bash
# Ouvrir index.html dans un navigateur
# Ou utiliser un serveur local :
python -m http.server 8000
# Puis ouvrir http://localhost:8000
```

## 🌐 Déploiement sur Vercel

### Option 1 : Via GitHub (Recommandé)

1. Pousser le code sur GitHub :
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/benjbin/cfi-services.git
git branch -M main
git push -u origin main
```

2. Sur Vercel :
   - Aller sur [vercel.com](https://vercel.com)
   - Cliquer sur "Import Project"
   - Connecter le repository GitHub `benjbin/cfi-services`
   - Vercel détectera automatiquement la configuration
   - Cliquer sur "Deploy"

### Option 2 : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel

# Déployer en production
vercel --prod
```

## ⚙️ Configuration Vercel

Le fichier `vercel.json` configure :
- **Rewrites** : URLs propres sans `.html`
- **Headers de sécurité** : Protection XSS, clickjacking, etc.
- **Cache** : Optimisation des performances (images, CSS, JS)

## 📊 SEO

- ✅ Meta tags optimisés
- ✅ Open Graph et Twitter Cards
- ✅ Données structurées Schema.org (LocalBusiness, Organization, Service)
- ✅ Sitemap.xml
- ✅ Robots.txt
- ✅ Alt text sur toutes les images
- ✅ URLs canoniques

## 🎨 Fonctionnalités

- Design moderne et responsive
- Animations au scroll fluides
- Formulaire de contact
- Intégration Google Maps
- Optimisé pour les performances
- Accessible (ARIA, sémantique HTML)

## 📝 Pages

- **/** : Page d'accueil avec présentation des services
- **/contact** : Formulaire de contact et coordonnées
- **/mentions-legales** : Mentions légales et informations légales

## 🔧 Maintenance

### Mettre à jour le sitemap
Modifier `sitemap.xml` avec les nouvelles dates de modification.

### Ajouter une nouvelle page
1. Créer le fichier HTML
2. Ajouter l'entrée dans `sitemap.xml`
3. Ajouter le rewrite dans `vercel.json` si besoin

## 📄 Licence

© CFI Services. Tous droits réservés.

## 👤 Contact

**CFI Services**
- 📍 26 Rue Edouard Branly, 90000 Belfort, France
- 📞 03 84 90 15 75
- ✉️ gladys.lemoine@cfi-services.fr
- 🌐 https://www.cfi-services.fr
