# CFI Services — site vitrine

Refonte du site de CFI Services, spécialiste de l'impression tout support.

Site statique (HTML / CSS / JavaScript), sans étape de build :

- `index.html` : la page
- `css/style.css` : les styles
- `js/main.js` : interactions (GSAP, ScrollTrigger, Lenis)
- `js/hero3d.js` : hero 3D temps réel (Three.js) — imprimante grand format
- `assets/` : images, logos clients, labels

## Lancer en local

Le hero 3D charge des modules ES depuis un CDN : il faut passer par un serveur web.

```bash
python3 -m http.server 5174
```

puis ouvrir http://localhost:5174.

## À compléter

- Formulaire de devis : il ouvre actuellement la messagerie du visiteur (`mailto:`) ; à brancher sur un service d'envoi.
- Adresse et téléphone de l'atelier.
