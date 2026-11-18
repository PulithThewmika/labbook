import ballerina/test;
import ballerina/time;

// Pure unit tests: no database. Campus zone is Asia/Colombo (+05:30), lab open 08:00-17:00.

const string NOW = "2029-12-31T00:00:00Z"; // = 05:30 local on 2029-12-31

function utc(string s) returns time:Utc {
    time:Utc|time:Error r = time:utcFromString(s);
    return r is time:Utc ? r : time:utcNow();
}

function zone() returns time:Zone => campusZone();

function ruleOf(RuleViolation? v) returns string? => v is RuleViolation ? v.rule : ();

@test:Config {groups: ["unit"]}
function br1PastStartRejected() {
    test:assertEquals(ruleOf(checkFuture(utc("2029-12-30T10:00:00Z"), utc(NOW))), "BR-1");
    test:assertEquals(ruleOf(checkFuture(utc("2030-01-01T10:00:00Z"), utc(NOW))), ());
}

@test:Config {groups: ["unit"]}
function br2DurationLimits() {
    time:Zone z = zone();
    // 29 minutes
    test:assertEquals(ruleOf(checkDuration(utc("2030-01-01T10:00:00+05:30"), utc("2030-01-01T10:29:00+05:30"), z)), "BR-2");
    // 4.5 hours
    test:assertEquals(ruleOf(checkDuration(utc("2030-01-01T09:00:00+05:30"), utc("2030-01-01T13:30:00+05:30"), z)), "BR-2");
    // start not on a 30-minute boundary
    test:assertEquals(ruleOf(checkDuration(utc("2030-01-01T10:15:00+05:30"), utc("2030-01-01T11:15:00+05:30"), z)), "BR-2");
    // 30 minutes and 4 hours are accepted
    test:assertEquals(ruleOf(checkDuration(utc("2030-01-01T10:00:00+05:30"), utc("2030-01-01T10:30:00+05:30"), z)), ());
    test:assertEquals(ruleOf(checkDuration(utc("2030-01-01T09:00:00+05:30"), utc("2030-01-01T13:00:00+05:30"), z)), ());
}

@test:Config {groups: ["unit"]}
function br3HorizonLimit() {
    test:assertEquals(ruleOf(checkHorizon(utc("2030-01-31T10:00:00Z"), utc(NOW))), "BR-3"); // 31 days
    test:assertEquals(ruleOf(checkHorizon(utc("2030-01-29T10:00:00Z"), utc(NOW))), ());
}

@test:Config {groups: ["unit"]}
function br4OpeningHours() {
    time:Zone z = zone();
    test:assertEquals(ruleOf(checkOpeningHours(utc("2030-01-01T07:30:00+05:30"), utc("2030-01-01T09:00:00+05:30"),
            "08:00", "17:00", z)), "BR-4");
    test:assertEquals(ruleOf(checkOpeningHours(utc("2030-01-01T16:30:00+05:30"), utc("2030-01-01T17:30:00+05:30"),
            "08:00", "17:00", z)), "BR-4");
    // crosses midnight
    test:assertEquals(ruleOf(checkOpeningHours(utc("2030-01-01T23:00:00+05:30"), utc("2030-01-02T00:30:00+05:30"),
            "08:00", "17:00", z)), "BR-4");
    // inside hours, including exactly at the edges
    test:assertEquals(ruleOf(checkOpeningHours(utc("2030-01-01T08:00:00+05:30"), utc("2030-01-01T17:00:00+05:30"),
            "08:00", "17:00", z)), ());
}

@test:Config {groups: ["unit"]}
function br5Capacity() {
    test:assertEquals(ruleOf(checkCapacity(41, 40)), "BR-5");
    test:assertEquals(ruleOf(checkCapacity(0, 40)), "BR-5");
    test:assertEquals(ruleOf(checkCapacity(40, 40)), ());
}

@test:Config {groups: ["unit"]}
function br7UpcomingLimit() {
    test:assertEquals(ruleOf(checkUpcomingLimit(3, false)), "BR-7");
    test:assertEquals(ruleOf(checkUpcomingLimit(2, false)), ());
    test:assertEquals(ruleOf(checkUpcomingLimit(9, true)), ());
}

@test:Config {groups: ["unit"]}
function br8NotBookable() {
    test:assertEquals(ruleOf(checkBookable(false)), "BR-8");
    test:assertEquals(ruleOf(checkBookable(true)), ());
}

@test:Config {groups: ["unit"]}
function br9RejectNote() {
    test:assertEquals(ruleOf(checkRejectNote("")), "BR-9");
    test:assertEquals(ruleOf(checkRejectNote("  ab ")), "BR-9");
    test:assertEquals(ruleOf(checkRejectNote("Lab closed that day")), ());
}

@test:Config {groups: ["unit"]}
function exclusionViolationMapsTo409() {
    [int, string, string] m = mapSqlState("23P01");
    test:assertEquals(m[0], 409);
    test:assertEquals(m[1], "BOOKING_CONFLICT");
}

@test:Config {groups: ["unit"]}
function otherSqlStatesMap() {
    test:assertEquals(mapSqlState("23514")[0], 400);
    test:assertEquals(mapSqlState("22P02")[0], 400);
    test:assertEquals(mapSqlState("08006")[0], 500);
}

@test:Config {groups: ["unit"]}
function tokenFromStripsBearerPrefix() {
    test:assertEquals(tokenFrom("Bearer abc.def.ghi"), "abc.def.ghi");
    test:assertEquals(tokenFrom("bearer  abc.def.ghi "), "abc.def.ghi");
    test:assertEquals(tokenFrom("abc.def.ghi"), "abc.def.ghi");
}
