/* global pgm */

exports.up = async (pgm) => {
  // ─── 1. New ENUM types ─────────────────────────────────────────────────────

  pgm.createType('location_enum', ['Russia', 'Belorussia', 'Kazakhstan', 'Armenia']);
  pgm.createType('industry_enum', ['FinTech', 'MedTech', 'Agro', 'Oil and Gas', 'Commerce', 'HoReCa', 'Customer services', 'Production']);
  pgm.createType('account_type_enum', ['Prospect', 'Client', 'Partner', 'Vendor']);
  pgm.createType('account_size_enum', ['1-50', '51-200', '201-1000', '1000+']);
  pgm.createType('contact_source_enum', ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Employee']);
  pgm.createType('preferred_communication_enum', ['Telegram', 'WhatsApp', 'Email', 'LinkedIn']);
  pgm.createType('language_enum', ['Russian', 'English']);
  pgm.createType('deal_type_enum', ['New Client', 'New Project with existing client', 'Upsale']);
  pgm.createType('deal_source_enum', ['Founder', 'Marketing', 'Organic', 'BizDev', 'Customer', 'Referral', 'Agent', 'Event', 'Tender Platforms', 'Employee']);
  pgm.createType('currency_enum', ['RUB', 'EUR', 'USD']);

  // ─── 2. Deal stage migration: 6 → 8 values ────────────────────────────────

  pgm.createType('deal_stage_v2', ['lead', 'qualifying', 'discovery', 'proposal', 'closing', 'contract', 'won', 'lost']);

  pgm.sql(`ALTER TABLE deals ADD COLUMN stage_v2 deal_stage_v2;`);

  pgm.sql(`
    UPDATE deals SET stage_v2 = CASE
      WHEN stage::text = 'qualified'   THEN 'qualifying'::deal_stage_v2
      WHEN stage::text = 'negotiation' THEN 'closing'::deal_stage_v2
      ELSE stage::text::deal_stage_v2
    END;
  `);

  pgm.sql(`ALTER TABLE deals ALTER COLUMN stage_v2 SET NOT NULL;`);
  pgm.sql(`ALTER TABLE deals ALTER COLUMN stage_v2 SET DEFAULT 'lead';`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN stage;`);
  pgm.sql(`ALTER TABLE deals RENAME COLUMN stage_v2 TO stage;`);
  pgm.sql(`DROP TYPE deal_stage;`);
  pgm.sql(`ALTER TYPE deal_stage_v2 RENAME TO deal_stage;`);

  // ─── 3. accounts.industry: VARCHAR → ENUM (SET NULL) ──────────────────────

  pgm.sql(`ALTER TABLE accounts ADD COLUMN industry_new industry_enum;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN industry;`);
  pgm.sql(`ALTER TABLE accounts RENAME COLUMN industry_new TO industry;`);

  // ─── 4. New columns for accounts ──────────────────────────────────────────

  pgm.addColumn('accounts', {
    type:               { type: 'account_type_enum' },
    location:           { type: 'location_enum' },
    size:               { type: 'account_size_enum' },
    is_target:          { type: 'boolean', notNull: true, default: false },
    account_storage:    { type: 'varchar(500)' },
    account_manager_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' },
  });

  // ─── 5. New columns for contacts ──────────────────────────────────────────

  pgm.addColumn('contacts', {
    telegram:                { type: 'varchar(255)' },
    linkedin:                { type: 'varchar(500)' },
    facebook:                { type: 'varchar(500)' },
    email_corp:              { type: 'varchar(255)' },
    email_personal:          { type: 'varchar(255)' },
    location:                { type: 'location_enum' },
    language:                { type: 'language_enum' },
    preferred_communication: { type: 'preferred_communication_enum' },
    birthday:                { type: 'date' },
    comments:                { type: 'text' },
    source:                  { type: 'contact_source_enum' },
  });

  // Copy existing email → email_corp
  pgm.sql(`UPDATE contacts SET email_corp = email WHERE email IS NOT NULL;`);

  // ─── 6. New columns for deals ─────────────────────────────────────────────

  pgm.addColumn('deals', {
    location:           { type: 'location_enum' },
    deal_type:          { type: 'deal_type_enum' },
    source:             { type: 'deal_source_enum' },
    project_domain:     { type: 'industry_enum' },
    description:        { type: 'text' },
    our_services:       { type: 'text[]' },
    deal_storage:       { type: 'varchar(500)' },
    expected_start_date: { type: 'date' },
    currency:           { type: 'currency_enum', notNull: true, default: 'RUB' },
    lost_reason:        { type: 'text' },
  });

  // ─── 7. New columns for deal_contacts ─────────────────────────────────────

  pgm.addColumn('deal_contacts', {
    role:    { type: 'varchar(255)' },
    comment: { type: 'text' },
  });

  // ─── 8. Index for new FK ───────────────────────────────────────────────────

  pgm.createIndex('accounts', 'account_manager_id', { name: 'idx_accounts_account_manager_id' });
};

exports.down = async (pgm) => {
  // ─── Reverse order ─────────────────────────────────────────────────────────

  pgm.dropIndex('accounts', 'account_manager_id', { name: 'idx_accounts_account_manager_id', ifExists: true });

  // deal_contacts
  pgm.sql(`ALTER TABLE deal_contacts DROP COLUMN IF EXISTS role;`);
  pgm.sql(`ALTER TABLE deal_contacts DROP COLUMN IF EXISTS comment;`);

  // deals new columns
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS lost_reason;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS currency;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS expected_start_date;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS deal_storage;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS our_services;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS description;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS project_domain;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS source;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS deal_type;`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN IF EXISTS location;`);

  // contacts new columns
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS source;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS comments;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS birthday;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS preferred_communication;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS language;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS location;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS email_personal;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS email_corp;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS facebook;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS linkedin;`);
  pgm.sql(`ALTER TABLE contacts DROP COLUMN IF EXISTS telegram;`);

  // accounts new columns
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS account_manager_id;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS account_storage;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS is_target;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS size;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS location;`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN IF EXISTS type;`);

  // accounts.industry: ENUM → VARCHAR
  pgm.sql(`ALTER TABLE accounts ADD COLUMN industry_old varchar(255);`);
  pgm.sql(`ALTER TABLE accounts DROP COLUMN industry;`);
  pgm.sql(`ALTER TABLE accounts RENAME COLUMN industry_old TO industry;`);

  // deal_stage: 8 → 6 values
  pgm.createType('deal_stage_old', ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
  pgm.sql(`ALTER TABLE deals ADD COLUMN stage_old deal_stage_old;`);
  pgm.sql(`
    UPDATE deals SET stage_old = CASE
      WHEN stage::text = 'qualifying' THEN 'qualified'::deal_stage_old
      WHEN stage::text = 'closing'    THEN 'negotiation'::deal_stage_old
      WHEN stage::text IN ('discovery', 'contract') THEN 'lead'::deal_stage_old
      ELSE stage::text::deal_stage_old
    END;
  `);
  pgm.sql(`ALTER TABLE deals ALTER COLUMN stage_old SET NOT NULL;`);
  pgm.sql(`ALTER TABLE deals ALTER COLUMN stage_old SET DEFAULT 'lead';`);
  pgm.sql(`ALTER TABLE deals DROP COLUMN stage;`);
  pgm.sql(`ALTER TABLE deals RENAME COLUMN stage_old TO stage;`);
  pgm.sql(`DROP TYPE deal_stage;`);
  pgm.sql(`ALTER TYPE deal_stage_old RENAME TO deal_stage;`);

  // ENUM types
  pgm.dropType('currency_enum');
  pgm.dropType('deal_source_enum');
  pgm.dropType('deal_type_enum');
  pgm.dropType('language_enum');
  pgm.dropType('preferred_communication_enum');
  pgm.dropType('contact_source_enum');
  pgm.dropType('account_size_enum');
  pgm.dropType('account_type_enum');
  pgm.dropType('industry_enum');
  pgm.dropType('location_enum');
};
