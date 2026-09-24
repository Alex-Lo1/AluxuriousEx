document.addEventListener('DOMContentLoaded', () => {
  const voucherModal = document.getElementById('voucherModal');
  const openVoucherModal = document.getElementById('openVoucherModal');

  if (voucherModal && openVoucherModal) {
    const closeVoucherModal = () => {
      voucherModal.hidden = true;
      document.body.classList.remove('voucher-modal-open');
    };

    const voucherForm = document.getElementById('voucherForm');
    const voucherReady = document.getElementById('voucherReady');
    const voucherError = document.getElementById('voucherError');

    const closeVoucherReady = () => {
      if (voucherReady) voucherReady.hidden = true;
      if (voucherModal.hidden) document.body.classList.remove('voucher-modal-open');
    };

    const resetVoucherForm = () => {
      voucherForm?.reset();
      if (voucherError) {
        voucherError.hidden = true;
        voucherError.textContent = '';
      }
      const voucherMinNote = document.getElementById('voucherMinNote');
      if (voucherMinNote) voucherMinNote.hidden = true;
      if (voucherEmailLabel) voucherEmailLabel.textContent = 'Your email';
    };

    openVoucherModal.addEventListener('click', () => {
      resetVoucherForm();
      voucherModal.hidden = false;
      document.body.classList.add('voucher-modal-open');
      voucherModal.querySelector('.voucher-modal-close')?.focus();
    });

    const voucherPrice = document.getElementById('voucherPrice');
    const voucherCustom = document.getElementById('voucherCustom');

    voucherPrice?.addEventListener('change', () => {
      if (voucherPrice.value && voucherCustom) voucherCustom.value = '';
    });

    voucherCustom?.addEventListener('input', () => {
      if (voucherCustom.value && voucherPrice) voucherPrice.value = '';
      const amount = Number(voucherCustom.value);
      const tooLow = voucherCustom.value !== '' && amount < 15;
      const voucherMinNote = document.getElementById('voucherMinNote');
      if (voucherMinNote) voucherMinNote.hidden = !tooLow;
      voucherCustom.setCustomValidity(tooLow ? 'The minimum amount is £15.' : '');
    });

    const voucherEmailLabel = document.getElementById('voucherEmailLabel');
    voucherModal.querySelectorAll('input[name="voucherSend"]').forEach((choice) => {
      choice.addEventListener('change', () => {
        if (!voucherEmailLabel) return;
        voucherEmailLabel.textContent = choice.value === 'recipient'
          ? "Recipient's email"
          : 'Your email';
      });
    });

    const showVoucherError = (message) => {
      if (!voucherError) return;
      voucherError.hidden = !message;
      voucherError.textContent = message || '';
    };

    document.querySelector('.voucher-submit')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const sendTo = voucherForm.querySelector('input[name="voucherSend"]:checked')?.value || 'self';
      showVoucherError('');
      button.disabled = true;
      try {
        const response = await fetch('/api/gift-vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('voucherName')?.value || '',
            email: document.getElementById('voucherEmail')?.value || '',
            sendTo,
            amount: voucherPrice?.value || '',
            customAmount: voucherCustom?.value || '',
            message: document.getElementById('voucherMessage')?.value || '',
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          showVoucherError(data.error || 'The voucher could not be created.');
          return;
        }
        document.getElementById('voucherResultCode').textContent = data.code;
        const pounds = Number(data.amount);
        document.getElementById('voucherResultAmount').textContent = Number.isInteger(pounds)
          ? `£${pounds}`
          : `£${pounds.toFixed(2)}`;
        closeVoucherModal();
        if (voucherReady) {
          voucherReady.hidden = false;
          document.body.classList.add('voucher-modal-open');
          voucherReady.querySelector('.voucher-modal-close')?.focus();
        }
      } catch (error) {
        showVoucherError('The voucher could not be created. Please try again.');
      } finally {
        button.disabled = false;
      }
    });

    voucherModal.querySelectorAll('[data-close-voucher-modal]').forEach((el) => {
      el.addEventListener('click', closeVoucherModal);
    });

    voucherReady?.querySelectorAll('[data-close-voucher-ready]').forEach((el) => {
      el.addEventListener('click', closeVoucherReady);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (voucherReady && !voucherReady.hidden) closeVoucherReady();
      else if (!voucherModal.hidden) closeVoucherModal();
    });
  }

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
