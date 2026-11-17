import ballerina/time;

// Pure booking-rule checks (BR-1..BR-5, BR-7..BR-9). No database, so unit tests need none.
// BR-6 (overlap) is enforced by the database exclusion constraints.

public type RuleViolation record {|
    string rule;
    string message;
|};

const decimal HALF_HOUR = 1800d;
const decimal FOUR_HOURS = 14400d;
const decimal DAY = 86400d;
const int MAX_UPCOMING = 3;

function violation(string rule, string message) returns RuleViolation => {rule, message};

// BR-1: start must be in the future.
function checkFuture(time:Utc startAt, time:Utc now) returns RuleViolation? {
    if time:utcDiffSeconds(startAt, now) <= 0d {
        return violation("BR-1", "The start time must be in the future");
    }
    return ();
}

// BR-2: 30 min to 4 h, both ends on a 30-minute boundary (in campus time).
function checkDuration(time:Utc startAt, time:Utc endAt, time:Zone zone) returns RuleViolation? {
    decimal secs = time:utcDiffSeconds(endAt, startAt);
    if secs < HALF_HOUR || secs > FOUR_HOURS {
        return violation("BR-2", "A booking must last between 30 minutes and 4 hours");
    }
    foreach time:Utc t in [startAt, endAt] {
        time:Civil c = zone.utcToCivil(t);
        if c.minute % 30 != 0 || (c.second ?: 0d) != 0d {
            return violation("BR-2", "Start and end times must be on a 30-minute boundary");
        }
    }
    return ();
}

// BR-3: the start may be at most 30 days ahead.
function checkHorizon(time:Utc startAt, time:Utc now) returns RuleViolation? {
    if time:utcDiffSeconds(startAt, now) > 30 * DAY {
        return violation("BR-3", "Bookings can be made at most 30 days ahead");
    }
    return ();
}

// BR-4: inside opening hours, on a single day, in campus time. Hours are "HH:MM".
function checkOpeningHours(time:Utc startAt, time:Utc endAt, string openTime, string closeTime, time:Zone zone)
        returns RuleViolation? {
    time:Civil s = zone.utcToCivil(startAt);
    time:Civil e = zone.utcToCivil(endAt);
    if s.year != e.year || s.month != e.month || s.day != e.day {
        return violation("BR-4", "A booking must start and end on the same day");
    }
    if s.hour * 60 + s.minute < minutesOf(openTime) || e.hour * 60 + e.minute > minutesOf(closeTime) {
        return violation("BR-4", string `The resource is only available ${openTime}-${closeTime}`);
    }
    return ();
}

// BR-5: attendees must fit the lab capacity (equipment: capacity 1).
function checkCapacity(int attendees, int capacity) returns RuleViolation? {
    if attendees < 1 || attendees > capacity {
        return violation("BR-5", string `Attendees must be between 1 and ${capacity}`);
    }
    return ();
}

// BR-7: a student may hold at most 3 upcoming pending/approved bookings. Admins are exempt.
function checkUpcomingLimit(int upcoming, boolean isAdmin) returns RuleViolation? {
    if !isAdmin && upcoming >= MAX_UPCOMING {
        return violation("BR-7", string `You can hold at most ${MAX_UPCOMING} upcoming bookings`);
    }
    return ();
}

// BR-8: inactive labs and equipment in maintenance/retired cannot be booked.
function checkBookable(boolean bookable) returns RuleViolation? {
    if !bookable {
        return violation("BR-8", "This resource is not available for booking");
    }
    return ();
}

// BR-9: a rejection needs a note of 3 to 300 characters.
function checkRejectNote(string note) returns RuleViolation? {
    int len = note.trim().length();
    if len < 3 || len > 300 {
        return violation("BR-9", "A rejection note of 3 to 300 characters is required");
    }
    return ();
}

function minutesOf(string hhmm) returns int {
    int|error h = int:fromString(hhmm.substring(0, 2));
    int|error m = int:fromString(hhmm.substring(3, 5));
    return (h is int ? h : 0) * 60 + (m is int ? m : 0);
}
