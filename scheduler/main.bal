import ballerina/log;
import ballerina/sql;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

configurable string dbHost = "localhost";
configurable int dbPort = 5432;
configurable string dbName = "labbook";
configurable string dbUser = "labbook";
// Secret. Provide it through Config.toml locally or an OpenChoreo Resource binding.
configurable string dbPassword = ?;
// disable | prefer | require | verify-ca | verify-full
configurable string dbSslMode = "require";

final postgresql:Client db = check new (dbHost, dbUser, dbPassword, dbName, dbPort,
    options = {ssl: {mode: sslMode(dbSslMode)}},
    connectionPool = {maxOpenConnections: 2}
);

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

// BR-12: pending bookings whose start has passed become `expired`; approved bookings whose end has
// passed become `completed`. Both updates run in one transaction. Returns [expired, completed].
function runJob() returns [int, int]|error {
    int expired = 0;
    int completed = 0;
    transaction {
        sql:ExecutionResult e = check db->execute(
            `UPDATE bookings SET status = 'expired' WHERE status = 'pending' AND start_at < now()`);
        sql:ExecutionResult c = check db->execute(
            `UPDATE bookings SET status = 'completed' WHERE status = 'approved' AND end_at < now()`);
        check commit;
        expired = e.affectedRowCount ?: 0;
        completed = c.affectedRowCount ?: 0;
    }
    return [expired, completed];
}

// OpenChoreo scheduled-task entry point: run once and exit. A returned error exits non-zero.
public function main() returns error? {
    [int, int]|error r = runJob();
    if r is error {
        log:printError("scheduler run failed", 'error = r);
        return r;
    }
    log:printInfo(string `expired=${r[0]} completed=${r[1]}`);
}
