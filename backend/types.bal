// API and DB records. Timestamps and times travel as strings (ISO 8601 UTC, "HH:MM"):
// SQL formats them, which avoids driver-specific time mappings.

// Signed-in user.
public type Me record {|
    string id;
    string? email;
    string displayName;
    string role;
|};

// Authenticated caller resolved from the JWT (or X-Dev-User in dev mode).
public type Caller record {|
    string id;
    string? email;
    string displayName;
    string role;
|};

public type Lab record {|
    string id;
    string code;
    string name;
    string building;
    string room;
    int capacity;
    string description;
    string openTime;
    string closeTime;
    boolean isActive;
|};

public type LabInput record {|
    string code;
    string name;
    string building;
    string room;
    int capacity;
    string description = "";
    string openTime = "08:00";
    string closeTime = "17:00";
    boolean isActive = true;
|};

public type Equipment record {|
    string id;
    string? labId;
    string? labCode;
    string assetTag;
    string name;
    string category;
    string description;
    string status;
|};

public type EquipmentInput record {|
    string? labId = ();
    string assetTag;
    string name;
    string category;
    string description = "";
    string status = "available";
|};

public type LabDetail record {|
    *Lab;
    Equipment[] equipment;
|};

public type BusySlot record {|
    string startAt;
    string endAt;
    string status;
|};

public type Availability record {|
    string openTime;
    string closeTime;
    BusySlot[] busy;
|};

public type BookingInput record {|
    string resourceType;
    string resourceId;
    string startAt;
    string endAt;
    string purpose;
    int attendees = 1;
|};

public type Booking record {|
    string id;
    string userId;
    string userName;
    string resourceType;
    string resourceId;
    string resourceName;
    string startAt;
    string endAt;
    string purpose;
    int attendees;
    string status;
    string? adminNote;
    string? decidedAt;
    string createdAt;
|};

public type RejectInput record {|
    string note;
|};

public type LabUtilisation record {|
    string labId;
    string code;
    float hoursBooked;
    float hoursOpen;
    float ratio;
|};

public type TopEquipment record {|
    string id;
    string name;
    int count;
|};

public type Stats record {|
    int bookingsToday;
    int pendingCount;
    LabUtilisation[] labUtilisation7d;
    TopEquipment[] topEquipment30d;
|};

// Internal rows ------------------------------------------------------------

type CountRow record {|
    int count;
|};

type ResourceInfo record {|
    string name;
    boolean bookable;
    int capacity; // lab capacity; 1 for equipment
    string openTime;
    string closeTime;
|};

type UtilRow record {|
    string labId;
    string code;
    float hoursBooked;
    float hoursOpen;
|};

type HoursRow record {|
    string openTime;
    string closeTime;
|};

type BookingState record {|
    string userId;
    string status;
    boolean started;
|};
