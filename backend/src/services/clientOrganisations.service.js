/**
 * Client Organisations Service
 * Business logic for client management
 */

import { pool } from '../db.js';

/**
 * Get all client organisations with contacts
 */
export async function getAllClientOrganisations() {
  const query = `
    SELECT
      co.id,
      co.organisation_name,
      co.created_at,
      co.updated_at,

      -- Aggregate contacts
      json_agg(
        DISTINCT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'phone_number', c.phone_number,
          'is_primary', c.is_primary
        )
      ) FILTER (WHERE c.id IS NOT NULL) as contacts

    FROM admin_console.client_organisations co
    LEFT JOIN admin_console.contacts c ON c.organisation_id = co.id AND c.organisation_type = 'client'
    GROUP BY co.id, co.organisation_name, co.created_at, co.updated_at
    ORDER BY co.organisation_name
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get single client organisation by ID
 */
export async function getClientOrganisationById(id) {
  const query = `
    SELECT
      co.id,
      co.organisation_name,
      co.created_at,
      co.updated_at,

      json_agg(
        DISTINCT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'phone_number', c.phone_number,
          'is_primary', c.is_primary
        )
      ) FILTER (WHERE c.id IS NOT NULL) as contacts

    FROM admin_console.client_organisations co
    LEFT JOIN admin_console.contacts c ON c.organisation_id = co.id AND c.organisation_type = 'client'
    WHERE co.id = $1
    GROUP BY co.id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Create a new client organisation with optional contacts
 */
export async function createClientOrganisation(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert the organisation
    const orgResult = await client.query(
      `INSERT INTO admin_console.client_organisations (organisation_name)
       VALUES ($1)
       RETURNING id, organisation_name, created_at, updated_at`,
      [data.organisation_name]
    );

    const organisation = orgResult.rows[0];

    // Insert contacts if provided
    if (data.contacts && data.contacts.length > 0) {
      for (const contact of data.contacts) {
        await client.query(
          `INSERT INTO admin_console.contacts
           (organisation_id, organisation_type, name, email, phone_number, is_primary)
           VALUES ($1, 'client', $2, $3, $4, $5)`,
          [organisation.id, contact.name, contact.email || null, contact.phone_number || null, contact.is_primary || false]
        );
      }
    }

    await client.query('COMMIT');

    // Return the full organisation with contacts
    return await getClientOrganisationById(organisation.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a client organisation and its contacts
 */
export async function updateClientOrganisation(id, data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update the organisation name
    await client.query(
      `UPDATE admin_console.client_organisations
       SET organisation_name = $1, updated_at = NOW()
       WHERE id = $2`,
      [data.organisation_name, id]
    );

    // Get existing contact IDs
    const existingContacts = await client.query(
      `SELECT id FROM admin_console.contacts
       WHERE organisation_id = $1 AND organisation_type = 'client'`,
      [id]
    );
    const existingIds = new Set(existingContacts.rows.map(c => c.id));

    // Process contacts
    const newContactIds = new Set();

    if (data.contacts && data.contacts.length > 0) {
      for (const contact of data.contacts) {
        if (contact.id) {
          // Update existing contact
          await client.query(
            `UPDATE admin_console.contacts
             SET name = $1, email = $2, phone_number = $3, is_primary = $4
             WHERE id = $5 AND organisation_id = $6 AND organisation_type = 'client'`,
            [contact.name, contact.email || null, contact.phone_number || null, contact.is_primary || false, contact.id, id]
          );
          newContactIds.add(contact.id);
        } else {
          // Insert new contact
          await client.query(
            `INSERT INTO admin_console.contacts
             (organisation_id, organisation_type, name, email, phone_number, is_primary)
             VALUES ($1, 'client', $2, $3, $4, $5)`,
            [id, contact.name, contact.email || null, contact.phone_number || null, contact.is_primary || false]
          );
        }
      }
    }

    // Delete contacts that were removed
    for (const existingId of existingIds) {
      if (!newContactIds.has(existingId)) {
        await client.query(
          `DELETE FROM admin_console.contacts WHERE id = $1`,
          [existingId]
        );
      }
    }

    await client.query('COMMIT');

    // Return the updated organisation with contacts
    return await getClientOrganisationById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a client organisation and all its contacts
 */
export async function deleteClientOrganisation(id) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete all contacts first
    const contactsResult = await client.query(
      `DELETE FROM admin_console.contacts
       WHERE organisation_id = $1 AND organisation_type = 'client'
       RETURNING id`,
      [id]
    );

    // Delete the organisation
    const orgResult = await client.query(
      `DELETE FROM admin_console.client_organisations
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    await client.query('COMMIT');

    return {
      deleted: orgResult.rowCount > 0,
      contactsDeleted: contactsResult.rowCount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get count of contacts for a client organisation (for delete confirmation)
 */
export async function getContactsCount(id) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM admin_console.contacts
     WHERE organisation_id = $1 AND organisation_type = 'client'`,
    [id]
  );
  return parseInt(result.rows[0].count, 10);
}
