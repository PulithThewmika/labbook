import ballerina/http;
import ballerina/test;
import ballerina/time;

// Integration tests: need the local docker-compose database (migrated + seeded).
// The service starts with the module; tests/Config.toml enables devMode.

const string STUDENT = "student@labbook.dev";
const string ADMIN = "admin@labbook.dev";
const string OTHER = "other@labbook.dev";
const string OFFSET = "+05:30"; // Asia/Colombo, no DST

// HTTP/1.1: the default h2c upgrade stalls the first POST on a fresh connection.
final http:Client api = check new ("http://localhost:8080", httpVersion = http:HTTP_1_1);

@test:BeforeEach
function cleanBookings() returns error? {
    _ = check db->execute(`DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE subject LIKE 'dev:%')`);
}

function pad(int n) returns string => n < 10 ? "0" + n.toString() : n.toString();

# ISO local timestamp (campus time) `days` ahead at `hour`:00.
function at(int days, int hour) returns string {
    time:Civil c = campusZone().utcToCivil(time:utcAddSeconds(time:utcNow(), <decimal>(days * 86400)));
    return string `${c.year}-${pad(c.month)}-${pad(c.day)}T${pad(hour)}:00:00${OFFSET}`;
}

function who(string email) returns map<string> => {"X-Dev-User": email};

function callGet(string path, string email) returns http:Response|error {
    return api->get(path, who(email));
}

function callPost(string path, json payload, string email) returns http:Response|error {
    return api->post(path, payload, who(email));
}


function resourceId(string path, string key, string value, string email) returns string|error {
    http:Response r = check callGet(path, email);
    json[] items = <json[]>check r.getJsonPayload();
    foreach json i in items {
        map<json> m = check i.cloneWithType();
        if m[key] == value {
            return (m["id"]).toString();
        }
    }
    return error("not found: " + value);
}

function labId() returns string|error => resourceId("/labs", "code", "CSL-A", STUDENT);

function bookingBody(string id, string 'from, string to, int attendees = 5) returns json =>
    {resourceType: "lab", resourceId: id, startAt: 'from, endAt: to, purpose: "Group project work", attendees};

function createLabBooking(string email, int day, int fromHour, int toHour) returns http:Response|error {
    return callPost("/bookings", bookingBody(check labId(), at(day, fromHour), at(day, toHour)), email);
}

@test:Config {groups: ["integration"]}
function healthIsPublic() returns error? {
    http:Response r = check api->get("/health");
    test:assertEquals(r.statusCode, 200);
}

@test:Config {groups: ["integration"]}
function unauthenticatedIs401() returns error? {
    http:Response r = check api->get("/labs");
    test:assertEquals(r.statusCode, 401);
    json b = check r.getJsonPayload();
    test:assertEquals(check b.code, "UNAUTHENTICATED");
}

@test:Config {groups: ["integration"]}
function studentHappyPath() returns error? {
    http:Response created = check createLabBooking(STUDENT, 2, 10, 12);
    test:assertEquals(created.statusCode, 201);
    json b = check created.getJsonPayload();
    test:assertEquals(check b.status, "pending");
    string id = (check b.id).toString();

    http:Response list = check callGet("/bookings?when=upcoming", STUDENT);
    json[] items = <json[]>check list.getJsonPayload();
    test:assertEquals(items.length(), 1);

    http:Response cancelled = check callPost("/bookings/" + id + "/cancel", {}, STUDENT);
    test:assertEquals(cancelled.statusCode, 200);
    test:assertEquals(check (check cancelled.getJsonPayload()).status, "cancelled");
}

@test:Config {groups: ["integration"]}
function overlapIs409AndTouchingIs201() returns error? {
    test:assertEquals((check createLabBooking(STUDENT, 2, 10, 12)).statusCode, 201);
    http:Response clash = check createLabBooking(OTHER, 2, 11, 13);
    test:assertEquals(clash.statusCode, 409);
    test:assertEquals(check (check clash.getJsonPayload()).code, "BOOKING_CONFLICT");
    // [start, end) ranges: starting exactly when the previous booking ends is fine
    test:assertEquals((check createLabBooking(OTHER, 2, 12, 13)).statusCode, 201);
}

@test:Config {groups: ["integration"]}
function fourthUpcomingBookingIsBr7() returns error? {
    foreach int h in [9, 10, 11] {
        test:assertEquals((check createLabBooking(STUDENT, 3, h, h + 1)).statusCode, 201);
    }
    http:Response r = check createLabBooking(STUDENT, 3, 13, 14);
    test:assertEquals(r.statusCode, 422);
    json b = check r.getJsonPayload();
    test:assertEquals(check b.rule, "BR-7");
}

@test:Config {groups: ["integration"]}
function ruleViolationsAre422() returns error? {
    string id = check labId();
    http:Response past = check callPost("/bookings", bookingBody(id, at(-1, 10), at(-1, 11)), STUDENT);
    test:assertEquals(past.statusCode, 422);
    test:assertEquals(check (check past.getJsonPayload()).rule, "BR-1");
    http:Response late = check callPost("/bookings", bookingBody(id, at(2, 16), at(2, 18)), STUDENT);
    test:assertEquals(check (check late.getJsonPayload()).rule, "BR-4");
    http:Response crowd = check callPost("/bookings", bookingBody(id, at(2, 10), at(2, 11), 500), STUDENT);
    test:assertEquals(check (check crowd.getJsonPayload()).rule, "BR-5");
}

@test:Config {groups: ["integration"]}
function permissions() returns error? {
    http:Response created = check createLabBooking(STUDENT, 2, 10, 11);
    string id = (check (check created.getJsonPayload()).id).toString();
    test:assertEquals((check callPost("/bookings/" + id + "/approve", {}, STUDENT)).statusCode, 403);
    test:assertEquals((check callPost("/bookings/" + id + "/cancel", {}, OTHER)).statusCode, 403);
    test:assertEquals((check callGet("/stats", STUDENT)).statusCode, 403);
    test:assertEquals((check callPost("/labs", {code: "X-1", name: "Test lab", building: "B", room: "1", capacity: 10}, STUDENT)).statusCode, 403);
}

@test:Config {groups: ["integration"]}
function adminApproveRejectAndAutoApprove() returns error? {
    string a = (check (check (check createLabBooking(STUDENT, 2, 10, 11)).getJsonPayload()).id).toString();
    string b = (check (check (check createLabBooking(STUDENT, 2, 11, 12)).getJsonPayload()).id).toString();

    http:Response approved = check callPost("/bookings/" + a + "/approve", {}, ADMIN);
    test:assertEquals(check (check approved.getJsonPayload()).status, "approved");
    // already approved -> INVALID_STATE
    http:Response again = check callPost("/bookings/" + a + "/approve", {}, ADMIN);
    test:assertEquals(again.statusCode, 409);
    test:assertEquals(check (check again.getJsonPayload()).code, "INVALID_STATE");

    http:Response noNote = check callPost("/bookings/" + b + "/reject", {note: ""}, ADMIN);
    test:assertEquals(noNote.statusCode, 422);
    test:assertEquals(check (check noNote.getJsonPayload()).rule, "BR-9");
    http:Response rejected = check callPost("/bookings/" + b + "/reject", {note: "Lab closed for maintenance"}, ADMIN);
    json rj = check rejected.getJsonPayload();
    test:assertEquals(check rj.status, "rejected");
    test:assertEquals(check rj.adminNote, "Lab closed for maintenance");

    // a rejected booking frees its slot; admin bookings are approved immediately (BR-11)
    http:Response admin = check createLabBooking(ADMIN, 2, 11, 12);
    test:assertEquals(admin.statusCode, 201);
    test:assertEquals(check (check admin.getJsonPayload()).status, "approved");
}

@test:Config {groups: ["integration"]}
function equipmentInMaintenanceIsBr8() returns error? {
    string id = check resourceId("/equipment", "assetTag", "EQ-0002", ADMIN);
    http:Response r = check callPost("/bookings",
            {resourceType: "equipment", resourceId: id, startAt: at(2, 10), endAt: at(2, 11), purpose: "Signal tests"},
            STUDENT);
    test:assertEquals(r.statusCode, 422);
    test:assertEquals(check (check r.getJsonPayload()).rule, "BR-8");
}

@test:Config {groups: ["integration"]}
function availabilityHidesUsersAndStatsShape() returns error? {
    http:Response created = check createLabBooking(STUDENT, 2, 14, 15);
    test:assertEquals(created.statusCode, 201);
    string id = check labId();
    string date = at(2, 0).substring(0, 10);
    http:Response r = check callGet(string `/availability?resourceType=lab&resourceId=${id}&date=${date}`, STUDENT);
    json av = check r.getJsonPayload();
    json[] busy = <json[]>check av.busy;
    test:assertEquals(busy.length(), 1);
    map<json> slot = check busy[0].cloneWithType();
    test:assertEquals(slot.keys().sort(), ["endAt", "startAt", "status"]);

    http:Response s = check callGet("/stats", ADMIN);
    test:assertEquals(s.statusCode, 200);
    json st = check s.getJsonPayload();
    test:assertTrue((check st.pendingCount) is int);
    test:assertTrue((check st.bookingsToday) is int);
    json[] util = <json[]>check st.labUtilisation7d;
    foreach json u in util {
        test:assertEquals(check float:fromString((check u.hoursBooked).toString()), 0.0); // no past bookings
    }
    test:assertTrue((check st.topEquipment30d) is json[]);
}

@test:Config {groups: ["integration"]}
function malformedBodyIsBadRequest() returns error? {
    http:Response r = check callPost("/bookings", {resourceType: "lab"}, STUDENT);
    test:assertEquals(r.statusCode, 400);
    test:assertEquals(check (check r.getJsonPayload()).code, "BAD_REQUEST");
}
