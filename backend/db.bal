import ballerina/lang.regexp;
import ballerina/sql;
import ballerina/time;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

configurable string dbHost = "localhost";
configurable int dbPort = 5432;
configurable string dbName = "labbook";
configurable string dbUser = "labbook";
// Secret. Provide it through Config.toml locally or a Choreo secret configuration.
configurable string dbPassword = ?;
// disable | prefer | require | verify-ca | verify-full
configurable string dbSslMode = "require";
// Time zone used for opening hours, day boundaries and "today".
configurable string campusTimeZone = "Asia/Colombo";

final postgresql:Client db = check new (dbHost, dbUser, dbPassword, dbName, dbPort,
    options = {ssl: {mode: sslMode(dbSslMode)}},
    connectionPool = {maxOpenConnections: 5}
);

// Looked up per call: a module-level time:Zone breaks `bal test` (anonymous readonly type is not resolvable).
function campusZone() returns time:Zone {
    time:Zone? z = time:getZone(campusTimeZone);
    if z is () {
        panic error("Unknown campusTimeZone: " + campusTimeZone);
    }
    return z;
}

final regexp:RegExp UUID_RE = re `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`;


function sslMode(string m) returns postgresql:SSLMode {
    match m {
        "disable" => {
            return postgresql:DISABLE;
        }
        "prefer" => {
            return postgresql:PREFER;
        }
        "verify-ca" => {
            return postgresql:VERIFY_CA;
        }
        "verify-full" => {
            return postgresql:VERIFY_FULL;
        }
    }
    return postgresql:REQUIRE;
}

function isUuid(string s) returns boolean => regexp:isFullMatch(UUID_RE, s);

function requireUuid(string id, string what) returns ApiError? {
    if !isUuid(id) {
        return notFound(what);
    }
}

// ---------------------------------------------------------------- users

function upsertUser(string subject, string? email, string displayName, boolean isAdmin) returns Caller|error {
    string role = isAdmin ? "admin" : "student";
    // One write per request keeps last_seen_at fresh and applies admin-list changes immediately.
    // ponytail: per-request upsert, cache by subject if write volume matters.
    return db->queryRow(`
        INSERT INTO users (subject, email, display_name, role)
        VALUES (${subject}, ${email}, ${displayName}, ${role})
        ON CONFLICT (subject) DO UPDATE
          SET email = EXCLUDED.email, display_name = EXCLUDED.display_name,
              role = EXCLUDED.role, last_seen_at = now()
        RETURNING id::text AS id, email, display_name AS "displayName", role`);
}

// ---------------------------------------------------------------- labs

final sql:ParameterizedQuery LAB_SELECT = `
    SELECT id::text AS id, code, name, building, room, capacity, description,
           to_char(open_time, 'HH24:MI') AS "openTime", to_char(close_time, 'HH24:MI') AS "closeTime",
           is_active AS "isActive"
    FROM labs`;

function listLabs(boolean includeInactive) returns Lab[]|error {
    sql:ParameterizedQuery q = includeInactive
        ? sql:queryConcat(LAB_SELECT, ` ORDER BY code`)
        : sql:queryConcat(LAB_SELECT, ` WHERE is_active ORDER BY code`);
    stream<Lab, sql:Error?> s = db->query(q);
    return from Lab l in s
        select l;
}

function getLab(string id) returns Lab|error {
    check requireUuid(id, "Lab");
    Lab|sql:Error r = db->queryRow(sql:queryConcat(LAB_SELECT, ` WHERE id = ${id}::uuid`));
    if r is sql:NoRowsError {
        return notFound("Lab");
    }
    return r;
}

function getLabDetail(string id) returns LabDetail|error {
    Lab lab = check getLab(id);
    Equipment[] eq = check listEquipment((), (), id, true);
    return {...lab, equipment: eq};
}

function insertLab(LabInput l) returns Lab|error {
    string id = check db->queryRow(`
        INSERT INTO labs (code, name, building, room, capacity, description, open_time, close_time, is_active)
        VALUES (${l.code}, ${l.name}, ${l.building}, ${l.room}, ${l.capacity}, ${l.description},
                ${l.openTime}::time, ${l.closeTime}::time, ${l.isActive})
        RETURNING id::text`);
    return getLab(id);
}

function updateLab(string id, LabInput l) returns Lab|error {
    check requireUuid(id, "Lab");
    sql:ExecutionResult r = check db->execute(`
        UPDATE labs SET code = ${l.code}, name = ${l.name}, building = ${l.building}, room = ${l.room},
               capacity = ${l.capacity}, description = ${l.description},
               open_time = ${l.openTime}::time, close_time = ${l.closeTime}::time, is_active = ${l.isActive}
        WHERE id = ${id}::uuid`);
    if r.affectedRowCount == 0 {
        return notFound("Lab");
    }
    return getLab(id);
}

// ---------------------------------------------------------------- equipment

final sql:ParameterizedQuery EQUIPMENT_SELECT = `
    SELECT e.id::text AS id, e.lab_id::text AS "labId", l.code AS "labCode", e.asset_tag AS "assetTag",
           e.name, e.category, e.description, e.status
    FROM equipment e LEFT JOIN labs l ON l.id = e.lab_id`;

function listEquipment(string? category, string? status, string? labId, boolean isAdmin) returns Equipment[]|error {
    sql:ParameterizedQuery q = sql:queryConcat(EQUIPMENT_SELECT, ` WHERE TRUE`);
    if !isAdmin {
        q = sql:queryConcat(q, ` AND e.status <> 'retired'`);
    }
    if category is string {
        q = sql:queryConcat(q, ` AND e.category = ${category}`);
    }
    if status is string {
        q = sql:queryConcat(q, ` AND e.status = ${status}`);
    }
    if labId is string {
        check requireUuid(labId, "Lab");
        q = sql:queryConcat(q, ` AND e.lab_id = ${labId}::uuid`);
    }
    q = sql:queryConcat(q, ` ORDER BY e.name`);
    stream<Equipment, sql:Error?> s = db->query(q);
    return from Equipment e in s
        select e;
}

function getEquipment(string id) returns Equipment|error {
    check requireUuid(id, "Equipment");
    Equipment|sql:Error r = db->queryRow(sql:queryConcat(EQUIPMENT_SELECT, ` WHERE e.id = ${id}::uuid`));
    if r is sql:NoRowsError {
        return notFound("Equipment");
    }
    return r;
}

function checkLabRef(string? labId) returns ApiError? {
    if labId is string && !isUuid(labId) {
        return badRequest("labId is not a valid id");
    }
}

function insertEquipment(EquipmentInput e) returns Equipment|error {
    check checkLabRef(e.labId);
    string id = check db->queryRow(`
        INSERT INTO equipment (lab_id, asset_tag, name, category, description, status)
        VALUES (${e.labId}::uuid, ${e.assetTag}, ${e.name}, ${e.category}, ${e.description}, ${e.status})
        RETURNING id::text`);
    return getEquipment(id);
}

function updateEquipment(string id, EquipmentInput e) returns Equipment|error {
    check requireUuid(id, "Equipment");
    check checkLabRef(e.labId);
    sql:ExecutionResult r = check db->execute(`
        UPDATE equipment SET lab_id = ${e.labId}::uuid, asset_tag = ${e.assetTag}, name = ${e.name},
               category = ${e.category}, description = ${e.description}, status = ${e.status}
        WHERE id = ${id}::uuid`);
    if r.affectedRowCount == 0 {
        return notFound("Equipment");
    }
    return getEquipment(id);
}

// ---------------------------------------------------------------- resources & availability

function getResourceInfo(string resourceType, string id) returns ResourceInfo|error {
    check requireUuid(id, resourceType == "lab" ? "Lab" : "Equipment");
    sql:ParameterizedQuery q = resourceType == "lab"
        ? `SELECT name, is_active AS bookable, capacity,
                  to_char(open_time, 'HH24:MI') AS "openTime", to_char(close_time, 'HH24:MI') AS "closeTime"
           FROM labs WHERE id = ${id}::uuid`
        : `SELECT e.name, (e.status = 'available' AND COALESCE(l.is_active, true)) AS bookable, 1 AS capacity,
                  COALESCE(to_char(l.open_time, 'HH24:MI'), '08:00') AS "openTime",
                  COALESCE(to_char(l.close_time, 'HH24:MI'), '17:00') AS "closeTime"
           FROM equipment e LEFT JOIN labs l ON l.id = e.lab_id WHERE e.id = ${id}::uuid`;
    ResourceInfo|sql:Error r = db->queryRow(q);
    if r is sql:NoRowsError {
        return notFound(resourceType == "lab" ? "Lab" : "Equipment");
    }
    return r;
}

function getAvailability(string resourceType, string id, string date) returns Availability|error {
    ResourceInfo info = check getResourceInfo(resourceType, id);
    sql:ParameterizedQuery base = `
        SELECT to_char(start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "startAt",
               to_char(end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "endAt", status
        FROM bookings WHERE status IN ('pending', 'approved')
          AND start_at < ((${date}::date + 1)::timestamp AT TIME ZONE ${campusTimeZone})
          AND end_at > (${date}::date::timestamp AT TIME ZONE ${campusTimeZone})`;
    sql:ParameterizedQuery q = resourceType == "lab"
        ? sql:queryConcat(base, ` AND lab_id = ${id}::uuid ORDER BY start_at`)
        : sql:queryConcat(base, ` AND equipment_id = ${id}::uuid ORDER BY start_at`);
    stream<BusySlot, sql:Error?> s = db->query(q);
    BusySlot[] busy = check from BusySlot b in s
        select b;
    return {openTime: info.openTime, closeTime: info.closeTime, busy};
}

// ---------------------------------------------------------------- bookings

final sql:ParameterizedQuery BOOKING_SELECT = `
    SELECT b.id::text AS id, b.user_id::text AS "userId", u.display_name AS "userName",
           b.resource_type AS "resourceType", COALESCE(b.lab_id, b.equipment_id)::text AS "resourceId",
           COALESCE(l.name, e.name) AS "resourceName",
           to_char(b.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "startAt",
           to_char(b.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "endAt",
           b.purpose, b.attendees, b.status, b.admin_note AS "adminNote",
           to_char(b.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "decidedAt",
           to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    LEFT JOIN labs l ON l.id = b.lab_id
    LEFT JOIN equipment e ON e.id = b.equipment_id`;

function getBooking(string id) returns Booking|error {
    check requireUuid(id, "Booking");
    Booking|sql:Error r = db->queryRow(sql:queryConcat(BOOKING_SELECT, ` WHERE b.id = ${id}::uuid`));
    if r is sql:NoRowsError {
        return notFound("Booking");
    }
    return r;
}

function listBookings(Caller c, string? status, string scope, string? when, int 'limit, int offset)
        returns Booking[]|error {
    sql:ParameterizedQuery q = sql:queryConcat(BOOKING_SELECT, ` WHERE TRUE`);
    // Students only ever see their own bookings, whatever `scope` says.
    if c.role != "admin" || scope == "mine" {
        q = sql:queryConcat(q, ` AND b.user_id = ${c.id}::uuid`);
    }
    if status is string {
        q = sql:queryConcat(q, ` AND b.status = ${status}`);
    }
    if when == "upcoming" {
        q = sql:queryConcat(q, ` AND b.end_at > now()`);
    } else if when == "past" {
        q = sql:queryConcat(q, ` AND b.end_at <= now()`);
    }
    // The approval queue (status=pending) is oldest first.
    if status == "pending" {
        q = sql:queryConcat(q, ` ORDER BY b.created_at ASC`);
    } else if when == "upcoming" {
        q = sql:queryConcat(q, ` ORDER BY b.start_at ASC`);
    } else {
        q = sql:queryConcat(q, ` ORDER BY b.start_at DESC`);
    }
    q = sql:queryConcat(q, ` LIMIT ${'limit} OFFSET ${offset}`);
    stream<Booking, sql:Error?> s = db->query(q);
    return from Booking b in s
        select b;
}

function countUpcoming(string userId) returns int|error {
    CountRow r = check db->queryRow(`
        SELECT count(*)::int AS count FROM bookings
        WHERE user_id = ${userId}::uuid AND status IN ('pending', 'approved') AND end_at > now()`);
    return r.count;
}

function insertBooking(Caller c, BookingInput b, time:Utc startAt, time:Utc endAt, boolean autoApprove)
        returns string|error {
    string status = autoApprove ? "approved" : "pending";
    string? labId = b.resourceType == "lab" ? b.resourceId : ();
    string? equipmentId = b.resourceType == "equipment" ? b.resourceId : ();
    string startIso = time:utcToString(startAt);
    string endIso = time:utcToString(endAt);
    return db->queryRow(`
        INSERT INTO bookings (user_id, resource_type, lab_id, equipment_id, start_at, end_at, purpose,
                              attendees, status, decided_by, decided_at)
        VALUES (${c.id}::uuid, ${b.resourceType}, ${labId}::uuid, ${equipmentId}::uuid,
                ${startIso}::timestamptz, ${endIso}::timestamptz, ${b.purpose.trim()}, ${b.attendees}, ${status},
                CASE WHEN ${status} = 'approved' THEN ${c.id}::uuid END,
                CASE WHEN ${status} = 'approved' THEN now() END)
        RETURNING id::text`);
}

function getBookingState(string id) returns BookingState|error {
    check requireUuid(id, "Booking");
    BookingState|sql:Error r = db->queryRow(`
        SELECT user_id::text AS "userId", status, (start_at <= now()) AS started
        FROM bookings WHERE id = ${id}::uuid`);
    if r is sql:NoRowsError {
        return notFound("Booking");
    }
    return r;
}

// Moves a booking out of `fromStatuses`. Guarded by the status so a concurrent change yields 409, not a lost update.
function transition(string id, string[] fromStatuses, string toStatus, string? decidedBy, string? note)
        returns error? {
    sql:ExecutionResult r = check db->execute(`
        UPDATE bookings SET status = ${toStatus}, admin_note = COALESCE(${note}, admin_note),
               decided_by = COALESCE(${decidedBy}::uuid, decided_by),
               decided_at = CASE WHEN ${decidedBy}::uuid IS NULL THEN decided_at ELSE now() END
        WHERE id = ${id}::uuid AND status = ANY(${fromStatuses}::text[])`);
    if r.affectedRowCount == 0 {
        return invalidState("The booking can no longer be changed this way");
    }
}

// ---------------------------------------------------------------- stats

function getStats() returns Stats|error {
    CountRow today = check db->queryRow(`
        SELECT count(*)::int AS count FROM bookings
        WHERE status IN ('pending', 'approved', 'completed')
          AND (start_at AT TIME ZONE ${campusTimeZone})::date = (now() AT TIME ZONE ${campusTimeZone})::date`);
    CountRow pending = check db->queryRow(`SELECT count(*)::int AS count FROM bookings WHERE status = 'pending'`);

    stream<UtilRow, sql:Error?> us = db->query(`
        SELECT l.id::text AS "labId", l.code,
               (COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN EXTRACT(EPOCH FROM (LEAST(b.end_at, now()) - GREATEST(b.start_at, now() - interval '7 days')))  END)
                         / 3600.0, 0))::float8 AS "hoursBooked",
               (EXTRACT(EPOCH FROM (l.close_time - l.open_time)) / 3600.0 * 7)::float8 AS "hoursOpen"
        FROM labs l
        LEFT JOIN bookings b ON b.lab_id = l.id AND b.status IN ('approved', 'completed')
             AND b.end_at > now() - interval '7 days' AND b.start_at < now()
        WHERE l.is_active
        GROUP BY l.id ORDER BY l.code`);
    LabUtilisation[] util = check from UtilRow u in us
        select {
            labId: u.labId,
            code: u.code,
            hoursBooked: round2(u.hoursBooked),
            hoursOpen: round2(u.hoursOpen),
            ratio: u.hoursOpen > 0.0 ? round2(u.hoursBooked / u.hoursOpen) : 0.0
        };

    stream<TopEquipment, sql:Error?> ts = db->query(`
        SELECT e.id::text AS id, e.name, count(*)::int AS count
        FROM bookings b JOIN equipment e ON e.id = b.equipment_id
        WHERE b.status IN ('approved', 'completed') AND b.start_at > now() - interval '30 days'
        GROUP BY e.id, e.name ORDER BY count(*) DESC, e.name LIMIT 5`);
    TopEquipment[] top = check from TopEquipment t in ts
        select t;

    return {bookingsToday: today.count, pendingCount: pending.count, labUtilisation7d: util, topEquipment30d: top};
}

function round2(float f) returns float => <float>(<int>(f * 100.0 + 0.5)) / 100.0;
