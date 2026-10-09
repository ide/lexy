import Foundation

/// An in-memory Lexus that answers with the same wire shapes as the real hosts. The car acts on a
/// command 3 seconds after accepting it. Any email and password sign in except the password
/// `wrong`, and any code except `000000`.
actor DemoLexus: LexusTransport {
    static let shared = DemoLexus()

    nonisolated static let actAfterMs: Double = 3000
    nonisolated static let roundTripMs: Double = 1000

    /// Makes every write fail with a 500. Reads still answer.
    var failing = false
    func setFailing(_ on: Bool) { failing = on }

    private var locked = true
    private var trunkOpen = false
    private var engineSince: Double = 0
    private var nickName = "IS 350"
    private var pending: [(command: String, at: Double)] = []
    /// The snapshot's occurrence date. Reads never move it; acting on a command or a refresh-status
    /// request does.
    private var reportedAt: Double = 0
    private var climate: JSON = [
        "settingsOn": true, "temperature": 72, "temperatureUnit": "F", "minTemp": 65, "maxTemp": 85, "tempInterval": 1,
        "acOperations": [[
            "categoryName": "defrost", "categoryDisplayName": "Defrost", "available": true,
            "acParameters": [
                ["name": "frontDefrost", "displayName": "Front Defrost", "available": true, "enabled": false],
                ["name": "rearDefrost", "displayName": "Rear Defrost", "available": true, "enabled": false],
            ],
        ]],
    ]

    nonisolated static let vin = "DEMO0000000000000"

    func send(_ request: WireRequest) async throws -> WireReply {
        let path = request.url.path
        let body = request.json
        if path.hasSuffix("/authenticate") { return DemoLexus.authenticate(body) }
        if path.hasSuffix("/authorize") { return .json(302, "", location: "com.toyota.oneapp:/oauth2Callback?code=demo-code") }
        if path.hasSuffix("/access_token") { return .json(200, DemoLexus.tokens) }
        try await Task.sleep(for: .milliseconds(Int(DemoLexus.roundTripMs)))
        let at = nowMs()
        switch path {
        case "/oneapi/v2/vehicle/guid":
            return .json(200, discovery())
        case "/v1/remote/route/status":
            let ready = try await untilDue(at)
            return .json(200, status(ready))
        case "/v1/remote/route/refresh-status":
            reportedAt = max(reportedAt, at)
            return .json(200, ["payload": ["returnCode": "000000"]])
        case "/v1/remote/route/engine-status":
            let ready = try await untilDue(at)
            settle(ready)
            return .json(200, ["payload": [
                "vin": .string(DemoLexus.vin), "status": engineSince > 0 ? "1" : "0",
                "date": engineSince > 0 ? .string(isoString(engineSince)) : "", "timer": 20,
            ]])
        case "/oneapi/v1/telemetry/tires/pressure":
            func pressure(_ v: Int) -> JSON { ["value": .int(v), "unit": "psi", "displayLowTirePressureWarning": .bool(v < 33)] }
            return .json(200, ["payload": [
                "tirePressureStatus": "Normal", "flTirePressure": pressure(36), "frTirePressure": pressure(36),
                "rlTirePressure": pressure(35), "rrTirePressure": pressure(32),
            ]])
        case "/oneapi/v1/vehicle/vehicle-spec":
            return .json(200, ["payload": [
                "vehicleSpecifications": ["dataItems": [
                    ["dataName": "Transmission", "dataValue": "8-Speed Automatic"],
                    ["dataName": "Drive Type", "dataValue": "RWD"],
                    ["dataName": "Grade", "dataValue": "F SPORT"],
                ]],
                "additionalDetails": ["dataItems": [
                    ["dataName": "Date of First Use", "dataValue": "April 1, 2026"],
                    ["dataName": "Order Date", "dataValue": "03/2026"],
                ]],
            ]])
        case "/oneapi/v3/vehicle-subscriptions":
            return .json(200, ["payload": [
                "paidSubscriptions": [["displayProductName": "Remote Connect", "status": "ACTIVE", "subscriptionEndDate": "2028-04-01"]],
                "trialSubscriptions": [["displayProductName": "Drive Connect", "status": "ACTIVE", "subscriptionEndDate": "2027-04-01"]],
                "complimentarySubscriptions": [["displayProductName": "Service Connect", "status": "ACTIVE", "subscriptionEndDate": "2036-04-01"]],
            ]])
        case "/v1/remote/route/climate-settings":
            if request.method == "PUT" {
                if failing { return DemoLexus.failure }
                var merged = climate.object
                for (k, v) in body.object { merged[k] = v }
                climate = .object(merged)
            }
            return .json(200, ["payload": climate])
        case "/v1/remote/route/command":
            if failing { return DemoLexus.failure }
            pending.append((body["command"].string, at))
            return .json(200, ["payload": ["returnCode": "000000"]])
        case "/oneapi/v1/vehicle-association/vehicle":
            if failing { return DemoLexus.failure }
            nickName = body["nickName"].string
            return .json(200, ["payload": [:]])
        default:
            return .json(404, ["message": .string("The demo has no \(path)")])
        }
    }

    private static let failure = WireReply.json(500, ["message": "The demo server is simulating an error."])

    private func settle(_ at: Double) {
        let due = pending.filter { $0.at + DemoLexus.actAfterMs <= at }
        pending.removeAll { $0.at + DemoLexus.actAfterMs <= at }
        for (command, sent) in due {
            switch command {
            case "door-lock": locked = true
            case "door-unlock": locked = false
            case "trunk-unlock": trunkOpen = true
            case "trunk-lock": trunkOpen = false
            case "engine-start": engineSince = sent + DemoLexus.actAfterMs
            case "engine-stop": engineSince = 0
            default: break
            }
            reportedAt = max(reportedAt, sent + DemoLexus.actAfterMs)
        }
    }

    /// Holds a read until pending commands have acted, as a car reporting back would.
    private func untilDue(_ at: Double) async throws -> Double {
        guard let due = pending.map({ $0.at + DemoLexus.actAfterMs }).max() else { return at }
        if due > at { try await Task.sleep(for: .milliseconds(Int(due - at))) }
        return max(at, due)
    }

    private func discovery() -> JSON {
        ["payload": [[
            "vin": .string(DemoLexus.vin), "brand": "L", "generation": "21MM", "region": "US", "asiCode": "JG", "hwType": "211",
            "nickName": .string(nickName), "modelName": "IS 350", "modelYear": "2026", "displayModelDescription": "2026 Lexus IS 350 F SPORT",
            "color": "Cloudburst Grey", "fuelType": "G", "grade": "F SPORT", "modelCode": "9510",
            "image": "https://delivery.vcr.assetscs.toyota.com/adobe/assets/urn:aaid:aem:06327492-1484-4909-af33-b7c14b21edda/as/image.png?size=700,700",
            "extendedCapabilities": [
                "doorLockUnlockCapable": true, "remoteEngineStartStop": true, "trunkLockUnlockCapable": true,
                "hornCapable": true, "buzzerCapable": true, "hazardCapable": true, "lightsCapable": true,
            ],
        ]]]
    }

    private func status(_ at: Double) -> JSON {
        settle(at)
        if reportedAt == 0 { reportedAt = at - 90_000 }
        func v(_ value: String) -> JSON { ["value": .string(value), "status": 0] }
        let lock = v(locked ? "Locked" : "Unlocked")
        return ["payload": ["status": [
            "occurrenceDate": .string(isoString(reportedAt)),
            "cautionOverallCount": 0,
            "latitude": 37.334606,
            "longitude": -122.009102,
            "telemetry": ["fugage": ["value": 62, "unit": "%"], "rage": ["value": 214, "unit": "Mile"], "odo": ["value": 12482, "unit": "Mile"]],
            "vehicleStatus": [
                ["category": "Driver Side", "sections": [
                    ["section": "Door", "values": [v("Closed"), lock]],
                    ["section": "Rear Door", "values": [v("Closed"), lock]],
                    ["section": "Window", "values": [v("Closed")]],
                    ["section": "Rear Window", "values": [v("Closed")]],
                ]],
                ["category": "Passenger Side", "sections": [
                    ["section": "Door", "values": [v("Closed"), lock]],
                    ["section": "Rear Door", "values": [v("Closed"), lock]],
                    ["section": "Window", "values": [v("Open")]],
                    ["section": "Rear Window", "values": [v("Closed")]],
                ]],
                ["category": "Other", "sections": [
                    ["section": "Moonroof", "values": [v("Closed")]],
                    ["section": "Trunk", "values": [v(trunkOpen ? "Open" : "Closed")]],
                    ["section": "Hood", "values": [v("Closed")]],
                ]],
                ["category": "Trip Details", "sections": [
                    ["section": "Trip A", "values": [v("272.1 miles")]],
                    ["section": "Trip B", "values": [v("735.1 miles")]],
                ]],
            ],
        ]]]
    }

    // MARK: Identity

    nonisolated static func node(_ step: String, authId: String) -> JSON {
        func prompt(_ value: String) -> JSON { ["name": "prompt", "value": .string(value)] }
        let callbacks: JSON
        switch step {
        case "username":
            callbacks = [["type": "NameCallback", "output": [prompt("User Name")], "input": [["name": "IDToken1", "value": ""]]]]
        case "password":
            callbacks = [["type": "PasswordCallback", "output": [prompt("Password")], "input": [["name": "IDToken1", "value": ""]]]]
        case "choice":
            callbacks = [["type": "ChoiceCallback",
                          "output": [prompt("How would you like to receive your code?"), ["name": "choices", "value": ["Email", "Text message"]], ["name": "defaultChoice", "value": 0]],
                          "input": [["name": "IDToken1", "value": 0]]]]
        default:
            callbacks = [["type": "TextInputCallback",
                          "output": [prompt("Enter the verification code we sent you."), ["name": "value", "value": ""]],
                          "input": [["name": "IDToken1", "value": ""]]]]
        }
        return ["authId": .string(authId), "callbacks": callbacks]
    }

    nonisolated static func answer(_ posted: JSON) -> JSON { posted["callbacks"].array.first?["input"].array.first?["value"] ?? .null }

    nonisolated static func authenticate(_ posted: JSON) -> WireReply {
        let answer = answer(posted)
        switch posted["authId"].string {
        case "demo-username":
            return .json(200, node("password", authId: "demo-password"))
        case "demo-password":
            return answer.string == "wrong"
                ? .json(401, ["message": "The email or password you entered is incorrect."])
                : .json(200, ["tokenId": "demo-sso-token"])
        case "demo-choice":
            return .json(200, node("otp", authId: "demo-otp"))
        case "demo-otp":
            return answer.string == "000000"
                ? .json(401, ["message": "That verification code is incorrect or has expired."])
                : .json(200, ["tokenId": "demo-sso-token"])
        default:
            return .json(200, node("username", authId: "demo-username"))
        }
    }

    nonisolated static var tokens: JSON {
        func b64url(_ text: String) -> String {
            Data(text.utf8).base64EncodedString().replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        }
        let idToken = "\(b64url(#"{"alg":"none"}"#)).\(b64url(#"{"extension_tmsguid":"demo-guid"}"#))."
        return ["access_token": "demo-access", "refresh_token": "demo-refresh", "id_token": .string(idToken), "token_type": "Bearer", "expires_in": 3600]
    }
}

/// Login Flow's mock identity tree. The scenario decides where sign-in fails. Each node's `authId`
/// carries the step.
nonisolated enum PreviewScenario: String, CaseIterable, Sendable, Identifiable {
    case successMulti = "success-multi"
    case successSingle = "success-single"
    case wrongPassword = "wrong-password"
    case wrongCode = "wrong-code"
    case networkError = "network-error"
    var id: String { rawValue }
}

nonisolated struct PreviewLexus: LexusTransport {
    let scenario: PreviewScenario
    /// Long enough for the busy labels ("Signing In…") to show.
    static let latency = Duration.milliseconds(350)

    func send(_ request: WireRequest) async throws -> WireReply {
        try await Task.sleep(for: PreviewLexus.latency)
        if scenario == .networkError { throw URLError(.notConnectedToInternet) }
        let path = request.url.path
        if path.hasSuffix("/authenticate") { return authenticate(request.json) }
        if path.hasSuffix("/authorize") { return .json(302, "", location: "com.toyota.oneapp:/oauth2Callback?code=preview-code") }
        if path.hasSuffix("/access_token") { return .json(200, DemoLexus.tokens) }
        return .json(404, ["message": .string("The preview has no \(path)")])
    }

    private func authenticate(_ posted: JSON) -> WireReply {
        let step = posted["callbacks"].array.isEmpty ? "start" : posted["authId"].string
        func node(_ name: String) -> WireReply { .json(200, DemoLexus.node(name, authId: "preview-\(name)")) }
        switch step {
        case "preview-username": return node("password")
        case "preview-password":
            if scenario == .wrongPassword { return .json(401, ["message": "The email or password you entered is incorrect."]) }
            return node(scenario == .successSingle ? "otp" : "choice")
        case "preview-choice": return node("otp")
        case "preview-otp":
            if scenario == .wrongCode { return .json(401, ["message": "That verification code is incorrect or has expired."]) }
            return .json(200, ["tokenId": "preview-sso-token"])
        default: return node("username")
        }
    }
}
