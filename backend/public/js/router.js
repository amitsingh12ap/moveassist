/* MoveAssist — Navigation & Routing */
/* router.js */

// ─── NAVIGATION ───────────────────────────────────────────────
function navTo(screen) {
  // Mobile bottom nav
  ['home','scan','profile'].forEach(s => {
    document.getElementById('nav-'+s)?.classList.remove('active');
  });
  document.getElementById('nav-'+screen)?.classList.add('active');

  // Desktop sidebar
  ['home','scan','profile'].forEach(s => {
    document.getElementById('dsk-'+s)?.classList.remove('active');
  });
  document.getElementById('dsk-'+screen)?.classList.add('active');

  if (screen === 'scan') startCamera();
  else { stopCamera(); if (typeof hideScanSuccess === 'function') hideScanSuccess(); }
  const screenId = screen === 'home' && user?.role === 'admin' ? 'admin' : screen === 'home' && user?.role === 'agent' ? 'agent' : screen;
  showScreen(screenId);
  if (screenId === 'admin') openAdminDashboard();
  else if (screenId === 'agent') loadAgentMoves();
  setTopbar(screen);

  // Scroll handled by showScreen
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) {
    el.classList.add('active');
    // Scroll to top within the screen
    setTimeout(() => { el.scrollTop = 0; }, 50);
  }
  if (id === 'auth') {
    document.body.classList.add('auth-mode');
    // Auth: hide desk-topbar, show sidebar brand only
    const dt = document.getElementById('deskTopbar');
    if (dt) dt.style.display = 'none';
  } else {
    document.body.classList.remove('auth-mode');
    // Re-show desk-topbar if desktop + logged in
    if (isDesktop() && user) {
      const dt = document.getElementById('deskTopbar');
      if (dt) dt.style.display = 'flex';
    }
  }
  currentScreen = id;
}

function goBack() {
  if (user?.role === 'agent' || user?.role === 'admin') {
    showScreen('agent');
    loadAgentMoves();
  } else {
    showScreen('home');
    loadMoves();
  }
}

function setTopbar(screen) {
  const mTitles = {
    home: 'Move<span style="color:var(--sub);font-weight:700">Assist</span>',
    agent: 'Agent Dashboard',
    scan: 'QR Scanner',
    profile: 'Profile',
    move: 'Move Detail',
    boxes: 'Boxes',
    furniture: 'Furniture',
    report: 'Report',
    payment: 'Payment',
    admin: 'Admin',
  };
  const dTitles = {
    home: 'My Moves',
    agent: 'Agent Dashboard',
    scan: 'QR Scanner',
    profile: 'Profile',
    move: 'Move Detail',
    boxes: 'Boxes',
    furniture: 'Furniture',
    report: 'Report',
    payment: 'Payment',
    admin: 'Admin Dashboard',
  };
  const mobileTitle = document.getElementById('topbarTitle');
  if (mobileTitle) mobileTitle.innerHTML = mTitles[screen] || 'MoveAssist';
  // Update desk breadcrumb
  const bread = document.getElementById('deskBreadcrumb');
  if (bread) bread.textContent = dTitles[screen] || 'Dashboard';
  // Sync server dot on desktop topbar
  const dot2 = document.getElementById('serverDot2');
  if (dot2) {
    const dot1 = document.getElementById('serverDot');
    if (dot1) dot2.className = dot1.className;
    if (dot1) dot2.style.cssText = dot1.style.cssText;
  }
}

