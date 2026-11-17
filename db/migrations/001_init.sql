CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       text NOT NULL UNIQUE,                 -- IdP "sub"
  email         text UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,16}$'),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  building     text NOT NULL,
  room         text NOT NULL,
  capacity     int  NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  description  text NOT NULL DEFAULT '',
  open_time    time NOT NULL DEFAULT '08:00',
  close_time   time NOT NULL DEFAULT '17:00',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (open_time < close_time)
);

CREATE TABLE IF NOT EXISTS equipment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id       uuid REFERENCES labs(id) ON DELETE SET NULL,   -- home lab, optional
  asset_tag    text NOT NULL UNIQUE,
  name         text NOT NULL,
  category     text NOT NULL,
  description  text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','retired')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id),
  resource_type  text NOT NULL CHECK (resource_type IN ('lab','equipment')),
  lab_id         uuid REFERENCES labs(id),
  equipment_id   uuid REFERENCES equipment(id),
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  purpose        text NOT NULL CHECK (char_length(purpose) BETWEEN 5 AND 500),
  attendees      int  NOT NULL DEFAULT 1 CHECK (attendees >= 1),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','cancelled','completed','expired')),
  admin_note     text,
  decided_by     uuid REFERENCES users(id),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK ((resource_type = 'lab'       AND lab_id IS NOT NULL AND equipment_id IS NULL)
      OR (resource_type = 'equipment' AND equipment_id IS NOT NULL AND lab_id IS NULL)),
  CHECK (status <> 'rejected' OR admin_note IS NOT NULL),
  CONSTRAINT no_lab_overlap EXCLUDE USING gist
    (lab_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
    WHERE (lab_id IS NOT NULL AND status IN ('pending','approved')),
  CONSTRAINT no_equipment_overlap EXCLUDE USING gist
    (equipment_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
    WHERE (equipment_id IS NOT NULL AND status IN ('pending','approved'))
);

CREATE INDEX IF NOT EXISTS bookings_user_start_idx   ON bookings (user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_start_idx ON bookings (status, start_at);
CREATE INDEX IF NOT EXISTS equipment_lab_idx         ON equipment (lab_id);

-- updated_at triggers: drop + recreate so re-running the migration is safe
DROP TRIGGER IF EXISTS labs_updated_at ON labs;
CREATE TRIGGER labs_updated_at BEFORE UPDATE ON labs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS equipment_updated_at ON equipment;
CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
