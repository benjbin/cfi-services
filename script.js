(function () {
  'use strict';

  const header = document.getElementById('header');
  const scrollProgress = document.getElementById('scroll-progress');
  const burger = document.querySelector('.header-burger');
  const nav = document.querySelector('.header-nav');
  const navLinks = document.querySelectorAll('.header-nav-list a');
  const backdrop = document.querySelector('.header-backdrop');
  const contactForm = document.getElementById('contact-form');
  const temoignagesSlider = document.getElementById('temoignages-slider');
  const temoignageDotsEl = document.getElementById('temoignage-dots');

  // ----- Scroll progress bar
  function updateScrollProgress() {
    if (!scrollProgress) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = pct + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  updateScrollProgress();

  // ----- Header scroll
  function onScroll() {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();


  // ----- Reveal on scroll - simple et fluide
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -50px 0px', threshold: 0.1 }
  );

  revealEls.forEach(function (el) {
    revealObserver.observe(el);
  });

  // ----- Animations simples au scroll pour les sections
  const sections = document.querySelectorAll('section:not(.hero)');
  const sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          
          // Animation en cascade simple
          const revealChildren = entry.target.querySelectorAll('.reveal:not(.is-visible)');
          revealChildren.forEach(function (child, index) {
            setTimeout(function() {
              child.classList.add('is-visible');
            }, index * 50);
          });
          
          // Animation pour les cartes de service
          const serviceCards = entry.target.querySelectorAll('.service-card:not(.is-visible)');
          serviceCards.forEach(function (card, index) {
            setTimeout(function() {
              card.classList.add('is-visible');
            }, index * 100);
          });
          
          // Animation pour les cartes excellence
          const excellenceCards = entry.target.querySelectorAll('.excellence-card:not(.is-visible)');
          excellenceCards.forEach(function (card, index) {
            setTimeout(function() {
              card.classList.add('is-visible');
            }, index * 100);
          });
          
          // Animation pour les labels
          const labelCards = entry.target.querySelectorAll('.label-card:not(.is-visible)');
          labelCards.forEach(function (card, index) {
            setTimeout(function() {
              card.classList.add('is-visible');
            }, index * 100);
          });
          
          // Animation pour les témoignages
          const temoignageCards = entry.target.querySelectorAll('.temoignage-card:not(.is-visible)');
          temoignageCards.forEach(function (card, index) {
            setTimeout(function() {
              card.classList.add('is-visible');
            }, index * 100);
          });
          
          // Animation pour les stats
          const stats = entry.target.querySelectorAll('.savoir-faire-stat:not(.is-visible)');
          stats.forEach(function (stat, index) {
            setTimeout(function() {
              stat.classList.add('is-visible');
            }, index * 80);
          });
          
          // Animation pour les détails de contact
          const contactDetails = entry.target.querySelectorAll('.contact-detail:not(.is-visible)');
          contactDetails.forEach(function (detail, index) {
            setTimeout(function() {
              detail.classList.add('is-visible');
            }, index * 100);
          });
          
          // Animation pour le formulaire de contact
          const contactForm = entry.target.querySelector('.contact-form:not(.is-visible)');
          if (contactForm) {
            setTimeout(function() {
              contactForm.classList.add('is-visible');
            }, 200);
          }
        }
      });
    },
    { rootMargin: '0px 0px -80px 0px', threshold: 0.1 }
  );

  sections.forEach(function (section) {
    sectionObserver.observe(section);
  });
  
  // Observer individuel pour les cartes (pour animations plus précises)
  const cardObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    { rootMargin: '0px 0px -50px 0px', threshold: 0.2 }
  );
  
  // Observer toutes les cartes et éléments animables
  document.querySelectorAll('.service-card, .excellence-card, .label-card, .temoignage-card, .savoir-faire-stat, .contact-detail, .contact-form').forEach(function(card) {
    cardObserver.observe(card);
  });

  // ----- Menu mobile
  function openMenu() {
    const isOpen = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', !isOpen);
    nav.classList.toggle('is-open');
    if (header) header.classList.toggle('menu-open', !isOpen);
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  function closeMenu() {
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    if (header) header.classList.remove('menu-open');
    document.body.style.overflow = '';
  }

  if (burger && nav) {
    burger.addEventListener('click', openMenu);
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu();
      });
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeMenu);
  }

  document.addEventListener('click', function (e) {
    if (nav && nav.classList.contains('is-open') && !nav.contains(e.target) && burger && !burger.contains(e.target)) {
      closeMenu();
    }
  });

  // ----- Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ----- Témoignages slider
  if (temoignagesSlider && temoignageDotsEl) {
    const cards = temoignagesSlider.querySelectorAll('.temoignage-card');
    const count = cards.length;

    for (var i = 0; i < count; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'temoignage-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Témoignage ' + (i + 1));
      dot.dataset.index = i;
      dot.addEventListener('click', function () {
        var idx = parseInt(this.dataset.index, 10);
        var card = cards[idx];
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      });
      temoignageDotsEl.appendChild(dot);
    }

    var dots = temoignageDotsEl.querySelectorAll('.temoignage-dot');

    function updateDots() {
      var scrollLeft = temoignagesSlider.scrollLeft;
      var cardWidth = cards[0] ? cards[0].offsetWidth + parseInt(getComputedStyle(temoignagesSlider).gap || 0, 10) : 0;
      var index = cardWidth > 0 ? Math.round(scrollLeft / cardWidth) : 0;
      index = Math.min(index, count - 1);
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === index);
      });
    }

    temoignagesSlider.addEventListener('scroll', updateDots);
    window.addEventListener('resize', updateDots);

    document.querySelector('.temoignage-prev')?.addEventListener('click', function () {
      var scrollLeft = temoignagesSlider.scrollLeft;
      var cardWidth = cards[0] ? cards[0].offsetWidth + parseInt(getComputedStyle(temoignagesSlider).gap || 0, 10) : 0;
      var prev = Math.max(0, Math.floor(scrollLeft / cardWidth) - 1);
      cards[prev]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    });

    document.querySelector('.temoignage-next')?.addEventListener('click', function () {
      var scrollLeft = temoignagesSlider.scrollLeft;
      var cardWidth = cards[0] ? cards[0].offsetWidth + parseInt(getComputedStyle(temoignagesSlider).gap || 0, 10) : 0;
      var next = Math.min(count - 1, Math.floor(scrollLeft / cardWidth) + 1);
      cards[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    });
  }

  // ----- Compteurs (stats)
  var statValues = document.querySelectorAll('.stat-value[data-count]');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target) || reducedMotion) {
      el.textContent = target;
      return;
    }
    var duration = 1500;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var easeOut = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(start + (target - start) * easeOut);
      el.textContent = current;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    window.requestAnimationFrame(step);
  }

  var statsObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var val = entry.target;
          if (!val.classList.contains('counted')) {
            val.classList.add('counted');
            animateCounter(val);
          }
        }
      });
    },
    { rootMargin: '0px 0px -80px 0px', threshold: 0 }
  );

  statValues.forEach(function (el) {
    statsObserver.observe(el);
  });

  // ----- Formulaire de contact
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = this.querySelector('button[type="submit"]');
      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      setTimeout(function () {
        btn.textContent = 'Message envoyé !';
        btn.style.background = 'var(--cfi-purple)';
        contactForm.reset();
        setTimeout(function () {
          btn.textContent = originalText;
          btn.disabled = false;
          btn.style.background = '';
        }, 2500);
      }, 800);
    });
  }
})();
