import { pool } from '../db.js';
import { supabaseAdmin } from '../supabase.js';
import { sendBatch } from '../services/emailService.js';

/**
 * POST /api/internal/email/send-weekly-digest
 * Build and send a weekly scraper digest to all admin users.
 * Queries the last 7 days from scraper tables.
 */
export async function sendWeeklyDigest(req, res) {
  try {
    const [renewables, dataCentres, contracts] = await Promise.all([
      pool.query(`
        SELECT name, address, area_name, app_state, decision, start_date, url
        FROM scraper.planit_renewables
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY start_date DESC NULLS LAST
        LIMIT 50
      `),
      pool.query(`
        SELECT name, address, area_name, app_state, decision, start_date, url
        FROM scraper.planit_datacentres
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY start_date DESC NULLS LAST
        LIMIT 50
      `),
      pool.query(`
        SELECT title, buyer_name, published_date, value_low, value_high, url
        FROM scraper.contracts_finder
        WHERE created_at >= NOW() - INTERVAL '7 days'
        ORDER BY published_date DESC NULLS LAST
        LIMIT 50
      `)
    ]);

    const total = renewables.rows.length + dataCentres.rows.length + contracts.rows.length;
    if (total === 0) {
      return res.json({ message: 'No new entries in the last 7 days, digest not sent.', sent: 0 });
    }

    const html = buildDigestHtml({
      renewables: renewables.rows,
      dataCentres: dataCentres.rows,
      contracts: contracts.rows
    });

    // Get all admin users from auth.users via Supabase admin client
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) throw new Error(`Failed to fetch admin roles: ${rolesError.message}`);
    if (!adminRoles?.length) return res.json({ message: 'No admin users found.', sent: 0 });

    const userIds = adminRoles.map(r => r.user_id);
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);

    const adminEmails = users.users
      .filter(u => userIds.includes(u.id) && u.email)
      .map(u => u.email);

    if (!adminEmails.length) return res.json({ message: 'No admin email addresses found.', sent: 0 });

    const weekStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `TRP Weekly Planning Digest, w/e ${weekStr}`;

    const emails = adminEmails.map(email => ({
      to: email,
      subject,
      html,
      type: 'scraper_digest',
      projectId: null
    }));

    const results = await sendBatch(emails);
    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({ sent, failed, total, results });
  } catch (error) {
    console.error('sendWeeklyDigest error:', error);
    res.status(500).json({ error: 'Failed to send weekly digest', details: error.message });
  }
}

function buildDigestHtml({ renewables, dataCentres, contracts }) {
  const weekStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  function tableSection(title, rows, columns) {
    if (!rows.length) return `<h2 style="color:#1e293b;font-size:16px;margin:24px 0 8px">${title}</h2><p style="color:#64748b;font-size:13px">No new entries this week.</p>`;
    const headers = columns.map(c => `<th style="text-align:left;padding:6px 10px;background:#f1f5f9;border-bottom:2px solid #e2e8f0;font-size:12px;color:#475569">${c.label}</th>`).join('');
    const bodyRows = rows.map(row => {
      const cells = columns.map(c => {
        const val = row[c.key] ?? '—';
        const display = c.key === 'start_date' || c.key === 'published_date'
          ? (val !== '—' ? new Date(val).toLocaleDateString('en-GB') : '—')
          : String(val);
        if (c.key === 'name' || c.key === 'title') {
          const link = row.url ? `<a href="${row.url}" style="color:#3b82f6">${display}</a>` : display;
          return `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${link}</td>`;
        }
        return `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569">${display}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `
      <h2 style="color:#1e293b;font-size:16px;margin:24px 0 8px">${title} <span style="font-size:12px;color:#64748b;font-weight:400">(${rows.length} new)</span></h2>
      <table style="width:100%;border-collapse:collapse;font-family:sans-serif"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>
    `;
  }

  const renewablesHtml = tableSection('Renewables (Planit)', renewables, [
    { key: 'name', label: 'Name' },
    { key: 'area_name', label: 'Area' },
    { key: 'app_state', label: 'Status' },
    { key: 'decision', label: 'Decision' },
    { key: 'start_date', label: 'Start Date' }
  ]);

  const dataCentresHtml = tableSection('Data Centres (Planit)', dataCentres, [
    { key: 'name', label: 'Name' },
    { key: 'area_name', label: 'Area' },
    { key: 'app_state', label: 'Status' },
    { key: 'decision', label: 'Decision' },
    { key: 'start_date', label: 'Start Date' }
  ]);

  const contractsHtml = tableSection('Contracts Finder', contracts, [
    { key: 'title', label: 'Title' },
    { key: 'buyer_name', label: 'Buyer' },
    { key: 'published_date', label: 'Published' }
  ]);

  return `
    <div style="font-family:sans-serif;max-width:800px;margin:0 auto;padding:24px">
      <h1 style="color:#1e293b;font-size:20px;margin-bottom:4px">TRP Weekly Planning Digest</h1>
      <p style="color:#64748b;font-size:13px;margin-top:0">New entries in the last 7 days, week ending ${weekStr}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
      ${renewablesHtml}
      ${dataCentresHtml}
      ${contractsHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 8px">
      <p style="color:#94a3b8;font-size:11px">Sent automatically by TRP Dashboard</p>
    </div>
  `;
}
