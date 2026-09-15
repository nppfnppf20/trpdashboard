import { pool } from '../db.js';

export async function listTones(userId) {
  const { rows } = await pool.query(
    `SELECT id, label, sample_text, guidance_notes, is_default, created_at, updated_at
       FROM public.user_email_tones
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at`,
    [userId]
  );
  return rows;
}

export async function createTone(userId, { label, sampleText, guidanceNotes, isDefault }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (isDefault) {
      await client.query(
        `UPDATE public.user_email_tones SET is_default = false, updated_at = now() WHERE user_id = $1 AND is_default`,
        [userId]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO public.user_email_tones (user_id, label, sample_text, guidance_notes, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label, sample_text, guidance_notes, is_default, created_at, updated_at`,
      [userId, label, sampleText, guidanceNotes ?? null, !!isDefault]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTone(userId, toneId, { label, sampleText, guidanceNotes, isDefault }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (isDefault) {
      await client.query(
        `UPDATE public.user_email_tones SET is_default = false, updated_at = now() WHERE user_id = $1 AND is_default AND id != $2`,
        [userId, toneId]
      );
    }
    const { rows } = await client.query(
      `UPDATE public.user_email_tones
          SET label = COALESCE($3, label),
              sample_text = COALESCE($4, sample_text),
              guidance_notes = COALESCE($5, guidance_notes),
              is_default = COALESCE($6, is_default),
              updated_at = now()
        WHERE user_id = $1 AND id = $2
        RETURNING id, label, sample_text, guidance_notes, is_default, created_at, updated_at`,
      [userId, toneId, label ?? null, sampleText ?? null, guidanceNotes ?? null, isDefault ?? null]
    );
    await client.query('COMMIT');
    return rows[0] ?? null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTone(userId, toneId) {
  const { rowCount } = await pool.query(
    `DELETE FROM public.user_email_tones WHERE user_id = $1 AND id = $2`,
    [userId, toneId]
  );
  return rowCount > 0;
}

export async function getTone(userId, toneId) {
  const { rows } = await pool.query(
    `SELECT id, label, sample_text, guidance_notes, is_default FROM public.user_email_tones WHERE user_id = $1 AND id = $2`,
    [userId, toneId]
  );
  return rows[0] ?? null;
}
