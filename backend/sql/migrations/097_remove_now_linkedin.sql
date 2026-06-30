-- Remove "Now" LinkedIn post type from marketing draft types
DELETE FROM marketing.drafts WHERE draft_type_id = (SELECT id FROM marketing.draft_types WHERE slug = 'now_linkedin');
DELETE FROM marketing.draft_types WHERE slug = 'now_linkedin';
