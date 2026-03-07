/* MoveAssist — Admin Dashboard & Pricing */
/* admin.js */

// ─── ADMIN DASHBOARD ─────────────────────────────────────────
let adminTab = 'overview';
let adminData = {};

function openAdminDashboard() {
  showScreen('admin');
  setTopbar('admin');
  switchAdminTab('overview');
}

function switchAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  const btn = document.getElementById('atab-' + tab);
  if (btn) btn.classList.add('active');
  document.getElementById('adminContent').innerHTML =
    '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  ({ overview: renderAdminOverview, moves: renderAdminMoves,
     payments: renderAdminPayments, users: renderAdminUsers,
     addons: renderAdminAddons,
     pricing: renderAdminPricing,
     flags: renderAdminFlags }[tab] || (() => {}))();
}

async function renderAdminOverview() {
  const c = document.getElementById('adminContent');
  try {
    const [stats, pending, recentMoves] = await Promise.all([
      api('GET', '/api/admin/stats'),
      api('GET', '/api/admin/payments/pending'),
      api('GET', '/api/admin/moves'),
    ]);
    adminData.stats = stats; adminData.pending = pending;
    const statusBreakdown = [
      { label:'Active',      val:parseInt(stats.moves.active||0),      color:'#3b82f6' },
      { label:'In Progress', val:parseInt(stats.moves.in_progress||0), color:'#f59e0b' },
      { label:'Completed',   val:parseInt(stats.moves.completed||0),   color:'#22c55e' },
      { label:'Pending Pay', val:parseInt(stats.moves.unpaid||0),      color:'#f97316' },
    ];
    const totalMoves = Math.max(parseInt(stats.moves.total||1),1);
    const recent6 = (recentMoves||[]).slice(0,6);
    const SC = {active:'#3b82f6',in_progress:'#f59e0b',completed:'#22c55e',payment_pending:'#f97316',payment_under_verification:'#8b5cf6',cancelled:'#ef4444',created:'#94a3b8'};
    c.innerHTML = `
      <!-- KPI Row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px">
        ${[
          {label:'TOTAL MOVES',       val:stats.moves.total,                                            sub:`+${parseInt(stats.moves.active||0)+parseInt(stats.moves.in_progress||0)} active`,   color:'var(--text)',    icon:'📦'},
          {label:'PAYMENT PENDING',   val:stats.moves.unpaid,                                           sub:`${stats.pending_verifications} verifying`,                                           color:'var(--warn)',    icon:'⏳'},
          {label:'REVENUE COLLECTED', val:'₹'+parseFloat(stats.revenue?.collected||0).toLocaleString('en-IN'), sub:`${stats.users.customers} customers`,                                        color:'var(--accent)',  icon:'💰'},
          {label:'FIELD AGENTS',      val:stats.users.agents,                                           sub:`${parseInt(stats.users.total)} total users`,                                         color:'var(--success)', icon:'👷'},
        ].map(k=>`
          <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;display:flex;align-items:center;gap:12px">
            <div style="font-size:26px;flex-shrink:0">${k.icon}</div>
            <div><div style="font-size:10px;color:var(--sub);font-weight:700;letter-spacing:0.6px;margin-bottom:3px">${k.label}</div>
            <div style="font-size:24px;font-weight:800;color:${k.color};line-height:1">${k.val}</div>
            <div style="font-size:11px;color:var(--sub);margin-top:2px">${k.sub}</div></div>
          </div>`).join('')}
      </div>
      <!-- 2-col body -->
      <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start">
        <!-- LEFT -->
        <div>
          ${pending.length ? `
          <div style="font-size:11px;font-weight:700;color:var(--warn);letter-spacing:0.8px;margin-bottom:8px">⚡ NEEDS ATTENTION (${pending.length})</div>
          <div class="card" style="padding:0;margin-bottom:18px">
            ${pending.map(p=>`
            <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.move_title}</div>
                <div style="font-size:11px;color:var(--sub);margin-top:1px">👤 ${p.customer_name} · ${p.payment_mode}</div>
              </div>
              <div style="font-weight:700;color:var(--accent);white-space:nowrap;font-size:13px">₹${parseFloat(p.amount).toLocaleString('en-IN')}</div>
              <div style="display:flex;gap:6px">
                <button onclick="adminVerifyPayment('${p.id}','approve')" style="padding:5px 11px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;color:var(--success);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">✓</button>
                <button onclick="adminVerifyPayment('${p.id}','reject')" style="padding:5px 11px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:var(--error);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">✗</button>
              </div>
            </div>`).join('')}
          </div>` : ''}
          <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:8px">🕐 RECENT MOVES</div>
          <div class="card" style="padding:0">
            ${recent6.length===0?`<div style="padding:20px;text-align:center;color:var(--sub);font-size:13px">No moves yet</div>`:
            recent6.map(m=>{const sc=SC[m.status]||'#94a3b8';return`
              <div onclick="openMove('${m.id}')" style="padding:11px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;cursor:pointer" onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background=''">
                <div style="width:7px;height:7px;border-radius:50%;background:${sc};flex-shrink:0"></div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.title||'Unnamed Move'}</div>
                  <div style="font-size:11px;color:var(--sub);margin-top:1px">${m.customer_name||'—'} · ${m.move_date?new Date(m.move_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'No date'}</div>
                </div>
                <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:${sc}22;color:${sc};white-space:nowrap">${(m.status||'').replace(/_/g,' ').toUpperCase()}</span>
              </div>`}).join('')}
            <div style="padding:9px 16px;text-align:right">
              <button onclick="switchAdminTab('moves')" style="background:none;border:none;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">View all moves →</button>
            </div>
          </div>
        </div>
        <!-- RIGHT sidebar -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card" style="padding:16px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:12px">📊 MOVE STATUS</div>
            ${statusBreakdown.map(s=>{const pct=Math.round((s.val/totalMoves)*100);return`
              <div style="margin-bottom:9px">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                  <span>${s.label}</span><span style="font-weight:700;color:${s.color}">${s.val}</span>
                </div>
                <div style="height:4px;background:var(--card2);border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${s.color};border-radius:99px"></div>
                </div>
              </div>`}).join('')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:12px">💵 REVENUE</div>
            ${[
              {label:'Collected',val:stats.revenue?.collected||0,color:'var(--success)'},
              {label:'Pending',  val:stats.revenue?.pending||0,  color:'var(--warn)'},
              {label:'Add-ons',  val:stats.revenue?.addons||0,   color:'var(--accent)'},
            ].map(r=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:12px;color:var(--sub)">${r.label}</span>
                <span style="font-size:13px;font-weight:700;color:${r.color}">₹${parseFloat(r.val).toLocaleString('en-IN')}</span>
              </div>`).join('')}
          </div>
          <div class="card" style="padding:16px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:10px">⚡ QUICK ACTIONS</div>
            ${[['moves','📋 Manage All Moves'],['payments','💳 Review Payments'],['users','👥 Manage Users'],['addons','🎁 Add-on Services']].map(([t,l])=>`
              <button onclick="switchAdminTab('${t}')" style="width:100%;padding:9px 12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left;margin-bottom:6px">${l}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  } catch(e) { c.innerHTML = errorState(e.message, 'renderAdminOverview()'); }
}

async function renderAdminMoves() {
  const c = document.getElementById('adminContent');
  try {
    const [moves, users] = await Promise.all([api('GET','/api/admin/moves'), api('GET','/api/admin/users')]);
    adminData.moves = moves;
    adminData.agents = users.filter(u => u.role === 'agent');
    c.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:8px">
        <input type="text" id="moveSearchInput" placeholder="Search moves…" oninput="filterAdminMoves()"
          style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:10px;font-family:inherit;font-size:14px;outline:none"/>
        <select id="moveStatusFilter" onchange="filterAdminMoves()"
          style="background:var(--card2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:10px;font-family:inherit;font-size:12px;outline:none">
          <option value="">All</option>
          <option value="payment_pending">Pending Payment</option>
          <option value="payment_under_verification">Verifying</option>
          <option value="active">Active</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div id="adminMovesList"></div>`;
    filterAdminMoves();
  } catch(e) { c.innerHTML = errorState(e.message, 'renderAdminMoves()'); }
}

function filterAdminMoves() {
  const q = (document.getElementById('moveSearchInput')?.value || '').toLowerCase();
  const filter = document.getElementById('moveStatusFilter')?.value || '';
  const moves = (adminData.moves || []).filter(m =>
    (!q || m.title.toLowerCase().includes(q) || (m.customer_name||'').toLowerCase().includes(q)) &&
    (!filter || m.status === filter)
  );
  const list = document.getElementById('adminMovesList');
  if (!list) return;
  if (!moves.length) { list.innerHTML = emptyState('🔍', 'No matches found', 'Try adjusting your search or filter criteria', { color: 'gray' }); return; }
  list.innerHTML = moves.map(m => {
    const s = STATUS_LABELS[m.status] || { label: m.status, color: 'var(--sub)', icon: '📦' };
    const agentOpts = (adminData.agents||[]).map(a =>
      `<option value="${a.id}" ${m.agent_id===a.id?'selected':''}>${a.name}</option>`).join('');
    const canForce = ['payment_pending','payment_under_verification','created'].includes(m.status);
    return `
    <div class="card" style="margin-bottom:10px;padding:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <div><div style="font-weight:700">${m.title}</div>
        <div style="font-size:12px;color:var(--sub)">👤 ${m.customer_name||'—'} · ${m.customer_email||''}</div></div>
        <span style="font-size:20px">${s.icon}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px">
        <span style="color:${s.color};font-weight:600">${s.label}</span>
        <span style="color:var(--dim)">📦 ${m.total_boxes} · ₹${parseFloat(m.amount_collected||0).toLocaleString('en-IN')}</span>
      </div>
      <div style="display:flex;gap:8px">
        <select id="agsel-${m.id}" style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--text);padding:8px;border-radius:8px;font-family:inherit;font-size:12px;outline:none">
          <option value="">— Assign Agent —</option>${agentOpts}
        </select>
        <button onclick="doAssignAgent('${m.id}')" style="padding:8px 12px;background:var(--accent);border:none;border-radius:8px;color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Assign</button>
        ${canForce?`<button onclick="doForceActivate('${m.id}')" style="padding:8px 10px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;color:var(--success);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer">⚡ Force</button>`:''}
      </div>
      ${['created','payment_pending'].includes(m.status) ? `
      <div style="margin-top:8px">
        <button onclick="openSetPricingModal('${m.id}')" style="width:100%;padding:9px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;color:var(--accent);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
          💰 ${m.amount_total > 0 ? 'Update' : 'Set'} Price${m.amount_total > 0 ? ` (₹${parseFloat(m.amount_total).toLocaleString('en-IN')} set)` : ''}
        </button>
      </div>` : ''}
      ${m.status === 'completed' ? `
      <div style="margin-top:8px">
        <button onclick="generateInvoice('${m.id}')" style="width:100%;padding:9px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:8px;color:#7c3aed;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          🧾 Generate Invoice
        </button>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function doAssignAgent(moveId) {
  const agentId = document.getElementById('agsel-'+moveId)?.value;
  if (!agentId) { toast('Select an agent first', 'error'); return; }
  try {
    const data = await api('PUT', `/api/admin/moves/${moveId}/assign-agent`, { agent_id: agentId });
    const agentName = data?.agent?.name || data?.agent_name || 'Agent';
    toast(`Agent "${agentName}" assigned ✓`, 'success');
    showScreen('admin');
    setTopbar('admin');
    renderAdminMoves();
  } catch(e) { toast(e.message, 'error'); }
}

async function doForceActivate(moveId) {
  if (!confirm('Force-activate this move without payment verification?')) return;
  try {
    await api('POST', `/api/admin/moves/${moveId}/force-activate`);
    toast('Move force-activated ✓', 'success');
    showScreen('admin');
    setTopbar('admin');
    renderAdminMoves();
  } catch(e) { toast(e.message, 'error'); }
}

async function renderAdminPayments() {
  const c = document.getElementById('adminContent');
  try {
    const [pending, all, users] = await Promise.all([
      api('GET','/api/admin/payments/pending'),
      api('GET','/api/admin/payments'),
      adminData.users ? Promise.resolve(adminData.users) : api('GET','/api/admin/users'),
    ]);
    if (!adminData.users) adminData.users = users;
    adminData.agents = (adminData.users||[]).filter(u => u.role === 'agent');
    const statusColor = { success:'var(--success)', under_verification:'#a78bfa', failed:'var(--error)', pending:'var(--warn)' };
    c.innerHTML = `
      ${pending.length ? `
      <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:12px">⚡ PENDING VERIFICATION (${pending.length})</div>
      <div class="card" style="padding:0;margin-bottom:16px">
        ${pending.map(p => {
          const isToken   = p.payment_type === 'token';
          const isBalance = p.payment_type === 'balance';
          const agentOpts = (adminData.agents||[]).map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
          const typeLabel = isToken ? '🔐 Token (10%)' : isBalance ? '💳 Balance' : '💰 Payment';
          return `
          <div style="padding:14px;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.move_title}</div>
                <div style="font-size:12px;color:var(--sub);margin-top:2px">👤 ${p.customer_name} · ${typeLabel} · ${p.payment_mode.replace('_',' ')}</div>
                ${p.transaction_id ? `<div style="font-size:11px;color:var(--dim);margin-top:2px">Ref: ${p.transaction_id}</div>` : ''}
                ${p.notes ? `<div style="font-size:11px;color:var(--dim);margin-top:2px">Note: ${p.notes}</div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:800;font-size:18px;color:var(--accent)">₹${parseFloat(p.amount).toLocaleString('en-IN')}</div>
                <div style="font-size:11px;color:var(--dim)">${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
              </div>
            </div>
            ${isToken ? `
            <div style="margin:10px 0 6px">
              <label style="font-size:11px;color:var(--sub);font-weight:600;display:block;margin-bottom:4px">Assign Agent (optional — can be done later)</label>
              <select id="tokenAgent_${p.move_id}" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px">
                <option value="">— No agent yet —</option>
                ${agentOpts}
              </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:6px">
              <button onclick="adminVerifyToken('${p.move_id}','approve')" style="flex:1;padding:10px;background:#dcfce7;border:1.5px solid #86efac;border-radius:8px;color:#15803d;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✓ Verify & Activate Move</button>
              <button onclick="adminVerifyToken('${p.move_id}','reject')" style="padding:10px 14px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;color:#dc2626;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✗</button>
            </div>` : `
            <div style="display:flex;gap:8px;margin-top:10px">
              <button onclick="adminVerifyBalance('${p.move_id}','approve')" style="flex:1;padding:10px;background:#dcfce7;border:1.5px solid #86efac;border-radius:8px;color:#15803d;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✓ Verify Balance</button>
              <button onclick="adminVerifyBalance('${p.move_id}','reject')" style="padding:10px 14px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;color:#dc2626;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✗</button>
            </div>`}
          </div>`;
        }).join('')}
      </div>` : ''}
      <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:12px">ALL PAYMENTS</div>
      <div class="card" style="padding:0">
        ${all.length ? all.map(p => `
        <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.move_title}</div>
              <div style="font-size:11px;color:var(--sub)">${p.customer_name} · ${p.payment_mode.replace('_',' ')}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:10px">
              <div style="font-weight:700;color:var(--accent)">₹${parseFloat(p.amount).toLocaleString('en-IN')}</div>
              <div style="font-size:11px;font-weight:600;color:${statusColor[p.status]||'var(--sub)'}">${p.status.replace('_',' ')}</div>
            </div>
          </div>
        </div>`).join('') : '<div style="padding:20px;text-align:center;color:var(--dim)">No payments yet</div>'}
      </div>`;
  } catch(e) { c.innerHTML = errorState(e.message, 'renderAdminPayments()'); }
}

async function renderAdminUsers() {
  const c = document.getElementById('adminContent');
  try {
    const response = await api('GET','/api/admin/users');
    
    // Ensure we have an array
    const users = Array.isArray(response) ? response : (response.users || []);
    
    if (!Array.isArray(users)) {
      console.error('Invalid response format:', response);
      throw new Error('Invalid response format from server');
    }
    
    adminData.users = users;
    const roleColor = { admin:'#a78bfa', agent:'var(--accent)', customer:'var(--accent2)' };
    const roleBg = { admin:'#f3f0ff', agent:'#eff6ff', customer:'#fef3c7' };
    const grouped = {
      admin: users.filter(u=>u.role==='admin'),
      agent: users.filter(u=>u.role==='agent'),
      customer: users.filter(u=>u.role==='customer'),
    };
    
    c.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:20px;font-weight:700;margin:0;color:var(--fg)">Users Management</h2>
          <p style="font-size:13px;color:var(--sub);margin:4px 0 0">Manage admins, agents, and customers. Roles are permanent once assigned.</p>
        </div>
        <button onclick="openCreateUserModal()" class="btn-primary" style="padding:10px 20px">+ New User</button>
      </div>
      
      ${['admin','agent','customer'].map((role,i) => `
      ${i>0?'<div style="height:8px"></div>':''}
      <div style="font-size:11px;font-weight:700;color:var(--sub);letter-spacing:0.8px;margin-bottom:12px">${role.toUpperCase()}S (${grouped[role].length})</div>
      <div class="card" style="padding:0">
        ${grouped[role].length ? grouped[role].map(u => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;background:${roleColor[u.role]};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:white">
            ${(u.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${u.name}</div>
            <div style="font-size:12px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.email}</div>
            ${u.total_moves>0?`<div style="font-size:11px;color:var(--dim)">${u.total_moves} moves</div>`:''}
          </div>
          <div style="background:${roleBg[u.role]};border:1px solid ${roleColor[u.role]};color:${roleColor[u.role]};padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;flex-shrink:0;text-transform:capitalize">
            ${u.role}
          </div>
          ${u.role !== 'admin' ? `<button onclick="deleteUser('${u.id}')" style="background:#fee;border:1px solid #fcc;color:#c00;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">Delete</button>` : ''}
        </div>`).join('') : '<div style="padding:16px;color:var(--dim);font-size:13px;text-align:center">None</div>'}
      </div>`).join('')}
    `;
  } catch(e) { c.innerHTML = errorState(e.message, 'renderAdminUsers()'); }
}

async function adminVerifyPayment(paymentId, action) {
  try {
    const data = await api('POST', `/api/admin/payments/${paymentId}/verify`, { action });
    toast(data.message, action==='approve' ? 'success' : 'error');
    switchAdminTab(adminTab);
  } catch(e) { toast(e.message, 'error'); }
}

// Role changes disabled - roles are permanent once assigned

function openCreateUserModal() {
  openModal('createUserModal');
  document.getElementById('createUserForm').reset();
}

async function createNewUser() {
  const form = document.getElementById('createUserForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  
  const data = {
    name: document.getElementById('newUserName').value,
    email: document.getElementById('newUserEmail').value,
    password: document.getElementById('newUserPassword').value,
    phone: document.getElementById('newUserPhone').value || null,
    role: document.getElementById('newUserRole').value
  };
  
  try {
    await api('POST', '/api/admin/users/create', data);
    toast(`${data.role === 'agent' ? 'Agent' : data.role === 'admin' ? 'Sub-admin' : 'User'} created successfully!`, 'success');
    closeModal('createUserModal');
    renderAdminUsers();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user? This action cannot be undone.')) return;
  try {
    const response = await api('DELETE', `/api/admin/users/${userId}`);
    toast('User deleted successfully', 'success');
    await renderAdminUsers();
  } catch(e) { 
    console.error('Delete user error:', e);
    toast(e.message, 'error'); 
  }
}

const FLAG_META = {
  intra_city_only:  { label: 'Intra-City Only',      desc: 'Restrict move creation to same-city routes only', icon: '🏙️' },
  cost_estimator:   { label: 'Cost Estimator',        desc: 'Show BHK-based price estimate during move creation', icon: '💰' },
  client_inventory: { label: 'Client Inventory',      desc: 'Allow clients to declare items before move day', icon: '📋' },
  damage_disputes:  { label: 'Damage Disputes',       desc: 'Let clients raise a dispute on condition changes', icon: '⚠️' },
  post_move_rating: { label: 'Post-Move Rating',      desc: 'Prompt clients to rate their move after completion', icon: '⭐' },
  document_vault:   { label: 'Document Vault',        desc: 'Allow document uploads (NOC, permits, etc.)', icon: '📁' },
  notifications:    { label: 'In-App Notifications',  desc: 'Enable real-time activity notifications for clients', icon: '🔔' },
};

async function renderAdminFlags() {
  const c = document.getElementById('adminContent');
  try {
    const flags = await api('GET', '/api/feature-flags');
    c.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--sub)">Toggle features on/off without redeploying. Changes take effect immediately.</div>
      </div>
      <div class="card" style="padding:0">
        ${flags.map((f, i) => {
          const meta = FLAG_META[f.key] || { label: f.key, desc: '', icon: '🚩' };
          return `
          <div style="display:flex;align-items:center;gap:14px;padding:16px 16px;${i < flags.length-1 ? 'border-bottom:1px solid var(--border)' : ''}">
            <div style="font-size:24px;flex-shrink:0">${meta.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px">${meta.label}</div>
              <div style="font-size:12px;color:var(--sub);margin-top:2px">${meta.desc}</div>
            </div>
            <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer">
              <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleFlag('${f.key}',this.checked)"
                style="opacity:0;width:0;height:0;position:absolute">
              <span id="toggle-${f.key}" style="position:absolute;inset:0;border-radius:24px;transition:0.2s;background:${f.enabled ? '#2563eb' : '#e2e8f0'}">
                <span style="position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:${f.enabled ? '23px' : '3px'};transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
              </span>
            </label>
          </div>`;
        }).join('')}
      </div>`;
  } catch(e) { c.innerHTML = errorState(e.message, 'renderAdminFlags()'); }
}

async function toggleFlag(key, enabled) {
  try {
    await api('PUT', `/api/feature-flags/${key}`, { enabled });
    const span = document.getElementById('toggle-' + key);
    if (span) {
      span.style.background = enabled ? '#2563eb' : '#e2e8f0';
      const knob = span.querySelector('span');
      if (knob) knob.style.left = enabled ? '23px' : '3px';
    }
    toast(`${FLAG_META[key]?.label || key} ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'error');
  } catch(e) { toast(e.message, 'error'); }
}

// ── PRICING ADMIN ──────────────────────────────────────────────
let pricingConfigs = [];

async function renderAdminPricing() {
  const c = document.getElementById('adminContent');
  c.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  
  try {
    pricingConfigs = await api('GET', '/api/admin/pricing');
    
    const activeCount = pricingConfigs.filter(p => p.is_active).length;
    const cityCount = pricingConfigs.filter(p => p.city).length;
    const defaultConfig = pricingConfigs.find(p => p.is_default);
    
    c.innerHTML = `
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <h2 style="font-size:20px;font-weight:700;margin:0;color:var(--fg)">Pricing Configuration</h2>
            <p style="font-size:13px;color:var(--sub);margin:4px 0 0">Manage pricing models for different cities and routes</p>
          </div>
          <button onclick="openPricingModal()" class="btn-primary" style="padding:10px 20px">+ New Pricing</button>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
          <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #93c5fd">
            <div style="font-size:11px;color:#1e40af;font-weight:600;margin-bottom:8px">TOTAL CONFIGS</div>
            <div style="font-size:28px;font-weight:700;color:#1e3a8a">${pricingConfigs.length}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1px solid #6ee7b7">
            <div style="font-size:11px;color:#047857;font-weight:600;margin-bottom:8px">ACTIVE</div>
            <div style="font-size:28px;font-weight:700;color:#065f46">${activeCount}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:1px solid #fcd34d">
            <div style="font-size:11px;color:#b45309;font-weight:600;margin-bottom:8px">CITY-SPECIFIC</div>
            <div style="font-size:28px;font-weight:700;color:#92400e">${cityCount}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#fae8ff 0%,#f3e8ff 100%);border:1px solid #d8b4fe">
            <div style="font-size:11px;color:#7e22ce;font-weight:600;margin-bottom:8px">DEFAULT</div>
            <div style="font-size:14px;font-weight:700;color:#6b21a8;margin-top:8px">${defaultConfig ? defaultConfig.config_name : 'None'}</div>
          </div>
        </div>
      </div>
      
      <div id="pricingGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:20px">
        ${pricingConfigs.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--sub)">No pricing configurations yet. Create your first one!</div>' : 
          pricingConfigs.map(config => `
            <div class="card" style="background:${config.is_default ? 'linear-gradient(135deg,#ecfdf5 0%,#ffffff 100%)' : 'white'};
                                        border:2px solid ${config.is_default ? '#10b981' : '#e2e8f0'};
                                        ${!config.is_active ? 'opacity:0.6;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
                <div>
                  <div style="font-size:16px;font-weight:600">${config.config_name}</div>
                  <div style="font-size:13px;color:var(--sub);margin-top:4px">${config.city || 'National Default'}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${config.is_default ? '<span class="badge badge-green">Default</span>' : ''}
                  ${config.is_active ? '<span class="badge badge-blue">Active</span>' : '<span class="badge badge-slate">Inactive</span>'}
                </div>
              </div>
              
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px">
                <div style="background:#f8fafc;padding:10px;border-radius:6px">
                  <div style="font-size:11px;color:var(--sub);font-weight:600;margin-bottom:4px">1 BHK</div>
                  <div style="font-size:15px;font-weight:600">₹${new Intl.NumberFormat('en-IN').format(config.base_1bhk)}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:6px">
                  <div style="font-size:11px;color:var(--sub);font-weight:600;margin-bottom:4px">2 BHK</div>
                  <div style="font-size:15px;font-weight:600">₹${new Intl.NumberFormat('en-IN').format(config.base_2bhk)}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:6px">
                  <div style="font-size:11px;color:var(--sub);font-weight:600;margin-bottom:4px">3 BHK</div>
                  <div style="font-size:15px;font-weight:600">₹${new Intl.NumberFormat('en-IN').format(config.base_3bhk)}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:6px">
                  <div style="font-size:11px;color:var(--sub);font-weight:600;margin-bottom:4px">Local Rate</div>
                  <div style="font-size:15px;font-weight:600;color:#2563eb">₹${config.rate_per_km_local}/km</div>
                </div>
              </div>
              
              <div style="display:flex;gap:8px;padding-top:16px;border-top:1px solid #f1f5f9">
                <button onclick='editPricing("${config.id}")' class="btn-outline" style="flex:1;font-size:13px">✏️ Edit</button>
                <button onclick='togglePricingActive("${config.id}",${!config.is_active})' class="btn-outline" style="flex:1;font-size:13px">
                  ${config.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                </button>
                ${!config.is_default ? `<button onclick='deletePricing("${config.id}")' class="btn-outline" style="flex:1;font-size:13px;color:#ef4444">🗑️ Delete</button>` : ''}
              </div>
            </div>
          `).join('')}
      </div>
    `;
  } catch(e) {
    c.innerHTML = errorState(e.message, 'renderAdminPricing()');
  }
}

function openPricingModal() {
  openModal('pricingModal');
  document.getElementById('pricingForm').reset();
  document.getElementById('pricingId').value = '';
  document.getElementById('pricingIsActive').checked = true;
  document.getElementById('pricingIsDefault').checked = false;
  // Set defaults
  document.getElementById('pricingBase1').value = 5500;
  document.getElementById('pricingBase2').value = 10000;
  document.getElementById('pricingBase3').value = 16000;
  document.getElementById('pricingBase4').value = 21000;
  document.getElementById('pricingBase5').value = 28000;
  document.getElementById('pricingRateLocal').value = 12;
  document.getElementById('pricingRateRegional').value = 20;
  document.getElementById('pricingRateIntercity').value = 15;
  document.getElementById('pricingFloorCharge').value = 400;
  document.getElementById('pricingPacking').value = 25;
  document.getElementById('pricingFragile').value = 5;
  document.getElementById('pricingGst').value = 18;
}

function editPricing(id) {
  const config = pricingConfigs.find(c => c.id === id);
  if (!config) return;
  
  openModal('pricingModal');
  document.getElementById('pricingId').value = id;
  document.getElementById('pricingConfigName').value = config.config_name;
  document.getElementById('pricingCity').value = config.city || '';
  document.getElementById('pricingIsActive').checked = config.is_active;
  document.getElementById('pricingIsDefault').checked = config.is_default;
  document.getElementById('pricingBase1').value = config.base_1bhk;
  document.getElementById('pricingBase2').value = config.base_2bhk;
  document.getElementById('pricingBase3').value = config.base_3bhk;
  document.getElementById('pricingBase4').value = config.base_4bhk;
  document.getElementById('pricingBase5').value = config.base_5bhk;
  document.getElementById('pricingRateLocal').value = config.rate_per_km_local;
  document.getElementById('pricingRateRegional').value = config.rate_per_km_regional;
  document.getElementById('pricingRateIntercity').value = config.rate_per_km_intercity;
  document.getElementById('pricingFloorCharge').value = config.floor_charge_no_lift;
  document.getElementById('pricingPacking').value = config.packing_material_percent;
  document.getElementById('pricingFragile').value = config.fragile_items_percent;
  document.getElementById('pricingGst').value = config.gst_percent;
  document.getElementById('pricingNotes').value = config.notes || '';
}

async function savePricing() {
  const form = document.getElementById('pricingForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  
  const data = {
    config_name: document.getElementById('pricingConfigName').value,
    city: document.getElementById('pricingCity').value || null,
    is_active: document.getElementById('pricingIsActive').checked,
    is_default: document.getElementById('pricingIsDefault').checked,
    base_1bhk: parseFloat(document.getElementById('pricingBase1').value),
    base_2bhk: parseFloat(document.getElementById('pricingBase2').value),
    base_3bhk: parseFloat(document.getElementById('pricingBase3').value),
    base_4bhk: parseFloat(document.getElementById('pricingBase4').value),
    base_5bhk: parseFloat(document.getElementById('pricingBase5').value),
    rate_per_km_local: parseFloat(document.getElementById('pricingRateLocal').value),
    rate_per_km_regional: parseFloat(document.getElementById('pricingRateRegional').value),
    rate_per_km_intercity: parseFloat(document.getElementById('pricingRateIntercity').value),
    floor_charge_no_lift: parseFloat(document.getElementById('pricingFloorCharge').value),
    packing_material_percent: parseFloat(document.getElementById('pricingPacking').value),
    fragile_items_percent: parseFloat(document.getElementById('pricingFragile').value),
    gst_percent: parseFloat(document.getElementById('pricingGst').value),
    notes: document.getElementById('pricingNotes').value || null
  };
  
  const id = document.getElementById('pricingId').value;
  try {
    if (id) {
      await api('PUT', `/api/admin/pricing/${id}`, data);
      toast('Pricing updated!', 'success');
    } else {
      await api('POST', '/api/admin/pricing', data);
      toast('Pricing created!', 'success');
    }
    closeModal('pricingModal');
    renderAdminPricing();
  } catch(e) { toast(e.message, 'error'); }
}

async function togglePricingActive(id, newState) {
  try {
    await api('PUT', `/api/admin/pricing/${id}`, { is_active: newState });
    toast(`Pricing ${newState ? 'activated' : 'deactivated'}!`, 'success');
    renderAdminPricing();
  } catch(e) { toast(e.message, 'error'); }
}

async function deletePricing(id) {
  if (!confirm('Delete this pricing configuration? This cannot be undone.')) return;
  try {
    await api('DELETE', `/api/admin/pricing/${id}`);
    toast('Pricing deleted!', 'success');
    renderAdminPricing();
  } catch(e) { toast(e.message, 'error'); }
}

