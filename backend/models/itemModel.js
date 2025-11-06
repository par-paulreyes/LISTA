const db = require('../db');

const Item = {
  findAllByCompany: (company_name, callback) => {
    db.query(`
      SELECT i.*, 
             ml.status AS status, 
             i.item_status AS system_status,
             COALESCE(pending_count.count, 0) as pending_maintenance_count,
             CASE WHEN pending_count.count > 0 THEN 'pending' ELSE 'completed' END as maintenance_status
      FROM items i
      LEFT JOIN maintenance_logs ml ON ml.id = (
        SELECT id FROM maintenance_logs
        WHERE item_id = i.id
        ORDER BY maintenance_date DESC, created_at DESC
        LIMIT 1
      )
      
      LEFT JOIN (
        SELECT item_id, COUNT(*) as count
        FROM maintenance_logs
        WHERE status = 'pending'
        GROUP BY item_id
      ) pending_count ON pending_count.item_id = i.id
      WHERE i.company_name = ?
    `, [company_name], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
  findById: (id, callback) => {
    db.query(`
      SELECT i.*, 
             ml.status AS status, 
             i.item_status AS system_status,
             COALESCE(pending_count.count, 0) as pending_maintenance_count,
             CASE WHEN pending_count.count > 0 THEN 'pending' ELSE 'completed' END as maintenance_status
      FROM items i
      LEFT JOIN maintenance_logs ml ON ml.id = (
        SELECT id FROM maintenance_logs
        WHERE item_id = i.id
        ORDER BY maintenance_date DESC, created_at DESC
        LIMIT 1
      )
      
      LEFT JOIN (
        SELECT item_id, COUNT(*) as count
        FROM maintenance_logs
        WHERE status = 'pending'
        GROUP BY item_id
      ) pending_count ON pending_count.item_id = i.id
      WHERE i.id = ?
    `, [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  },
  create: (item, callback) => {
    db.query('INSERT INTO items SET ?', item, (err, results) => {
      if (err) return callback(err);
      callback(null, results.insertId);
    });
  },
  update: (id, item, callback) => {
    db.query('UPDATE items SET ? WHERE id = ?', [item, id], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
  delete: (id, callback) => {
    db.query('DELETE FROM items WHERE id = ?', [id], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
  findByQRCode: (code, callback) => {
    db.query('SELECT * FROM items WHERE qr_code = ?', [code], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  },
  findUpcomingMaintenance: (company_name, callback) => {
    db.query(
      `SELECT * FROM items WHERE company_name = ? AND (next_maintenance_date IS NOT NULL AND next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
      [company_name],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results);
      }
    );
  },
  findItemsNeedingMaintenance: (company_name, callback) => {
    db.query(`
      SELECT DISTINCT 
        i.*, 
        i.item_status AS system_status
      FROM items i
      WHERE i.company_name = ? 
      AND (
        i.item_status IN ('Bad Condition')
        OR EXISTS (
          SELECT 1 FROM maintenance_logs ml 
          WHERE ml.item_id = i.id AND ml.status = 'pending'
        )
        OR (i.next_maintenance_date IS NOT NULL AND i.next_maintenance_date <= CURDATE())
      )
    `, [company_name], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  },
};

module.exports = Item; 