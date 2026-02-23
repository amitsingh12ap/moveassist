const puppeteer = require('puppeteer');
const db = require('../../config/db');

function buildHTML(move, boxes, furniture) {
  const deliveredBoxes = boxes.filter(b => b.status === 'delivered').length;
  const deliveredFurn  = furniture.filter(f => f.condition_after).length;
  const condColor = { excellent: '#16a34a', good: '#2563eb', fair: '#d97706', poor: '#dc2626' };
  const statusColor = { delivered: '#16a34a', in_transit: '#2563eb', loaded: '#7c3aed', packed: '#d97706', created: '#6b7280' };

  const boxRows = boxes.map((b, i) => {
    const last = (b.scan_history || []).slice(-1)[0];
    const col = statusColor[b.status] || '#6b7280';
    return `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600">${b.label || `Box ${i+1}`}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b">${b.category || 'General'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">
        <span style="background:${col}18;color:${col};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase">${b.status}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px">${last ? new Date(last.scanned_at).toLocaleString('en-IN') : '—'}</td>
    </tr>`;
  }).join('');

  const furnRows = furniture.map(f => {
    const bc = condColor[f.condition_before] || '#64748b';
    const ac = condColor[f.condition_after] || '#94a3b8';
    const photos = f.photos || [];
    const beforePhoto = photos.find(p => p.photo_type === 'before');
    const afterPhoto  = photos.find(p => p.photo_type === 'after');
    const damaged = f.condition_after && f.condition_after !== f.condition_before && 
                    ['fair','poor'].includes(f.condition_after);
    return `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:600">${f.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b">${f.category || 'General'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">
        <span style="color:${bc};font-weight:600">${f.condition_before || '—'}</span>
        ${f.condition_after ? `<span style="color:#94a3b8"> → </span><span style="color:${ac};font-weight:600">${f.condition_after}</span>` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">
        ${damaged ? `<span style="color:#dc2626;font-size:11px;font-weight:700">⚠ CONDITION CHANGE</span><br/>` : ''}
        ${f.damage_notes ? `<span style="color:#dc2626;font-size:11px">${f.damage_notes}</span>` : '<span style="color:#94a3b8;font-size:11px">None</span>'}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center">
        <div style="display:flex;gap:6px;justify-content:center">
          ${beforePhoto ? `<div style="text-align:center"><div style="font-size:9px;color:#94a3b8;margin-bottom:2px">PICKUP</div><img src="${beforePhoto.photo_url}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/></div>` : ''}
          ${afterPhoto  ? `<div style="text-align:center"><div style="font-size:9px;color:#94a3b8;margin-bottom:2px">DELIVERY</div><img src="${afterPhoto.photo_url}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/></div>` : ''}
          ${!beforePhoto && !afterPhoto ? '<span style="color:#94a3b8;font-size:11px">No photos</span>' : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  const moveDate = move.move_date ? new Date(move.move_date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : 'N/A';
  const reportDate = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const statusLabel = move.status?.replace(/_/g,' ').toUpperCase();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #1e293b; background:#fff; font-size:13px; }
  .page { padding: 40px 48px; }

  /* HEADER */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:24px; border-bottom:2px solid #e2e8f0; }
  .brand { display:flex; align-items:center; gap:14px; }
  .brand-icon { width:48px; height:48px; background:linear-gradient(135deg,#2563eb,#7c3aed); border-radius:14px; display:flex; align-items:center; justify-content:center; }
  .brand-icon svg { width:26px; height:26px; stroke:#fff; fill:none; stroke-width:2; }
  .brand-name { font-size:24px; font-weight:800; color:#1e293b; letter-spacing:-0.5px; }
  .brand-tag { font-size:11px; color:#64748b; margin-top:1px; }
  .report-meta { text-align:right; }
  .report-title { font-size:18px; font-weight:700; color:#1e293b; }
  .report-date { font-size:11px; color:#94a3b8; margin-top:4px; }
  .report-id { font-size:10px; color:#cbd5e1; margin-top:2px; font-family:monospace; }

  /* STATUS BANNER */
  .status-banner { background:linear-gradient(135deg,#eff6ff,#f5f3ff); border:1px solid #dbeafe; border-radius:16px; padding:20px 24px; margin-bottom:28px; display:flex; justify-content:space-between; align-items:center; }
  .move-title { font-size:20px; font-weight:800; color:#1e293b; }
  .move-route { font-size:12px; color:#64748b; margin-top:4px; }
  .status-pill { padding:6px 16px; border-radius:20px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }

  /* STATS GRID */
  .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
  .stat-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; text-align:center; }
  .stat-val { font-size:28px; font-weight:800; line-height:1; }
  .stat-label { font-size:11px; color:#94a3b8; margin-top:4px; text-transform:uppercase; letter-spacing:0.5px; }

  /* SECTIONS */
  .section { margin-bottom:28px; }
  .section-title { font-size:14px; font-weight:700; color:#1e293b; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .section-title::after { content:''; flex:1; height:1px; background:#e2e8f0; }

  /* INFO GRID */
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-item { background:#f8fafc; border-radius:10px; padding:12px 16px; }
  .info-label { font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .info-val { font-size:13px; font-weight:600; color:#1e293b; }

  /* TABLE */
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
  thead tr { background:#f8fafc; }
  th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; }

  /* FOOTER */
  .footer { margin-top:32px; padding-top:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:11px; font-weight:700; color:#64748b; }
  .footer-note { font-size:10px; color:#94a3b8; }

  /* PROGRESS BAR */
  .progress-wrap { background:#e2e8f0; border-radius:99px; height:8px; overflow:hidden; }
  .progress-fill { height:100%; border-radius:99px; background:linear-gradient(90deg,#2563eb,#7c3aed); }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div>
        <div class="brand-name">MoveAssist</div>
        <div class="brand-tag">Professional Move Management</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">Move Report</div>
      <div class="report-date">Generated: ${reportDate}</div>
      <div class="report-id">ID: ${move.id}</div>
    </div>
  </div>

  <!-- STATUS BANNER -->
  <div class="status-banner">
    <div>
      <div class="move-title">${move.title || 'Untitled Move'}</div>
      <div class="move-route">${move.from_address || '—'} &nbsp;→&nbsp; ${move.to_address || '—'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">📅 Move Date: <strong>${moveDate}</strong> &nbsp;·&nbsp; 👤 ${move.user_name}</div>
    </div>
    <span class="status-pill" style="${move.status==='completed'?'background:#dcfce7;color:#16a34a':move.status==='in_progress'?'background:#dbeafe;color:#2563eb':'background:#f1f5f9;color:#64748b'}">${statusLabel}</span>
  </div>

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-val" style="color:#2563eb">${boxes.length}</div>
      <div class="stat-label">Total Boxes</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:#16a34a">${deliveredBoxes}</div>
      <div class="stat-label">Boxes Delivered</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:#7c3aed">${furniture.length}</div>
      <div class="stat-label">Furniture Items</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:#16a34a">${deliveredFurn}</div>
      <div class="stat-label">Furniture Delivered</div>
    </div>
  </div>

  <!-- MOVE INFO -->
  <div class="section">
    <div class="section-title">Move Information</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Customer</div><div class="info-val">${move.user_name}</div></div>
      <div class="info-item"><div class="info-label">Email</div><div class="info-val">${move.email || '—'}</div></div>
      <div class="info-item"><div class="info-label">From Address</div><div class="info-val">${move.from_address || '—'}</div></div>
      <div class="info-item"><div class="info-label">To Address</div><div class="info-val">${move.to_address || '—'}</div></div>
      <div class="info-item"><div class="info-label">Move Date</div><div class="info-val">${moveDate}</div></div>
      <div class="info-item"><div class="info-label">Payment Status</div><div class="info-val">${move.payment_status || '—'}</div></div>
    </div>
  </div>

  ${boxes.length > 0 ? `
  <!-- BOXES -->
  <div class="section">
    <div class="section-title">Box Tracking (${deliveredBoxes}/${boxes.length} delivered)</div>
    <div style="margin-bottom:10px">
      <div class="progress-wrap"><div class="progress-fill" style="width:${boxes.length>0?Math.round(deliveredBoxes/boxes.length*100):0}%"></div></div>
    </div>
    <table>
      <thead><tr><th>Label</th><th>Category</th><th>Status</th><th>Last Scan</th></tr></thead>
      <tbody>${boxRows}</tbody>
    </table>
  </div>` : ''}

  ${furniture.length > 0 ? `
  <!-- FURNITURE -->
  <div class="section">
    <div class="section-title">Furniture Condition Report (${deliveredFurn}/${furniture.length} delivered)</div>
    <table>
      <thead><tr><th>Item</th><th>Category</th><th>Condition</th><th>Damage Notes</th><th>Photos</th></tr></thead>
      <tbody>${furnRows}</tbody>
    </table>
  </div>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">MoveAssist — Home shifting made structured</div>
    <div class="footer-note">This is a system-generated report. All times are in IST.</div>
  </div>

</div>
</body>
</html>`;
}

exports.generate = async (req, res) => {
  const startTime = Date.now();
  const { moveId } = req.params;
  try {
    // Allow owner, agent, or admin
    const moveResult = await db.query(
      `SELECT m.*, u.name as user_name, u.email
       FROM moves m JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND (m.user_id = $2 OR m.agent_id = $2 OR $3 = 'admin')`,
      [moveId, req.user.id, req.user.role]
    );
    if (!moveResult.rows[0]) return res.status(404).json({ error: 'Move not found' });
    const move = moveResult.rows[0];

    const boxesResult = await db.query(
      `SELECT b.*, (SELECT json_agg(s ORDER BY s.scanned_at ASC) FROM box_scans s WHERE s.box_id = b.id) as scan_history
       FROM boxes b WHERE b.move_id = $1 ORDER BY b.created_at ASC`, [moveId]
    );

    const furnitureResult = await db.query(
      `SELECT f.*, (SELECT json_agg(p ORDER BY p.taken_at ASC) FROM furniture_photos p WHERE p.furniture_id = f.id) as photos
       FROM furniture_items f WHERE f.move_id = $1 ORDER BY f.created_at ASC`, [moveId]
    );

    const html = buildHTML(move, boxesResult.rows, furnitureResult.rows);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top:'0', bottom:'0', left:'0', right:'0' } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="moveassist-report-${moveId.slice(0,8)}.pdf"`);
    res.send(pdf);

    const generationTime = Date.now() - startTime;
    await db.query('INSERT INTO move_reports (move_id, generation_time_ms) VALUES ($1,$2) ON CONFLICT DO NOTHING', [moveId, generationTime]);
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed: ' + err.message });
  }
};

exports.download = async (req, res) => {
  return exports.generate(req, res);
};
