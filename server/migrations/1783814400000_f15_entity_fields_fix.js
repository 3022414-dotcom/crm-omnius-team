exports.up = (pgm) => {
  pgm.addColumn('deals',    { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
  pgm.addColumn('accounts', { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
  pgm.addColumn('contacts', { created_by_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' } });
  pgm.createIndex('deals',    'created_by_id', { ifNotExists: true });
  pgm.createIndex('accounts', 'created_by_id', { ifNotExists: true });
  pgm.createIndex('contacts', 'created_by_id', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex('deals',    'created_by_id', { ifExists: true });
  pgm.dropIndex('accounts', 'created_by_id', { ifExists: true });
  pgm.dropIndex('contacts', 'created_by_id', { ifExists: true });
  pgm.dropColumn('deals',    'created_by_id');
  pgm.dropColumn('accounts', 'created_by_id');
  pgm.dropColumn('contacts', 'created_by_id');
};
