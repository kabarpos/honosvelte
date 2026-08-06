-- 0005_rbac.sql — roles, permissions, pivots + users.status/whatsapp.
-- users.role (a slug) maps to roles.slug, so existing rows stay compatible.

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON role_permissions(permission_id);

-- Per-user permission overrides: users inherit their role's permissions, then
-- these win. granted = 1 grant, 0 deny.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_id)
);

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN whatsapp TEXT;

INSERT OR IGNORE INTO roles (slug, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full access to every module.'),
  ('admin',       'Admin',       'Operates the application.'),
  ('user',        'User',        'Standard account access.');

INSERT OR IGNORE INTO permissions (slug, name, description) VALUES
  ('users.read',         'Read users',         'View and list users.'),
  ('users.create',       'Create users',       'Create new users.'),
  ('users.update',       'Update users',       'Edit users and their role/status.'),
  ('users.delete',       'Delete users',       'Delete users.'),
  ('users.activate',     'Activate users',     'Activate or deactivate users.'),
  ('roles.read',         'Read roles',         'View and list roles.'),
  ('roles.create',       'Create roles',       'Create new roles.'),
  ('roles.update',       'Update roles',       'Edit roles.'),
  ('roles.delete',       'Delete roles',       'Delete roles.'),
  ('roles.assign',       'Assign permissions', 'Manage a role''s permissions.'),
  ('permissions.read',   'Read permissions',   'View and list permissions.'),
  ('permissions.create', 'Create permissions', 'Create new permissions.'),
  ('permissions.update', 'Update permissions', 'Edit permissions.'),
  ('permissions.delete', 'Delete permissions', 'Delete permissions.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p ON p.slug IN (
  'users.read', 'users.create', 'users.update', 'users.delete', 'users.activate',
  'roles.read', 'roles.create', 'roles.update', 'roles.assign',
  'permissions.read', 'permissions.create', 'permissions.update'
)
WHERE r.slug = 'admin';