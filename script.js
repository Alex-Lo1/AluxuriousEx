document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const navBar = document.getElementById('navBar');

  if (menuToggle && navBar) {
    menuToggle.addEventListener('click', () => {
      navBar.classList.toggle('active');
      
      // Switch icon between hamburger bars and close 'X'
      const icon = menuToggle.querySelector('i');
      if (icon) {
        if (navBar.classList.contains('active')) {
          icon.classList.remove('fa-bars');
          icon.classList.add('fa-xmark');
        } else {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });
  }
});