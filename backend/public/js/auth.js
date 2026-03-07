/* MoveAssist — Authentication */
/* auth.js */

// ─── AUTH ─────────────────────────────────────────────────────
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('authLoginForm').style.display = isLogin ? 'block' : 'none';
  document.getElementById('authRegisterForm').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authTabLogin').className = isLogin ? 'btn btn-primary' : 'btn btn-secondary';
  document.getElementById('authTabRegister').className = isLogin ? 'btn btn-secondary' : 'btn btn-primary';
  if (!isLogin) {
    document.getElementById('authTabLogin').style.cssText = 'flex:1;border-radius:8px;padding:10px;background:transparent;border:none;color:var(--sub)';
    document.getElementById('authTabRegister').style.cssText = 'flex:1;border-radius:8px;padding:10px';
  } else {
    document.getElementById('authTabLogin').style.cssText = 'flex:1;border-radius:8px;padding:10px';
    document.getElementById('authTabRegister').style.cssText = 'flex:1;border-radius:8px;padding:10px;background:transparent;border:none;color:var(--sub)';
  }
}

async function doLogin() {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Logging in...';
  try {
    const data = await api('POST', '/api/auth/login', {
      emailOrPhone: document.getElementById('loginEmailOrPhone').value,
      password: document.getElementById('loginPassword').value,
    });
    if (!data.token || !data.user) throw new Error('Invalid response from server');
    token = data.token;
    user = data.user;
    localStorage.setItem('ma_token', token);
    localStorage.setItem('ma_user', JSON.stringify(user));
    showApp();
    toast('Welcome back, ' + (user.name||'').split(' ')[0] + '!', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
  btn.disabled = false; btn.textContent = 'Login';
}

async function doRegister() {
  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    const data = await api('POST', '/api/auth/register', {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
      phone: document.getElementById('regPhone').value,
    });
    if (!data.token || !data.user) throw new Error('Invalid response from server');
    token = data.token;
    user = data.user;
    localStorage.setItem('ma_token', token);
    localStorage.setItem('ma_user', JSON.stringify(user));
    showApp();
    toast('Account created! Welcome 🎉', 'success');
  } catch(e) {
    toast(e.message, 'error');
  }
  btn.disabled = false; btn.textContent = 'Create Account';
}

function doLogout() {
  token = ''; user = null;
  localStorage.removeItem('ma_token');
  localStorage.removeItem('ma_user');
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('topbarUserInfo').style.display = 'none';
  document.body.classList.remove('logged-in');
  document.body.classList.add('auth-mode');
  showScreen('auth');
}

function isDesktop() { return window.innerWidth >= 900; }

function showApp() {
  document.body.classList.add('logged-in');
  document.body.classList.remove('auth-mode');
  // Bottom nav (mobile only)
  document.getElementById('bottomNav').style.display = 'flex';

  const initials = user?.name?.split(' ').map(w => w[0]).join('').substring(0, 2) || '?';
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = user?.name || '—';
  document.getElementById('profileEmail').textContent = user?.email || '—';
  document.getElementById('profileServer').textContent = BASE;

  // Role badge on profile
  const roleBadgeColor = { agent: 'var(--accent2)', admin: '#a78bfa', customer: 'var(--success)' };
  const roleEl = document.getElementById('profileRoleBadge');
  if (roleEl) {
    roleEl.textContent = (user?.role || 'customer').toUpperCase();
    roleEl.style.color = roleBadgeColor[user?.role] || 'var(--sub)';
  }

  // Desktop sidebar role label
  const roleLabel = { admin: 'SAAS CONTROL CENTER', agent: 'AGENT PORTAL', customer: 'CUSTOMER PORTAL' };
  document.getElementById('deskSidebarRole').textContent = roleLabel[user?.role] || 'CUSTOMER PORTAL';

  // Populate desktop inner topbar
  document.getElementById('deskUserName').textContent = user?.name || '';
  document.getElementById('deskUserRole').textContent = (user?.role || '').toUpperCase();
  document.getElementById('deskAvatar').textContent = initials;

  // Sync server dot to desktop topbar
  const dot1 = document.getElementById('serverDot');
  const dot2 = document.getElementById('serverDot2');
  if (dot1 && dot2) { dot2.className = dot1.className; dot2.style.cssText = dot1.style.cssText; }

  // Update sidebar home button label based on role
  const homeBtn = document.getElementById('dsk-home');
  const homeBtnLabel = homeBtn?.querySelector('span') || homeBtn?.lastChild;
  if (homeBtn) {
    const svgPart = homeBtn.innerHTML.match(/<svg[^]*?<\/svg>/)?.[0] || '';
    if (user?.role === 'admin') homeBtn.innerHTML = svgPart + ' Admin Panel';
    else if (user?.role === 'agent') homeBtn.innerHTML = svgPart + ' Dashboard';
    else homeBtn.innerHTML = svgPart + ' My Moves';
  }

  // Hide QR Scanner from sidebar for admin (field tool only)
  // Also hide for customers — they can't scan boxes
  const scanBtn = document.getElementById('dsk-scan');
  const mobileScanBtn = document.getElementById('nav-scan');
  const isCustomer = user?.role === 'customer' || (!user?.role);
  if (scanBtn) scanBtn.style.display = (user?.role === 'admin' || isCustomer) ? 'none' : '';
  if (mobileScanBtn) mobileScanBtn.style.display = isCustomer ? 'none' : '';

  // Show admin navigation items for admin users
  if (user?.role === 'admin') {
    const adminSection = document.getElementById('dsk-admin-section');
    const addonsBtn = document.getElementById('dsk-addons');
    if (adminSection) adminSection.style.display = '';
    if (addonsBtn) addonsBtn.style.display = '';
  }

  // Topbar user info (mobile only)
  document.getElementById('topbarUserInfo').style.display = isDesktop() ? 'none' : 'flex';
  document.getElementById('topbarUserInfo').style.flexDirection = 'column';
  document.getElementById('topbarUserInfo').style.alignItems = 'flex-end';
  const uname = document.getElementById('topbarUserName');
  const urole = document.getElementById('topbarUserRole');
  if (uname) uname.textContent = user?.name || '';
  if (urole) urole.textContent = (user?.role || '').toUpperCase();

  // Mobile nav labels
  const mobileHome = document.getElementById('nav-home');
  if (mobileHome) {
    if (user?.role === 'admin') { mobileHome.querySelector('.nav-label').textContent = 'Admin'; mobileHome.querySelector('.nav-icon').textContent = '🛡️'; }
    else if (user?.role === 'agent') { mobileHome.querySelector('.nav-label').textContent = 'Dashboard'; mobileHome.querySelector('.nav-icon').textContent = '🗂️'; }
    else { mobileHome.querySelector('.nav-label').textContent = 'Moves'; mobileHome.querySelector('.nav-icon').textContent = '🏠'; }
  }

  if (user?.role === 'admin') { showScreen('admin'); openAdminDashboard(); }
  else if (user?.role === 'agent') { navTo('agent'); loadAgentMoves(); }
  else { navTo('home'); loadMoves(); }
  loadNotifCount();
}

