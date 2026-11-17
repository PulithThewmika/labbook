import ballerina/http;
import ballerina/lang.regexp;
import ballerina/log;
import ballerina/time;

configurable int port = 8080;

final regexp:RegExp DATE_RE = re `\d{4}-\d{2}-\d{2}`;
final readonly & string[] BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled", "completed", "expired"];

type OkBooking record {|
    *http:Ok;
    Booking body;
|};

type CreatedBooking record {|
    *http:Created;
    Booking body;
|};

type CreatedLab record {|
    *http:Created;
    Lab body;
|};

type CreatedEquipment record {|
    *http:Created;
    Equipment body;
|};

// One log line per request: method, path (no query string), status, duration. No PII, no tokens.
service class RequestStart {
    *http:RequestInterceptor;
    resource function 'default [string... path](http:RequestContext ctx, http:Request req)
            returns http:NextService|error? {
        string raw = req.rawPath;
        int? q = raw.indexOf("?");
        ctx.set("t0", time:monotonicNow());
        ctx.set("method", req.method);
        ctx.set("path", q is int ? raw.substring(0, q) : raw);
        return ctx.next();
    }
}

service class RequestEnd {
    *http:ResponseInterceptor;
    remote function interceptResponse(http:RequestContext ctx, http:Response res) returns http:NextService|error? {
        any|error t0 = ctx.get("t0");
        any|error method = ctx.get("method");
        any|error path = ctx.get("path");
        decimal ms = t0 is decimal ? (time:monotonicNow() - t0) * 1000 : 0d;
        log:printInfo("request", method = method is string ? method : "?", path = path is string ? path : "?",
                status = res.statusCode, ms = ms);
        return ctx.next();
    }
}

// Malformed JSON, missing or mistyped fields/parameters -> the standard 400 error shape.
service class OnError {
    *http:ResponseErrorInterceptor;
    remote function interceptResponseError(error err) returns http:Response {
        return errorResponse(err);
    }
}


service http:InterceptableService / on new http:Listener(port) {

    public function createInterceptors() returns [RequestStart, RequestEnd, OnError] =>
        [new RequestStart(), new RequestEnd(), new OnError()];

    resource function get health() returns record {|string status;|} {
        return {status: "ok"};
    }

    resource function get me(http:Request req) returns Me|http:Response {
        do {
            Caller c = check authenticate(req);
            return {id: c.id, email: c.email, displayName: c.displayName, role: c.role};
        } on fail error e {
            return errorResponse(e);
        }
    }

    // ------------------------------------------------------------ labs

    resource function get labs(http:Request req, boolean includeInactive = false) returns Lab[]|http:Response {
        do {
            Caller c = check authenticate(req);
            return check listLabs(includeInactive && c.role == "admin");
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function get labs/[string id](http:Request req) returns LabDetail|http:Response {
        do {
            _ = check authenticate(req);
            return check getLabDetail(id);
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post labs(http:Request req, LabInput body) returns CreatedLab|http:Response {
        do {
            check adminOnly(req);
            return {body: check insertLab(body)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function put labs/[string id](http:Request req, LabInput body) returns Lab|http:Response {
        do {
            check adminOnly(req);
            return check updateLab(id, body);
        } on fail error e {
            return errorResponse(e);
        }
    }

    // ------------------------------------------------------------ equipment

    resource function get equipment(http:Request req, string? category, string? status, string? labId)
            returns Equipment[]|http:Response {
        do {
            Caller c = check authenticate(req);
            return check listEquipment(category, status, labId, c.role == "admin");
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post equipment(http:Request req, EquipmentInput body) returns CreatedEquipment|http:Response {
        do {
            check adminOnly(req);
            return {body: check insertEquipment(body)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function put equipment/[string id](http:Request req, EquipmentInput body)
            returns Equipment|http:Response {
        do {
            check adminOnly(req);
            return check updateEquipment(id, body);
        } on fail error e {
            return errorResponse(e);
        }
    }

    // ------------------------------------------------------------ availability

    resource function get availability(http:Request req, string resourceType, string resourceId, string date)
            returns Availability|http:Response {
        do {
            _ = check authenticate(req);
            check validateResourceType(resourceType);
            if !regexp:isFullMatch(DATE_RE, date) {
                fail badRequest("date must be YYYY-MM-DD");
            }
            return check getAvailability(resourceType, resourceId, date);
        } on fail error e {
            return errorResponse(e);
        }
    }

    // ------------------------------------------------------------ bookings

    resource function get bookings(http:Request req, string? status, string? 'when, string scope = "all",
            int 'limit = 20, int offset = 0) returns Booking[]|http:Response {
        do {
            Caller c = check authenticate(req);
            if status is string && BOOKING_STATUSES.indexOf(status) is () {
                fail badRequest("Unknown status");
            }
            if scope != "mine" && scope != "all" {
                fail badRequest("scope must be mine or all");
            }
            if 'when is string && 'when != "upcoming" && 'when != "past" {
                fail badRequest("when must be upcoming or past");
            }
            if 'limit < 1 || 'limit > 100 || offset < 0 {
                fail badRequest("limit must be 1-100 and offset >= 0");
            }
            return check listBookings(c, status, scope, 'when, 'limit, offset);
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post bookings(http:Request req, BookingInput body) returns CreatedBooking|http:Response {
        do {
            Caller c = check authenticate(req);
            return {body: check createBooking(c, body)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function get bookings/[string id](http:Request req) returns Booking|http:Response {
        do {
            Caller c = check authenticate(req);
            Booking b = check getBooking(id);
            if c.role != "admin" && b.userId != c.id {
                fail forbidden();
            }
            return b;
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post bookings/[string id]/cancel(http:Request req) returns OkBooking|http:Response {
        do {
            Caller c = check authenticate(req);
            return {body: check cancelBooking(c, id)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post bookings/[string id]/approve(http:Request req) returns OkBooking|http:Response {
        do {
            Caller c = check authenticate(req);
            check requireAdmin(c);
            check requirePending(id);
            check transition(id, ["pending"], "approved", c.id, ());
            return {body: check getBooking(id)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    resource function post bookings/[string id]/reject(http:Request req, RejectInput body)
            returns OkBooking|http:Response {
        do {
            Caller c = check authenticate(req);
            check requireAdmin(c);
            RuleViolation? v = checkRejectNote(body.note);
            if v is RuleViolation {
                fail ruleViolation(v);
            }
            check requirePending(id);
            check transition(id, ["pending"], "rejected", c.id, body.note.trim());
            return {body: check getBooking(id)};
        } on fail error e {
            return errorResponse(e);
        }
    }

    // ------------------------------------------------------------ stats

    resource function get stats(http:Request req) returns Stats|http:Response {
        do {
            check adminOnly(req);
            return check getStats();
        } on fail error e {
            return errorResponse(e);
        }
    }
}

function adminOnly(http:Request req) returns error? {
    Caller c = check authenticate(req);
    check requireAdmin(c);
}

function validateResourceType(string t) returns ApiError? {
    if t != "lab" && t != "equipment" {
        fail badRequest("resourceType must be lab or equipment");
    }
}

// BR-9: only a pending booking can be approved or rejected.
function requirePending(string id) returns error? {
    BookingState st = check getBookingState(id);
    if st.status != "pending" {
        return invalidState("Only pending bookings can be approved or rejected");
    }
}

function createBooking(Caller c, BookingInput b) returns Booking|error {
    check validateResourceType(b.resourceType);
    time:Utc|time:Error startAt = time:utcFromString(b.startAt);
    time:Utc|time:Error endAt = time:utcFromString(b.endAt);
    if startAt is time:Error || endAt is time:Error {
        fail badRequest("startAt and endAt must be ISO 8601 timestamps with a time zone");
    }
    int purposeLen = b.purpose.trim().length();
    if purposeLen < 5 || purposeLen > 500 {
        fail badRequest("purpose must be 5 to 500 characters");
    }

    ResourceInfo info = check getResourceInfo(b.resourceType, b.resourceId);
    time:Utc now = time:utcNow();
    RuleViolation? v = checkBookable(info.bookable)
        ?: checkFuture(startAt, now)
        ?: checkDuration(startAt, endAt, campusZone())
        ?: checkHorizon(startAt, now)
        ?: checkOpeningHours(startAt, endAt, info.openTime, info.closeTime, campusZone())
        ?: checkCapacity(b.attendees, info.capacity);
    boolean isAdmin = c.role == "admin";
    if v is () {
        v = checkUpcomingLimit(check countUpcoming(c.id), isAdmin);
    }
    if v is RuleViolation {
        fail ruleViolation(v);
    }
    // BR-6 (overlap) is enforced by the exclusion constraints; a clash surfaces as SQLSTATE 23P01 -> 409.
    string id = check insertBooking(c, b, startAt, endAt, isAdmin);
    return getBooking(id);
}

function cancelBooking(Caller c, string id) returns Booking|error {
    BookingState st = check getBookingState(id);
    boolean isAdmin = c.role == "admin";
    if !isAdmin && st.userId != c.id {
        return forbidden("You can only cancel your own bookings");
    }
    if st.status != "pending" && st.status != "approved" {
        return invalidState("This booking can no longer be cancelled");
    }
    if !isAdmin && st.started {
        return invalidState("Only upcoming bookings can be cancelled");
    }
    check transition(id, ["pending", "approved"], "cancelled", (), ());
    return getBooking(id);
}
