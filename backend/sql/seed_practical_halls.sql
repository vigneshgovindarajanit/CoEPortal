-- Practical halls seed data
-- Existing labs below use capacity 25; Workshop Lab uses the current practical defaults.
-- Run in MySQL against your application database.

INSERT INTO hall (
  block_name,
  hall_number,
  hall_code,
  seat_rows,
  seat_cols,
  students_per_bench,
  exam_type,
  capacity,
  supervisors,
  is_active
)
VALUES
  ('AE', '1001', 'IT LAB 1', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1002', 'IT LAB 2', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1003', 'IT LAB 3', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1004', 'IT LAB 4', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1005', 'IT LAB 5', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1101', 'CSE LAB 1', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1102', 'CSE LAB 2', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1103', 'CSE LAB 3', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1104', 'CSE LAB 4', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1105', 'CSE LAB 5', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1201', 'ME LAB 1', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1202', 'ME LAB 2', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1203', 'ME LAB 3', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1204', 'ME LAB 4', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1205', 'ME LAB 5', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1206', 'ME LAB 6', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1301', 'CT LAB 1', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1302', 'CT LAB 2', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1401', 'AIML LAB 1', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1402', 'AIML LAB 2', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1403', 'AIML LAB 3', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1404', 'AIML LAB 4', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1405', 'AIML LAB 5', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1406', 'AIML LAB 6', 5, 5, 1, 'PRACTICAL', 25, 1, 1),
  ('AE', '1501', 'WORKSHOP LAB', 6, 10, 1, 'PRACTICAL', 60, 1, 1)
ON DUPLICATE KEY UPDATE
  block_name = VALUES(block_name),
  hall_number = VALUES(hall_number),
  seat_rows = VALUES(seat_rows),
  seat_cols = VALUES(seat_cols),
  students_per_bench = VALUES(students_per_bench),
  exam_type = VALUES(exam_type),
  capacity = VALUES(capacity),
  supervisors = VALUES(supervisors),
  is_active = VALUES(is_active);
