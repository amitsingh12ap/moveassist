/* MoveAssist — Global State */
/* state.js */

// ─── STATE ───────────────────────────────────────────────────
const BASE = window.location.origin;
let token = localStorage.getItem('ma_token') || '';
let user = (() => { try { const v = localStorage.getItem('ma_user'); return (v && v !== 'undefined') ? JSON.parse(v) : null; } catch { return null; } })();

const STATUS_LABELS = {
  'created':                      { label: 'Created',               color: 'var(--sub)',     icon: '📋' },
  'payment_pending':              { label: 'Payment Pending',       color: 'var(--warn)',    icon: '💳' },
  'payment_under_verification':   { label: 'Under Verification',    color: '#a78bfa',        icon: '🔍' },
  'active':                       { label: 'Active',                color: 'var(--success)', icon: '✅' },
  'in_progress':                  { label: 'In Progress',           color: 'var(--accent2)', icon: '🚛' },
  'completed':                    { label: 'Completed',             color: 'var(--success)', icon: '🏁' },
  'closed':                       { label: 'Closed',                color: 'var(--dim)',     icon: '🔒' },
};
let currentMove = null;
let currentBox = null;
let currentScreen = 'auth';

