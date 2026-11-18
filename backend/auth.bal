import ballerina/http;
import ballerina/jwt;
import ballerina/log;
import ballerina/time;

// Local development only: accept `X-Dev-User: <email>` instead of a JWT. NEVER true on Choreo.
configurable boolean devMode = false;
// Emails that get the admin role.
configurable string[] adminEmails = [];
// Expected `iss` of the backend JWT forwarded by the Choreo gateway (x-jwt-assertion).
configurable string jwtIssuer = "";
// JWKS URL used to verify the JWT signature.
configurable string jwtJwksUrl = "";
// Request header that carries the JWT: "x-jwt-assertion" behind the Choreo gateway, or "Authorization"
// (Bearer token) when the SPA signs in directly with an OIDC provider such as ThunderID on OpenChoreo.
configurable string jwtHeader = "x-jwt-assertion";

final jwt:ValidatorConfig jwtValidator = {
    issuer: jwtIssuer,
    clockSkew: 60,
    signatureConfig: {jwksConfig: {url: jwtJwksUrl}}
};

function init() returns error? {
    if time:getZone(campusTimeZone) is () {
        return error("Unknown campusTimeZone: " + campusTimeZone);
    }
    if devMode {
        log:printWarn("devMode is ON: X-Dev-User header is trusted. Never enable this on Choreo.");
    } else if jwtIssuer == "" || jwtJwksUrl == "" {
        return error("jwtIssuer and jwtJwksUrl must be set when devMode is false");
    }
}

// Resolves the caller from the request and upserts their user row.
function authenticate(http:Request req) returns Caller|error {
    string subject;
    string? email;
    string name;
    if devMode {
        string|http:HeaderNotFoundError h = req.getHeader("X-Dev-User");
        if h is http:HeaderNotFoundError || h.trim() == "" {
            return unauthenticated("Missing X-Dev-User header");
        }
        string devEmail = h.trim().toLowerAscii();
        subject = "dev:" + devEmail;
        email = devEmail;
        name = localPart(devEmail);
    } else {
        string|http:HeaderNotFoundError raw = req.getHeader(jwtHeader);
        if raw is http:HeaderNotFoundError {
            return unauthenticated();
        }
        jwt:Payload|jwt:Error p = jwt:validate(tokenFrom(raw), jwtValidator);
        if p is jwt:Error {
            log:printWarn("JWT validation failed");
            return unauthenticated("Invalid token");
        }
        string? sub = p.sub;
        if sub is () {
            return unauthenticated("Token has no subject");
        }
        subject = sub;
        email = claim(p, "email");
        name = displayNameOf(p, email, sub);
    }
    return upsertUser(subject, email, name, isAdminEmail(email));
}

// Accepts a bare JWT or an "Authorization: Bearer <jwt>" value.
function tokenFrom(string raw) returns string {
    string v = raw.trim();
    return v.toLowerAscii().startsWith("bearer ") ? v.substring(7).trim() : v;
}

function isAdminEmail(string? email) returns boolean {
    if email is () {
        return false;
    }
    string e = email.toLowerAscii();
    foreach string a in adminEmails {
        if a.trim().toLowerAscii() == e {
            return true;
        }
    }
    return false;
}

function requireAdmin(Caller c) returns ApiError? {
    if c.role != "admin" {
        return forbidden("Admin access required");
    }
}

function claim(jwt:Payload p, string key) returns string? {
    anydata v = p[key];
    return v is string && v.trim() != "" ? v.trim() : ();
}

function displayNameOf(jwt:Payload p, string? email, string sub) returns string {
    string? n = claim(p, "name");
    if n is string {
        return n;
    }
    string? given = claim(p, "given_name");
    string? family = claim(p, "family_name");
    if given is string {
        return family is string ? given + " " + family : given;
    }
    if email is string {
        return localPart(email);
    }
    return sub;
}

function localPart(string email) returns string {
    int? at = email.indexOf("@");
    return at is int && at > 0 ? email.substring(0, at) : email;
}
