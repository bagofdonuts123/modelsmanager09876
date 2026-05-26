/* =========================================
   LUMEN VAULT — VISUAL EFFECTS ENGINE
   ========================================= */

/* ── Utility: Elastic Easing ──────────────────── */
function easeOutElasticGSAP(x) {
   const c4 = (2 * Math.PI) / 3;
   return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}
gsap.registerEase("elasticOut", easeOutElasticGSAP);

/* =========================================
   1. HEAT-WARP BACKGROUND SHADER (Three.js)
   ========================================= */
(function initHeatWarp() {
   const canvas = document.getElementById('bgCanvas');
   if (!canvas || typeof THREE === 'undefined') return;

   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

   const scene = new THREE.Scene();
   const camera = new THREE.Camera();
   const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });

   renderer.setSize(window.innerWidth, window.innerHeight);
   renderer.setPixelRatio(1);
   renderer.domElement.style.width = '100%';
   renderer.domElement.style.height = '100%';
   renderer.domElement.style.display = 'block';

   const vertShader = `
      precision highp float;
      attribute vec3 position;
      varying vec2 vUv;
      void main() {
         vUv = position.xy * 0.5 + 0.5;
         gl_Position = vec4(position, 1.0);
      }
   `;

   const fragShader = `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform vec2 u_resolution;
      uniform float u_animInt;
      uniform float u_heatDistortion;

      float hash(vec2 p) {
         vec3 p3 = fract(vec3(p.xyx) * 0.1031);
         p3 += dot(p3, p3.yzx + 33.33);
         return fract((p3.x + p3.y) * p3.z);
      }

      float vnoise(vec2 p) {
         vec2 i = floor(p);
         vec2 f = fract(p);
         f = f * f * (3.0 - 2.0 * f);
         float a = hash(i);
         float b = hash(i + vec2(1.0, 0.0));
         float c = hash(i + vec2(0.0, 1.0));
         float d = hash(i + vec2(1.0, 1.0));
         return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      vec2 warp(vec2 p, float scale, float amt) {
         float n1 = vnoise(p * scale + u_time * 0.4) - 0.5;
         float n2 = vnoise(p * scale + 17.0 + u_time * 0.35) - 0.5;
         return p + vec2(n1, n2) * amt;
      }

      void main() {
         vec2 uv = vUv;
         float aspect = u_resolution.x / u_resolution.y;
         uv.x *= aspect;

         vec2 mouse = u_mouse;
         mouse.x *= aspect;
         float mouseDist = length(uv - mouse);
         float mouseInfluence = smoothstep(1.2, 0.0, mouseDist) * 0.12 * u_heatDistortion;

         vec2 w1 = warp(uv, 3.0, 0.18 * u_animInt + mouseInfluence);
         vec2 w2 = warp(w1, 2.0, 0.14 * u_animInt + mouseInfluence * 0.5);
         vec2 w3 = warp(w2, 1.5, 0.10 * u_animInt);

         float n = vnoise(w3 + u_time * 0.15);
         float n2 = vnoise(w3 * 1.3 - u_time * 0.12);
         float pattern = n * 0.5 + n2 * 0.5;

         vec3 baseColor = vec3(0.102, 0.106, 0.102);
         vec3 midColor = vec3(0.118, 0.122, 0.118);
         vec3 crestColor = vec3(0.118, 0.165, 0.133);

         vec3 color = mix(baseColor, midColor, pattern);
         color = mix(color, crestColor, smoothstep(0.55, 0.8, pattern) * 0.3);

         gl_FragColor = vec4(color, 1.0);
      }
   `;

   const material = new THREE.RawShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms: {
         u_time: { value: 0.0 },
         u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
         u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
         u_animInt: { value: prefersReducedMotion ? 0.0 : 1.0 },
         u_heatDistortion: { value: 0.0 }
      }
   });

   const geometry = new THREE.PlaneGeometry(2, 2);
   const mesh = new THREE.Mesh(geometry, material);
   scene.add(mesh);

   let targetMouse = { x: 0.5, y: 0.5 };
   document.addEventListener('mousemove', (e) => {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = 1.0 - (e.clientY / window.innerHeight);
   });

   window._lumenScrollVelocity = 0;

   let isVisible = true;
   const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
   });
   observer.observe(canvas);

   function render() {
      requestAnimationFrame(render);
      if (!isVisible) return;

      if (!prefersReducedMotion) {
         material.uniforms.u_time.value = performance.now() * 0.001;
      }

      material.uniforms.u_mouse.value.x += (targetMouse.x - material.uniforms.u_mouse.value.x) * 0.05;
      material.uniforms.u_mouse.value.y += (targetMouse.y - material.uniforms.u_mouse.value.y) * 0.05;

      const targetHeat = Math.min(window._lumenScrollVelocity / 300, 1.0);
      material.uniforms.u_heatDistortion.value += (targetHeat - material.uniforms.u_heatDistortion.value) * 0.1;
      window._lumenScrollVelocity *= 0.95;

      renderer.render(scene, camera);
   }
   render();

   window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
   });
})();

/* =========================================
   2. LENIS SMOOTH SCROLLING
   ========================================= */
let lenis = null;
(function initLenis() {
   if (typeof Lenis === 'undefined') return;

   const grid = document.getElementById('boxContainer');
   if (!grid) return;

   lenis = new Lenis({
      wrapper: grid,
      content: grid,
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
   });

   lenis.on('scroll', (e) => {
      window._lumenScrollVelocity = Math.abs(e.velocity || 0);
   });

   function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
   }
   requestAnimationFrame(raf);
})();

/* =========================================
   3. CARD VIGNETTE HOVER EFFECT
   ========================================= */
(function initCardVignette() {
   const grid = document.getElementById('boxContainer');
   if (!grid) return;

   const EFFECT_RADIUS = 150;
   let mouseX = window.innerWidth / 2;
   let mouseY = window.innerHeight / 2;
   let needsUpdate = true;

   document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      needsUpdate = true;
   });

   const visibleCards = new Set();
   const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
         if (entry.isIntersecting) {
            visibleCards.add(entry.target);
         } else {
            visibleCards.delete(entry.target);
            entry.target.style.removeProperty('will-change');
         }
      });
   }, { root: grid, threshold: 0 });

   function observeCards() {
      const cards = grid.querySelectorAll('.box');
      cards.forEach(card => {
         if (!card.dataset.vigObserved) {
            card.dataset.vigObserved = '1';
            cardObserver.observe(card);
         }
      });
   }

   observeCards();
   const mutationObserver = new MutationObserver(observeCards);
   mutationObserver.observe(grid, { childList: true });

   function updateVignettes() {
      if (!needsUpdate) {
         requestAnimationFrame(updateVignettes);
         return;
      }
      needsUpdate = false;

      visibleCards.forEach(card => {
         const rect = card.getBoundingClientRect();
         const cardCenterX = rect.left + rect.width / 2;
         const cardCenterY = rect.top + rect.height / 2;

         const distPx = Math.sqrt(
            (mouseX - cardCenterX) ** 2 +
            (mouseY - cardCenterY) ** 2
         );

         const dist = Math.min(distPx / EFFECT_RADIUS, 1);

         if (dist < 1 || card.dataset.wasNear) {
            card.style.setProperty('--dist', dist);
            card.dataset.wasNear = dist < 1 ? '1' : '';

            const vigX = Math.max(0, Math.min(1, (mouseX - rect.left) / rect.width));
            const vigY = Math.max(0, Math.min(1, (mouseY - rect.top) / rect.height));
            card.style.setProperty('--vig-x', vigX);
            card.style.setProperty('--vig-y', vigY);

            if (dist < 1) {
               card.style.willChange = 'filter';
            } else {
               card.style.removeProperty('will-change');
            }
         }
      });

      requestAnimationFrame(updateVignettes);
   }

   requestAnimationFrame(updateVignettes);
})();

/* =========================================
   4. KINETIC TEXT REVEAL
   ========================================= */
function kineticReveal(element, options) {
   if (!element || element.dataset.kineticked) return;
   element.dataset.kineticked = '1';

   options = options || {};
   const text = element.textContent;
   const baseDelay = options.delay || 0;
   const stagger = options.stagger || 0.025;
   const duration = options.duration || 0.5;

   element.setAttribute('aria-label', text);
   element.innerHTML = '';

   const chars = text.split('').map((char) => {
      const wrapper = document.createElement('span');
      wrapper.style.display = 'inline-block';
      wrapper.style.overflow = 'hidden';
      wrapper.style.verticalAlign = 'bottom';

      const inner = document.createElement('span');
      inner.textContent = char === ' ' ? '\u00A0' : char;
      inner.style.display = 'inline-block';
      inner.style.transform = 'translateY(100%)';

      wrapper.appendChild(inner);
      element.appendChild(wrapper);
      return inner;
   });

   chars.forEach((char, i) => {
      gsap.to(char, {
         y: 0,
         duration: duration,
         ease: 'power3.out',
         delay: baseDelay + i * stagger
      });
   });

   const totalTime = baseDelay + chars.length * stagger + duration;
   setTimeout(() => {
      element.textContent = text;
      element.removeAttribute('aria-label');
      delete element.dataset.kineticked;
   }, totalTime * 1000 + 100);
}

/* =========================================
   5. MUTATION OBSERVER — DRIVE ALL ANIMATIONS
   ========================================= */
(function initMutationAnimations() {
   const grid = document.getElementById('boxContainer');
   const infoPanel = document.getElementById('infoContent');
   const emptyState = document.querySelector('.empty-state');

   // Track if we've already animated current cards
   let lastCardCount = 0;
   let lastInfoHTML = '';

   // Observe grid for new cards
   if (grid) {
      const gridObserver = new MutationObserver(() => {
         const cards = grid.querySelectorAll('.box');
         if (cards.length > 0 && cards.length !== lastCardCount) {
            lastCardCount = cards.length;

            gsap.fromTo(cards,
               { x: -20, opacity: 0 },
               {
                  x: 0,
                  opacity: 1,
                  duration: 0.4,
                  ease: 'elastic.out(1, 0.5)',
                  stagger: 0.02
               }
            );
         }
      });

      gridObserver.observe(grid, { childList: true });
   }

   // Observe inspector panel for content changes
   if (infoPanel) {
      const infoObserver = new MutationObserver(() => {
         const currentHTML = infoPanel.innerHTML;
         if (currentHTML && currentHTML !== lastInfoHTML && !infoPanel.classList.contains('hidden')) {
            lastInfoHTML = currentHTML;

            // Mark sections for animation
            const sections = infoPanel.querySelectorAll('.section');
            sections.forEach((section) => {
               if (!section.dataset.animated) {
                  section.dataset.animated = '1';
               }
            });

            // Animate sections with elastic slide
            const targetSections = infoPanel.querySelectorAll('.section:not([data-gsap])');
            targetSections.forEach((section) => {
               section.dataset.gsap = '1';
            });

            if (targetSections.length > 0) {
               gsap.fromTo(targetSections,
                  { x: 16, opacity: 0 },
                  {
                     x: 0,
                     opacity: 1,
                     duration: 0.5,
                     ease: 'elastic.out(1, 0.5)',
                     stagger: 0.06
                  }
               );
            }

            // Animate section titles with kinetic reveal
            const titles = infoPanel.querySelectorAll('.section-title');
            titles.forEach((title) => {
               if (!title.dataset.kineticked) {
                  kineticReveal(title, { stagger: 0.03, duration: 0.4 });
               }
            });
         }
      });

      infoObserver.observe(infoPanel, { childList: true, subtree: true, attributes: true });

      // Also watch for class changes (hidden toggle)
      const classObserver = new MutationObserver((mutations) => {
         mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
               const isHidden = infoPanel.classList.contains('hidden');

               if (!isHidden && infoPanel.innerHTML.trim()) {
                  // Panel became visible with content
                  const sections = infoPanel.querySelectorAll('.section');
                  sections.forEach((section, i) => {
                     gsap.fromTo(section,
                        { x: 16, opacity: 0 },
                        {
                           x: 0,
                           opacity: 1,
                           duration: 0.5,
                           ease: 'elastic.out(1, 0.5)',
                           delay: i * 0.06
                        }
                     );
                  });
               }

               if (isHidden && emptyState) {
                  // Panel hidden, show empty state
                  emptyState.classList.remove('hidden');
                  gsap.fromTo(emptyState, { opacity: 0 }, { opacity: 1, duration: 0.2 });
               }
            }
         });
      });

      classObserver.observe(infoPanel, { attributes: true, attributeFilter: ['class'] });
   }

   // Animate empty state on first load
   if (emptyState) {
      const emptyText = emptyState.querySelector('.kinetic-text');
      if (emptyText) {
         setTimeout(() => {
            kineticReveal(emptyText, { stagger: 0.02, duration: 0.4 });
         }, 800);
      }
   }
})();

/* =========================================
   6. SIDEBAR ITEM LINE REVEAL ARROWS
   ========================================= */
(function initSidebarArrows() {
   const catList = document.getElementById('categoryList');
   if (!catList) return;

   function addArrowsToCategories() {
      const items = catList.querySelectorAll('.category-item');
      items.forEach(item => {
         if (item.dataset.arrowsAdded) return;
         item.dataset.arrowsAdded = '1';

         const leftArrow = document.createElement('span');
         leftArrow.className = 'cat-arrow-left';
         leftArrow.textContent = '<';
         item.appendChild(leftArrow);

         const rightArrow = document.createElement('span');
         rightArrow.className = 'cat-arrow-right';
         rightArrow.textContent = '>';
         item.appendChild(rightArrow);
      });
   }

   const observer = new MutationObserver(addArrowsToCategories);
   observer.observe(catList, { childList: true });

   setTimeout(addArrowsToCategories, 300);
})();

/* =========================================
   7. KEYBOARD SHORTCUTS
   ========================================= */
(function initKeyboardShortcuts() {
   document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
         const overlay = document.getElementById('modalOverlay');
         if (overlay && !overlay.classList.contains('hidden')) {
            // Trigger close via click on close button
            const closeBtn = overlay.querySelector('.close-modal');
            if (closeBtn) closeBtn.click();
         }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
         e.preventDefault();
         const searchInput = document.getElementById('searchInput');
         if (searchInput) searchInput.focus();
      }
   });
})();
