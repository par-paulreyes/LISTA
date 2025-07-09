-- Migration script to add 'Out of Stock' to item_status ENUM
-- Run this script to update existing database

USE ims_db;

-- First, alter the table to allow the new ENUM value
ALTER TABLE items MODIFY COLUMN item_status ENUM('Available', 'Bad Condition', 'To be Borrowed', 'Borrowed', 'Out of Stock') DEFAULT 'Available';

-- Verify the change
DESCRIBE items; 