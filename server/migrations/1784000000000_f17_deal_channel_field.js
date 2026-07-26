exports.up = (pgm) => {
  pgm.addColumn('deals', { deal_channel: { type: 'varchar(500)' } });
};

exports.down = (pgm) => {
  pgm.dropColumn('deals', 'deal_channel');
};
