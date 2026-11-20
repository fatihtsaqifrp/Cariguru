module.exports = db => {
  const addColumn = (table, column, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(item => item.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  addColumn('attendance','checkin_latitude','REAL');
  addColumn('attendance','checkin_longitude','REAL');
  addColumn('tutor_profiles','availability_json',"TEXT NOT NULL DEFAULT '[]'");
  addColumn('transactions','idempotency_key','TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key)');
};
