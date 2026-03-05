-- Migration 004: add delivered_boxes to moves
-- fixes: "Failed to log scan" 500 error in box scan/bulk-scan/updateStatus

ALTER TABLE moves ADD COLUMN IF NOT EXISTS delivered_boxes INTEGER DEFAULT 0;

UPDATE moves m 
SET delivered_boxes = (
  SELECT COUNT(*) FROM boxes b 
  WHERE b.move_id = m.id AND b.status = 'delivered'
);
