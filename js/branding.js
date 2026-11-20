(() => {
  const fallback = { platformName: 'Portal Les Privat Semarang', tagline: 'Belajar lebih mudah bersama pengajar berkualitas', primaryColor: '#4f46e5', logoUrl: '', faviconUrl: '',contactEmail:'',contactPhone:'',address:'' };
  const apply = branding => {
    const settings = { ...fallback, ...(branding || {}) };
    const pageTitle=document.body.dataset.pageTitle||document.title;document.body.dataset.pageTitle=pageTitle;document.title=`${settings.platformName} | ${pageTitle}`;
    document.documentElement.style.setProperty('--clr-primary-600', settings.primaryColor);
    document.documentElement.style.setProperty('--brand-primary', settings.primaryColor);
    if (settings.faviconUrl) { const icon = document.querySelector('link[rel="icon"]'); if (icon) icon.href = settings.faviconUrl; }
    document.querySelectorAll('.sidebar__logo,.auth-card__logo-icon,.navbar__logo').forEach(node => {
      if (settings.logoUrl) {
        node.replaceChildren();
        node.classList.add('brand-logo-image');
        node.setAttribute('aria-label', settings.platformName);
        const image = document.createElement('img');
        image.src = settings.logoUrl;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.addEventListener('error', () => {
          node.classList.remove('brand-logo-image');
          node.removeAttribute('aria-label');
          node.textContent = settings.platformName.trim().charAt(0).toUpperCase();
        }, { once: true });
        node.append(image);
      } else {
        node.replaceChildren();
        node.classList.remove('brand-logo-image');
        node.textContent = settings.platformName.trim().charAt(0).toUpperCase();
        node.removeAttribute('aria-label');
      }
    });
    document.querySelectorAll('.sidebar__name,.auth-card__logo-text,.navbar__name,[data-platform-name]').forEach(node => { node.textContent = settings.platformName; });
    document.querySelectorAll('[data-platform-tagline]').forEach(node => { node.textContent = settings.tagline; });
    document.querySelectorAll('[data-platform-email]').forEach(node=>{node.textContent=settings.contactEmail||'Email kontak belum diatur';if(settings.contactEmail)node.href=`mailto:${settings.contactEmail}`;else{node.removeAttribute('href');node.title='Email kontak belum diatur oleh Admin';}});
    document.querySelectorAll('[data-platform-phone]').forEach(node=>{node.textContent=settings.contactPhone||'Telepon kontak belum diatur';if(settings.contactPhone)node.href=`tel:${settings.contactPhone.replace(/[^+\d]/g,'')}`;else{node.removeAttribute('href');node.title='Nomor telepon belum diatur oleh Admin';}});
    document.querySelectorAll('[data-platform-address]').forEach(node=>{node.textContent=settings.address||'Alamat belum diatur';});
    document.querySelectorAll('[data-contact-link]').forEach(node=>{if(settings.contactEmail)node.href=`mailto:${settings.contactEmail}`;else{node.removeAttribute('href');node.title='Email kontak belum diatur oleh Admin';}});
    document.querySelectorAll('[data-disabled-link]').forEach(node=>{node.removeAttribute('href');node.setAttribute('aria-disabled','true');node.setAttribute('tabindex','0');node.title='Tautan ini belum dikonfigurasi.';});
    window.TenantBranding = settings;
  };
  window.applyTenantBranding = apply;
  fetch('/api/tenant/branding', { cache: 'no-store' }).then(response => response.ok ? response.json() : fallback).then(apply).catch(() => apply(fallback));
})();
