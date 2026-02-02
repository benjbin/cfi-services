# Configuration Vercel pour CFI Services

## Problème 404 - Solution

Si vous obtenez une erreur 404, suivez ces étapes :

### 1. Vérifier les paramètres du projet sur Vercel

Allez sur : https://vercel.com/benjamins-projects-73fdca16/cfi-services/settings

**Dans l'onglet "General" :**
- **Framework Preset** : Sélectionnez "**Other**" ou laissez vide
- **Root Directory** : Laissez vide (ou `/`)
- **Build Command** : Laissez **VIDE** (ne mettez rien)
- **Output Directory** : Laissez **VIDE** (ne mettez rien)
- **Install Command** : Laissez **VIDE**

### 2. Redéployer

1. Allez dans l'onglet "Deployments"
2. Cliquez sur les "..." du dernier déploiement
3. Sélectionnez "Redeploy"
4. Ou faites un nouveau push Git

### 3. Vérifier les logs

Dans l'onglet "Deployments", cliquez sur le dernier déploiement et vérifiez les logs pour voir s'il y a des erreurs.

### 4. Si ça ne fonctionne toujours pas

**Option A : Supprimer et recréer le projet**
1. Supprimez le projet actuel
2. Créez un nouveau projet
3. Importez `benjbin/cfi-services`
4. Lors de l'import, sélectionnez "**Other**" comme framework
5. Laissez TOUS les champs de build VIDES
6. Déployez

**Option B : Utiliser Vercel CLI**
```bash
npm i -g vercel
cd /Users/benjaminbinet/Desktop/CLIENTS/CFI/site
vercel login
vercel --prod
```

## Structure attendue

Vercel doit trouver ces fichiers à la racine :
- ✅ `index.html` (page d'accueil)
- ✅ `contact.html`
- ✅ `mentions-legales.html`
- ✅ `styles.css`
- ✅ `script.js`
- ✅ `vercel.json`

## Vérification

Après le déploiement, ces URLs doivent fonctionner :
- https://cfi-services.vercel.app/
- https://cfi-services.vercel.app/contact
- https://cfi-services.vercel.app/mentions-legales
