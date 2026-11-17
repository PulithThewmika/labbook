-- Demo data. Idempotent: safe to re-run.
INSERT INTO labs (code, name, building, room, capacity, description, open_time, close_time) VALUES
  ('CSL-A',  'Computer Lab A',     'Engineering Block', 'B1-01', 40, 'General-purpose computing lab with 40 workstations.',        '08:00', '17:00'),
  ('ELEC-1', 'Electronics Lab',    'Engineering Block', 'B2-04', 24, 'Bench stations with power supplies, multimeters and scopes.', '08:00', '17:00'),
  ('NET-1',  'Networking Lab',     'Technology Block',  'T1-12', 30, 'Routers, switches and cabling for networking practicals.',    '08:30', '16:30'),
  ('IOT-1',  'IoT & Embedded Lab', 'Technology Block',  'T2-03', 20, 'Microcontrollers, sensors and single-board computers.',       '08:00', '18:00')
ON CONFLICT (code) DO NOTHING;

INSERT INTO equipment (lab_id, asset_tag, name, category, description, status)
SELECT l.id, v.asset_tag, v.name, v.category, v.description, v.status
FROM (VALUES
  ('ELEC-1', 'EQ-0001', 'Digital Oscilloscope 100 MHz', 'Test & Measurement',    '4-channel bench oscilloscope.',                 'available'),
  ('ELEC-1', 'EQ-0002', 'Digital Oscilloscope 200 MHz', 'Test & Measurement',    '2-channel bench oscilloscope with FFT.',        'maintenance'),
  ('ELEC-1', 'EQ-0003', 'Logic Analyser 16-channel',    'Test & Measurement',    'USB logic analyser with protocol decoders.',    'available'),
  ('IOT-1',  'EQ-0004', 'Raspberry Pi 5 Kit #1',        'Single-board computer', 'Pi 5 8 GB, power supply, case, SD card.',       'available'),
  ('IOT-1',  'EQ-0005', 'Raspberry Pi 5 Kit #2',        'Single-board computer', 'Pi 5 8 GB, power supply, case, SD card.',       'available'),
  ('IOT-1',  'EQ-0006', 'Arduino Starter Kit',          'Microcontroller',       'Arduino Uno with sensors and breadboard.',      'available'),
  ('IOT-1',  'EQ-0007', '3D Printer',                   'Fabrication',           'FDM printer, 220 x 220 x 250 mm build volume.', 'available'),
  ('CSL-A',  'EQ-0008', 'Projector #1',                 'AV',                    'Full HD projector with HDMI and VGA.',          'available'),
  ('NET-1',  'EQ-0009', 'Projector #2',                 'AV',                    'Full HD projector with HDMI and VGA.',          'available'),
  ('NET-1',  'EQ-0010', 'Cisco Switch Kit',             'Networking',            'Managed switch, console cable and patch leads.', 'available')
) AS v(lab_code, asset_tag, name, category, description, status)
JOIN labs l ON l.code = v.lab_code
ON CONFLICT (asset_tag) DO NOTHING;
