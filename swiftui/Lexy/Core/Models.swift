import Foundation

// Codable types are cached, so a launch can show the last answers on its first frame.

/// `status` is 0 before the session has been checked, and 401 when signed out.
nonisolated struct Account: Equatable, Sendable {
    var signedIn = false
    var demo = false
    var expiresAt: Double = 0
    var status = 0
    var error = ""
}

/// One step of the ForgeRock sign-in tree. `raw` is the node as received, for answering it.
nonisolated struct AuthNode: Equatable, Sendable {
    var ok = false
    var status = 0
    var error = ""
    var raw: JSON = .null
    var tokenId = ""
    var types: [String] = []
    var prompts: [String] = []
    /// The prompts ask for a one-time code.
    var asksCode = false
    var choices: [String] = []
}

nonisolated struct Done: Equatable, Sendable {
    var ok = false
    var status = 0
    var error = ""
    static let success = Done(ok: true, status: 200, error: "")
}

/// `capabilities` lists the remote-capability flags that are on.
nonisolated struct Car: Codable, Equatable, Sendable {
    var vin = ""
    var brand = "L"
    var generation = ""
    var region = ""
    var asiCode = ""
    var hwType = ""
    var nickName = ""
    var modelName = ""
    var modelYear = ""
    var description = ""
    var color = ""
    var image = ""
    var fuelType = ""
    var grade = ""
    var modelCode = ""
    var capabilities: [String] = []

    var name: String { Rules.vehicleName(nick: nickName, model: modelName) }
    func can(_ flag: String) -> Bool { capabilities.contains(flag) }
}

nonisolated struct Garage: Codable, Equatable, Sendable {
    var ok = false
    var status = 0
    var error = ""
    var car = Car(brand: "L")
    var cars: [Car] = []
}

/// One section of a status snapshot, such as Driver Side / Rear Door / ["Closed", "Locked"]. `at`
/// is when its oldest shown reading was observed.
nonisolated struct StatusSection: Codable, Equatable, Sendable, Hashable {
    var category: String
    var section: String
    var values: [String]
    var at: Double = 0
}

nonisolated struct VehicleStatus: Codable, Equatable, Sendable {
    var ok = false
    var status = 0
    var error = ""
    var occurredMs: Double = 0
    /// When the app made the read.
    var fetchedMs: Double = 0
    var fuel: Double = 0
    var range: Double = 0
    var rangeUnit = ""
    var odometer: Double = 0
    var odometerUnit = ""
    var caution: Double = 0
    var latitude: Double = 0
    var longitude: Double = 0
    var tripA: Double = 0
    var tripB: Double = 0
    var sections: [StatusSection] = []
    /// The oldest doors-and-windows reading older than this snapshot, or 0.
    var closuresStaleMs: Double = 0

    var hasLocation: Bool { latitude != 0 || longitude != 0 }
    /// The car's timestamp, capped at the read time, since car clocks can run ahead.
    var observedMs: Double { fetchedMs > 0 ? min(occurredMs, fetchedMs) : occurredMs }
}

nonisolated struct Tire: Codable, Equatable, Sendable, Hashable {
    var position: String
    var value: Double
    var low: Bool
}

nonisolated struct Tires: Codable, Equatable, Sendable {
    var ok = false
    var status = ""
    var unit = ""
    var tires: [Tire] = []
}

nonisolated struct Engine: Codable, Equatable, Sendable {
    var ok = false
    var status = ""
    var startedMs: Double = 0
    var timer: Double = 0
    var running: Bool { status == "1" }
}

nonisolated struct SpecItem: Codable, Equatable, Sendable {
    var name: String
    var value: String
}

nonisolated struct Spec: Codable, Equatable, Sendable {
    var ok = false
    var items: [SpecItem] = []

    func value(_ name: String, or fallback: String) -> String {
        items.first { $0.name == name && !$0.value.isEmpty }?.value ?? fallback
    }
}

nonisolated struct Service: Codable, Equatable, Sendable, Hashable {
    var bucket: String
    var name: String
    var status: String
    var endMs: Double
}

nonisolated struct Services: Codable, Equatable, Sendable {
    var ok = false
    var items: [Service] = []
}

nonisolated struct CommandResult: Equatable, Sendable {
    var ok = false
    var status = 0
    var error = ""
    var command = ""
    var returnCode = ""
    var accepted: Bool { ok && returnCode == "000000" }
}

/// Remote-start climate settings. `raw` is the wire object that changes are written back into.
nonisolated struct Climate: Codable, Equatable, Sendable {
    var ok = false
    var raw: JSON = .null
    var on = false
    var temperature: Double = 0
    var unit = "F"
    var min: Double = 0
    var max: Double = 0
    var step: Double = 1
    var front = false
    var frontEnabled = false
    var rear = false
    var rearEnabled = false
}

nonisolated enum Command: String, Sendable, CaseIterable {
    case doorLock = "door-lock"
    case doorUnlock = "door-unlock"
    case engineStart = "engine-start"
    case engineStop = "engine-stop"
    case trunkLock = "trunk-lock"
    case trunkUnlock = "trunk-unlock"
    case hazardOn = "hazard-on"
    case hazardOff = "hazard-off"
    case headlightOn = "headlight-on"
    case buzzerWarning = "buzzer-warning"
    case soundHorn = "sound-horn"

    var isLock: Bool { self == .doorLock || self == .doorUnlock }
    var isEngine: Bool { self == .engineStart || self == .engineStop }
}

/// The installed maps apps and the saved choice ("" when unset).
nonisolated struct MapsApps: Equatable, Sendable {
    var provider = ""
    var apple = true
    var google = false
    var waze = false
}
