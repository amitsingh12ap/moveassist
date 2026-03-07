/* MoveAssist — Moves, Notifications, Ratings, Disputes, Documents */
/* moves.js */

// ─── MOVES ────────────────────────────────────────────────────
async function loadMoves() {
  const list = document.getElementById('movesList');
  list.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const moves = await api('GET', '/api/moves');

    // Desktop KPI banner
    const banner = document.getElementById('homeStatsBanner');
    const secTitle = document.getElementById('homeSectionTitle');
    if (banner && isDesktop()) {
      const active = moves.filter(m => m.status === 'active' || m.status === 'in_progress').length;
      const pending = moves.filter(m => ['payment_pending','created'].includes(m.status)).length;
      const totalBoxes = moves.reduce((s,m) => s + (parseInt(m.total_boxes)||0), 0);
      const delivered = moves.reduce((s,m) => s + (parseInt(m.delivered_boxes)||0), 0);
      banner.style.display = 'grid';
      if (secTitle) secTitle.style.display = 'block';
      banner.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-icon" style="background:#eff6ff;color:var(--accent)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
          <div class="kpi-val">${moves.length}</div>
          <div class="kpi-label">Total Moves</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background:#dcfce7;color:#15803d"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="kpi-val" style="color:#15803d">${active}</div>
          <div class="kpi-label">Active</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background:#fef3c7;color:#b45309"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
          <div class="kpi-val" style="color:#b45309">${pending}</div>
          <div class="kpi-label">Payment Pending</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background:#f0fdf4;color:#166534"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
          <div class="kpi-val" style="color:#166534">${delivered}/${totalBoxes}</div>
          <div class="kpi-label">Boxes Delivered</div>
        </div>`;
    }

    if (!moves.length) {
      list.innerHTML = emptyState('🏠', 'No moves yet', 'Plan your move from start to finish — track boxes, furniture, quotes, and payments in one place', { color: 'blue', action: 'openCreateMove()', actionLabel: '+ Create Your First Move' });
      return;
    }
    list.innerHTML = moves.map(m => {
      const isPending = ['payment_pending', 'created'].includes(m.status);
      const isVerifying = m.status === 'payment_under_verification';
      const s = STATUS_LABELS[m.status] || { label: m.status, color: 'var(--sub)', icon: '📦' };
      const statusClass = m.status === 'active' ? 'status-active' : isPending ? 'status-pending' : m.status === 'completed' ? 'status-completed' : '';
      const badgeClass = 'status-badge-' + m.status;
      const dateStr = m.move_date ? new Date(m.move_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : null;
      return `
      <div class="move-card ${statusClass}" onclick="openMove('${m.id}')">
        <div class="move-card-header">
          <div class="move-card-title">${m.title || 'Unnamed Move'}</div>
          <span class="move-card-badge ${badgeClass}">${s.label}</span>
        </div>
        <div class="move-card-route">
          <span class="from">${m.from_address || 'Origin not set'}</span>
          <span class="arrow">→</span>
          <span class="to">${m.to_address || 'Destination not set'}</span>
        </div>
        <div class="move-card-footer">
          <div class="move-card-stats">
            <span class="move-card-stat">📦 ${m.total_boxes||0} boxes</span>
            ${m.total_boxes > 0 ? `<span class="move-card-stat" style="color:var(--success)">✓ ${m.delivered_boxes||0} delivered</span>` : ''}
          </div>
          ${dateStr ? `<span class="move-card-date">📅 ${dateStr}</span>` : ''}
        </div>
        ${isPending ? `<div onclick="openPaymentScreen('${m.id}')" style="margin-top:10px;padding:9px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#b45309;display:flex;justify-content:space-between;align-items:center;cursor:pointer">
          <span>${parseFloat(m.estimated_cost||0) > 0 ? `🔐 Pay ₹${Math.round(parseFloat(m.estimated_cost)*0.1).toLocaleString('en-IN')} token to confirm` : '⏳ Awaiting price confirmation'}</span>
          <span style="font-weight:700;color:var(--accent)">${parseFloat(m.estimated_cost||0) > 0 ? 'Pay Now →' : 'View →'}</span>
        </div>` : ''}
        ${isVerifying ? `<div style="margin-top:10px;padding:9px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1d4ed8">
          🔍 Payment under verification by admin
        </div>` : ''}
        ${m.status === 'completed' ? `<div onclick="event.stopPropagation();generateInvoice('${m.id}')" style="margin-top:10px;padding:9px 12px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;font-size:12px;color:#7c3aed;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:600">
          <span>🧾 Download Invoice</span>
          <span style="font-weight:700">Download →</span>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = errorState(e.message, 'loadMoves()');
  }
}

async function openMove(id) {
  showScreen('move');
  setTopbar('move');
  const content = document.getElementById('moveDetailContent');
  content.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const m = await api('GET', `/api/moves/${id}`);
    currentMove = m;
    const boxes = await api('GET', `/api/boxes/move/${id}`);
    const furniture = await api('GET', `/api/furniture/move/${id}`);
    const delivered = Array.isArray(boxes) ? boxes.filter(b => b.status === 'delivered').length : 0;
    const paid = isActive(m);
    const isPending = ['payment_pending', 'created'].includes(m.status);
    const s = STATUS_LABELS[m.status] || { label: m.status, color: 'var(--sub)', icon: '📦' };

    const amtTotal = parseFloat(m.estimated_cost||0);
    const amtPaid  = parseFloat(m.amount_paid||0);
    const amtDue   = Math.max(0, amtTotal - amtPaid);
    const bhkLabel = { '1bhk':'1 BHK','2bhk':'2 BHK','3bhk':'3 BHK','4bhk':'4 BHK','villa':'Villa','studio':'Studio' }[m.bhk_type] || '';
    const bsColors = {packed:'#6366f1',loaded:'#f59e0b',in_transit:'#3b82f6',delivered:'#22c55e'};
    const bsLabels = {packed:'Packed',loaded:'Loaded',in_transit:'In Transit',delivered:'Delivered'};

    content.innerHTML = `
      <div class="move-detail-layout">

        <!-- LEFT: Main info -->
        <div class="move-detail-main">

          <!-- Title row -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
            <div style="min-width:0">
              <h2 style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin:0 0 8px;line-height:1.2">${m.title || 'Unnamed Move'}</h2>
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span class="move-card-badge status-badge-${m.status}" style="font-size:11px">${s.label}</span>
                ${m.move_date ? `<span style="font-size:12px;color:var(--sub)">📅 ${new Date(m.move_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>` : ''}
                ${bhkLabel ? `<span style="font-size:12px;color:var(--sub);background:var(--card2);padding:2px 8px;border-radius:99px">🏠 ${bhkLabel}</span>` : ''}
              </div>
            </div>
            <span style="font-size:30px;flex-shrink:0;opacity:0.85">${s.icon}</span>
          </div>

          <!-- Route card -->
          <div class="detail-card" style="margin-bottom:12px;padding:14px 16px">
            <div style="display:grid;grid-template-columns:1fr 28px 1fr;align-items:start;gap:8px">
              <div>
                <div style="font-size:10px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">From</div>
                <div style="font-size:13px;font-weight:600;line-height:1.3">${m.from_address || '—'}</div>
                ${m.floor_from != null ? `<div style="font-size:11px;color:var(--dim);margin-top:3px">Floor ${m.floor_from} · ${m.has_lift_from ? '🛗 Lift' : 'No lift'}</div>` : ''}
              </div>
              <div style="text-align:center;color:var(--accent);font-weight:700;font-size:18px;padding-top:16px">→</div>
              <div style="text-align:right">
                <div style="font-size:10px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">To</div>
                <div style="font-size:13px;font-weight:600;line-height:1.3">${m.to_address || '—'}</div>
                ${m.floor_to != null ? `<div style="font-size:11px;color:var(--dim);margin-top:3px">Floor ${m.floor_to} · ${m.has_lift_to ? '🛗 Lift' : 'No lift'}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Compact 4-stat row -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
            <div style="background:var(--card2);border-radius:10px;padding:10px 6px;text-align:center;border:1px solid var(--border)">
              <div style="font-size:19px;font-weight:800;color:var(--text)">${boxes.length}</div>
              <div style="font-size:10px;color:var(--sub);margin-top:2px;font-weight:600">Boxes</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:10px 6px;text-align:center;border:1px solid var(--border)">
              <div style="font-size:19px;font-weight:800;color:#22c55e">${delivered}</div>
              <div style="font-size:10px;color:var(--sub);margin-top:2px;font-weight:600">Delivered</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:10px 6px;text-align:center;border:1px solid var(--border)">
              <div style="font-size:19px;font-weight:800;color:${boxes.length-delivered>0?'#f59e0b':'var(--sub)'}">${boxes.length-delivered}</div>
              <div style="font-size:10px;color:var(--sub);margin-top:2px;font-weight:600">Remaining</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:10px 6px;text-align:center;border:1px solid var(--border)">
              <div style="font-size:19px;font-weight:800;color:var(--accent2)">${furniture.length}</div>
              <div style="font-size:10px;color:var(--sub);margin-top:2px;font-weight:600">Furniture</div>
            </div>
          </div>

          ${boxes.length > 0 ? `
          <!-- Progress + box breakdown combined -->
          <div class="detail-card" style="margin-bottom:12px;padding:12px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
              <span style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px">Delivery Progress</span>
              <span style="font-size:12px;font-weight:700;color:${delivered===boxes.length?'#22c55e':'var(--accent)'}">${delivered}/${boxes.length} delivered</span>
            </div>
            <div style="height:7px;background:var(--card2);border-radius:99px;overflow:hidden;margin-bottom:10px">
              <div style="height:100%;width:${Math.round((delivered/boxes.length)*100)}%;background:${delivered===boxes.length?'#22c55e':'var(--accent)'};border-radius:99px;transition:width 0.5s ease"></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${['packed','loaded','in_transit','delivered'].map(st => {
                const cnt = boxes.filter(b=>b.status===st).length;
                if(!cnt) return '';
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:${bsColors[st]}18;border:1px solid ${bsColors[st]}35;border-radius:99px;font-size:11px;font-weight:600;color:${bsColors[st]}"><span style="width:5px;height:5px;border-radius:50%;background:${bsColors[st]};flex-shrink:0"></span>${bsLabels[st]} ${cnt}</span>`;
              }).join('')}
            </div>
          </div>` : ''}

          ${(user?.role === 'agent' || user?.role === 'admin') && !['completed','cancelled'].includes(m.status) ? `
          <!-- Add-on services -->
          <div class="detail-card" id="addonsCard-${m.id}" style="margin-bottom:12px;padding:14px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px">🎁 Add-on Services</span>
              <button onclick="openAddonsModal('${m.id}')" style="padding:4px 12px;background:var(--accent);color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">+ Add</button>
            </div>
            <div id="moveAddons-${m.id}"><div style="color:var(--sub);font-size:12px;padding:4px 0">Loading…</div></div>
          </div>` : ''}

          <!-- Payment summary -->
          <div class="detail-card" style="margin-bottom:12px;padding:14px 16px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">💰 Payment Summary</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:${amtDue>0 && !isPending?'10px':'0'}">
              <div><div style="font-size:10px;color:var(--dim);margin-bottom:2px">Quote</div><div style="font-size:15px;font-weight:800">${amtTotal>0 ? '₹'+amtTotal.toLocaleString('en-IN') : '—'}</div></div>
              <div><div style="font-size:10px;color:var(--dim);margin-bottom:2px">Paid</div><div style="font-size:15px;font-weight:800;color:#22c55e">₹${amtPaid.toLocaleString('en-IN')}</div></div>
              <div><div style="font-size:10px;color:var(--dim);margin-bottom:2px">Balance</div><div style="font-size:15px;font-weight:800;color:${amtDue>0?'#ef4444':'#22c55e'}">₹${amtDue.toLocaleString('en-IN')}</div></div>
            </div>
            ${amtDue > 0 && !isPending ? `<button onclick="openPaymentScreen('${m.id}')" style="width:100%;margin-top:8px;padding:9px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;color:#dc2626;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Collect ₹${amtDue.toLocaleString('en-IN')} →</button>` : ''}
          </div>

          ${isPending ? `
          <div class="payment-gate" style="margin-bottom:12px">
            <div class="gate-icon">${amtTotal > 0 ? '🔐' : '⏳'}</div>
            <div class="gate-title">${amtTotal > 0 ? `Pay ₹${Math.round(amtTotal*0.1).toLocaleString('en-IN')} Token to Confirm Booking` : 'Awaiting Price Confirmation'}</div>
            <div class="gate-sub">${amtTotal > 0 ? `Total: ₹${amtTotal.toLocaleString('en-IN')} · Token is 10% to activate your booking` : 'Admin will confirm your price shortly. You\'ll be notified.'}</div>
            <button class="btn btn-primary" onclick="openPaymentScreen('${m.id}')" style="max-width:240px;margin:0 auto">${amtTotal > 0 ? 'Pay Token Now →' : 'View Payment Details →'}</button>
          </div>` : ''}

        </div>

        <!-- RIGHT: Sidebar -->
        <div class="move-detail-sidebar">

          <!-- 2×2 Action grid -->
          <div class="detail-card" style="margin-bottom:12px;padding:14px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Quick Actions</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button onclick="${paid ? `openBoxes('${m.id}')` : `showPaymentGate('${m.id}')`}" ${!paid?'disabled':''} style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;background:var(--card2);border:1px solid var(--border);border-radius:10px;cursor:${paid?'pointer':'default'};opacity:${paid?'1':'0.5'};font-family:inherit;transition:border-color 0.15s">
                <span style="font-size:22px">📦</span>
                <span style="font-size:11px;font-weight:700;color:var(--text)">Boxes</span>
                <span style="font-size:13px;font-weight:800;color:var(--accent)">${boxes.length}</span>
              </button>
              <button onclick="${paid ? `openFurniture('${m.id}')` : `showPaymentGate('${m.id}')`}" ${!paid?'disabled':''} style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;background:var(--card2);border:1px solid var(--border);border-radius:10px;cursor:${paid?'pointer':'default'};opacity:${paid?'1':'0.5'};font-family:inherit;transition:border-color 0.15s">
                <span style="font-size:22px">🛋️</span>
                <span style="font-size:11px;font-weight:700;color:var(--text)">Furniture</span>
                <span style="font-size:13px;font-weight:800;color:var(--accent)">${furniture.length}</span>
              </button>
              <button onclick="openPaymentScreen('${m.id}')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;background:var(--card2);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;transition:border-color 0.15s">
                <span style="font-size:22px">💳</span>
                <span style="font-size:11px;font-weight:700;color:var(--text)">Payment</span>
              </button>
              <button onclick="${paid ? `generateReport('${m.id}')` : `showPaymentGate('${m.id}')`}" ${!paid?'disabled':''} style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;background:${paid?'var(--accent)':'var(--card2)'};border:1px solid ${paid?'var(--accent)':'var(--border)'};border-radius:10px;cursor:${paid?'pointer':'default'};opacity:${paid?'1':'0.5'};font-family:inherit;transition:border-color 0.15s">
                <span style="font-size:22px">📄</span>
                <span style="font-size:11px;font-weight:700;color:${paid?'#fff':'var(--text)'}">PDF Report</span>
              </button>
            </div>
          </div>

          ${(user?.role === 'agent' || user?.role === 'admin') && (m.status === 'in_progress' || m.status === 'active') ? `
          <div style="margin-bottom:12px">
            <button onclick="attemptCompleteMove('${m.id}')" style="width:100%;padding:13px;background:#dcfce7;border:1.5px solid #86efac;border-radius:10px;color:#15803d;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Mark Move as Complete
            </button>
          </div>` : ''}

          ${m.agent_id && user?.role !== 'agent' ? `
          <div class="detail-card" style="padding:14px 16px">
            <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Assigned Agent</div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:${m.agent_phone?'10px':'0'}">
              <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0">${(m.agent_name||'A')[0].toUpperCase()}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.agent_name || 'Agent'}</div>
                <div style="font-size:11px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.agent_email || ''}</div>
              </div>
            </div>
            ${m.agent_phone ? `
            <div style="display:flex;gap:8px">
              <a href="tel:${m.agent_phone}" style="flex:1;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;color:#15803d">📞 Call</a>
              <a href="https://wa.me/${m.agent_phone.replace(/\D/g,'')}" target="_blank" style="flex:1;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;color:#15803d">💬 WhatsApp</a>
            </div>` : ''}
          </div>` : !m.agent_id && user?.role !== 'agent' ? `
          <div class="detail-card" style="padding:14px 16px;text-align:center">
            <div style="font-size:28px;margin-bottom:6px">👤</div>
            <div style="font-size:12px;font-weight:600;color:var(--sub)">No agent assigned yet</div>
          </div>` : ''}

        </div>
      </div>
    `;
    
    // Load add-ons for agents/admin (skip for completed/cancelled moves)
    if ((user?.role === 'agent' || user?.role === 'admin') && !['completed','cancelled'].includes(m.status)) {
      loadMoveAddons(id);
    }
  } catch(e) {
    content.innerHTML = errorState(e.message, 'openMove(currentMove?.id)');
  }
}

function openCreateMove() {
  document.getElementById('newMoveDate').value = new Date().toISOString().split('T')[0];
  openModal('createMoveModal');
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Address Autocomplete
// ══════════════════════════════════════════════
let addrCache = {}, addrTimers = {}, moveGeo = { from:{}, to:{} };

async function addressAutocomplete(input, suggestId, side) {
  const q = input.value.trim();
  const box = document.getElementById(suggestId);
  if (q.length < 3) { box.style.display = 'none'; return; }
  clearTimeout(addrTimers[side]);
  addrTimers[side] = setTimeout(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=in`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'MoveAssist/1.0' } });
      const results = await r.json();
      if (!results.length) { box.style.display = 'none'; return; }
      box.innerHTML = results.map(item => {
        const city = item.address?.city || item.address?.town || item.address?.village || item.address?.county || '';
        const state = item.address?.state || '';
        const display = item.display_name.split(',').slice(0,3).join(',');
        return `<div class="address-suggestion-item" onclick="selectAddress('${side}','${display.replace(/'/g,"\\'")}','${city.replace(/'/g,"\\'")}',${item.lat},${item.lon})">${display}</div>`;
      }).join('');
      box.style.display = 'block';
    } catch(e) { box.style.display = 'none'; }
  }, 350);
}

function selectAddress(side, display, city, lat, lon) {
  document.getElementById(side === 'from' ? 'newMoveFrom' : 'newMoveTo').value = display;
  document.getElementById(side === 'from' ? 'fromSuggestions' : 'toSuggestions').style.display = 'none';
  moveGeo[side] = { city, lat, lon };
  checkIntraCity();
}

function checkIntraCity() {
  const warn = document.getElementById('intraCityWarning');
  const btn = document.getElementById('createMoveNextBtn');
  if (moveGeo.from.city && moveGeo.to.city) {
    const same = moveGeo.from.city.toLowerCase().trim() === moveGeo.to.city.toLowerCase().trim();
    // Only block if feature flag is enabled (checked on server) — show warning optimistically
    warn.style.display = same ? 'none' : '';
    warn.textContent = `⚠️ We currently only support moves within the same city. Detected: ${moveGeo.from.city} → ${moveGeo.to.city}.`;
  }
}

async function useMyLocation() {
  const btn = document.getElementById('gpsBtn');
  if (!navigator.geolocation) { toast('Geolocation not supported by your browser', 'error'); return; }
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg> Locating...`;
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude: lat, longitude: lon } = pos.coords;
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'MoveAssist/1.0' } });
      const data = await r.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || '';
      const display = [addr.road, addr.suburb, city, addr.state].filter(Boolean).join(', ');
      document.getElementById('newMoveFrom').value = display;
      moveGeo.from = { city, lat, lon };
      checkIntraCity();
      toast('📍 Location detected!', 'success');
    } catch(e) { toast('Could not reverse geocode location', 'error'); }
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Use my location`;
    btn.disabled = false;
  }, err => {
    toast('Location access denied. Please enable GPS.', 'error');
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Use my location`;
    btn.disabled = false;
  }, { timeout: 10000 });
}

// ══════════════════════════════════════════════
// CLIENT FLOW — BHK + Estimator
// ══════════════════════════════════════════════
let selectedBHK = null, estimateData = null;

function selectBHK(bhk) {
  selectedBHK = bhk;
  ['studio','1bhk','2bhk','3bhk','4bhk'].forEach(b => {
    document.getElementById('bhk-'+b)?.classList.toggle('selected', b === bhk);
  });
  updateEstimate();
}

async function updateEstimate() {
  if (!selectedBHK) return;
  try {
    const data = await api('POST', '/api/pricing/estimate', {
      bhk_type: selectedBHK,
      num_furniture: 0, num_boxes: 0,
      floor_from: parseInt(document.getElementById('floorFrom')?.value)||0,
      floor_to: parseInt(document.getElementById('floorTo')?.value)||0,
      has_lift_from: document.getElementById('liftFrom')?.checked,
      has_lift_to: document.getElementById('liftTo')?.checked,
      has_fragile: document.getElementById('hasFragile')?.checked,
    });
    estimateData = data;
    const card = document.getElementById('estimateCard');
    const b = data.breakdown;
    card.style.display = 'block';
    document.getElementById('estimateTotal').textContent = data.display;
    document.getElementById('estimateBreakdown').innerHTML =
      `Base (${selectedBHK.toUpperCase()}): ₹${b.base.toLocaleString('en-IN')}` +
      (b.floorFrom > 0 ? ` · Floor pickup: ₹${b.floorFrom.toLocaleString('en-IN')}` : '') +
      (b.floorTo > 0 ? ` · Floor delivery: ₹${b.floorTo.toLocaleString('en-IN')}` : '') +
      (b.fragile > 0 ? ` · Fragile: ₹${b.fragile.toLocaleString('en-IN')}` : '') +
      ` · GST (18%): ₹${b.tax.toLocaleString('en-IN')}`;
  } catch(e) {}
}

async function createMoveStep2() {
  const title = document.getElementById('newMoveTitle').value.trim();
  const from = document.getElementById('newMoveFrom').value.trim();
  const to = document.getElementById('newMoveTo').value.trim();
  if (!title || !from || !to) { toast('Please fill all fields', 'error'); return; }
  document.getElementById('createStep1').style.display = 'none';
  document.getElementById('createStep2').style.display = 'block';
}

async function createMove() {
  const btn = document.getElementById('createMoveBtn');
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    const move = await api('POST', '/api/moves', {
      title: document.getElementById('newMoveTitle').value,
      from_address: document.getElementById('newMoveFrom').value,
      to_address: document.getElementById('newMoveTo').value,
      move_date: document.getElementById('newMoveDate').value,
      from_city: moveGeo.from.city || '',
      to_city: moveGeo.to.city || '',
      from_lat: moveGeo.from.lat, from_lng: moveGeo.from.lon,
      to_lat: moveGeo.to.lat, to_lng: moveGeo.to.lon,
      floor_from: parseInt(document.getElementById('floorFrom')?.value)||0,
      floor_to: parseInt(document.getElementById('floorTo')?.value)||0,
      has_lift_from: document.getElementById('liftFrom')?.checked||false,
      has_lift_to: document.getElementById('liftTo')?.checked||false,
      bhk_type: selectedBHK,
    });
    // Save pricing estimate
    if (estimateData && move.id) {
      const b = estimateData.breakdown;
      await api('POST', '/api/pricing/save', {
        move_id: move.id, base_price: b.base, num_rooms: 0,
        has_fragile: document.getElementById('hasFragile')?.checked||false,
        fragile_surcharge: b.fragile, floor_surcharge: b.floorFrom+b.floorTo,
        tax_percent: 18, discount: 0, total: b.total
      });
    }
    closeModal('createMoveModal');
    loadMoves();
    toast('Move created! 🎉', 'success');
    // Reset form
    ['newMoveTitle','newMoveFrom','newMoveTo'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    moveGeo = { from:{}, to:{} }; selectedBHK = null; estimateData = null;
    document.getElementById('createStep1').style.display = '';
    document.getElementById('createStep2').style.display = 'none';
  } catch(e) {
    if (e.message?.includes('INTRA_CITY_ONLY')) {
      toast('Only same-city moves are currently supported', 'error');
      document.getElementById('createStep2').style.display = 'none';
      document.getElementById('createStep1').style.display = '';
    } else if (e.message?.includes('CITIES_REQUIRED')) {
      toast('Please provide both pickup and delivery cities', 'error');
      document.getElementById('createStep2').style.display = 'none';
      document.getElementById('createStep1').style.display = '';
    } else {
      toast(e.message, 'error');
    }
  }
  btn.disabled = false; btn.textContent = 'Create Move 🎉';
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Notifications
// ══════════════════════════════════════════════
async function loadNotifCount() {
  try {
    const r = await api('GET', '/api/notifications/unread-count');
    const badge = document.getElementById('notifBadge');
    const bell = document.getElementById('notifBell');
    if (bell) bell.style.display = 'block';
    if (badge) {
      if (r.count > 0) { badge.textContent = r.count > 9 ? '9+' : r.count; badge.style.display = 'flex'; }
      else badge.style.display = 'none';
    }
  } catch(e) {}
}

async function openNotifications() {
  openModal('notifPanel');
  const list = document.getElementById('notifList');
  list.innerHTML = '<div style="text-align:center;padding:32px"><div class="spinner"></div></div>';
  try {
    const notifs = await api('GET', '/api/notifications');
    if (!notifs.length) {
      list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--sub)">No notifications yet</div>';
      return;
    }
    const icons = { box_scanned:'📦', furniture_delivered:'🛋️', move_completed:'✅', condition_change:'⚠️', dispute_raised:'🚨', rating_received:'⭐', move_created:'🏠' };
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read?'':'unread'}" onclick="markNotifRead('${n.id}',this)">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <span style="font-size:20px">${icons[n.type]||'🔔'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:${n.read?'500':'700'};color:var(--text)">${n.title}</div>
            ${n.body ? `<div style="font-size:12px;color:var(--sub);margin-top:2px">${n.body}</div>` : ''}
            <div style="font-size:11px;color:var(--dim);margin-top:4px">${timeAgo(n.created_at)}</div>
          </div>
          ${!n.read ? '<div style="width:8px;height:8px;background:var(--accent);border-radius:50%;flex-shrink:0;margin-top:4px"></div>' : ''}
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<div style="color:var(--error);padding:16px">${e.message}</div>`; }
}

async function markNotifRead(id, el) {
  await api('POST', '/api/notifications/mark-read', { ids: [id] });
  el.classList.remove('unread');
  loadNotifCount();
}

async function markAllNotifsRead() {
  await api('POST', '/api/notifications/mark-all-read');
  document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
  document.getElementById('notifBadge').style.display = 'none';
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}d ago`; if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`; return 'just now';
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Timeline / Activity Feed
// ══════════════════════════════════════════════
async function loadTimeline(moveId) {
  const el = document.getElementById('moveTimeline');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
  try {
    const acts = await api('GET', `/api/activities/move/${moveId}`);
    if (!acts.length) { el.innerHTML = '<div style="color:var(--sub);font-size:13px;padding:12px 0">No activity yet</div>'; return; }
    const typeStyle = {
      move_created: { bg:'#eff6ff', color:'#2563eb', icon:'🏠' },
      box_scanned: { bg:'#fef3c7', color:'#b45309', icon:'📦' },
      furniture_delivered: { bg:'#f0fdf4', color:'#16a34a', icon:'🛋️' },
      move_completed: { bg:'#dcfce7', color:'#16a34a', icon:'✅' },
      condition_change: { bg:'#fef2f2', color:'#dc2626', icon:'⚠️' },
    };
    el.innerHTML = acts.reverse().map(a => {
      const s = typeStyle[a.type] || { bg:'#f1f5f9', color:'#64748b', icon:'🔔' };
      return `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${s.bg};color:${s.color}">${s.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${a.title}</div>
          ${a.description ? `<div style="font-size:12px;color:var(--sub);margin-top:2px">${a.description}</div>` : ''}
          <div style="font-size:11px;color:var(--dim);margin-top:3px">${timeAgo(a.created_at)} · ${a.actor_name||a.actor_role||'System'}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {}
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Rating
// ══════════════════════════════════════════════
let currentRating = 0, ratingMoveId = null;

function openRateModal(moveId) {
  ratingMoveId = moveId;
  currentRating = 0;
  [1,2,3,4,5].forEach(n => { document.getElementById('star-'+n).style.opacity = '0.3'; });
  document.getElementById('ratingReview').value = '';
  openModal('rateMoveModal');
}

function setRating(n) {
  currentRating = n;
  [1,2,3,4,5].forEach(i => { document.getElementById('star-'+i).style.opacity = i <= n ? '1' : '0.3'; });
}

async function submitRating() {
  if (!currentRating) { toast('Please select a star rating', 'error'); return; }
  const btn = document.getElementById('submitRatingBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    await api('POST', `/api/ratings/move/${ratingMoveId}`, {
      rating: currentRating, review: document.getElementById('ratingReview').value
    });
    closeModal('rateMoveModal');
    toast(`Thanks for your ${currentRating}★ rating! 🙏`, 'success');
    openMove(ratingMoveId);
  } catch(e) { toast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Submit Rating';
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Dispute
// ══════════════════════════════════════════════
let disputePhotoDataUrl = null, disputeMoveId = null;

async function openDisputeModal(moveId) {
  disputeMoveId = moveId; disputePhotoDataUrl = null;
  document.getElementById('disputeDesc').value = '';
  document.getElementById('disputePhotoPreview').style.display = 'none';
  // Populate furniture
  try {
    const furn = await api('GET', `/api/furniture/move/${moveId}`);
    const sel = document.getElementById('disputeFurnSelect');
    sel.innerHTML = '<option value="">Select furniture item (optional)</option>';
    furn.forEach(f => sel.innerHTML += `<option value="${f.id}">${f.name}</option>`);
  } catch(e) {}
  openModal('disputeModal');
}

function handleDisputePhoto(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    disputePhotoDataUrl = e.target.result;
    document.getElementById('disputePhotoImg').src = disputePhotoDataUrl;
    document.getElementById('disputePhotoPreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitDispute() {
  const desc = document.getElementById('disputeDesc').value.trim();
  if (!desc) { toast('Please describe the issue', 'error'); return; }
  const btn = document.getElementById('submitDisputeBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    await api('POST', `/api/disputes/move/${disputeMoveId}`, {
      furniture_id: document.getElementById('disputeFurnSelect').value || null,
      description: desc,
      client_photo_url: disputePhotoDataUrl || null
    });
    closeModal('disputeModal');
    toast('Dispute submitted. Our team will review it shortly.', 'success');
  } catch(e) { toast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Submit Dispute';
}

// ══════════════════════════════════════════════
// CLIENT FLOW — Document Vault
// ══════════════════════════════════════════════
let docFileDataUrl = null, docVaultMoveId = null;

async function openDocVault(moveId) {
  docVaultMoveId = moveId;
  docFileDataUrl = null;
  document.getElementById('docName').value = '';
  openModal('docVaultModal');
  await loadDocVault(moveId);
}

async function loadDocVault(moveId) {
  const list = document.getElementById('docVaultList');
  list.innerHTML = '';
  try {
    const docs = await api('GET', `/api/documents/move/${moveId}`);
    if (!docs.length) { list.innerHTML = '<div style="color:var(--sub);font-size:13px;margin-bottom:8px">No documents uploaded yet</div>'; return; }
    const typeIcons = { noc:'📜', parking:'🅿️', entry:'🚪', insurance:'🛡️', other:'📄' };
    list.innerHTML = docs.map(d => `
      <div class="doc-card">
        <span style="font-size:20px">${typeIcons[d.doc_type]||'📄'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${d.name}</div>
          <div style="font-size:11px;color:var(--sub)">${d.doc_type?.toUpperCase()} · ${timeAgo(d.created_at)} · ${d.uploaded_by_name}</div>
        </div>
        <a href="${d.file_url}" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none">View</a>
      </div>`).join('');
  } catch(e) {}
}

function handleDocFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    docFileDataUrl = e.target.result;
    document.getElementById('docFilePreview').textContent = `✓ ${file.name}`;
    document.getElementById('docFilePreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function uploadDocument() {
  const name = document.getElementById('docName').value.trim();
  if (!name) { toast('Document name required', 'error'); return; }
  if (!docFileDataUrl) { toast('Please select a file', 'error'); return; }
  const btn = document.getElementById('uploadDocBtn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    await api('POST', `/api/documents/move/${docVaultMoveId}`, {
      name, doc_type: document.getElementById('docType').value, file_url: docFileDataUrl
    });
    docFileDataUrl = null;
    document.getElementById('docName').value = '';
    document.getElementById('docFilePreview').style.display = 'none';
    await loadDocVault(docVaultMoveId);
    toast('Document uploaded!', 'success');
  } catch(e) { toast(e.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Upload Document';
}

// Start polling notifications every 30s when logged in
setInterval(() => { if (token) loadNotifCount(); }, 30000);

async function updateMoveStatus(id, status) {
  try {
    const m = currentMove;
    await api('PUT', `/api/moves/${id}`, { ...m, status });
    toast('Status updated to ' + status.replace('_',' '), 'success');
    openMove(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function attemptCompleteMove(id) {
  // Fetch current state for pre-flight checklist
  const [boxes, furniture] = await Promise.all([
    api('GET', `/api/boxes/move/${id}`),
    api('GET', `/api/furniture/move/${id}`)
  ]);

  const pendingBoxes        = Array.isArray(boxes) ? boxes.filter(b => b.status !== 'delivered') : [];
  const pendingFurn         = Array.isArray(furniture) ? furniture.filter(f => !f.condition_after) : [];
  const missingPickupPhoto  = Array.isArray(furniture) ? furniture.filter(f => !(f.photos||[]).find(p => p.photo_type==='before')) : [];
  const missingDelivPhoto   = Array.isArray(furniture) ? furniture.filter(f => f.condition_after && !(f.photos||[]).find(p => p.photo_type==='after')) : [];

  const checks = [
    { label: `All boxes delivered`,         ok: pendingBoxes.length === 0,       detail: pendingBoxes.length ? `${pendingBoxes.length} box${pendingBoxes.length>1?'es':''} still pending` : null },
    { label: `All furniture delivered`,     ok: pendingFurn.length === 0,         detail: pendingFurn.length ? `${pendingFurn.length} item${pendingFurn.length>1?'s':''} not marked delivered` : null },
    { label: `Delivery photos documented`,  ok: missingDelivPhoto.length === 0,   detail: missingDelivPhoto.length ? `Missing for: ${missingDelivPhoto.map(f=>f.name).join(', ')}` : null },
  ];

  const allClear = checks.every(c => c.ok);

  document.getElementById('completeMoveChecklist').innerHTML = checks.map(c => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:${c.ok ? '#dcfce7' : '#fee2e2'};display:flex;align-items:center;justify-content:center;margin-top:1px">
        ${c.ok
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        }
      </div>
      <div>
        <div style="font-size:13px;font-weight:600;color:${c.ok ? 'var(--text)' : 'var(--error)'}">${c.label}</div>
        ${c.detail ? `<div style="font-size:11px;color:var(--error);margin-top:2px">${c.detail}</div>` : ''}
      </div>
    </div>
  `).join('');

  document.getElementById('completeMoveActions').innerHTML = allClear
    ? `<button onclick="confirmCompleteMove('${id}')" id="confirmCompleteBtn" class="btn btn-primary" style="background:#16a34a;border-color:#16a34a">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Confirm — Mark as Complete
       </button>`
    : `<div style="font-size:12px;color:var(--sub);text-align:center;padding:8px 0">Resolve all issues above to complete this move</div>`;

  openModal('completeMoveModal');
}

async function confirmCompleteMove(id) {
  const btn = document.getElementById('confirmCompleteBtn');
  btn.disabled = true; btn.textContent = 'Completing...';
  try {
    await api('POST', `/api/moves/${id}/complete`, {});
    toast('🎉 Move marked as complete!', 'success');
    closeModal('completeMoveModal');
    openMove(id);
  } catch(e) {
    toast(e.message || 'Could not complete move', 'error');
    btn.disabled = false; btn.textContent = 'Confirm — Mark as Complete';
  }
}

