import ballerina/http;
import ballerina/log;
import ballerina/sql;

public type ApiErrorDetail record {|
    int status;
    string code;
    string? rule;
|};

public type ApiError distinct error<ApiErrorDetail>;

function apiError(int status, string code, string message, string? rule = ()) returns ApiError {
    return error ApiError(message, status = status, code = code, rule = rule);
}

function badRequest(string message) returns ApiError => apiError(400, "BAD_REQUEST", message);

function unauthenticated(string message = "Authentication required") returns ApiError =>
    apiError(401, "UNAUTHENTICATED", message);

function forbidden(string message = "You are not allowed to do this") returns ApiError =>
    apiError(403, "FORBIDDEN", message);

function notFound(string what) returns ApiError => apiError(404, "NOT_FOUND", what + " not found");

function invalidState(string message) returns ApiError => apiError(409, "INVALID_STATE", message);

function ruleViolation(RuleViolation v) returns ApiError =>
    apiError(422, "RULE_VIOLATION", v.message, v.rule);

// Maps a PostgreSQL SQLSTATE to [http status, code, message]. Pure, so it is unit tested.
// Class 22 (data exception) and 23 (integrity) are caller mistakes; 23P01 is an exclusion-constraint hit.
function mapSqlState(string sqlState) returns [int, string, string] {
    if sqlState == "23P01" {
        return [409, "BOOKING_CONFLICT", "That time slot is already booked"];
    }
    if sqlState == "23505" {
        return [400, "BAD_REQUEST", "A record with the same unique value already exists"];
    }
    if sqlState.startsWith("22") || sqlState.startsWith("23") {
        return [400, "BAD_REQUEST", "One of the supplied values is invalid"];
    }
    return [500, "INTERNAL", "Internal server error"];
}

// Converts any error into the single JSON error shape. Never leaks SQL or stack traces.
function errorResponse(error e) returns http:Response {
    int status = 500;
    string code = "INTERNAL";
    string message = "Internal server error";
    string? rule = ();
    if e is ApiError {
        ApiErrorDetail d = e.detail();
        status = d.status;
        code = d.code;
        rule = d.rule;
        message = e.message();
    } else if e is sql:DatabaseError {
        [int, string, string] m = mapSqlState(e.detail().sqlState ?: "");
        [status, code, message] = m;
        if status == 500 {
            log:printError("database error", sqlState = e.detail().sqlState ?: "");
        }
    } else if e is http:PayloadBindingError || e is http:ClientRequestError {
        status = 400;
        code = "BAD_REQUEST";
        message = "Malformed request";
    } else {
        log:printError("unhandled error", 'error = e);
    }
    map<json> body = {code, message};
    if rule is string {
        body["rule"] = rule;
    }
    http:Response res = new;
    res.statusCode = status;
    res.setJsonPayload(body);
    return res;
}
