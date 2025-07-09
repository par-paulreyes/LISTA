-- Complete Database Setup for DTC-IMS
-- This script drops the existing database and creates a fresh one

-- Step 1: Drop existing database (if it exists)
-- DROP DATABASE IF EXISTS ims_db;

-- Step 2: Create fresh database
-- CREATE DATABASE ims_db;
USE ims_db;

DROP TABLE IF EXISTS maintenance_logs;
DROP TABLE IF EXISTS diagnostics;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;

-- Step 3: Create users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(255) DEFAULT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 4: Create companies table (optional, for reference)
CREATE TABLE companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create items table
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_no VARCHAR(100) UNIQUE NOT NULL,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    article_type VARCHAR(100) NOT NULL,
    specifications TEXT,
    date_acquired DATE,
    end_user VARCHAR(100),
    price DECIMAL(10,2),
    location VARCHAR(255),
    supply_officer VARCHAR(100),
    company_name VARCHAR(255) NOT NULL,
    image_url VARCHAR(255),
    next_maintenance_date DATE,
    pending_maintenance_count INT DEFAULT 0,
    maintenance_status VARCHAR(50) DEFAULT 'pending',
    serial_no VARCHAR(100) DEFAULT NULL,
    brand VARCHAR(100) DEFAULT NULL,
    category ENUM('Electronic', 'Utility', 'Tool', 'Supply') DEFAULT NULL,
    quantity INT DEFAULT 1,
    item_status ENUM('Available', 'Bad Condition', 'To be Borrowed', 'Borrowed', 'Out of Stock') DEFAULT 'Available',
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 6: Create maintenance_logs table
CREATE TABLE maintenance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    maintenance_date DATE NOT NULL,
    task_performed TEXT NOT NULL,
    maintained_by VARCHAR(100) NOT NULL,
    notes TEXT,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Step 7: Create diagnostics table
CREATE TABLE diagnostics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    diagnostics_date DATE NOT NULL,
    system_status VARCHAR(100) NOT NULL,
    findings TEXT,
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Step 8: Insert default company
INSERT INTO companies (name, description) VALUES ('DTC', 'Department of Technology and Communication');

-- Step 9: Insert default admin user
-- Username: admin Password: 123456 (hashed with bcrypt) 
INSERT INTO users (username, full_name, email, password, company_name, role) VALUES 
('admin', 'System Administrator', 'admin@dtc.com', '$2b$10$SMLogd9V0jzJyyorAIoejOpc98XJ1Vw5xPAWM5lP07XWyALG9SoJa', 'DTC', 'admin');

-- Step 10: Insert sample items
INSERT INTO items (property_no, qr_code, article_type, specifications, date_acquired, end_user, price, location, supply_officer, company_name, image_url, next_maintenance_date, pending_maintenance_count, maintenance_status, serial_no, brand, category, quantity, item_status, remarks) VALUES 
('PC-001','ICTCE-PC-001', 'Desktop Computer', 'Intel i7, 16GB RAM, 512GB SSD', '2024-01-15', 'John Doe', 45000.00, 'IT Office', 'Supply Officer 1', 'DTC', NULL, NULL, 0, 'pending', 'SN-PC-001', 'Dell', 'Electronic', 1, 'Available', 'Main IT desktop'),
('PC-002','ICTCE-PC-002', 'Laptop', 'Dell Latitude, Intel i5, 8GB RAM', '2024-02-20', 'Jane Smith', 35000.00, 'Admin Office', 'Supply Officer 1', 'DTC', NULL, NULL, 0, 'pending', 'SN-PC-002', 'Dell', 'Electronic', 1, 'Available', NULL),
('PR-001','ICTCE-PR-001', 'Printer', 'HP LaserJet Pro, Wireless', '2024-03-10', 'Print Room', 25000.00, 'Print Room', 'Supply Officer 2', 'DTC', NULL, NULL, 0, 'pending', 'SN-PR-001', 'HP', 'Electronic', 1, 'Available', 'Wireless printer'),
('PC-003','ICTCE-PC-003', 'Desktop Computer', 'Intel i3, 4GB RAM, 256GB HDD', '2023-06-15', 'Mike Johnson', 25000.00, 'HR Office', 'Supply Officer 1', 'DTC', NULL, NULL, 0, 'pending', 'SN-PC-003', NULL, 'Electronic', 1, 'Bad Condition', 'Needs RAM upgrade'),
('PR-002','ICTCE-PR-002', 'Printer', 'Canon Printer, Basic Model', '2023-08-20', 'Finance Office', 15000.00, 'Finance Office', 'Supply Officer 2', 'DTC', NULL, NULL, 0, 'pending', 'SN-PR-002', 'Canon', 'Electronic', 2, 'To be Borrowed', NULL);

-- Step 11: Insert sample maintenance logs
INSERT INTO maintenance_logs (item_id, maintenance_date, task_performed, maintained_by, status) VALUES 
(1, '2024-06-01', 'Regular cleaning and software update', 'admin', 'completed'),
(2, '2024-06-05', 'Hardware inspection and cleaning', 'admin', 'completed'),
(3, '2024-06-10', 'Printer maintenance and cartridge replacement', 'admin', 'completed'),
(4, '2024-06-20', 'System check and repair needed', 'admin', 'pending'),
(5, '2024-06-18', 'Printer repair and maintenance', 'admin', 'pending');

-- Step 12: Insert sample diagnostics
INSERT INTO diagnostics (item_id, diagnostics_date, system_status, findings, recommendations) VALUES 
(1, '2024-06-15', 'Good', 'System running optimally', 'Continue regular maintenance'),
(2, '2024-06-15', 'Good', 'All systems operational', 'No issues detected'),
(3, '2024-06-15', 'Good', 'Printer functioning normally', 'Replace cartridges when needed'),
(4, '2024-06-20', 'Poor', 'System running slowly, hardware issues detected', 'Immediate maintenance required'),
(5, '2024-06-18', 'Fair', 'Printer has minor issues, needs attention', 'Schedule maintenance soon');

-- Step 13: Create indexes for better performance
CREATE INDEX idx_items_company ON items(company_name);
CREATE INDEX idx_items_property_no ON items(property_no);
CREATE INDEX idx_users_company ON users(company_name);
CREATE INDEX idx_maintenance_logs_item ON maintenance_logs(item_id);
CREATE INDEX idx_diagnostics_item ON diagnostics(item_id);

-- Step 14: Show the created tables
SHOW TABLES;

-- Step 15: Verify the data
SELECT 'Users:' as info;
SELECT id, username, full_name, company_name, role FROM users;

SELECT 'Items:' as info;
SELECT id, property_no, article_type, company_name FROM items;

SELECT 'Companies:' as info;
SELECT * FROM companies;
/*
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE borrow_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    item_ids TEXT,
    status VARCHAR(50),
    pickup_date DATE,
    return_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES students(id)
);

CREATE TABLE borrow_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(50),
    FOREIGN KEY (request_id) REFERENCES borrow_requests(id)
); 