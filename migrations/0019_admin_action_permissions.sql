-- 0019_admin_action_permissions.sql — granular permissions for admin actions.
INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('contact.update', 'Update contact messages', 'Change contact message status.'),
  ('contact.reply', 'Reply to contact messages', 'Send an email reply to a contact message.'),
  ('contact.delete', 'Delete contact messages', 'Delete contact messages in bulk.'),
  ('notifications.read', 'Read notifications', 'View the admin notification center.'),
  ('notifications.update', 'Update notifications', 'Mark notifications as read.'),
  ('email.test', 'Test email templates', 'Send test email messages.'),
  ('whatsapp.test', 'Test WhatsApp templates', 'Send test WhatsApp messages.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
  AND p.slug IN (
    'contact.update', 'contact.reply', 'contact.delete',
    'notifications.read', 'notifications.update',
    'email.test', 'whatsapp.test'
  );
