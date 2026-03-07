/* MoveAssist — Payment Flows & Move Plans */
/* payments.js */

// ─── PAYMENT ─────────────────────────────────────────────────

// STATUS_LABELS moved to state.js (shared across all modules)

const TIMELINE_STEPS = [
  { key: 'created',                       label: 'Move Created',             sub: 'Details entered' },
  { key: 'payment_pending',               label: 'Payment Pending',          sub: 'Complete payment to activate' },
  { key: 'payment_under_verification',    label: 'Payment Under Review',     sub: 'Admin verification in progress' },
  { key: 'active',                        label: 'Move Active',              sub: 'Agent assigned, features unlocked' },
  { key: 'in_progress',                   label: 'In Progress',              sub: 'Move execution underway' },
  { key: 'completed',                     label: 'Completed',                sub: 'All items delivered' },
  { key: 'closed',                        label: 'Closed',                   sub: 'Move report generated & closed' },
];

function isActive(move) {
  return ['active', 'in_progress', 'completed'].includes(move.status);
}

// ── Legacy payment screen removed — see updated openPaymentScreen / renderPaymentScreen below ──



// Open pay-now modal
function openPayModal(moveId, amtDue) {
  document.getElementById('payModalTitle').textContent = `Pay ₹${parseFloat(amtDue).toFixed(2)}`;
  document.getElementById('payModalContent').innerHTML = `
    <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Choose your preferred payment method:</div>
    <div class="pay-method-grid">
      <div class="pay-method-btn" onclick="selectPayMethod('upi',this)" id="pm-upi">
        <div class="pay-method-icon">📲</div><div class="pay-method-label">UPI</div>
      </div>
      <div class="pay-method-btn" onclick="selectPayMethod('card',this)" id="pm-card">
        <div class="pay-method-icon">💳</div><div class="pay-method-label">Card</div>
      </div>
      <div class="pay-method-btn" onclick="selectPayMethod('netbanking',this)" id="pm-netbanking">
        <div class="pay-method-icon">🏦</div><div class="pay-method-label">Net Banking</div>
      </div>
      <div class="pay-method-btn" onclick="selectPayMethod('wallet',this)" id="pm-wallet">
        <div class="pay-method-icon">👛</div><div class="pay-method-label">Wallet</div>
      </div>
    </div>
    <div id="payMethodDetails" style="margin-bottom:16px"></div>
    <div style="font-size:11px;color:var(--dim);margin-bottom:16px;text-align:center">🔒 Payments are processed securely. Test mode — no real charge.</div>
    <button class="btn btn-primary" onclick="submitOnlinePayment('${moveId}',${amtDue})" id="payNowBtn" disabled>Pay ₹${parseFloat(amtDue).toFixed(2)}</button>
  `;
  window._payMethod = '';
  openModal('payModal');
}

let _payMethod = '';
function selectPayMethod(method, el) {
  _payMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('payNowBtn').disabled = false;

  const details = document.getElementById('payMethodDetails');
  if (method === 'upi') {
    details.innerHTML = `<div class="field"><label>UPI ID</label><input type="text" id="upiId" class="upi-input" placeholder="yourname@upi" inputmode="email"/></div>`;
  } else if (method === 'card') {
    details.innerHTML = `
      <div class="field"><label>Card Number</label><input type="text" id="cardNum" placeholder="•••• •••• •••• ••••" inputmode="numeric" maxlength="19"/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Expiry</label><input type="text" id="cardExp" placeholder="MM/YY" maxlength="5"/></div>
        <div class="field"><label>CVV</label><input type="password" id="cardCvv" placeholder="•••" maxlength="3" inputmode="numeric"/></div>
      </div>`;
  } else {
    details.innerHTML = `<div style="font-size:13px;color:var(--sub);padding:8px 0">You'll be redirected to complete payment via ${method}.</div>`;
  }
}

async function submitOnlinePayment(moveId, amount) {
  const btn = document.getElementById('payNowBtn');
  btn.disabled = true; btn.textContent = 'Processing...';
  try {
    const data = await api('POST', `/api/payments/move/${moveId}/online`, {
      payment_mode: _payMethod,
      amount: amount,
      transaction_id: `TXN_${Date.now()}`,
    });
    closeModal('payModal');
    toast(data.message, 'success');
    currentMove.status = data.move_status;
    await openPaymentScreen(moveId);
  } catch(e) {
    toast('Payment failed: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = `Pay ₹${parseFloat(amount).toFixed(2)}`;
  }
}

function openCashModal(moveId) {
  window._cashMoveId = moveId;
  
  // Get quote total from current payment screen data
  const quoteTotal = window._currentQuoteTotal || 0;
  const estimatedCost = window._currentEstimatedCost || 0;
  const suggestedAmount = quoteTotal || estimatedCost || 0;
  
  // Pre-fill amount field
  setTimeout(() => {
    const amountField = document.getElementById('cashAmount');
    if (amountField && suggestedAmount > 0) {
      amountField.value = suggestedAmount;
    }
  }, 100);
  
  openModal('cashModal');
}

async function submitCashPayment() {
  const amount = document.getElementById('cashAmount').value;
  if (!amount || parseFloat(amount) <= 0) { 
    toast('Enter a valid amount', 'error'); 
    return; 
  }
  
  const btn = document.getElementById('cashSubmitBtn');
  btn.disabled = true; btn.textContent = 'Processing...';
  
  try {
    const data = await api('POST', `/api/payments/move/${window._cashMoveId}/cash`, {
      amount: parseFloat(amount),
      payment_mode: document.getElementById('cashMode').value,
      notes: document.getElementById('cashNotes').value,
    });
    
    closeModal('cashModal');
    
    // Reset cash modal fields
    document.getElementById('cashAmount').value = '';
    document.getElementById('cashNotes').value = '';
    document.getElementById('cashMode').value = 'cash';
    
    toast(data.message, 'success');
    
    // Refresh payment screen
    await openPaymentScreen(window._cashMoveId);
  } catch(e) {
    toast(e.message || 'Failed to mark payment', 'error');
    btn.disabled = false; btn.textContent = 'Mark Payment Received';
  }
}

// Pricing setup for new moves without pricing
function openPricingSetup(moveId) {
  document.getElementById('payModalTitle').textContent = 'Set Move Pricing';
  document.getElementById('payModalContent').innerHTML = `
    <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Enter move details to calculate your price:</div>
    <div class="field"><label>Base Price (₹)</label><input type="number" id="priceBase" placeholder="5000" inputmode="decimal"/></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label>Distance (km)</label><input type="number" id="priceKm" placeholder="0" inputmode="decimal"/></div>
      <div class="field"><label>No. of Rooms</label><input type="number" id="priceRooms" placeholder="2" inputmode="numeric"/></div>
    </div>
    <div class="field"><label>Floor Surcharge (₹)</label><input type="number" id="priceFloor" placeholder="0" inputmode="decimal"/></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <input type="checkbox" id="priceFragile" style="width:18px;height:18px;accent-color:var(--accent)"/>
      <label for="priceFragile" style="font-size:14px">Has fragile items (+₹500)</label>
    </div>
    <div class="field"><label>Discount (₹)</label><input type="number" id="priceDiscount" placeholder="0" inputmode="decimal"/></div>
    <button class="btn btn-primary" onclick="calculateAndPay('${moveId}')">Calculate & Proceed to Pay</button>
  `;
  openModal('payModal');
}

async function calculateAndPay(moveId) {
  try {
    const data = await api('POST', `/api/payments/move/${moveId}/initiate`, {
      base_price: parseFloat(document.getElementById('priceBase').value) || 0,
      distance_km: parseFloat(document.getElementById('priceKm').value) || 0,
      num_rooms: parseInt(document.getElementById('priceRooms').value) || 0,
      floor_surcharge: parseFloat(document.getElementById('priceFloor').value) || 0,
      has_fragile: document.getElementById('priceFragile').checked,
      discount: parseFloat(document.getElementById('priceDiscount').value) || 0,
    });
    closeModal('payModal');
    toast(`Total: ₹${data.total.toFixed(2)} — Invoice #${data.invoice_number}`, 'success');
    openPaymentScreen(moveId);
  } catch(e) { toast(e.message, 'error'); }
}

// Show payment gate popup when blocked action is attempted
function showPaymentGate(moveId) {
  document.getElementById('payModalTitle').textContent = '💳 Payment Required';
  document.getElementById('payModalContent').innerHTML = `
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:48px;margin-bottom:12px">🚫</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--warn)">Move Not Active Yet</div>
      <div style="font-size:14px;color:var(--sub);line-height:1.7;margin-bottom:24px">Your move is pending activation. Please complete payment to access this feature.</div>
      <button class="btn btn-primary" onclick="closeModal('payModal');openPaymentScreen('${moveId}')" style="max-width:240px;margin:0 auto">💳 Complete Payment</button>
    </div>
  `;
  openModal('payModal');
}

async function generateReport(moveId) {
  const id = moveId || currentMove?.id;
  showScreen('report');
  setTopbar('report');
  const content = document.getElementById('reportContent');
  content.innerHTML = '<div style="text-align:center;padding:60px"><div class="spinner"></div><div style="margin-top:16px;color:var(--sub);font-size:13px">Generating PDF...</div></div>';
  try {
    const r = await fetch(`${BASE}/api/reports/generate/${id}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `move-report-${id}.pdf`; a.click();
      content.innerHTML = `
        <div style="text-align:center;padding:40px">
          <div style="font-size:56px;margin-bottom:16px">✅</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Report Downloaded!</div>
          <div style="color:var(--sub);font-size:13px;margin-bottom:24px">Check your Downloads folder</div>
          <button class="btn btn-primary" onclick="generateReport('${id}')">Download Again</button>
        </div>`;
    } else {
      throw new Error('Report generation failed');
    }
  } catch(e) {
    content.innerHTML = errorState(e.message);
  }
}

async function generateInvoice(moveId) {
  const id = moveId || currentMove?.id;
  toast('Generating invoice PDF...', 'info');
  try {
    const r = await fetch(`${BASE}/api/reports/invoice/${id}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; 
      a.download = `moveassist-invoice-${id.slice(0,8)}.pdf`; 
      a.click();
      toast('Invoice downloaded successfully!', 'success');
    } else {
      const err = await r.json();
      throw new Error(err.error || 'Invoice generation failed');
    }
  } catch(e) {
    toast(e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// PAYMENT FLOW  (6-step):
//  1. Admin sets confirmed price  → customer notified
//  2. Customer pays 10% token     → admin verifies
//  3. Token verified              → move ACTIVE, agent assigned
//  4. Agent on-site               → submits final quote
//  5. Customer pays balance       → admin verifies
//  6. Balance verified            → move IN_PROGRESS
// ══════════════════════════════════════════════════════════════

async function openPaymentScreen(moveId) {
  showScreen('payment');
  setTopbar('payment');
  const content = document.getElementById('paymentContent');
  content.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const [data, quote, plan, addons] = await Promise.all([
      api('GET', `/api/payments/move/${moveId}`),
      api('GET', `/api/quotes/move/${moveId}`).catch(() => null),
      api('GET', `/api/plans/move/${moveId}`).catch(() => null),
      api('GET', `/api/moves/${moveId}/addons`).catch(() => []),
    ]);
    currentMove = { ...(currentMove||{}), id: moveId, ...data };
    renderPaymentScreen(data, quote, plan, addons);
  } catch(e) {
    content.innerHTML = errorState(e.message);
  }
}

function renderPaymentScreen(data, quote, plan, addons = []) {
  window._currentPlan = plan || null;
  
  // Calculate add-ons total
  const addonsTotal = addons.reduce((sum, a) => sum + parseFloat(a.total_price || 0), 0);
  
  window._currentQuoteTotal = quote ? (parseFloat(quote.total) + addonsTotal) : 0;
  window._currentEstimatedCost = parseFloat(data.estimated_cost || 0);
  
  const content = document.getElementById('paymentContent');
  const status       = data.move_status || data.status || '';
  const isPending    = ['payment_pending','created'].includes(status);
  const isVerifying  = status === 'payment_under_verification';
  const isActive     = status === 'active';
  const isInProgress = status === 'in_progress';
  const isCompleted  = status === 'completed';
  const isCustomer   = user?.role === 'customer';
  const isAgent      = user?.role === 'agent';
  const isAdmin      = user?.role === 'admin';
  const amtTotal     = parseFloat(data.amount_total || 0);
  const amtPaid      = parseFloat(data.amount_paid  || 0);
  const tokenAmt     = data.token_amount ? parseFloat(data.token_amount) : Math.round(amtTotal * 0.10);
  const priceIsSet   = amtTotal > 0;

  // ── Step indicator ───────────────────────────────────────────
  const customerSteps = [
    { key:'price_set',   label:'Price Set',       done: priceIsSet },
    { key:'token',       label:'Token Paid',       done: !!data.token_paid },
    { key:'active',      label:'Move Active',      done: isActive },
    { key:'quote',       label:'Final Quote',      done: !!quote },
    { key:'balance',     label:'Balance Paid',     done: status === 'in_progress' || status === 'completed' },
    { key:'inprogress',  label:'In Progress',      done: status === 'in_progress' || status === 'completed' },
  ];
  
  const agentSteps = [
    { key:'assigned',    label:'Assigned',         done: true },
    { key:'visited',     label:'Site Visit',       done: !!quote },
    { key:'quoted',      label:'Quote Submitted',  done: !!quote },
    { key:'paid',        label:'Payment Received', done: status === 'in_progress' || status === 'completed' },
    { key:'inprogress',  label:'In Progress',      done: status === 'in_progress' || status === 'completed' },
  ];
  
  const steps = (isAgent || isAdmin) ? agentSteps : customerSteps;
  const stepHtml = `
  <div style="display:flex;gap:0;margin-bottom:24px;overflow-x:auto;padding-bottom:4px">
    ${steps.map((s,i) => `
    <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px">
      <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;
        background:${s.done?'var(--accent)':'#e2e8f0'};color:${s.done?'#fff':'#94a3b8'}">
        ${s.done?'✓':(i+1)}
      </div>
      ${i<steps.length-1?`<div style="position:relative;top:-14px;left:50%;width:100%;height:2px;background:${s.done?'var(--accent)':'#e2e8f0'};z-index:-1"></div>`:''}
      <div style="font-size:10px;color:${s.done?'var(--accent)':'#94a3b8'};margin-top:4px;text-align:center;font-weight:${s.done?'700':'400'}">${s.label}</div>
    </div>`).join('')}
  </div>`;

  // ── Amount summary card ──────────────────────────────────────
  const estimatedCost = parseFloat(data.estimated_cost || 0);
  const quotedTotal = quote ? parseFloat(quote.total) : 0;
  const finalTotal  = (quotedTotal || amtTotal) + addonsTotal;  // Include add-ons in total
  const balanceDue  = Math.max(0, finalTotal - amtPaid);

  const summaryHtml = `
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">💰 Payment Summary</div>
    ${estimatedCost > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0">
      <span style="font-size:13px;color:var(--sub)">${isAgent || isAdmin ? 'Customer Estimate' : 'Initial Estimate'}</span>
      <span style="font-size:14px;font-weight:600;color:#64748b">₹${estimatedCost.toLocaleString('en-IN')}</span>
    </div>` : ''}
    ${quotedTotal > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0">
      <span style="font-size:13px;color:var(--sub)">Final Quote</span>
      <span style="font-size:14px;font-weight:700;color:#7c3aed">₹${quotedTotal.toLocaleString('en-IN')}</span>
    </div>` : isAgent || isAdmin ? `
    <div style="padding:12px 0;color:var(--sub);font-size:13px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px;margin:8px 0">
      📋 Visit customer location to assess items and determine final price
    </div>` : ''}
    ${addons.length > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0">
      <span style="font-size:13px;color:var(--sub)">🎁 Add-on Services (${addons.length})</span>
      <span style="font-size:14px;font-weight:700;color:#b45309">₹${addonsTotal.toLocaleString('en-IN')}</span>
    </div>` : ''}
    ${(quotedTotal > 0 || addonsTotal > 0) ? `
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
      <span style="font-size:14px;font-weight:700;color:#1e293b">Grand Total</span>
      <span style="font-size:16px;font-weight:800;color:#7c3aed">₹${finalTotal.toLocaleString('en-IN')}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0">
      <span style="font-size:13px;color:var(--sub)">Amount Paid</span>
      <span style="font-size:14px;font-weight:700;color:var(--success)">₹${amtPaid.toLocaleString('en-IN')}</span>
    </div>
    ${balanceDue > 0 && (quotedTotal > 0 || amtTotal > 0) ? `
    <div style="display:flex;justify-content:space-between;padding:10px 0">
      <span style="font-size:14px;font-weight:700">Balance Due</span>
      <span style="font-size:18px;font-weight:800;color:${status==='in_progress'||status==='completed'?'var(--success)':'var(--error)'}">₹${balanceDue.toLocaleString('en-IN')}</span>
    </div>` : balanceDue === 0 && amtPaid > 0 ? `<div style="padding:8px 0;font-size:13px;color:var(--success);font-weight:600">✅ Fully Paid</div>` : ''}
  </div>`;

  // ── Status banner ─────────────────────────────────────────────
  const bannerCfg = {
    payment_pending:             { bg:'#fffbeb', border:'#fde68a', icon:'💰', color:'#b45309', msg: priceIsSet ? `Pay ₹${tokenAmt.toLocaleString('en-IN')} token (10%) to confirm your booking and activate your move` : 'Admin is reviewing your request and will confirm the price shortly' },
    payment_under_verification:  { bg:'#eff6ff', border:'#bfdbfe', icon:'🔍', color:'#1d4ed8', msg:'Token payment submitted and under verification by admin' },
    active:                      { bg:'#f0fdf4', border:'#bbf7d0', icon:'✅', color:'#15803d', msg: quotedTotal > 0 ? 'Agent has submitted final quote. Pay balance to start your move' : 'Move activated! Agent will visit soon to assess items and provide final quote' },
    in_progress:                 { bg:'#f0fdf4', border:'#bbf7d0', icon:'🚛', color:'#15803d', msg:'Your move is in progress. Agent is coordinating the relocation' },
    completed:                   { bg:'#ede9fe', border:'#ddd6fe', icon:'🎉', color:'#6d28d9', msg:'Move completed successfully!' },
  };
  
  // Agent-specific banners
  const agentBannerCfg = {
    created:                     { bg:'#fffbeb', border:'#fde68a', icon:'📋', color:'#b45309', msg: 'New move request - Review customer details and prepare for site visit' },
    payment_pending:             { bg:'#fffbeb', border:'#fde68a', icon:'📋', color:'#b45309', msg: 'Visit customer location, assess items, and submit final quote' },
    active:                      { bg:'#f0fdf4', border:'#bbf7d0', icon:'💰', color:'#15803d', msg: window._currentQuoteTotal > 0 ? `Quote submitted: ₹${window._currentQuoteTotal.toLocaleString('en-IN')}. Collect payment to start move` : 'Submit final quote after site visit, then collect payment' },
    in_progress:                 { bg:'#dbeafe', border:'#93c5fd', icon:'🚛', color:'#1e40af', msg:'Payment received! Coordinate relocation and delivery' },
    completed:                   { bg:'#ede9fe', border:'#ddd6fe', icon:'🎉', color:'#6d28d9', msg:'Move completed successfully!' },
  };
  
  const bc = (isAgent || isAdmin) ? (agentBannerCfg[status] || { bg:'#f1f5f9', border:'#e2e8f0', icon:'📦', color:'var(--sub)', msg:status }) : (bannerCfg[status] || { bg:'#f1f5f9', border:'#e2e8f0', icon:'📦', color:'var(--sub)', msg:status });
  const bannerHtml = `
  <div style="padding:14px 16px;border-radius:12px;margin-bottom:20px;display:flex;align-items:center;gap:12px;
    background:${bc.bg};border:1.5px solid ${bc.border}">
    <span style="font-size:26px;flex-shrink:0">${bc.icon}</span>
    <div>
      <div style="font-size:13px;font-weight:700;color:${bc.color}">${STATUS_LABELS[status]?.label || status}</div>
      <div style="font-size:12px;color:var(--sub);margin-top:2px">${bc.msg}</div>
    </div>
  </div>`;

  // ── CTA section ───────────────────────────────────────────────
  let ctaHtml = '';

  // Customer: awaiting price
  if (isCustomer && isPending && !priceIsSet) {
    ctaHtml = `
    <div style="padding:16px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:8px">⏳</div>
      <div style="font-weight:700;margin-bottom:6px">Waiting for Price Confirmation</div>
      <div style="font-size:13px;color:var(--sub);margin-bottom:8px">Our team is reviewing your move details${estimatedCost > 0 ? ` (Estimate: ₹${estimatedCost.toLocaleString('en-IN')})` : ''} and will confirm the final price shortly.</div>
      <div style="font-size:12px;color:#78716c;background:#fef3c7;padding:8px;border-radius:6px;margin-top:8px">
        💡 Once confirmed, you'll pay 10% token to activate your move
      </div>
    </div>`;
  }

  // Customer: price set, can pay token
  if (isCustomer && isPending && priceIsSet) {
    ctaHtml = `
    <button onclick="openTokenPayModal('${data.move_id}',${tokenAmt})"
      style="width:100%;padding:16px;background:var(--accent);border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:12px;box-shadow:0 4px 14px rgba(37,99,235,0.25)">
      🔐 Pay ₹${tokenAmt.toLocaleString('en-IN')} Token to Activate Move →
    </button>
    <div style="text-align:center;font-size:12px;color:var(--sub);margin-bottom:8px">
      This is 10% of the confirmed price (₹${amtTotal.toLocaleString('en-IN')}) to activate your booking
    </div>
    <div style="font-size:11px;color:#78716c;background:#eff6ff;padding:8px;border-radius:6px;margin-bottom:20px;text-align:center">
      💡 After token payment, agent will visit to assess actual items and provide final quote
    </div>`;
  }

  // Customer: token under verification
  if (isCustomer && isVerifying && !data.token_paid) {
    ctaHtml = `
    <div style="padding:14px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;font-size:13px;color:#1d4ed8;text-align:center;margin-bottom:16px">
      🔍 Token payment submitted and under review. You'll be notified within 2–4 hours.
    </div>`;
  }

  // Customer: active + quote exists → show balance CTA
  if (isCustomer && isActive && quote && balanceDue > 0 && status !== 'in_progress' && status !== 'completed') {
    ctaHtml = `
    <button onclick="openBalancePayModal('${data.move_id}',${balanceDue})"
      style="width:100%;padding:16px;background:#7c3aed;border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:12px;box-shadow:0 4px 14px rgba(124,58,237,0.25)">
      💳 Pay Balance ₹${balanceDue.toLocaleString('en-IN')} →
    </button>`;
  }

  // Customer: balance under verification
  if (isCustomer && isVerifying && data.token_paid) {
    ctaHtml = `
    <div style="padding:14px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;font-size:13px;color:#1d4ed8;text-align:center;margin-bottom:16px">
      🔍 Balance payment submitted and under review. You'll be notified once verified.
    </div>`;
  }

  // Agent/Admin: Actions for managing move
  if (isAgent || isAdmin) {
    // Submit quote button - always show unless move is completed
    if (!isCompleted) {
      ctaHtml += `
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:4px">
          ${quote ? '✏️ Update Final Quote' : '📋 Submit Final Quote'}
        </div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:12px">
          ${quote ? `Current quote: ₹${parseFloat(quote.total).toLocaleString('en-IN')}. Update if needed based on actual items.` : 'After assessing items at customer location, enter the final amount to be collected.'}
        </div>
        <button onclick="openSubmitQuoteModal('${data.move_id}', ${quote ? parseFloat(quote.total) : window._currentEstimatedCost || 0})"
          style="padding:11px 20px;background:#16a34a;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
          ${quote ? '✏️ Update Quote' : '📝 Submit Final Quote'}
        </button>
      </div>`;
    }

    // Payment collection button
    if (quote && !isInProgress && !isCompleted) {
      // Quote exists but payment not yet received
      const quoteTotal = parseFloat(quote.total);
      const totalWithAddons = quoteTotal + addonsTotal;
      ctaHtml += `
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:4px">💵 Collect Full Payment</div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:4px">
          Quote: ₹${quoteTotal.toLocaleString('en-IN')}
          ${addonsTotal > 0 ? ` + Add-ons: ₹${addonsTotal.toLocaleString('en-IN')} = <strong>₹${totalWithAddons.toLocaleString('en-IN')}</strong>` : ''}
        </div>
        <div style="font-size:11px;color:#78716c;background:#fef3c7;padding:6px 8px;border-radius:6px;margin-bottom:12px">
          ⚠️ Collect full payment before starting the move. Once marked, move will automatically start.
        </div>
        <button onclick="openCashModal('${data.move_id}')"
          style="width:100%;padding:12px;background:#16a34a;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">
          💵 Mark Full Payment Received (₹${totalWithAddons.toLocaleString('en-IN')})
        </button>
      </div>`;
    } else if (isInProgress || isCompleted) {
      // Payment received confirmation
      ctaHtml += `
      <div style="background:#dcfce7;border:1.5px solid #86efac;border-radius:14px;padding:16px;margin-bottom:12px;text-align:center">
        <div style="font-size:24px;margin-bottom:8px">✅</div>
        <div style="font-size:14px;font-weight:700;color:#15803d;margin-bottom:4px">Payment Received</div>
        <div style="font-size:13px;color:#166534">₹${amtPaid.toLocaleString('en-IN')} collected and verified</div>
        <div style="font-size:11px;color:#15803d;margin-top:8px">Move ${isCompleted ? 'completed' : 'in progress'}</div>
      </div>`;
    } else if (!quote) {
      // No quote yet - show hint
      ctaHtml += `
      <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:14px;padding:14px;margin-bottom:12px;text-align:center">
        <div style="font-size:13px;color:#78716c">
          👆 Submit final quote first, then collect payment
        </div>
      </div>`;
  }
    }

  // ── Agent Quote detail ────────────────────────────────────────
  const quoteHtml = quote ? `
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">
      📋 Agent's Final Quote ${quote.agent_name ? `· ${quote.agent_name}` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
        <div style="font-size:10px;color:var(--sub);margin-bottom:2px">Base Price</div>
        <div style="font-size:15px;font-weight:700">₹${parseFloat(quote.base_price).toLocaleString('en-IN')}</div>
      </div>
      ${parseFloat(quote.floor_charge)>0?`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--sub);margin-bottom:2px">Floor Charges</div><div style="font-size:15px;font-weight:700">₹${parseFloat(quote.floor_charge).toLocaleString('en-IN')}</div></div>`:''}
      ${parseFloat(quote.fragile_charge)>0?`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--sub);margin-bottom:2px">Fragile</div><div style="font-size:15px;font-weight:700">₹${parseFloat(quote.fragile_charge).toLocaleString('en-IN')}</div></div>`:''}
      ${parseFloat(quote.extra_items)>0?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px"><div style="font-size:10px;color:#b45309;margin-bottom:2px">Extra Items</div><div style="font-size:15px;font-weight:700;color:#b45309">₹${parseFloat(quote.extra_items).toLocaleString('en-IN')}</div></div>`:''}
      ${parseFloat(quote.discount)>0?`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px"><div style="font-size:10px;color:#16a34a;margin-bottom:2px">Discount</div><div style="font-size:15px;font-weight:700;color:#16a34a">−₹${parseFloat(quote.discount).toLocaleString('en-IN')}</div></div>`:''}
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px">
        <div style="font-size:10px;color:var(--accent);margin-bottom:2px">GST 18%</div>
        <div style="font-size:15px;font-weight:700;color:var(--accent)">₹${parseFloat(quote.tax).toLocaleString('en-IN')}</div>
      </div>
    </div>
    
    ${addons.length > 0 ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">🎁 Add-on Services</div>
      ${addons.map(addon => {
        let priceDisplay = '';
        if (addon.pricing_type === 'quantity' && addon.quantity > 1) {
          priceDisplay = `${addon.quantity} × ₹${parseFloat(addon.unit_price).toLocaleString('en-IN')} = ₹${parseFloat(addon.total_price).toLocaleString('en-IN')}`;
        } else {
          priceDisplay = `₹${parseFloat(addon.total_price).toLocaleString('en-IN')}`;
        }
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;${addon !== addons[addons.length-1] ? 'border-bottom:1px solid #fde68a;' : ''}">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">${addon.icon || '🔧'}</span>
            <span style="font-size:13px;color:#78716c">${addon.name}</span>
          </div>
          <span style="font-size:13px;font-weight:600;color:#b45309">${priceDisplay}</span>
        </div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:8px;border-top:2px solid #fde68a">
        <span style="font-size:12px;font-weight:700;color:#b45309">Add-ons Subtotal</span>
        <span style="font-size:16px;font-weight:800;color:#b45309">₹${addonsTotal.toLocaleString('en-IN')}</span>
      </div>
    </div>` : ''}
    
    <div style="border-top:2px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--sub);font-weight:600">FINAL TOTAL</span>
      <span style="font-size:22px;font-weight:800;color:#7c3aed">₹${(parseFloat(quote.total) + addonsTotal).toLocaleString('en-IN')}</span>
    </div>
    ${quote.notes?`<div style="margin-top:10px;padding:10px;background:#f1f5f9;border-radius:8px;font-size:13px;color:var(--sub)">💬 ${quote.notes}</div>`:''}
  </div>` : '';

  // ── Move Plan card ────────────────────────────────────────────
  // Customer sees published plan. Agent sees it + edit button.
  const PACKAGE_LABELS = { basic:'🟡 Basic', standard:'🔵 Standard', premium:'⭐ Premium' };
  const SLOT_LABELS    = { morning:'🌅 Morning (7–11am)', afternoon:'☀️ Afternoon (12–4pm)', evening:'🌆 Evening (5–8pm)' };
  const VEHICLE_ICONS  = { 'mini truck':'🚐', 'tempo':'🚛', '14ft truck':'🚚', '17ft truck':'🚚', 'container':'📦' };

  // ── Move Plan card ────────────────────────────────────────────
  let planHtml = '';
  if (plan) {
    const isDraft = plan.plan_status !== 'confirmed';
    // Build packing materials chips from individual DB columns
    const matChips = [];
    if (plan.packing_boxes     > 0) matChips.push(`📦 ${plan.packing_boxes} Boxes`);
    if (plan.bubble_wrap_meters> 0) matChips.push(`🫧 ${plan.bubble_wrap_meters}m Bubble Wrap`);
    if (plan.packing_tape_rolls> 0) matChips.push(`🎁 ${plan.packing_tape_rolls} Tape Rolls`);
    if (plan.stretch_wrap_rolls> 0) matChips.push(`🌀 ${plan.stretch_wrap_rolls} Stretch Wrap`);
    if (plan.furniture_blankets> 0) matChips.push(`🛏️ ${plan.furniture_blankets} Blankets`);
    if (plan.custom_materials)      matChips.push(...plan.custom_materials.split(',').map(s=>s.trim()).filter(Boolean));

    planHtml = `
    <div style="background:#fff;border:1.5px solid ${isDraft?'#fbbf24':'#a5b4fc'};border-radius:14px;padding:18px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px">📋 Move Plan</span>
          ${isDraft ? `<span style="font-size:10px;padding:3px 8px;background:#fef3c7;color:#b45309;border-radius:99px;font-weight:700">Draft</span>` : `<span style="font-size:10px;padding:3px 8px;background:#dcfce7;color:#15803d;border-radius:99px;font-weight:700">✓ Confirmed</span>`}
        </div>
        ${(isAgent||isAdmin) ? `<button onclick="openMovePlanModal('${data.move_id}')" style="font-size:12px;padding:5px 12px;background:#ede9fe;border:none;border-radius:8px;color:#4f46e5;font-family:inherit;font-weight:700;cursor:pointer">✏️ Edit</button>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        ${plan.package_type ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
          <div style="font-size:10px;color:var(--sub);margin-bottom:3px;text-transform:uppercase;font-weight:700">Package</div>
          <div style="font-size:14px;font-weight:700">${PACKAGE_LABELS[plan.package_type] || plan.package_type}</div>
        </div>` : ''}
        ${plan.vehicle_type ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
          <div style="font-size:10px;color:var(--sub);margin-bottom:3px;text-transform:uppercase;font-weight:700">Vehicle</div>
          <div style="font-size:14px;font-weight:700">${VEHICLE_ICONS[plan.vehicle_type]||'🚚'} ${plan.vehicle_type}${plan.vehicle_count > 1 ? ` ×${plan.vehicle_count}` : ''}</div>
          ${plan.vehicle_number ? `<div style="font-size:11px;color:var(--sub);margin-top:2px">${plan.vehicle_number}</div>` : ''}
        </div>` : ''}
        ${plan.movers_count > 0 ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
          <div style="font-size:10px;color:var(--sub);margin-bottom:3px;text-transform:uppercase;font-weight:700">Crew</div>
          <div style="font-size:14px;font-weight:700">👷 ${plan.movers_count} Movers</div>
          ${plan.team_lead_name ? `<div style="font-size:11px;color:var(--sub);margin-top:2px">Lead: ${plan.team_lead_name}${plan.team_lead_phone ? ` · 📞 ${plan.team_lead_phone}` : ''}</div>` : ''}
        </div>` : ''}
        ${plan.pickup_date ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px">
          <div style="font-size:10px;color:var(--sub);margin-bottom:3px;text-transform:uppercase;font-weight:700">Pickup</div>
          <div style="font-size:14px;font-weight:700">${new Date(plan.pickup_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          ${plan.pickup_time_slot ? `<div style="font-size:11px;color:#1d4ed8;margin-top:2px;font-weight:600">${SLOT_LABELS[plan.pickup_time_slot]||plan.pickup_time_slot}</div>` : ''}
        </div>` : ''}
      </div>

      ${plan.packing_start_time ? `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:10px;font-size:13px">
        <span>📦</span>
        <div><span style="font-weight:600">Packing starts:</span> ${plan.packing_start_time}</div>
      </div>` : ''}
      ${plan.estimated_delivery ? `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:10px;font-size:13px">
        <span>🏠</span>
        <div><span style="font-weight:600">Est. delivery:</span> ${new Date(plan.estimated_delivery).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
      </div>` : ''}

      ${matChips.length ? `
      <div style="margin-bottom:10px">
        <div style="font-size:10px;color:var(--sub);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Packing Materials</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${matChips.map(c => `<span style="padding:4px 10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:99px;font-size:12px;font-weight:500">${c}</span>`).join('')}
        </div>
      </div>` : ''}

      ${plan.special_instructions ? `
      <div style="padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e">
        <span style="font-weight:700">📌 Special Instructions:</span> ${plan.special_instructions}
      </div>` : ''}
    </div>`;

  } else if (isAgent || isAdmin) {
    planHtml = `
    <div style="background:#f5f3ff;border:1.5px dashed #a5b4fc;border-radius:14px;padding:18px;margin-bottom:16px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">📋</div>
      <div style="font-weight:700;color:#4f46e5;margin-bottom:6px">Add Move Plan</div>
      <div style="font-size:12px;color:var(--sub);margin-bottom:14px">Fill in vehicle, crew, schedule and packing details. Customer sees this once you confirm.</div>
      <button onclick="openMovePlanModal('${data.move_id}')"
        style="padding:11px 20px;background:#4f46e5;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
        📋 Create Move Plan
      </button>
    </div>`;
  }

  // ── Payment history ───────────────────────────────────────────
  const historyHtml = data.payments && data.payments.length ? `
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px">
    <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">🧾 Payment History</div>
    ${data.payments.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #e2e8f0">
      <div>
        <div style="font-size:13px;font-weight:600;text-transform:capitalize">${(p.payment_type||'payment').replace('_',' ')} · ${(p.payment_mode||'').replace('_',' ')}</div>
        <div style="font-size:11px;color:var(--sub)">${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:700">₹${parseFloat(p.amount).toLocaleString('en-IN')}</div>
        <div style="font-size:11px;padding:2px 8px;border-radius:20px;display:inline-block;margin-top:2px;
          background:${['verified','success'].includes(p.status)?'#dcfce7':p.status==='under_verification'?'#eff6ff':'#fef2f2'};
          color:${['verified','success'].includes(p.status)?'#15803d':p.status==='under_verification'?'#1d4ed8':'#dc2626'}">
          ${p.status==='under_verification'?'Pending Verification':p.status}
        </div>
      </div>
    </div>`).join('')}
  </div>` : '';

  content.innerHTML = `
  <div style="max-width:560px;margin:0 auto">
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:18px;font-weight:800;margin-bottom:4px">${data.title || 'Payment'}</div>
        <div style="font-size:12px;color:var(--sub)">${data.invoice_number ? `Invoice #${data.invoice_number}` : 'Invoice pending'}</div>
      </div>
      ${(isAgent || isAdmin) && quote ? `
      <button onclick="generateInvoice('${data.move_id}')" style="padding:8px 16px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Print Invoice
      </button>` : ''}
    </div>
    ${stepHtml}
    ${bannerHtml}
    ${summaryHtml}
    ${ctaHtml}
    ${quoteHtml}
    ${planHtml}
    ${historyHtml}
  </div>`;
}

// ── MODAL: Admin/Agent sets confirmed price ───────────────────
function openSetPricingModal(moveId) {
  document.getElementById('setPricingContent').innerHTML = `
  <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Set the confirmed price. Customer will be notified and asked to pay 10% token.</div>
  <div class="field"><label>Base Price (₹) *</label><input type="number" id="spBase" placeholder="e.g. 7999" min="0"/></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="field"><label>Floor Charges (₹)</label><input type="number" id="spFloor" value="0" min="0"/></div>
    <div class="field"><label>Fragile Handling (₹)</label><input type="number" id="spFragile" value="0" min="0"/></div>
    <div class="field"><label>Discount (₹)</label><input type="number" id="spDiscount" value="0" min="0"/></div>
    <div class="field"><label>Notes</label><input type="text" id="spNotes" placeholder="Optional"/></div>
  </div>
  <div id="spPreview" style="display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin:12px 0;text-align:center">
    <div style="font-size:11px;color:var(--sub);margin-bottom:4px">TOTAL (incl. GST 18%)</div>
    <div id="spTotal" style="font-size:28px;font-weight:800;color:var(--accent)">—</div>
    <div id="spToken" style="font-size:13px;color:var(--sub);margin-top:4px">Token: —</div>
  </div>
  <button onclick="previewSetPrice()" style="width:100%;padding:10px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px">🔢 Preview Total</button>
  <button onclick="submitSetPricing('${moveId}')" id="spBtn" class="btn btn-primary">Confirm Price & Notify Customer</button>`;
  openModal('setPricingModal');
}

function previewSetPrice() {
  const base     = parseFloat(document.getElementById('spBase').value) || 0;
  const floor    = parseFloat(document.getElementById('spFloor').value) || 0;
  const fragile  = parseFloat(document.getElementById('spFragile').value) || 0;
  const discount = parseFloat(document.getElementById('spDiscount').value) || 0;
  const subtotal = base + floor + fragile - discount;
  const total    = subtotal + Math.round(subtotal * 0.18);
  const token    = Math.round(total * 0.10);
  document.getElementById('spPreview').style.display = 'block';
  document.getElementById('spTotal').textContent  = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('spToken').textContent  = `Token (10%): ₹${token.toLocaleString('en-IN')}`;
}

async function submitSetPricing(moveId) {
  const base = parseFloat(document.getElementById('spBase').value);
  if (!base || base <= 0) { toast('Base price required', 'error'); return; }
  const btn = document.getElementById('spBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const d = await api('POST', `/api/payments/move/${moveId}/set-pricing`, {
      base_price:       base,
      floor_surcharge:  parseFloat(document.getElementById('spFloor').value)   || 0,
      fragile_surcharge:parseFloat(document.getElementById('spFragile').value) || 0,
      discount:         parseFloat(document.getElementById('spDiscount').value)|| 0,
      notes:            document.getElementById('spNotes').value || null,
    });
    closeModal('setPricingModal');
    toast(`✅ Price set ₹${d.total.toLocaleString('en-IN')} · Token: ₹${d.token_amount.toLocaleString('en-IN')}`, 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Confirm Price & Notify Customer';
  }
}

// ── MODAL: Customer pays 10% token ───────────────────────────
function openTokenPayModal(moveId, amount) {
  document.getElementById('tokenPayContent').innerHTML = `
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:40px;margin-bottom:8px">🔐</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:4px">Confirm Your Booking</div>
    <div style="font-size:13px;color:var(--sub)">Pay 10% now to activate your move</div>
  </div>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:20px">
    <div style="font-size:11px;color:var(--sub);margin-bottom:4px">TOKEN AMOUNT</div>
    <div style="font-size:36px;font-weight:800;color:var(--accent)">₹${parseFloat(amount).toLocaleString('en-IN')}</div>
    <div style="font-size:12px;color:var(--sub);margin-top:4px">10% of total · Balance payable after agent visit</div>
  </div>
  <div class="field"><label>Payment Mode</label>
    <select id="tpMode" style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:14px">
      <option value="upi">UPI</option>
      <option value="bank_transfer">Bank Transfer / NEFT</option>
      <option value="cash">Cash to Agent</option>
    </select>
  </div>
  <div class="field"><label>Transaction Ref / UTR Number</label>
    <input type="text" id="tpRef" placeholder="e.g. 4038291829 or UTR123456"/></div>
  <div class="field"><label>Notes (optional)</label>
    <input type="text" id="tpNotes" placeholder="Any message for admin"/></div>
  <button onclick="submitTokenPay('${moveId}')" id="tpBtn" class="btn btn-primary">
    Submit Token Payment ₹${parseFloat(amount).toLocaleString('en-IN')}
  </button>`;
  openModal('tokenPayModal');
}

async function submitTokenPay(moveId) {
  const btn = document.getElementById('tpBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const d = await api('POST', `/api/payments/move/${moveId}/token`, {
      payment_mode:    document.getElementById('tpMode').value,
      transaction_ref: document.getElementById('tpRef').value || null,
      notes:           document.getElementById('tpNotes').value || null,
    });
    closeModal('tokenPayModal');
    toast(d.message, 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Token Payment';
  }
}

// ── MODAL: Customer pays balance ──────────────────────────────
function openBalancePayModal(moveId, amount) {
  document.getElementById('balPayContent').innerHTML = `
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:40px;margin-bottom:8px">💳</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:4px">Pay Remaining Balance</div>
    <div style="font-size:13px;color:var(--sub)">Complete payment to start your move</div>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;margin-bottom:20px">
    <div style="font-size:11px;color:var(--sub);margin-bottom:4px">BALANCE DUE</div>
    <div style="font-size:36px;font-weight:800;color:#15803d">₹${parseFloat(amount).toLocaleString('en-IN')}</div>
  </div>
  <div class="field"><label>Payment Mode</label>
    <select id="bpMode" style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:14px">
      <option value="upi">UPI</option>
      <option value="bank_transfer">Bank Transfer / NEFT</option>
      <option value="cash">Cash to Agent</option>
    </select>
  </div>
  <div class="field"><label>Transaction Ref / UTR Number</label>
    <input type="text" id="bpRef" placeholder="e.g. 4038291829 or UTR123456"/></div>
  <button onclick="submitBalancePay('${moveId}')" id="bpBtn" class="btn btn-primary">
    Submit Balance Payment ₹${parseFloat(amount).toLocaleString('en-IN')}
  </button>`;
  openModal('balPayModal');
}

async function submitBalancePay(moveId) {
  const btn = document.getElementById('bpBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const d = await api('POST', `/api/payments/move/${moveId}/pay-balance`, {
      payment_mode:    document.getElementById('bpMode').value,
      transaction_ref: document.getElementById('bpRef').value || null,
    });
    closeModal('balPayModal');
    toast(d.message, 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Balance Payment';
  }
}

// ── MODAL: Agent submits total amount needed from customer ─────
function openSubmitQuoteModal(moveId, currentTotal = 0) {
  document.getElementById('submitQuoteContent').innerHTML = `
  <div style="font-size:13px;color:var(--sub);margin-bottom:16px">
    Enter the total amount you need from the customer. This becomes the confirmed price.
  </div>
  <div class="field">
    <label style="font-size:14px;font-weight:700">Total Amount (₹) *</label>
    <input type="number" id="sqTotal" placeholder="e.g. 12000" min="1" inputmode="decimal"
      value="${currentTotal > 0 ? currentTotal : ''}"
      style="font-size:22px;font-weight:800;padding:14px;border:2px solid var(--accent);border-radius:12px;text-align:center"/>
  </div>
  <div style="margin-bottom:14px">
    <button onclick="document.getElementById('sqBreakdown').style.display=document.getElementById('sqBreakdown').style.display==='none'?'block':'none'"
      style="padding:8px 14px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;color:var(--sub)">
      + Add Itemised Breakdown (optional)
    </button>
  </div>
  <div id="sqBreakdown" style="display:none">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="field"><label>Base Price (₹)</label><input type="number" id="sqBase" value="0" min="0"/></div>
      <div class="field"><label>Floor Charges (₹)</label><input type="number" id="sqFloor" value="0" min="0"/></div>
      <div class="field"><label>Fragile (₹)</label><input type="number" id="sqFragile" value="0" min="0"/></div>
      <div class="field"><label>Extra Items (₹)</label><input type="number" id="sqExtra" value="0" min="0"/></div>
    </div>
    <div class="field"><label>Discount (₹)</label><input type="number" id="sqDiscount" value="0" min="0"/></div>
  </div>
  <div class="field"><label>Notes (optional)</label>
    <textarea id="sqNotes" placeholder="e.g. Found 2 extra heavy items on-site..." style="height:70px"></textarea>
  </div>
  <button onclick="submitAgentQuote('${moveId}')" id="sqBtn"
    style="width:100%;padding:14px;background:#16a34a;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">
    ✅ Confirm Total
  </button>`;
  openModal('submitQuoteModal');
}

function previewQuote() { /* legacy — no-op */ }

async function submitAgentQuote(moveId) {
  const total = parseFloat(document.getElementById('sqTotal').value);
  if (!total || total <= 0) { toast('Enter the total amount', 'error'); return; }
  const btn = document.getElementById('sqBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const d = await api('POST', `/api/quotes/move/${moveId}`, {
      total_amount:   total,
      base_price:     parseFloat(document.getElementById('sqBase')?.value)    || 0,
      floor_charge:   parseFloat(document.getElementById('sqFloor')?.value)   || 0,
      fragile_charge: parseFloat(document.getElementById('sqFragile')?.value) || 0,
      extra_items:    parseFloat(document.getElementById('sqExtra')?.value)   || 0,
      discount:       parseFloat(document.getElementById('sqDiscount')?.value)|| 0,
      notes:          document.getElementById('sqNotes').value || null,
    });
    closeModal('submitQuoteModal');
    toast(`✅ Total confirmed: ₹${d.total.toLocaleString('en-IN')}. Balance due: ₹${d.balance_due.toLocaleString('en-IN')}`, 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Confirm Total';
  }
}

// ── MODAL: Agent marks payment received from customer ─────────
function openAgentMarkPaymentModal(moveId, paymentType, suggestedAmount) {
  const isToken = paymentType === 'token';
  const label   = isToken ? '🔐 Token Received' : '✅ Full Payment Received';
  const color   = isToken ? '#b45309' : '#15803d';
  const bg      = isToken ? '#fffbeb' : '#f0fdf4';
  const border  = isToken ? '#fde68a' : '#bbf7d0';

  document.getElementById('submitQuoteContent').innerHTML = `
  <div style="background:${bg};border:1.5px solid ${border};border-radius:12px;padding:14px;margin-bottom:16px;text-align:center">
    <div style="font-size:24px;margin-bottom:4px">${isToken ? '🔐' : '✅'}</div>
    <div style="font-weight:800;font-size:15px;color:${color}">${label}</div>
    <div style="font-size:12px;color:var(--sub);margin-top:4px">
      ${isToken ? 'Mark partial/token amount collected from customer' : 'Mark full outstanding balance collected from customer'}
    </div>
  </div>
  <div class="field">
    <label style="font-weight:700">Amount Received (₹) *</label>
    <input type="number" id="ampAmount" value="${suggestedAmount || ''}" min="1" inputmode="decimal"
      style="font-size:20px;font-weight:700;padding:12px;border:2px solid ${border};border-radius:12px;text-align:center"/>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field">
      <label>Payment Mode</label>
      <select id="ampMode" style="padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;width:100%">
        <option value="cash">Cash</option>
        <option value="upi">UPI</option>
        <option value="bank_transfer">Bank Transfer</option>
      </select>
    </div>
    <div class="field">
      <label>Reference / UPI ID</label>
      <input type="text" id="ampRef" placeholder="optional"/>
    </div>
  </div>
  <div class="field"><label>Notes (optional)</label>
    <input type="text" id="ampNotes" placeholder="Any remarks..."/>
  </div>
  <button onclick="submitAgentMarkPayment('${moveId}','${paymentType}')" id="ampBtn"
    style="width:100%;padding:14px;background:${color};border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer">
    ${label}
  </button>`;
  openModal('submitQuoteModal');
}

async function submitAgentMarkPayment(moveId, paymentType) {
  const amount = parseFloat(document.getElementById('ampAmount').value);
  if (!amount || amount <= 0) { toast('Enter amount received', 'error'); return; }
  const btn = document.getElementById('ampBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const d = await api('POST', `/api/quotes/move/${moveId}/mark-payment`, {
      payment_type:    paymentType,
      amount:          amount,
      payment_mode:    document.getElementById('ampMode').value,
      transaction_ref: document.getElementById('ampRef').value || null,
      notes:           document.getElementById('ampNotes').value || null,
    });
    closeModal('submitQuoteModal');
    const msg = paymentType === 'full'
      ? `✅ Full payment of ₹${amount.toLocaleString('en-IN')} recorded. Move is now in progress!`
      : `🔐 Token of ₹${amount.toLocaleString('en-IN')} recorded.`;
    toast(msg, 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = paymentType === 'full' ? '✅ Full Payment Received' : '🔐 Token Received';
  }
}

// ── MODAL: Agent fills / edits move plan ──────────────────────
function openMovePlanModal(moveId, existing) {
  const p = existing || window._currentPlan || {};
  const materials = Array.isArray(p.packing_materials) ? p.packing_materials
    : (p.packing_materials ? JSON.parse(p.packing_materials) : []);
  const matString = materials.map(m => typeof m === 'object' ? `${m.item}${m.qty?' x'+m.qty:''}` : m).join(', ');

  document.getElementById('submitQuoteContent').innerHTML = `
  <div style="font-size:13px;color:var(--sub);margin-bottom:16px">Fill in the move plan details. Save as draft or publish directly to the customer.</div>

  <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Package & Vehicle</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="field" style="margin:0">
      <label>Package Type</label>
      <select id="mpPackage">
        <option value="basic" ${p.package_type==='basic'?'selected':''}>🟡 Basic</option>
        <option value="standard" ${!p.package_type||p.package_type==='standard'?'selected':''}>🔵 Standard</option>
        <option value="premium" ${p.package_type==='premium'?'selected':''}>⭐ Premium</option>
      </select>
    </div>
    <div class="field" style="margin:0">
      <label>Vehicle Type</label>
      <select id="mpVehicle">
        <option value="">Select...</option>
        <option value="mini truck" ${p.vehicle_type==='mini truck'?'selected':''}>🚐 Mini Truck</option>
        <option value="tempo" ${p.vehicle_type==='tempo'?'selected':''}>🚛 Tempo</option>
        <option value="14ft truck" ${p.vehicle_type==='14ft truck'?'selected':''}>🚚 14ft Truck</option>
        <option value="17ft truck" ${p.vehicle_type==='17ft truck'?'selected':''}>🚚 17ft Truck</option>
        <option value="container" ${p.vehicle_type==='container'?'selected':''}>📦 Container</option>
      </select>
    </div>
  </div>
  <div class="field">
    <label>Vehicle Number</label>
    <input type="text" id="mpVehicleNum" placeholder="e.g. MH01AB1234" value="${p.vehicle_number||''}"/>
  </div>

  <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Crew</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="field" style="margin:0">
      <label>No. of Movers</label>
      <input type="number" id="mpMovers" min="1" max="20" value="${p.movers_count||2}"/>
    </div>
    <div class="field" style="margin:0">
      <label>Team Lead Name</label>
      <input type="text" id="mpLeadName" placeholder="e.g. Raju Sharma" value="${p.team_lead_name||''}"/>
    </div>
  </div>
  <div class="field">
    <label>Team Lead Phone</label>
    <input type="tel" id="mpLeadPhone" placeholder="e.g. 9876543210" value="${p.team_lead_phone||''}"/>
  </div>

  <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Schedule</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="field" style="margin:0">
      <label>Packing Start</label>
      <input type="text" id="mpPackingAt" placeholder="e.g. 7am on pickup day" value="${p.packing_start_time||''}"/>
    </div>
    <div class="field" style="margin:0">
      <label>Pickup Date</label>
      <input type="date" id="mpPickupAt" value="${p.pickup_date ? p.pickup_date.slice(0,10) : ''}"/>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="field" style="margin:0">
      <label>Pickup Time Slot</label>
      <select id="mpSlot">
        <option value="">—</option>
        <option value="morning"   ${p.pickup_time_slot==='morning'?'selected':''}>🌅 Morning (7–11am)</option>
        <option value="afternoon" ${p.pickup_time_slot==='afternoon'?'selected':''}>☀️ Afternoon (12–4pm)</option>
        <option value="evening"   ${p.pickup_time_slot==='evening'?'selected':''}>🌆 Evening (5–8pm)</option>
      </select>
    </div>
    <div class="field" style="margin:0">
      <label>Est. Delivery Date</label>
      <input type="date" id="mpDelivery" value="${p.estimated_delivery ? p.estimated_delivery.slice(0,10) : ''}"/>
    </div>
  </div>

  <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Packing Materials</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="field" style="margin:0"><label>📦 Boxes</label><input type="number" id="mpBoxes" min="0" value="${p.packing_boxes||0}" placeholder="0"/></div>
    <div class="field" style="margin:0"><label>🫧 Bubble Wrap (m)</label><input type="number" id="mpBubble" min="0" value="${p.bubble_wrap_meters||0}" placeholder="0"/></div>
    <div class="field" style="margin:0"><label>🎁 Tape Rolls</label><input type="number" id="mpTape" min="0" value="${p.packing_tape_rolls||0}" placeholder="0"/></div>
    <div class="field" style="margin:0"><label>🌀 Stretch Wrap Rolls</label><input type="number" id="mpStretch" min="0" value="${p.stretch_wrap_rolls||0}" placeholder="0"/></div>
    <div class="field" style="margin:0"><label>🛏️ Furniture Blankets</label><input type="number" id="mpBlankets" min="0" value="${p.furniture_blankets||0}" placeholder="0"/></div>
    <div class="field" style="margin:0"><label>Other Materials</label><input type="text" id="mpCustomMat" value="${p.custom_materials||''}" placeholder="e.g. crates, shrink wrap"/></div>
  </div>
  <div style="font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Notes</div>
  <div class="field">
    <label>Special Instructions (visible to customer)</label>
    <textarea id="mpInstructions" placeholder="e.g. Customer has a piano, needs extra padding...">${p.special_instructions||''}</textarea>
  </div>
  <div class="field">
    <label>Internal Notes (agent only)</label>
    <textarea id="mpInternal" style="height:60px" placeholder="e.g. Building has no service lift...">${p.internal_notes||''}</textarea>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
    <button onclick="saveMovePlan('${moveId}', false)" id="mpSaveBtn"
      style="padding:13px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:12px;color:var(--text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
      💾 Save Draft
    </button>
    <button onclick="saveMovePlan('${moveId}', true)" id="mpPublishBtn"
      style="padding:13px;background:#4f46e5;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
      🚀 Publish to Customer
    </button>
  </div>`;
  openModal('submitQuoteModal');
}

function parseMaterials(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    // detect "item x qty" or "qty item" patterns
    const xMatch = s.match(/^(.+?)\s+[xX×]\s*(\d+)$/);
    const nMatch = s.match(/^(\d+)\s+(.+)$/);
    if (xMatch) return { item: xMatch[1].trim(), qty: parseInt(xMatch[2]) };
    if (nMatch) return { item: nMatch[2].trim(), qty: parseInt(nMatch[1]) };
    return { item: s };
  });
}

async function saveMovePlan(moveId, publish) {
  const btn = document.getElementById(publish ? 'mpPublishBtn' : 'mpSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = publish ? 'Publishing...' : 'Saving...'; }
  try {
    await api('POST', `/api/plans/move/${moveId}`, {
      package_type:         document.getElementById('mpPackage').value,
      vehicle_type:         document.getElementById('mpVehicle').value || null,
      vehicle_number:       document.getElementById('mpVehicleNum').value || null,
      movers_count:         parseInt(document.getElementById('mpMovers').value) || 0,
      team_lead_name:       document.getElementById('mpLeadName').value || null,
      team_lead_phone:      document.getElementById('mpLeadPhone').value || null,
      packing_boxes:        parseInt(document.getElementById('mpBoxes').value) || 0,
      bubble_wrap_meters:   parseInt(document.getElementById('mpBubble').value) || 0,
      packing_tape_rolls:   parseInt(document.getElementById('mpTape').value) || 0,
      stretch_wrap_rolls:   parseInt(document.getElementById('mpStretch').value) || 0,
      furniture_blankets:   parseInt(document.getElementById('mpBlankets').value) || 0,
      custom_materials:     document.getElementById('mpCustomMat').value || null,
      packing_start_at:     document.getElementById('mpPackingAt').value || null,
      pickup_at:            document.getElementById('mpPickupAt').value || null,
      pickup_slot:          document.getElementById('mpSlot').value || null,
      estimated_delivery:   document.getElementById('mpDelivery').value || null,
      special_instructions: document.getElementById('mpInstructions').value || null,
      internal_notes:       document.getElementById('mpInternal').value || null,
      publish,
    });
    closeModal('submitQuoteModal');
    toast(publish ? '📋 Move plan published to customer!' : '💾 Move plan saved as draft', 'success');
    openPaymentScreen(moveId);
  } catch(e) {
    toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = publish ? '🚀 Publish to Customer' : '💾 Save Draft'; }
  }
}

// ── Admin: verify token from admin payments panel ─────────────
async function adminVerifyToken(moveId, action) {
  const sel = document.getElementById(`tokenAgent_${moveId}`);
  const agentId = sel ? sel.value || null : null;
  try {
    await api('POST', `/api/payments/move/${moveId}/verify-token`, { action, agent_id: agentId });
    toast(action === 'approve' ? '✅ Move activated!' : '❌ Payment rejected', action === 'approve' ? 'success' : 'error');
    renderAdminPayments();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Admin: verify balance from admin payments panel ───────────
async function adminVerifyBalance(moveId, action) {
  try {
    await api('POST', `/api/payments/move/${moveId}/verify-balance`, { action });
    toast(action === 'approve' ? '✅ Balance verified — move in progress!' : '❌ Balance rejected', action === 'approve' ? 'success' : 'error');
    renderAdminPayments();
  } catch(e) { toast(e.message, 'error'); }
}


