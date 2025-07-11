const Item = require('../models/itemModel');
const MaintenanceLog = require('../models/maintenanceLogModel');
const Diagnostic = require('../models/diagnosticModel');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.getAllItems = (req, res) => {
  console.log('Getting all items for company:', req.user.company_name);
  
  const company_name = req.user.company_name;
  Item.findAllByCompany(company_name, (err, items) => {
    if (err) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ message: 'Error fetching items', error: err.message });
    }
    console.log('Successfully fetched items:', items.length);
    res.json(items);
  });
};

exports.getItemById = (req, res) => {
  Item.findById(req.params.id, (err, item) => {
    if (err) return res.status(500).json({ message: 'Error fetching item', error: err });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  });
};

exports.createItem = async (req, res) => {
  try {
    console.log('Creating item with data:', req.body);
    console.log('User:', req.user);
    const company_name = req.user.company_name;
    const { maintenance_date, maintained_by, maintenance_tasks, diagnostic, item_description, created_at, updated_at, ...itemData } = req.body;
    console.log('Extracted maintenance fields:', { maintenance_date, maintained_by, maintenance_tasks, diagnostic });
    console.log('Filtered item data:', itemData);
    
    // Map item_description to specifications for Supply/Tool/Utility items
    if (item_description && !itemData.specifications) {
      itemData.specifications = item_description;
    }
    
    // Set default article_type for non-electronic items
    if (!itemData.article_type) {
      if (itemData.category === 'Supply') {
        itemData.article_type = 'Supply Item';
      } else if (itemData.category === 'Tool') {
        itemData.article_type = 'Tool';
      } else if (itemData.category === 'Utility') {
        itemData.article_type = 'Utility Item';
      }
    }
    
    let item = { ...itemData, company_name };
    if (req.body.image_url) {
      item.image_url = req.body.image_url;
    }
    console.log('Final item data to insert:', item);
    const itemId = await new Promise((resolve, reject) => {
      Item.create(item, (err, id) => {
        if (err) reject(err);
        else resolve(id);
      });
    });
    let maintenanceLogsCreated = 0;
    let diagnosticCreated = false;
    
    // Create maintenance logs if provided
    if (maintenance_tasks && maintenance_date) {
      try {
        const maintenanceTasks = JSON.parse(maintenance_tasks);
        const maintainedBy = req.user.username;
        
        console.log('Creating maintenance logs for tasks:', maintenanceTasks);
        
        // Create all maintenance logs using Promise.all
        const maintenancePromises = maintenanceTasks.map((task, index) => {
          return new Promise((resolve, reject) => {
            const maintenanceLog = {
              item_id: itemId,
              maintenance_date: maintenance_date,
              task_performed: task.task,
              maintained_by: maintainedBy,
              notes: task.notes || '',
              status: task.completed ? 'completed' : 'pending'
            };
            
            console.log(`Creating maintenance log ${index + 1}:`, maintenanceLog);
            
            MaintenanceLog.create(maintenanceLog, (err, logId) => {
              if (err) {
                console.error('Error creating maintenance log:', err);
                reject(err);
              } else {
                console.log('Maintenance log created with ID:', logId);
                resolve(logId);
              }
            });
          });
        });
        
        // Wait for all maintenance logs to be created
        const maintenanceResults = await Promise.all(maintenancePromises);
        maintenanceLogsCreated = maintenanceResults.length;
        console.log(`Successfully created ${maintenanceLogsCreated} maintenance logs`);
        
      } catch (parseErr) {
        console.error('Error parsing or creating maintenance tasks:', parseErr);
        throw new Error('Failed to create maintenance logs: ' + parseErr.message);
      }
    }

    // Create diagnostic record if provided
    if (diagnostic) {
      try {
        const diagnosticData = JSON.parse(diagnostic);
        const diagnosticRecord = {
          item_id: itemId,
          diagnostics_date: new Date().toISOString().split('T')[0],
          system_status: diagnosticData.system_status,
          findings: diagnosticData.findings || '',
          recommendations: diagnosticData.recommendations || ''
        };
        
        console.log('Creating diagnostic record:', diagnosticRecord);
        
        const diagnosticId = await new Promise((resolve, reject) => {
          Diagnostic.create(diagnosticRecord, (err, id) => {
            if (err) {
              console.error('Error creating diagnostic:', err);
              reject(err);
            } else {
              console.log('Diagnostic created with ID:', id);
              resolve(id);
            }
          });
        });
        
        diagnosticCreated = true;
        console.log('Successfully created diagnostic record');
        
      } catch (parseErr) {
        console.error('Error parsing or creating diagnostic data:', parseErr);
        throw new Error('Failed to create diagnostic record: ' + parseErr.message);
      }
    }

    // Send success response
    const response = {
      message: 'Item created successfully',
      id: itemId,
      maintenance_logs_created: maintenanceLogsCreated,
      diagnostic_created: diagnosticCreated
    };
    
    console.log('Final response:', response);
    res.status(201).json(response);
    
  } catch (error) {
    console.error('Error in createItem:', error);
    res.status(500).json({ 
      message: 'Error creating item', 
      error: error.message 
    });
  }
};

exports.updateItem = (req, res) => {
  const { status, system_status, pending_maintenance_count, maintenance_status, ...updateData } = req.body;
  if (req.body.image_url) {
    updateData.image_url = req.body.image_url;
  }
  console.log('Updating item with filtered data:', updateData);
  Item.update(req.params.id, updateData, (err, result) => {
    if (err) {
      console.error('Error updating item:', err);
      return res.status(500).json({ message: 'Error updating item', error: err.message });
    }
    res.json({ message: 'Item updated' });
  });
};

exports.deleteItem = async (req, res) => {
  try {
    // Fetch the item to get the image_url
    Item.findById(req.params.id, async (err, item) => {
      if (err) return res.status(500).json({ message: 'Error finding item', error: err });
      if (!item) return res.status(404).json({ message: 'Item not found' });

      // If item has an image_url, delete the image from Supabase
      if (item.image_url) {
        let filePath;
        try {
          // Try to parse as URL
          const url = new URL(item.image_url);
          const pathParts = url.pathname.split('/object/public/');
          filePath = pathParts[1];
        } catch {
          // If it's not a valid URL, treat as direct path
          filePath = item.image_url;
        }
        if (filePath) {
          const { error: deleteError } = await supabase.storage.from('item-images').remove([filePath]);
          if (deleteError) {
            console.error('Error deleting image from Supabase:', deleteError);
            // Continue with item deletion even if image deletion fails
          }
        }
      }

      // Now delete the item from the database
      Item.delete(req.params.id, (err, result) => {
        if (err) return res.status(500).json({ message: 'Error deleting item', error: err });
        res.json({ message: 'Item and image deleted (if existed)' });
      });
    });
  } catch (error) {
    console.error('Error in deleteItem:', error);
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
};

exports.getItemByQRCode = (req, res) => {
  const code = req.params.code;
  Item.findByQRCode(code, (err, item) => {
    if (err) return res.status(500).json({ message: 'Error fetching item by QR code', error: err });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  });
};

exports.getUpcomingMaintenance = (req, res) => {
  const company_name = req.user.company_name;
  Item.findUpcomingMaintenance(company_name, (err, items) => {
    if (err) return res.status(500).json({ message: 'Error fetching upcoming maintenance items', error: err });
    res.json(items);
  });
};

exports.getItemsNeedingMaintenance = (req, res) => {
  const company_name = req.user.company_name;
  Item.findItemsNeedingMaintenance(company_name, (err, items) => {
    if (err) return res.status(500).json({ message: 'Error fetching items needing maintenance', error: err });
    res.json(items);
  });
};

exports.exportItems = (req, res) => {
  const company_name = req.user.company_name;
  const format = req.query.format || 'csv';
  
  Item.findAllByCompany(company_name, (err, items) => {
    if (err) return res.status(500).json({ message: 'Error exporting items', error: err });

    // Group items by numeric ID from QR code
    const groups = {};
    items.forEach(item => {
      const match = item.qr_code && item.qr_code.match(/(\d{3,})$/);
      if (!match) return;
      const id = match[1];
      if (!groups[id]) groups[id] = {};
      if (item.article_type === 'Desktop Computer') groups[id].pc = item;
      else if (item.article_type === 'Monitor') groups[id].monitor = item;
      else if (item.article_type === 'Keyboard') groups[id].keyboard = item;
      else if (item.article_type === 'Mouse') groups[id].mouse = item;
      else if (item.article_type === 'UPS') groups[id].ups = item;
      else {
        if (!groups[id].other) groups[id].other = [];
        groups[id].other.push(item);
      }
    });

    // Build export rows
    const exportRows = Object.entries(groups).map(([id, group]) => ({
      pc_no: id,
      pc_brand: group.pc?.brand || '',
      pc_serial: group.pc?.serial_no || '',
      pc_property: group.pc?.property_no || '',
      monitor_brand: group.monitor?.brand || '',
      monitor_serial: group.monitor?.serial_no || '',
      monitor_property: group.monitor?.property_no || '',
      keyboard_brand: group.keyboard?.brand || '',
      keyboard_serial: group.keyboard?.serial_no || group.keyboard?.property_no || '',
      mouse_brand: group.mouse?.brand || '',
      mouse_serial: group.mouse?.serial_no || group.mouse?.property_no || '',
      ups_brand: group.ups?.brand || '',
      ups_serial: group.ups?.serial_no || group.ups?.property_no || '',
      other_type: group.other?.[0]?.article_type || '',
      other_brand: group.other?.[0]?.brand || '',
      other_serial: group.other?.[0]?.serial_no || group.other?.[0]?.property_no || '',
      remarks: group.pc?.remarks || group.monitor?.remarks || group.keyboard?.remarks || group.mouse?.remarks || group.ups?.remarks || group.other?.[0]?.remarks || ''
    }));

    // Define export fields/columns
    const exportFields = [
      { label: 'PC No.', value: 'pc_no' },
      { label: 'System Unit Brand', value: 'pc_brand' },
      { label: 'System Unit Serial No.', value: 'pc_serial' },
      { label: 'System Unit Property No.', value: 'pc_property' },
      { label: 'Monitor Brand', value: 'monitor_brand' },
      { label: 'Monitor Serial No.', value: 'monitor_serial' },
      { label: 'Monitor Property No.', value: 'monitor_property' },
      { label: 'Keyboard Brand', value: 'keyboard_brand' },
      { label: 'Keyboard Serial/Property No.', value: 'keyboard_serial' },
      { label: 'Mouse Brand', value: 'mouse_brand' },
      { label: 'Mouse Serial/Property No.', value: 'mouse_serial' },
      { label: 'UPS Brand', value: 'ups_brand' },
      { label: 'UPS Serial/Property No.', value: 'ups_serial' },
      { label: 'Other Type', value: 'other_type' },
      { label: 'Other Brand', value: 'other_brand' },
      { label: 'Other Serial/Property No.', value: 'other_serial' },
      { label: 'Remarks', value: 'remarks' }
    ];

    if (format === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Grouped Inventory');
        sheet.columns = exportFields.map(f => ({ header: f.label, key: f.value, width: 18 }));
        exportRows.forEach(row => sheet.addRow(row));
        // Add another tab for DTC PC (Date)
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const dtcSheet = workbook.addWorksheet(`DTC PC (${dateStr})`);
        dtcSheet.columns = exportFields.map(f => ({ header: f.label, key: f.value, width: 18 }));
        exportRows.forEach(row => dtcSheet.addRow(row));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory_grouped.xlsx');
        workbook.xlsx.write(res).then(() => res.end());
      } catch (err) {
        return res.status(500).json({ message: 'Error generating Excel file', error: err });
      }
    } else if (format === 'csv') {
      try {
        const { Parser } = require('json2csv');
        const parser = new Parser({ fields: exportFields.map(f => ({ label: f.label, value: f.value })) });
        const csv = parser.parse(exportRows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory_grouped.csv');
        return res.send(csv);
      } catch (err) {
        return res.status(500).json({ message: 'Error generating CSV', error: err });
      }
    } else {
      // fallback to default (PDF or other)
      try {
        const PDFDocument = require('pdfkit');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory_grouped.pdf');
        const doc = new PDFDocument();
        doc.pipe(res);
        doc.fontSize(18).text('Grouped Inventory Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Company: ${company_name}`, { align: 'center' });
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        // Table header
        doc.fontSize(10).text(exportFields.map(f => f.label).join(' | '));
        doc.moveDown(0.5);
        exportRows.forEach(row => {
          doc.fontSize(9).text(exportFields.map(f => row[f.value] || '').join(' | '));
        });
        doc.end();
      } catch (err) {
        return res.status(500).json({ message: 'Error generating PDF', error: err });
      }
    }
  });
}; 