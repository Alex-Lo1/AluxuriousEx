document.addEventListener('DOMContentLoaded', () => {
  const serviceSearch = document.getElementById('serviceSearch');
  const serviceSearchClear = document.getElementById('serviceSearchClear');
  const serviceSearchStatus = document.getElementById('serviceSearchStatus');
  const serviceCards = document.querySelectorAll('.service-card');
  const serviceCategories = document.querySelectorAll('.service-category');

  if (serviceSearch && serviceCards.length) {
    const applySearch = () => {
      const query = serviceSearch.value.trim().toLowerCase();
      let visibleCount = 0;

      serviceCards.forEach((card) => {
        const name = card.querySelector('h3, h2')?.textContent.toLowerCase() || '';
        const matches = !query || name.includes(query);
        card.classList.toggle('is-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      serviceCategories.forEach((category) => {
        const hasVisibleCard = Boolean(category.querySelector('.service-card:not(.is-hidden)'));
        category.classList.toggle('is-hidden', !hasVisibleCard);
      });

      if (serviceSearchClear) serviceSearchClear.hidden = !query;

      if (!serviceSearchStatus) return;
      if (!query) {
        serviceSearchStatus.textContent = '';
      } else if (visibleCount === 0) {
        serviceSearchStatus.textContent = 'No services match that name. Try another service name.';
      } else {
        serviceSearchStatus.textContent = `${visibleCount} service${visibleCount === 1 ? '' : 's'} found.`;
      }
    };

    serviceSearch.addEventListener('input', applySearch);
    serviceSearchClear?.addEventListener('click', () => {
      serviceSearch.value = '';
      serviceSearch.focus();
      applySearch();
    });
  }

  const menuToggle = document.getElementById('menuToggle');
  const navBar = document.getElementById('navBar');
  const navOverlay = document.getElementById('navOverlay');
  const icon = menuToggle ? menuToggle.querySelector('i') : null;

  if (!menuToggle || !navBar) return;

  const setNavOffset = () => {
    const topBar = document.querySelector('.top-bar');
    const header = document.querySelector('.main-header');
    const topBarHeight = topBar ? topBar.getBoundingClientRect().height : 0;
    const headerHeight = header ? header.getBoundingClientRect().height : 0;

    document.documentElement.style.setProperty('--top-bar-height', `${topBarHeight}px`);
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
  };

  const setOpen = (isOpen) => {
    navBar.classList.toggle('active', isOpen);
    navOverlay?.classList.toggle('active', isOpen);
    if (navOverlay) navOverlay.hidden = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    navBar.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';

    if (icon) {
      icon.classList.toggle('fa-bars', !isOpen);
      icon.classList.toggle('fa-xmark', isOpen);
    }
  };

  const isOpen = () => navBar.classList.contains('active');

  menuToggle.addEventListener('click', () => {
    setNavOffset();
    setOpen(!isOpen());
  });

  navOverlay?.addEventListener('click', () => setOpen(false));

  navBar.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });

  window.addEventListener('resize', () => {
    setNavOffset();
  });

  setNavOffset();
});
