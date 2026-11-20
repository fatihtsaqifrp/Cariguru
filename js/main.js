/* ===================================================================
   TREVY — Main JavaScript
   Scroll animations, Navbar logic, Global utilities
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initNavbar();
  initMobileMenu();
  initTabs();
  initModals();
  initTooltips();
  initCounters();
});

/* ── Scroll-triggered Animations ──────────────────── */
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll(
    '.animate-on-scroll, .animate-left, .animate-right, .animate-scale'
  );

  if (!animatedElements.length) return;

  // Respect reduced motion preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    animatedElements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
  );

  animatedElements.forEach((el) => observer.observe(el));
}

/* ── Navbar Scroll Effect ─────────────────────────── */
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScroll = 0;
  const scrollThreshold = 50;

  function handleScroll() {
    const currentScroll = window.scrollY;
    
    if (currentScroll > scrollThreshold) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
}

/* ── Mobile Menu Toggle ───────────────────────────── */
function initMobileMenu() {
  const toggle = document.querySelector('.navbar__toggle');
  const links = document.querySelector('.navbar__links');
  
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    links.classList.toggle('active');
    document.body.style.overflow = links.classList.contains('active') ? 'hidden' : '';
  });

  // Close on link click
  links.querySelectorAll('.navbar__link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ── Tabs ─────────────────────────────────────────── */
function initTabs() {
  const tabContainers = document.querySelectorAll('[data-tabs]');
  
  tabContainers.forEach(container => {
    const buttons = container.querySelectorAll('.tab-btn');
    const tabId = container.dataset.tabs;
    const contents = document.querySelectorAll(`[data-tab-content="${tabId}"] .tab-content`);
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Deactivate all
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // Activate clicked
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.target);
        if (target) target.classList.add('active');
      });
    });
  });
}

/* ── Modals ───────────────────────────────────────── */
function initModals() {
  // Open modal
  document.querySelectorAll('[data-modal-open]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.dataset.modalOpen;
      openModal(modalId);
    });
  });

  // Close modal
  document.querySelectorAll('[data-modal-close]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modal = trigger.closest('.modal');
      const backdrop = modal?.previousElementSibling;
      closeModal(modal, backdrop);
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      const modal = backdrop.nextElementSibling;
      closeModal(modal, backdrop);
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = modal?.previousElementSibling;
  if (!modal || !backdrop) return;

  backdrop.classList.add('active');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal, backdrop) {
  if (!modal || !backdrop) return;
  backdrop.classList.remove('active');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Tooltips ─────────────────────────────────────── */
function initTooltips() {
  // CSS-only tooltips via [data-tooltip] attribute — no JS needed
}

/* ── Counter Animation ────────────────────────────── */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          
          if (prefersReducedMotion.matches) {
            el.textContent = formatNumber(target);
          } else {
            animateCounter(el, target);
          }
          
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el, target) {
  const duration = 2000;
  const startTime = performance.now();
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    
    el.textContent = prefix + formatNumber(current) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function formatNumber(num) {
  return num.toLocaleString('id-ID');
}

/* ── Toast Notifications ──────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.querySelector('.toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  
  const icons = {
    success: '✓',
    danger: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const icon = document.createElement('span');
  icon.style.cssText = 'font-size:1.2rem;font-weight:bold;';
  icon.textContent = icons[type] || icons.info;
  const text = document.createElement('span');
  text.style.cssText = 'flex:1;font-size:var(--fs-sm);';
  text.textContent = String(message);
  const close = document.createElement('button');
  close.type = 'button';
  close.style.cssText = 'opacity:.5;font-size:1.2rem;background:none;border:0;cursor:pointer;color:inherit;';
  close.textContent = '×';
  close.addEventListener('click', () => toast.remove());
  toast.append(icon, text, close);
  
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/* ── Sidebar Toggle (Dashboard) ───────────────────── */
function initSidebar() {
  const toggleBtn = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay?.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  });
}

/* ── Utility: Smooth scroll to element ────────────── */
function scrollToElement(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ── Utility: Format currency IDR ─────────────────── */
function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/* ── Utility: Format date ─────────────────────────── */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/* ── Utility: Debounce ────────────────────────────── */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
