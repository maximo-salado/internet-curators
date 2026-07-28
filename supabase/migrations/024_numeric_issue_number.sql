-- 024_numeric_issue_number.sql
-- Change issue_number from int to numeric(10,1) to support test-phase 0.x numbering.
-- Run this AFTER 022 and 023.

ALTER TABLE issues ALTER COLUMN issue_number TYPE numeric(10,1);
