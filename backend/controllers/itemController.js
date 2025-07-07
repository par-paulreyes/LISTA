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
    
    if (format === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        // Define the fields for all sheets
        const fields = [
          'id', 'qr_code', 'property_no', 'serial_no', 'category', 'article_type', 
          'brand', 'specifications', 'date_acquired', 'end_user', 'location', 
          'quantity', 'item_status', 'remarks'
        ];
        
        // Group items by category
        const itemsByCategory = {};
        items.forEach(item => {
          const category = item.category || 'Uncategorized';
          if (!itemsByCategory[category]) {
            itemsByCategory[category] = [];
          }
          itemsByCategory[category].push(item);
        });
        
        // Create "All" sheet first
        const allSheet = workbook.addWorksheet('All');
        allSheet.columns = fields.map(field => ({
          header: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
          key: field,
          width: 15
        }));
        
        // Add data to "All" sheet
        items.forEach(item => {
          allSheet.addRow(item);
        });
        
        // Create sheets for each category
        Object.keys(itemsByCategory).forEach(category => {
          const sheet = workbook.addWorksheet(category);
          sheet.columns = fields.map(field => ({
            header: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
            key: field,
            width: 15
          }));

          // Group items by article_type within this category
          const itemsByArticle = {};
          itemsByCategory[category].forEach(item => {
            const article = item.article_type || 'Unspecified';
            if (!itemsByArticle[article]) itemsByArticle[article] = [];
            itemsByArticle[article].push(item);
          });

          // For each article_type, add a yellow header row and then the items
          Object.keys(itemsByArticle).forEach(article => {
            // Add a yellow, bold header row for the article_type
            const headerRow = sheet.addRow([article]);
            headerRow.font = { bold: true };
            headerRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFF00' } // Yellow
            };
            // Merge the header row across all columns
            sheet.mergeCells(`A${headerRow.number}:${String.fromCharCode(65+fields.length-1)}${headerRow.number}`);

            // Add the data rows for this article_type
            itemsByArticle[article].forEach(item => {
              sheet.addRow(item);
            });
          });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.xlsx');
        
        // Write to response
        workbook.xlsx.write(res).then(() => {
          res.end();
        }).catch(err => {
          return res.status(500).json({ message: 'Error generating Excel file', error: err });
        });
        
      } catch (err) {
        return res.status(500).json({ message: 'Error generating Excel file', error: err });
      }
    } else if (format === 'pdf') {
      try {
        const PDFDocument = require('pdfkit');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.pdf');
        const doc = new PDFDocument();
        doc.pipe(res);
        
        doc.fontSize(18).text('Inventory Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Company: ${company_name}`, { align: 'center' });
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
        
        items.forEach((item, idx) => {
          doc.fontSize(12).text(`Item #${idx + 1}`, { underline: true });
          doc.fontSize(10).text(`ID: ${item.id || 'N/A'}`);
          doc.fontSize(10).text(`QR Code: ${item.qr_code || 'N/A'}`);
          doc.fontSize(10).text(`Property No: ${item.property_no || 'N/A'}`);
          doc.fontSize(10).text(`Serial No: ${item.serial_no || 'N/A'}`);
          doc.fontSize(10).text(`Category: ${item.category || 'N/A'}`);
          doc.fontSize(10).text(`Article Type: ${item.article_type || 'N/A'}`);
          doc.fontSize(10).text(`Brand: ${item.brand || 'N/A'}`);
          doc.fontSize(10).text(`Specifications: ${item.specifications || 'N/A'}`);
          doc.fontSize(10).text(`Date Acquired: ${item.date_acquired || 'N/A'}`);
          doc.fontSize(10).text(`End User: ${item.end_user || 'N/A'}`);
          doc.fontSize(10).text(`Location: ${item.location || 'N/A'}`);
          doc.fontSize(10).text(`Quantity: ${item.quantity || 'N/A'}`);
          doc.fontSize(10).text(`Item Status: ${item.item_status || 'N/A'}`);
          doc.fontSize(10).text(`Remarks: ${item.remarks || 'N/A'}`);
          doc.moveDown();
        });
        
        doc.end();
      } catch (err) {
        return res.status(500).json({ message: 'Error generating PDF', error: err });
      }
    } else {
      try {
        const { Parser } = require('json2csv');
        const fields = [
          'id', 'qr_code', 'property_no', 'serial_no', 'category', 'article_type', 
          'brand', 'specifications', 'date_acquired', 'end_user', 'location', 
          'quantity', 'item_status', 'remarks'
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(items);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
        return res.send(csv);
      } catch (err) {
        return res.status(500).json({ message: 'Error generating CSV', error: err });
      }
    }
  });
}; 