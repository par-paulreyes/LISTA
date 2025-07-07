const db = require('../db');

const MaintenanceLog = {
  findAllByCompany: (company_name, callback) => {
    db.query(
      `SELECT ml.*, i.property_no, i.article_type, i.qr_code, i.serial_no, i.specifications, i.category, i.quantity
       FROM maintenance_logs ml
       JOIN items i ON ml.item_id = i.id
       WHERE i.company_name = ?
       ORDER BY ml.maintenance_date DESC`,
      [company_name],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results);
      }
    );
  },
  findAllByItem: (item_id, callback) => {
    db.query(
      `SELECT ml.*, i.property_no, i.article_type, i.qr_code, i.company_name
       FROM maintenance_logs ml
       JOIN items i ON ml.item_id = i.id
       WHERE ml.item_id = ?
       ORDER BY ml.maintenance_date DESC, ml.created_at DESC`,
      [item_id],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results);
      }
    );
  },
  findById: (id, callback) => {
    db.query(
      `SELECT ml.*, i.company_name, i.qr_code
       FROM maintenance_logs ml
       JOIN items i ON ml.item_id = i.id
       WHERE ml.id = ?`,
      [id],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results[0]);
      }
    );
  },
  create: (log, callback) => {
    db.query('INSERT INTO maintenance_logs SET ?', log, (err, results) => {
      if (err) return callback(err);
      callback(null, results.insertId);
    });
  },
  update: (id, log, callback) => {
    db.query('UPDATE maintenance_logs SET ? WHERE id = ?', [log, id], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
  delete: (id, callback) => {
    db.query('DELETE FROM maintenance_logs WHERE id = ?', [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
  updateStatus: (id, status, callback) => {
    db.query('UPDATE maintenance_logs SET status = ? WHERE id = ?', [status, id], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
};

module.exports = MaintenanceLog; 