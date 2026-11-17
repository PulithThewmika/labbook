import ballerina/test;

// Integration test: needs the local docker-compose database (migrated).

@test:Config {groups: ["integration"]}
function expiresPastPendingAndCompletesPastApproved() returns error? {
    string uid = check db->queryRow(`
        INSERT INTO users (subject, display_name) VALUES ('test:scheduler', 'Scheduler Test')
        ON CONFLICT (subject) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id::text`);
    string labId = check db->queryRow(`SELECT id::text FROM labs WHERE code = 'CSL-A'`);
    _ = check db->execute(`DELETE FROM bookings WHERE user_id = ${uid}::uuid`);

    // Inserted directly, bypassing the API rules, with times in the past.
    string pending = check db->queryRow(`
        INSERT INTO bookings (user_id, resource_type, lab_id, start_at, end_at, purpose, status)
        VALUES (${uid}::uuid, 'lab', ${labId}::uuid, now() - interval '3 hours', now() - interval '2 hours',
                'Stale request', 'pending') RETURNING id::text`);
    string approved = check db->queryRow(`
        INSERT INTO bookings (user_id, resource_type, lab_id, start_at, end_at, purpose, status)
        VALUES (${uid}::uuid, 'lab', ${labId}::uuid, now() - interval '5 hours', now() - interval '4 hours',
                'Finished session', 'approved') RETURNING id::text`);
    string upcoming = check db->queryRow(`
        INSERT INTO bookings (user_id, resource_type, lab_id, start_at, end_at, purpose, status)
        VALUES (${uid}::uuid, 'lab', ${labId}::uuid, now() + interval '2 days', now() + interval '2 days 1 hour',
                'Upcoming session', 'pending') RETURNING id::text`);

    [int, int] counts = check runJob();
    test:assertTrue(counts[0] >= 1);
    test:assertTrue(counts[1] >= 1);
    test:assertEquals(check statusOf(pending), "expired");
    test:assertEquals(check statusOf(approved), "completed");
    test:assertEquals(check statusOf(upcoming), "pending");

    // a second run changes nothing for these rows
    _ = check runJob();
    test:assertEquals(check statusOf(pending), "expired");

    _ = check db->execute(`DELETE FROM bookings WHERE user_id = ${uid}::uuid`);
}

function statusOf(string id) returns string|error {
    return db->queryRow(`SELECT status FROM bookings WHERE id = ${id}::uuid`);
}
