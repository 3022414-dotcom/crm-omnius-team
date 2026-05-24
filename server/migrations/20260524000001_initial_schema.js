/* global pgm */

exports.up = async (pgm) => {
  // ─── ENUM Types ────────────────────────────────────────────────────────────

  pgm.createType('user_role', ['admin', 'bdm', 'viewer']);
  pgm.createType('deal_stage', ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
  pgm.createType('entity_type', ['account', 'contact', 'deal']);
  pgm.createType('activity_type', ['call', 'email', 'meeting', 'task']);

  // ─── updated_at trigger function ───────────────────────────────────────────

  pgm.sql(`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ─── users ─────────────────────────────────────────────────────────────────

  pgm.createTable('users', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email:      { type: 'varchar(255)', notNull: true, unique: true },
    name:       { type: 'varchar(255)', notNull: true },
    role:       { type: 'user_role', notNull: true },
    google_id:  { type: 'varchar(255)', unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── accounts ──────────────────────────────────────────────────────────────

  pgm.createTable('accounts', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name:       { type: 'varchar(255)', notNull: true },
    industry:   { type: 'varchar(255)' },
    website:    { type: 'varchar(500)' },
    phone:      { type: 'varchar(50)' },
    address:    { type: 'text' },
    notes:      { type: 'text' },
    owner_id:   { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── contacts ──────────────────────────────────────────────────────────────

  pgm.createTable('contacts', {
    id:           { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    first_name:   { type: 'varchar(255)', notNull: true },
    last_name:    { type: 'varchar(255)', notNull: true },
    email:        { type: 'varchar(255)' },
    phone:        { type: 'varchar(50)' },
    position:     { type: 'varchar(255)' },
    photo_path:   { type: 'varchar(500)' },
    account_id:   { type: 'uuid', references: '"accounts"', onDelete: 'SET NULL' },
    owner_id:     { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── deals ─────────────────────────────────────────────────────────────────

  pgm.createTable('deals', {
    id:         { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title:      { type: 'varchar(500)', notNull: true },
    value:      { type: 'decimal(15,2)' },
    stage:      { type: 'deal_stage', notNull: true, default: 'lead' },
    close_date: { type: 'date' },
    account_id: { type: 'uuid', references: '"accounts"', onDelete: 'SET NULL' },
    owner_id:   { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── deal_contacts ─────────────────────────────────────────────────────────

  pgm.createTable('deal_contacts', {
    deal_id:    { type: 'uuid', notNull: true, references: '"deals"', onDelete: 'CASCADE' },
    contact_id: { type: 'uuid', notNull: true, references: '"contacts"', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('deal_contacts', 'deal_contacts_pkey', 'PRIMARY KEY (deal_id, contact_id)');

  // ─── notes ─────────────────────────────────────────────────────────────────

  pgm.createTable('notes', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    entity_type: { type: 'entity_type', notNull: true },
    entity_id:   { type: 'uuid', notNull: true },
    content:     { type: 'text', notNull: true },
    author_id:   { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── attachments ───────────────────────────────────────────────────────────

  pgm.createTable('attachments', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    entity_type: { type: 'entity_type', notNull: true },
    entity_id:   { type: 'uuid', notNull: true },
    file_name:   { type: 'varchar(500)', notNull: true },
    file_path:   { type: 'varchar(1000)', notNull: true },
    file_size:   { type: 'integer' },
    mime_type:   { type: 'varchar(255)' },
    uploaded_by: { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── activities ────────────────────────────────────────────────────────────

  pgm.createTable('activities', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    type:        { type: 'activity_type', notNull: true },
    entity_type: { type: 'entity_type', notNull: true },
    entity_id:   { type: 'uuid', notNull: true },
    description: { type: 'text' },
    due_date:    { type: 'timestamptz' },
    completed:   { type: 'boolean', notNull: true, default: false },
    owner_id:    { type: 'uuid', notNull: true, references: '"users"', onDelete: 'RESTRICT' },
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ─── session ───────────────────────────────────────────────────────────────

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS session (
      sid    VARCHAR        NOT NULL COLLATE "default",
      sess   JSON           NOT NULL,
      expire TIMESTAMP(6)   NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);
  `);

  // ─── updated_at triggers ───────────────────────────────────────────────────

  for (const table of ['users', 'accounts', 'contacts', 'deals', 'notes', 'activities']) {
    pgm.sql(`
      CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    `);
  }

  // ─── Indexes ───────────────────────────────────────────────────────────────

  // FK indexes
  pgm.createIndex('accounts', 'owner_id',   { name: 'idx_accounts_owner_id' });
  pgm.createIndex('contacts', 'account_id', { name: 'idx_contacts_account_id' });
  pgm.createIndex('contacts', 'owner_id',   { name: 'idx_contacts_owner_id' });
  pgm.createIndex('deals',    'account_id', { name: 'idx_deals_account_id' });
  pgm.createIndex('deals',    'owner_id',   { name: 'idx_deals_owner_id' });
  pgm.createIndex('notes',    'author_id',  { name: 'idx_notes_author_id' });
  pgm.createIndex('attachments', 'uploaded_by', { name: 'idx_attachments_uploaded_by' });
  pgm.createIndex('activities',  'owner_id',    { name: 'idx_activities_owner_id' });
  pgm.createIndex('deal_contacts', 'contact_id', { name: 'idx_deal_contacts_contact_id' });

  // Search indexes
  pgm.createIndex('accounts', 'name',                      { name: 'idx_accounts_name' });
  pgm.createIndex('contacts', ['first_name', 'last_name'], { name: 'idx_contacts_name' });
  pgm.createIndex('contacts', 'email',                     { name: 'idx_contacts_email' });
  pgm.createIndex('deals',    'stage',                     { name: 'idx_deals_stage' });

  // Polymorphic association indexes
  pgm.createIndex('notes',       ['entity_type', 'entity_id'], { name: 'idx_notes_entity' });
  pgm.createIndex('attachments', ['entity_type', 'entity_id'], { name: 'idx_attachments_entity' });
  pgm.createIndex('activities',  ['entity_type', 'entity_id'], { name: 'idx_activities_entity' });
  pgm.createIndex('activities',  'due_date',                   { name: 'idx_activities_due_date' });
};

exports.down = async (pgm) => {
  // ─── Indexes ───────────────────────────────────────────────────────────────

  pgm.dropIndex('activities',  'due_date',                   { name: 'idx_activities_due_date', ifExists: true });
  pgm.dropIndex('activities',  ['entity_type', 'entity_id'], { name: 'idx_activities_entity', ifExists: true });
  pgm.dropIndex('attachments', ['entity_type', 'entity_id'], { name: 'idx_attachments_entity', ifExists: true });
  pgm.dropIndex('notes',       ['entity_type', 'entity_id'], { name: 'idx_notes_entity', ifExists: true });
  pgm.dropIndex('deals',    'stage',                         { name: 'idx_deals_stage', ifExists: true });
  pgm.dropIndex('contacts', 'email',                         { name: 'idx_contacts_email', ifExists: true });
  pgm.dropIndex('contacts', ['first_name', 'last_name'],     { name: 'idx_contacts_name', ifExists: true });
  pgm.dropIndex('accounts', 'name',                          { name: 'idx_accounts_name', ifExists: true });
  pgm.dropIndex('deal_contacts', 'contact_id', { name: 'idx_deal_contacts_contact_id', ifExists: true });
  pgm.dropIndex('activities',  'owner_id',     { name: 'idx_activities_owner_id', ifExists: true });
  pgm.dropIndex('attachments', 'uploaded_by',  { name: 'idx_attachments_uploaded_by', ifExists: true });
  pgm.dropIndex('notes',    'author_id',  { name: 'idx_notes_author_id', ifExists: true });
  pgm.dropIndex('deals',    'owner_id',   { name: 'idx_deals_owner_id', ifExists: true });
  pgm.dropIndex('deals',    'account_id', { name: 'idx_deals_account_id', ifExists: true });
  pgm.dropIndex('contacts', 'owner_id',   { name: 'idx_contacts_owner_id', ifExists: true });
  pgm.dropIndex('contacts', 'account_id', { name: 'idx_contacts_account_id', ifExists: true });
  pgm.dropIndex('accounts', 'owner_id',   { name: 'idx_accounts_owner_id', ifExists: true });

  // ─── Triggers ──────────────────────────────────────────────────────────────

  for (const table of ['activities', 'notes', 'deals', 'contacts', 'accounts', 'users']) {
    pgm.sql(`DROP TRIGGER IF EXISTS set_updated_at ON ${table};`);
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  pgm.sql(`DROP TABLE IF EXISTS session;`);

  // ─── Tables (reverse dependency order) ────────────────────────────────────

  pgm.dropTable('activities');
  pgm.dropTable('attachments');
  pgm.dropTable('notes');
  pgm.dropTable('deal_contacts');
  pgm.dropTable('deals');
  pgm.dropTable('contacts');
  pgm.dropTable('accounts');
  pgm.dropTable('users');

  // ─── Trigger function ──────────────────────────────────────────────────────

  pgm.sql(`DROP FUNCTION IF EXISTS trigger_set_updated_at();`);

  // ─── ENUM types ────────────────────────────────────────────────────────────

  pgm.dropType('activity_type');
  pgm.dropType('entity_type');
  pgm.dropType('deal_stage');
  pgm.dropType('user_role');
};
