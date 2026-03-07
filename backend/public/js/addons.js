/* MoveAssist — Add-on Services */
/* addons.js */

// ── ADD-ONS ADMIN ──────────────────────────────────────────────
let allAddons = [];
let addonsAnalytics = [];

async function renderAdminAddons() {
  const c = document.getElementById('adminContent');
  c.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  
  try {
    [allAddons, addonsAnalytics] = await Promise.all([
      api('GET', '/api/addons'),
      api('GET', '/api/addons/analytics')
    ]);
    
    const activeCount = allAddons.filter(a => a.is_active).length;
    const totalRevenue = addonsAnalytics.reduce((sum, a) => sum + parseFloat(a.total_revenue || 0), 0);
    const mostPopular = addonsAnalytics.sort((a, b) => b.times_used - a.times_used)[0];
    const avgRevenue = addonsAnalytics.length > 0 
      ? totalRevenue / addonsAnalytics.reduce((sum, a) => sum + a.times_used, 0) 
      : 0;
    
    c.innerHTML = `
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <h2 style="font-size:20px;font-weight:700;margin:0;color:var(--fg)">🎁 Add-on Services</h2>
            <p style="font-size:13px;color:var(--sub);margin:4px 0 0">Boost revenue with premium services</p>
          </div>
          <button onclick="openAddonModal()" class="btn-primary" style="padding:10px 20px">+ New Service</button>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
          <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #93c5fd">
            <div style="font-size:11px;color:#1e40af;font-weight:600;margin-bottom:8px">ACTIVE SERVICES</div>
            <div style="font-size:28px;font-weight:700;color:#1e3a8a">${activeCount}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);border:1px solid #6ee7b7">
            <div style="font-size:11px;color:#047857;font-weight:600;margin-bottom:8px">TOTAL REVENUE</div>
            <div style="font-size:28px;font-weight:700;color:# 065f46">₹${Math.round(totalRevenue).toLocaleString('en-IN')}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:1px solid #fcd34d">
            <div style="font-size:11px;color:#b45309;font-weight:600;margin-bottom:8px">MOST POPULAR</div>
            <div style="font-size:14px;font-weight:700;color:#92400e;margin-top:8px">${mostPopular ? mostPopular.name : '-'}</div>
          </div>
          <div class="card" style="background:linear-gradient(135deg,#fae8ff 0%,#f3e8ff 100%);border:1px solid #d8b4fe">
            <div style="font-size:11px;color:#7e22ce;font-weight:600;margin-bottom:8px">AVG / MOVE</div>
            <div style="font-size:28px;font-weight:700;color:#6b21a8">₹${Math.round(avgRevenue).toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:20px">
          <select id="addonCategoryFilter" onchange="filterAddons()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">
            <option value="">All Categories</option>
            <option value="tech_setup">Tech Setup</option>
            <option value="cleaning">Cleaning</option>
            <option value="labor">Labor</option>
            <option value="convenience">Convenience</option>
            <option value="insurance">Insurance</option>
          </select>
          <select id="addonStatusFilter" onchange="filterAddons()" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      
      <div id="addonsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px">
        ${allAddons.length === 0 ? '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--sub)">No add-on services yet. Create your first one!</div>' : ''}
      </div>
    `;
    
    renderAddonsGrid(allAddons);
  } catch(e) {
    c.innerHTML = errorState(e.message, 'renderAdminAddons()');
  }
}

function renderAddonsGrid(addons) {
  const grid = document.getElementById('addonsGrid');
  if (!grid) return;
  
  if (addons.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--sub)">No services match your filters</div>';
    return;
  }
  
  grid.innerHTML = addons.map(addon => {
    const analytic = addonsAnalytics.find(a => a.id === addon.id) || {};
    const timesUsed = analytic.times_used || 0;
    const revenue = analytic.total_revenue || 0;
    
    let priceDisplay = '';
    switch(addon.pricing_type) {
      case 'fixed':
        priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')}`;
        break;
      case 'percentage':
        priceDisplay = `${addon.base_price}% of total`;
        break;
      case 'quantity':
        priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')} ${addon.unit || 'per unit'}`;
        break;
      case 'distance':
        priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')}/km`;
        break;
    }
    
    return `
      <div class="card" style="${!addon.is_active ? 'opacity:0.6;' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
          <div style="font-size:32px">${addon.icon || '🔧'}</div>
          <div style="display:flex;gap:6px">
            <button onclick="editAddon('${addon.id}')" style="padding:6px 10px;border:none;background:var(--bg);border-radius:6px;cursor:pointer;font-size:12px">✏️</button>
            <button onclick="toggleAddonStatus('${addon.id}', ${!addon.is_active})" style="padding:6px 10px;border:none;background:var(--bg);border-radius:6px;cursor:pointer;font-size:12px">${addon.is_active ? '🔴' : '🟢'}</button>
            <button onclick="deleteAddon('${addon.id}')" style="padding:6px 10px;border:none;background:var(--bg);border-radius:6px;cursor:pointer;font-size:12px">🗑️</button>
          </div>
        </div>
        <div style="font-size:16px;font-weight:600;margin-bottom:4px">${addon.name}</div>
        <div style="display:inline-block;padding:4px 8px;background:var(--bg);border-radius:4px;font-size:10px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">${addon.category}</div>
        ${addon.is_active ? '<span style="margin-left:6px;padding:4px 8px;background:#d4edda;color:#155724;border-radius:4px;font-size:10px;font-weight:600">ACTIVE</span>' : '<span style="margin-left:6px;padding:4px 8px;background:#f8d7da;color:#721c24;border-radius:4px;font-size:10px;font-weight:600">INACTIVE</span>'}
        <div style="font-size:13px;color:var(--sub);margin-bottom:12px;line-height:1.4">${addon.description || 'No description'}</div>
        <div style="font-size:22px;font-weight:700;color:#27ae60;margin-bottom:12px">${priceDisplay}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:12px;border-top:1px solid var(--border)">
          <div>
            <div style="font-size:11px;color:var(--sub)">Times Used</div>
            <div style="font-size:14px;font-weight:600">${timesUsed}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--sub)">Revenue</div>
            <div style="font-size:14px;font-weight:600">₹${parseFloat(revenue || 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterAddons() {
  const category = document.getElementById('addonCategoryFilter').value;
  const status = document.getElementById('addonStatusFilter').value;
  
  let filtered = allAddons;
  
  if (category) {
    filtered = filtered.filter(a => a.category === category);
  }
  
  if (status !== '') {
    filtered = filtered.filter(a => a.is_active === (status === 'true'));
  }
  
  renderAddonsGrid(filtered);
}

function openAddonModal(id = null) {
  const modal = document.createElement('div');
  modal.id = 'addonModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px';
  
  const addon = id ? allAddons.find(a => a.id === id) : null;
  
  modal.innerHTML = `
    <div style="background:white;border-radius:12px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:18px">${id ? 'Edit Service' : 'Create New Service'}</h3>
        <button onclick="closeAddonModal()" style="border:none;background:none;font-size:24px;cursor:pointer;color:var(--sub)">×</button>
      </div>
      <div style="padding:20px">
        <input type="hidden" id="addonId" value="${id || ''}">
        
        <div style="margin-bottom:16px">
          <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Service Name *</label>
          <input type="text" id="addonName" value="${addon?.name || ''}" placeholder="e.g., WiFi & Internet Setup" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Category *</label>
            <select id="addonCategory" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
              <option value="">Select Category</option>
              <option value="tech_setup" ${addon?.category === 'tech_setup' ? 'selected' : ''}>Tech Setup</option>
              <option value="cleaning" ${addon?.category === 'cleaning' ? 'selected' : ''}>Cleaning</option>
              <option value="packing" ${addon?.category === 'packing' ? 'selected' : ''}>Packing</option>
              <option value="labor" ${addon?.category === 'labor' ? 'selected' : ''}>Labor</option>
              <option value="convenience" ${addon?.category === 'convenience' ? 'selected' : ''}>Convenience</option>
              <option value="insurance" ${addon?.category === 'insurance' ? 'selected' : ''}>Insurance</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Icon</label>
            <input type="text" id="addonIcon" value="${addon?.icon || ''}" placeholder="🔧" maxlength="2" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
          </div>
        </div>
        
        <div style="margin-bottom:16px">
          <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Description</label>
          <textarea id="addonDescription" placeholder="Describe what's included..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;min-height:60px">${addon?.description || ''}</textarea>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Pricing Type *</label>
            <select id="addonPricingType" onchange="updatePricingHint()" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
              <option value="fixed" ${addon?.pricing_type === 'fixed' ? 'selected' : ''}>Fixed Price</option>
              <option value="percentage" ${addon?.pricing_type === 'percentage' ? 'selected' : ''}>Percentage</option>
              <option value="quantity" ${addon?.pricing_type === 'quantity' ? 'selected' : ''}>Quantity-based</option>
              <option value="distance" ${addon?.pricing_type === 'distance' ? 'selected' : ''}>Distance-based</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Base Price *</label>
            <input type="number" id="addonBasePrice" value="${addon?.base_price || ''}" step="0.01" placeholder="800" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
            <small id="pricingHint" style="font-size:11px;color:var(--sub)">Fixed amount in ₹</small>
          </div>
        </div>
        
        <div style="margin-bottom:16px" id="unitField">
          <label style="display:block;margin-bottom:6px;font-weight:600;font-size:14px">Unit Label</label>
          <input type="text" id="addonUnit" value="${addon?.unit || ''}" placeholder="e.g., per TV, per item" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
        </div>
        
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="addonIsActive" ${addon?.is_active !== false ? 'checked' : ''}>
            <span style="font-size:14px">Active</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="addonShowToCustomer" ${addon?.show_to_customer !== false ? 'checked' : ''}>
            <span style="font-size:14px">Show to Customer</span>
          </label>
        </div>
      </div>
      <div style="padding:20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">
        <button onclick="closeAddonModal()" class="btn-secondary" style="padding:10px 20px">Cancel</button>
        <button onclick="saveAddon()" class="btn-primary" style="padding:10px 20px">Save Service</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  if (addon) updatePricingHint();
}

function updatePricingHint() {
  const type = document.getElementById('addonPricingType')?.value;
  const hint = document.getElementById('pricingHint');
  const unitField = document.getElementById('unitField');
  if (!hint) return;
  
  switch(type) {
    case 'fixed':
      hint.textContent = 'Fixed amount in ₹';
      if (unitField) unitField.style.display = 'none';
      break;
    case 'percentage':
      hint.textContent = 'Percentage of total (e.g., 2 for 2%)';
      if (unitField) unitField.style.display = 'none';
      break;
    case 'quantity':
      hint.textContent = 'Price per unit';
      if (unitField) unitField.style.display = 'block';
      break;
    case 'distance':
      hint.textContent = 'Price per kilometer';
      if (unitField) unitField.style.display = 'none';
      break;
  }
}

function closeAddonModal() {
  const modal = document.getElementById('addonModal');
  if (modal) modal.remove();
}

async function saveAddon() {
  const id = document.getElementById('addonId').value;
  const data = {
    name: document.getElementById('addonName').value,
    category: document.getElementById('addonCategory').value,
    icon: document.getElementById('addonIcon').value || '🔧',
    description: document.getElementById('addonDescription').value,
    pricing_type: document.getElementById('addonPricingType').value,
    base_price: parseFloat(document.getElementById('addonBasePrice').value),
    unit: document.getElementById('addonUnit').value,
    is_active: document.getElementById('addonIsActive').checked,
    show_to_customer: document.getElementById('addonShowToCustomer').checked,
  };
  
  try {
    if (id) {
      await api('PUT', `/api/addons/${id}`, data);
      toast('Service updated!', 'success');
    } else {
      await api('POST', '/api/addons', data);
      toast('Service created!', 'success');
    }
    closeAddonModal();
    renderAdminAddons();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function editAddon(id) {
  openAddonModal(id);
}

async function toggleAddonStatus(id, newState) {
  try {
    await api('PUT', `/api/addons/${id}`, { is_active: newState });
    toast(`Service ${newState ? 'activated' : 'deactivated'}!`, 'success');
    renderAdminAddons();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function deleteAddon(id) {
  if (!confirm('Delete this add-on service? This cannot be undone.')) return;
  try {
    await api('DELETE', `/api/addons/${id}`);
    toast('Service deleted!', 'success');
    renderAdminAddons();
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ── ADD-ONS FOR MOVES (AGENT/CLIENT VIEW) ──────────────────────
let moveAddonsData = {};

async function loadMoveAddons(moveId) {
  try {
    const addons = await api('GET', `/api/moves/${moveId}/addons`);
    moveAddonsData[moveId] = addons;
    renderMoveAddons(moveId);
  } catch(e) {
    const container = document.getElementById(`moveAddons-${moveId}`);
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:12px;color:var(--error);font-size:12px">Failed to load</div>`;
    }
  }
}

function renderMoveAddons(moveId) {
  const container = document.getElementById(`moveAddons-${moveId}`);
  if (!container) return;
  
  const addons = moveAddonsData[moveId] || [];
  
  if (addons.length === 0) {
    container.innerHTML = `<div style="color:var(--sub);font-size:12px;padding:4px 0">No add-ons yet — click <strong>+ Add</strong> to upsell services</div>`;
    return;
  }
  const total = addons.reduce((sum,a) => sum+parseFloat(a.total_price||0), 0);
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
      ${addons.map(a => {
        const price = a.pricing_type==='quantity'&&a.quantity>1
          ? `${a.quantity}× ₹${parseFloat(a.unit_price).toLocaleString('en-IN')} = ₹${parseFloat(a.total_price).toLocaleString('en-IN')}`
          : `₹${parseFloat(a.total_price).toLocaleString('en-IN')}`;
        const statusColors = {pending:'#f59e0b',completed:'#22c55e',cancelled:'#ef4444'};
        const sc = statusColors[a.status]||'#94a3b8';
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--card2);border-radius:8px;border:1px solid var(--border)">
          <span style="font-size:16px;flex-shrink:0">${a.icon||'🔧'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
            <div style="font-size:11px;color:var(--sub)">${price}</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:${sc}20;color:${sc};white-space:nowrap">${a.status}</span>
          <button onclick="removeMoveAddon('${moveId}','${a.id}')" style="flex-shrink:0;width:22px;height:22px;background:var(--error);color:white;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.08));border:1px solid rgba(34,197,94,0.2);border-radius:8px">
      <span style="font-size:11px;font-weight:700;color:var(--success)">TOTAL ADD-ONS</span>
      <span style="font-size:15px;font-weight:800;color:var(--success)">₹${total.toLocaleString('en-IN')}</span>
    </div>
  `;
}

async function openAddonsModal(moveId) {
  // Remove any existing modal first to prevent duplicates
  document.getElementById('addonsSelectModal')?.remove();
  try {
    const availableAddons = await api('GET', `/api/addons/available/${moveId}`);
    
    const modal = document.createElement('div');
    modal.id = 'addonsSelectModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px';
    
    modal.innerHTML = `
      <div style="background:var(--card);border-radius:14px;max-width:680px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.2)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--card);z-index:1;border-radius:14px 14px 0 0">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800">🎁 Add Services</h3>
            <p style="margin:2px 0 0;font-size:12px;color:var(--sub)">Select premium services to upsell</p>
          </div>
          <button onclick="closeAddonsModal()" style="border:none;background:var(--card2);border-radius:50%;width:30px;height:30px;font-size:18px;cursor:pointer;color:var(--sub);display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        </div>
        <div style="padding:16px">
          ${availableAddons.length === 0 ? `
            <div style="text-align:center;padding:32px;color:var(--sub)">
              <div style="font-size:40px;margin-bottom:10px">📦</div>
              <div style="font-size:15px;font-weight:600;margin-bottom:6px">All services added</div>
              <div style="font-size:12px">All available add-ons are already on this move</div>
            </div>
          ` : availableAddons.map(addon => {
            let priceDisplay = '';
            switch(addon.pricing_type) {
              case 'fixed':    priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')}`; break;
              case 'percentage': priceDisplay = `${addon.base_price}% of total`; break;
              case 'quantity': priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')} ${addon.unit||'per unit'}`; break;
              case 'distance': priceDisplay = `₹${parseFloat(addon.base_price).toLocaleString('en-IN')}/km`; break;
            }
            const catColors = {tech_setup:'#6366f1',cleaning:'#22c55e',labor:'#f59e0b',convenience:'#3b82f6',packing:'#ec4899'};
            const catColor = catColors[addon.category]||'#94a3b8';
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
              <div style="font-size:24px;flex-shrink:0;width:40px;text-align:center">${addon.icon||'🔧'}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                  <span style="font-size:13px;font-weight:700">${addon.name}</span>
                  <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;background:${catColor}15;color:${catColor};text-transform:uppercase">${addon.category.replace('_',' ')}</span>
                </div>
                <div style="font-size:11px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${addon.description||''}</div>
              </div>
              <div style="flex-shrink:0;text-align:right">
                <div style="font-size:14px;font-weight:800;color:var(--success);white-space:nowrap">${priceDisplay}</div>
                ${addon.pricing_type==='quantity'?`
                <div style="display:flex;align-items:center;gap:4px;margin-top:4px;justify-content:flex-end">
                  <input type="number" id="qty-${addon.id}" value="1" min="${addon.min_quantity||1}" max="${addon.max_quantity||100}" style="width:48px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;text-align:center;font-size:12px;background:var(--card2);color:var(--text)">
                  <span style="font-size:10px;color:var(--sub)">${addon.unit||'units'}</span>
                </div>`:''}
              </div>
              <button onclick="addServiceToMove('${moveId}','${addon.id}',${addon.pricing_type==='quantity'})" style="flex-shrink:0;padding:8px 14px;background:var(--accent);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Add</button>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch(e) {
    toast('Failed to load services: ' + e.message, 'error');
  }
}

function closeAddonsModal() {
  const modal = document.getElementById('addonsSelectModal');
  if (modal) modal.remove();
}

async function addServiceToMove(moveId, addonId, isQuantity) {
  try {
    const quantity = isQuantity ? parseInt(document.getElementById(`qty-${addonId}`)?.value || 1) : 1;
    
    await api('POST', `/api/move-addons/${moveId}/addons`, {
      addon_id: addonId,
      quantity: quantity
    });
    
    toast('Service added successfully!', 'success');
    closeAddonsModal();
    await loadMoveAddons(moveId);
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function removeMoveAddon(moveId, addonId) {
  if (!confirm('Remove this service from the move?')) return;
  
  try {
    await api('DELETE', `/api/move-addons/${moveId}/addons/${addonId}`);
    toast('Service removed', 'success');
    await loadMoveAddons(moveId);
  } catch(e) {
    toast(e.message, 'error');
  }
}


// ── Agent sidebar "Add-on Services" button handler ─────────────
// Admin → navigate to admin addons page
// Agent → open move picker then addon modal
async function openAddonsForAgent() {
  if (user?.role === 'admin') {
    window.location.href = '/admin/addons';
    return;
  }
  // For agent: fetch their active/in-progress moves and let them pick
  try {
    const moves = await api('GET', '/api/moves/agent');
    const activeMoves = (Array.isArray(moves) ? moves : []).filter(m =>
      ['active', 'in_progress', 'completed'].includes(m.status)
    );

    if (activeMoves.length === 0) {
      toast('No active moves to add services to', 'error');
      return;
    }

    if (activeMoves.length === 1) {
      openAddonsModal(activeMoves[0].id);
      return;
    }

    // Show move picker
    document.getElementById('addonsSelectModal')?.remove();
    const picker = document.createElement('div');
    picker.id = 'addonsSelectModal';
    picker.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px';
    picker.innerHTML = `
      <div style="background:var(--card,white);border-radius:14px;max-width:460px;width:100%;padding:24px">
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:6px">🎁 Add Services</div>
        <div style="font-size:13px;color:var(--sub);margin-bottom:20px">Select a move to add services to</div>
        ${activeMoves.map(m => `
          <div onclick="document.getElementById('addonsSelectModal').remove();openAddonsModal('${m.id}')"
            style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer;transition:background 0.15s"
            onmouseover="this.style.background='var(--card2)'" onmouseout="this.style.background=''">
            <div style="font-weight:600;font-size:14px">${m.title || 'Move'}</div>
            <div style="font-size:12px;color:var(--sub);margin-top:3px">${m.from_address?.split(',')[0] || ''} → ${m.to_address?.split(',')[0] || ''}</div>
            <div style="margin-top:6px"><span class="badge badge-${m.status}">${m.status}</span></div>
          </div>
        `).join('')}
        <button onclick="document.getElementById('addonsSelectModal').remove()"
          style="width:100%;margin-top:8px;padding:10px;background:none;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;color:var(--sub)">
          Cancel
        </button>
      </div>
    `;
    document.body.appendChild(picker);
  } catch(e) {
    toast('Failed to load moves: ' + e.message, 'error');
  }
}
