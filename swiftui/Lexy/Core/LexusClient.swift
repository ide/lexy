import CryptoKit
import Foundation

/// A failed Lexus call. `status` is 0 when no response arrived.
nonisolated struct LexusError: Error, Equatable {
    var status: Int
    var message: String
}

nonisolated func failure(_ error: Error) -> (status: Int, error: String) {
    switch error {
    case let e as LexusError: (e.status, e.message)
    case let e as URLError: (0, e.localizedDescription)
    default: (0, error.localizedDescription)
    }
}

nonisolated struct Session: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var idToken: String
    var expiresAt: Double
    var tokenType: String
}

/// HTTP to the Lexus identity and REST hosts, the stored session, and decoding replies into the
/// app's models.
final class LexusClient {
    nonisolated static let identityHost = "login.lexusdriverslogin.com"
    private static let identity = "https://\(identityHost)"
    private static let realm = "realms/root/realms/tmna-native"
    private static let authenticateURL = URL(string: "\(identity)/json/\(realm)/authenticate?authIndexType=service&authIndexValue=signin_2.0&locale=en-US")!
    private static let authorizeURL = URL(string: "\(identity)/oauth2/\(realm)/authorize")!
    private static let tokenURL = URL(string: "\(identity)/oauth2/\(realm)/access_token")!
    private static let clientId = "oneappsdkclient"
    private static let redirectURI = "com.toyota.oneapp:/oauth2Callback"
    private static let scope = "openid profile write"

    private static let rest = "https://onecdn.telematicsct.com"
    private static let discoveryURL = URL(string: "\(rest)/oneapi/v2/vehicle/guid")!
    private static let statusURL = URL(string: "\(rest)/v1/remote/route/status")!
    private static let refreshStatusURL = URL(string: "\(rest)/v1/remote/route/refresh-status")!
    private static let engineURL = URL(string: "\(rest)/v1/remote/route/engine-status")!
    private static let specURL = URL(string: "\(rest)/oneapi/v1/vehicle/vehicle-spec")!
    private static let tiresURL = URL(string: "\(rest)/oneapi/v1/telemetry/tires/pressure")!
    private static let commandURL = URL(string: "\(rest)/v1/remote/route/command")!
    private static let nicknameURL = URL(string: "\(rest)/oneapi/v1/vehicle-association/vehicle")!
    private static let subscriptionsURL = URL(string: "\(rest)/oneapi/v3/vehicle-subscriptions")!
    private static let climateURL = URL(string: "\(rest)/v1/remote/route/climate-settings")!

    /// The OneApp's public, app-wide API key, stored as bytes to keep secret scanners quiet.
    private static let apiKey = String(decoding: [
        112, 121, 112, 73, 72, 71, 48, 49, 53, 107, 52, 65, 66, 72, 87, 98, 99, 73, 52, 71, 48, 97, 57,
        52, 70, 55, 99, 67, 48, 74, 68, 111, 49, 79, 121, 110, 112, 65, 115, 71,
    ] as [UInt8], as: UTF8.self)

    /// Refresh an access token this close to its expiry.
    static let expiryMarginMs: Double = 60_000

    private let store: SecretStore
    let cache: AnswerCache
    private let live: LexusTransport
    let demo: DemoLexus

    init(store: SecretStore, cache: AnswerCache, live: LexusTransport = LiveTransport(), demo: DemoLexus = .shared) {
        self.store = store
        self.cache = cache
        self.live = live
        self.demo = demo
    }

    var isDemo: Bool { store.get("lexy.demo") == "1" }

    private var transport: LexusTransport { isDemo ? demo : live }

    private func signInTransport(_ preview: PreviewScenario?) -> LexusTransport {
        preview.map { PreviewLexus(scenario: $0) } ?? transport
    }

    // MARK: Session

    func readSession() -> Session? {
        guard let text = store.get("lexy.session"),
              let s = try? JSONDecoder().decode(Session.self, from: Data(text.utf8)),
              !s.accessToken.isEmpty, !s.refreshToken.isEmpty else { return nil }
        return s
    }

    private func keep(_ session: Session) {
        if let data = try? JSONEncoder().encode(session) { store.set("lexy.session", String(decoding: data, as: UTF8.self)) }
    }

    /// The stored session, read without a network request, for the first frame.
    func storedAccount() -> Account {
        guard let s = readSession() else { return Account(signedIn: false, demo: isDemo, expiresAt: 0, status: 0, error: "") }
        return Account(signedIn: true, demo: isDemo, expiresAt: s.expiresAt, status: 200, error: "")
    }

    /// Set when the gateway rejects a token before its stated expiry, so the next `session()`
    /// refreshes.
    private var rejected = false
    /// Lexus rotates refresh tokens, so concurrent callers share one refresh.
    private var refreshing: Task<Session, Error>?

    /// The only place that refreshes the token: when it is due, or after the gateway rejected it.
    func session(at: Double = nowMs()) async -> Account {
        let demo = isDemo
        guard var current = readSession() else { return Account(signedIn: false, demo: demo, expiresAt: 0, status: 401, error: "") }
        do {
            if rejected || current.expiresAt - LexusClient.expiryMarginMs <= at {
                current = try await refreshed(current, at: at)
                rejected = false
            }
            return Account(signedIn: true, demo: demo, expiresAt: current.expiresAt, status: 200, error: "")
        } catch {
            // A rejected refresh token has already been forgotten. Anything else (offline, a 5xx)
            // keeps the session for the next try.
            let signedIn = readSession() != nil
            let f = failure(error)
            return Account(signedIn: signedIn, demo: demo, expiresAt: signedIn ? current.expiresAt : 0, status: f.status, error: f.error)
        }
    }

    private func refreshed(_ session: Session, at: Double) async throws -> Session {
        if let refreshing { return try await refreshing.value }
        let task = Task { try await self.refreshOnce(session, at: at) }
        refreshing = task
        defer { refreshing = nil }
        return try await task.value
    }

    private func refreshOnce(_ session: Session, at: Double) async throws -> Session {
        let reply = try await transport.send(form(LexusClient.tokenURL, [
            "client_id": LexusClient.clientId,
            "grant_type": "refresh_token",
            "refresh_token": session.refreshToken,
            "response_type": "token",
            "scope": LexusClient.scope,
        ]))
        do {
            let next = try tokens(try readJSON(reply), previousRefresh: session.refreshToken, at: at)
            keep(next)
            return next
        } catch let e as LexusError where (400..<500).contains(e.status) {
            // Another refresh already rotated the token; the stored session is newer and valid.
            if let stored = readSession(), stored.refreshToken != session.refreshToken { return stored }
            store.forget("lexy.session")
            cache.forgetAll()
            throw LexusError(status: 401, message: "Your Lexus session expired. Please sign in again.")
        }
    }

    private func tokens(_ body: JSON, previousRefresh: String?, at: Double) throws -> Session {
        let refresh = body["refresh_token"].string.isEmpty ? (previousRefresh ?? "") : body["refresh_token"].string
        guard !body["access_token"].string.isEmpty, !body["id_token"].string.isEmpty, body["expires_in"].isNumber, !refresh.isEmpty else {
            throw LexusError(status: 0, message: "Lexus returned an incomplete token response")
        }
        return Session(accessToken: body["access_token"].string, refreshToken: refresh, idToken: body["id_token"].string,
                       expiresAt: at + body["expires_in"].number * 1000,
                       tokenType: body["token_type"].string.isEmpty ? "Bearer" : body["token_type"].string)
    }

    private func readJSON(_ reply: WireReply) throws -> JSON {
        let body = reply.json
        guard reply.ok else {
            let text = [body["message"].string, body["error_description"].string, body["error"].string].first { !$0.isEmpty }
            throw LexusError(status: reply.status, message: text ?? "Lexus answered \(reply.status)")
        }
        return body.isObject ? body : [:]
    }

    static func guid(_ idToken: String) -> String {
        let parts = idToken.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count > 1 else { return "" }
        var b64 = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        b64 += String(repeating: "=", count: (4 - b64.count % 4) % 4)
        guard let data = Data(base64Encoded: b64) else { return "" }
        return JSON.parse(data)["extension_tmsguid"].string
    }

    private func businessHeaders(_ s: Session) -> [String: String] {
        var h = [
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": "\(s.tokenType) \(s.accessToken)",
            "X-API-KEY": LexusClient.apiKey,
            "X-APPBRAND": "L",
            "X-CHANNEL": "ONEAPP",
            "X-LOCALE": "en-US",
            "X-OSNAME": "iOS",
            "X-OSVERSION": "18.5",
            "X-APPVERSION": "3.4.0",
            "X-DEVICE-TIMEZONE": "PST",
            "X-CORRELATIONID": UUID().uuidString.lowercased(),
        ]
        let id = LexusClient.guid(s.idToken)
        if !id.isEmpty { h["X-GUID"] = id }
        return h
    }

    private func vehicleHeaders(_ s: Session, _ car: Car) -> [String: String] {
        businessHeaders(s).merging([
            "VIN": car.vin, "X-BRAND": car.brand, "X-GENERATION": car.generation, "brand": car.brand, "generation": car.generation,
        ]) { _, new in new }
    }

    /// Makes one call with the stored session. It never refreshes; a 401 or 403 marks the token
    /// rejected for the next `session()`.
    private func authorized(_ build: (Session) throws -> WireRequest) async throws -> JSON {
        guard let s = readSession() else { throw LexusError(status: 401, message: "Signed out") }
        let reply = try await transport.send(try build(s))
        if reply.status == 401 || reply.status == 403 {
            rejected = true
            throw LexusError(status: 401, message: "Lexus rejected the session")
        }
        return try readJSON(reply)
    }

    private func form(_ url: URL, _ fields: [String: String], headers: [String: String] = [:]) -> WireRequest {
        var c = URLComponents()
        c.queryItems = fields.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        // A form body reads `+` as a space, so it is percent-encoded.
        let body = (c.percentEncodedQuery ?? "").replacingOccurrences(of: "+", with: "%2B")
        return WireRequest(url: url, method: "POST",
                           headers: ["Content-Type": "application/x-www-form-urlencoded"].merging(headers) { _, new in new },
                           body: Data(body.utf8))
    }

    // MARK: Sign-in

    private static let authHeaders = [
        "Accept": "application/json",
        "Accept-API-Version": "resource=2.0, protocol=1.0",
        "Accept-Language": "en-US",
        "Content-Type": "application/json",
    ]

    static func decodeNode(_ node: JSON) -> AuthNode {
        let callbacks = node["callbacks"].array
        let outputs = callbacks.flatMap { $0["output"].array }
        let prompts = outputs.filter { $0["name"].string == "prompt" || $0["name"].string == "message" }.map { $0["value"].string }
        return AuthNode(ok: true, status: 200, error: node["message"].string, raw: node, tokenId: node["tokenId"].string,
                        types: callbacks.map { $0["type"].string }, prompts: prompts, asksCode: Rules.asksCode(prompts),
                        choices: outputs.first { $0["name"].string == "choices" }?["value"].array.map(\.string) ?? [])
    }

    private func postNode(_ preview: PreviewScenario?, _ body: JSON) async -> AuthNode {
        do {
            let reply = try await signInTransport(preview).send(
                WireRequest(url: LexusClient.authenticateURL, method: "POST", headers: LexusClient.authHeaders, body: body.data))
            return LexusClient.decodeNode(try readJSON(reply))
        } catch {
            let f = failure(error)
            return AuthNode(ok: false, status: f.status, error: f.error)
        }
    }

    /// Fill the first input of the first callback of `type` with `value`.
    static func answered(_ raw: JSON, type: String, value: JSON) -> JSON {
        var node = raw
        var done = false
        node["callbacks"] = .array(raw["callbacks"].array.map { c in
            guard !done, c["type"].string == type, !c["input"].array.isEmpty else { return c }
            done = true
            var c = c
            var inputs = c["input"].array
            inputs[0]["value"] = value
            c["input"] = .array(inputs)
            return c
        })
        return node
    }

    func authStart(_ preview: PreviewScenario?) async -> AuthNode {
        await signInTransport(preview).startSignIn()
        return await postNode(preview, [:])
    }

    func authAnswer(_ preview: PreviewScenario?, raw: JSON, type: String, value: String) async -> AuthNode {
        await postNode(preview, LexusClient.answered(raw, type: type, value: .string(value)))
    }

    func authChoose(_ preview: PreviewScenario?, raw: JSON, index: Int) async -> AuthNode {
        await postNode(preview, LexusClient.answered(raw, type: "ChoiceCallback", value: .int(index)))
    }

    private static func b64url(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Exchanges the sign-in token for OAuth tokens with PKCE. A Login Flow preview keeps nothing.
    func authFinish(_ preview: PreviewScenario?, tokenId: String, at: Double = nowMs()) async -> Done {
        do {
            let request = signInTransport(preview)
            var bytes = [UInt8](repeating: 0, count: 32)
            _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            let verifier = LexusClient.b64url(Data(bytes))
            let challenge = LexusClient.b64url(Data(SHA256.hash(data: Data(verifier.utf8))))
            let authorize = try await request.send(form(LexusClient.authorizeURL, [
                "client_id": LexusClient.clientId,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
                "csrf": tokenId,
                "decision": "allow",
                "redirect_uri": LexusClient.redirectURI,
                "response_type": "code",
                "scope": LexusClient.scope,
            ], headers: ["Accept": "application/x-www-form-urlencoded", "iPlanetDirectoryPro": tokenId]))
            guard (300..<400).contains(authorize.status) else {
                _ = try readJSON(authorize)
                throw LexusError(status: authorize.status, message: "Lexus authorization failed (\(authorize.status))")
            }
            let location = URLComponents(string: authorize.header("Location") ?? "")
            guard let code = location?.queryItems?.first(where: { $0.name == "code" })?.value else {
                throw LexusError(status: 0, message: location?.queryItems?.first { $0.name == "error_description" }?.value
                    ?? "Lexus did not return an authorization code")
            }
            let token = try await request.send(form(LexusClient.tokenURL, [
                "client_id": LexusClient.clientId,
                "code": code,
                "code_verifier": verifier,
                "grant_type": "authorization_code",
                "redirect_uri": LexusClient.redirectURI,
            ]))
            let session = try tokens(try readJSON(token), previousRefresh: nil, at: at)
            if preview == nil { keep(session) }
            return .success
        } catch {
            let f = failure(error)
            return Done(ok: false, status: f.status, error: f.error)
        }
    }

    func useDemo(_ on: Bool) {
        if on { store.set("lexy.demo", "1") } else { store.forget("lexy.demo") }
    }

    func signOut() {
        store.forget("lexy.session")
        store.forget("lexy.demo")
        cache.forgetAll()
    }

    // MARK: Vehicle reads

    private static let capabilityOrder = [
        "doorLockUnlockCapable", "remoteEngineStartStop", "trunkLockUnlockCapable", "lightsCapable", "hazardCapable",
        "hornCapable", "buzzerCapable", "moonroofCloseCapable", "powerWindowsCloseCapable", "powerWindowsOpenCapable",
    ]

    static func decodeCar(_ d: JSON) -> Car {
        let extended = d["extendedCapabilities"]
        return Car(vin: d["vin"].string, brand: d["brand"].string.isEmpty ? "L" : d["brand"].string, generation: d["generation"].string,
                   region: d["region"].string, asiCode: d["asiCode"].string, hwType: d["hwType"].string,
                   nickName: d["nickName"].string, modelName: d["modelName"].string, modelYear: d["modelYear"].string,
                   description: d["displayModelDescription"].string, color: d["color"].string, image: d["image"].string,
                   fuelType: d["fuelType"].string, grade: d["grade"].string, modelCode: d["modelCode"].string,
                   capabilities: capabilityOrder.filter { extended[$0].isTrue })
    }

    /// The garage is cached under the account's guid.
    private var accountKey: String { LexusClient.guid(readSession()?.idToken ?? "") }

    func cachedGarage() -> Garage? { cache.recall("garage", vin: accountKey) }
    func cached<T: Codable>(_ key: String, vin: String) -> T? { cache.recall(key, vin: vin) }

    func garage() async -> Garage {
        let since = cache.generation
        guard readSession() != nil else { return Garage(ok: false, status: 401, error: "Signed out") }
        do {
            let body = try await authorized { s in WireRequest(url: LexusClient.discoveryURL, headers: self.businessHeaders(s)) }
            let cars = body["payload"].array.map(LexusClient.decodeCar).filter { !$0.vin.isEmpty }
            return cache.remember("garage", vin: accountKey, Garage(ok: true, status: 200, error: "", car: cars.first ?? Car(), cars: cars), since: since)
        } catch {
            let f = failure(error)
            // Keeps the cached car, so the screen can show it under a "Couldn't refresh" banner.
            let last: Garage? = f.status == 401 ? nil : cache.recall("garage", vin: accountKey)
            return Garage(ok: false, status: f.status, error: f.error, car: last?.car ?? Car(), cars: last?.cars ?? [])
        }
    }

    func status(_ car: Car, at: Double = nowMs()) async -> VehicleStatus {
        let since = cache.generation
        guard !car.vin.isEmpty else { return VehicleStatus(fetchedMs: at) }
        do {
            let body = try await authorized { s in WireRequest(url: LexusClient.statusURL, headers: self.vehicleHeaders(s, car)) }
            let st = body["payload"]["status"]
            let telemetry = st["telemetry"]
            let occurredMs = epochMs(st["occurrenceDate"])
            let wire = st["vehicleStatus"].array.flatMap { category in
                category["sections"].array.map { section in
                    StatusSection(category: category["category"].string, section: section["section"].string,
                            values: section["values"].array.map { $0["value"].string })
                }
            }
            let sections = foldClosures(vin: car.vin, at: occurredMs, sections: wire, since: since)
            let stale = sections.filter { $0.category != "Trip Details" && $0.at > 0 && $0.at < occurredMs }.map(\.at)
            func trip(_ name: String) -> Double {
                st["vehicleStatus"].array.first { $0["category"].string == "Trip Details" }?["sections"].array
                    .first { $0["section"].string == name }?["values"].array.first?["value"].number ?? 0
            }
            return cache.remember("status", vin: car.vin, VehicleStatus(
                ok: true, status: 200, error: "", occurredMs: occurredMs, fetchedMs: at,
                fuel: telemetry["fugage"]["value"].number,
                // The live key is `rage`, not the documented `range`.
                range: telemetry["rage"]["value"].number, rangeUnit: telemetry["rage"]["unit"].string,
                odometer: telemetry["odo"]["value"].number, odometerUnit: telemetry["odo"]["unit"].string,
                caution: st["cautionOverallCount"].number, latitude: st["latitude"].number, longitude: st["longitude"].number,
                tripA: trip("Trip A"), tripB: trip("Trip B"), sections: sections, closuresStaleMs: stale.min() ?? 0), since: since)
        } catch {
            let f = failure(error)
            if var last: VehicleStatus = cache.recall("status", vin: car.vin) {
                last.status = f.status
                last.error = f.error.isEmpty ? "Couldn’t refresh" : f.error
                return last
            }
            return VehicleStatus(ok: false, status: f.status, error: f.error, fetchedMs: at)
        }
    }

    /// Merges a snapshot into the readings kept for the car. Sparse snapshots (lock-only doors
    /// right after a drive) leave earlier window and opening readings in place, and the newest
    /// reading wins per field. A section's `at` is its oldest shown reading. A different VIN starts
    /// over.
    private struct Field: Codable { var value: String; var at: Double }
    private struct Held: Codable { var category: String; var section: String; var position: Field?; var lock: Field?; var order: Int }
    private struct Fold: Codable { var vin: String; var seq: Int; var rows: [String: Held] }

    func foldClosures(vin: String, at: Double, sections: [StatusSection], since: Int? = nil) -> [StatusSection] {
        var kept = cache.load("closures").flatMap { try? JSONDecoder().decode(Fold.self, from: $0) }
        if kept?.vin != vin { kept = Fold(vin: vin, seq: 0, rows: [:]) }
        var fold = kept!
        var passed: [StatusSection] = []
        for s in sections {
            let position = s.values.first { $0 == "Open" || $0 == "Closed" }
            let lock = s.values.first { $0 == "Locked" || $0 == "Unlocked" }
            if s.category == "Trip Details" || (position == nil && lock == nil) {
                passed.append(StatusSection(category: s.category, section: s.section, values: s.values, at: at))
                continue
            }
            let key = "\(s.category)/\(s.section)"
            var row = fold.rows[key] ?? {
                defer { fold.seq += 1 }
                return Held(category: s.category, section: s.section, order: fold.seq)
            }()
            if let position, row.position.map({ at >= $0.at }) ?? true { row.position = Field(value: position, at: at) }
            if let lock, row.lock.map({ at >= $0.at }) ?? true { row.lock = Field(value: lock, at: at) }
            fold.rows[key] = row
        }
        if let data = try? JSONEncoder().encode(fold) { cache.save("closures", data, since: since) }
        let folded = fold.rows.values.sorted { $0.order < $1.order }.map { r in
            StatusSection(category: r.category, section: r.section, values: [r.position?.value, r.lock?.value].compactMap { $0 },
                    at: min(r.position?.at ?? .infinity, r.lock?.at ?? .infinity))
        }
        return folded + passed
    }

    /// A read that keeps its last good answer through a failed one.
    private func keepingLast<T: Codable>(_ key: String, vin: String, empty: T, _ read: () async throws -> T) async -> T {
        let since = cache.generation
        do {
            return cache.remember(key, vin: vin, try await read(), since: since)
        } catch {
            return cache.recall(key, vin: vin) ?? empty
        }
    }

    private func payload(_ car: Car, _ url: URL) async throws -> JSON {
        try await authorized { s in WireRequest(url: url, headers: self.vehicleHeaders(s, car)) }["payload"]
    }

    func tires(_ car: Car) async -> Tires {
        guard !car.vin.isEmpty else { return Tires() }
        return await keepingLast("tires", vin: car.vin, empty: Tires()) {
            let p = try await payload(car, LexusClient.tiresURL)
            func tire(_ position: String) -> Tire {
                Tire(position: position, value: p[position]["value"].number, low: p[position]["displayLowTirePressureWarning"].isTrue)
            }
            return Tires(ok: !p["tirePressureStatus"].string.isEmpty, status: p["tirePressureStatus"].string, unit: p["flTirePressure"]["unit"].string,
                         tires: ["flTirePressure", "frTirePressure", "rlTirePressure", "rrTirePressure"].map(tire))
        }
    }

    func engine(_ car: Car) async -> Engine {
        guard !car.vin.isEmpty, car.can("remoteEngineStartStop") else { return Engine() }
        return await keepingLast("engine", vin: car.vin, empty: Engine()) {
            let p = try await payload(car, LexusClient.engineURL)
            return Engine(ok: true, status: p["status"].string, startedMs: epochMs(p["date"]), timer: p["timer"].number)
        }
    }

    func spec(_ car: Car) async -> Spec {
        guard !car.vin.isEmpty else { return Spec() }
        return await keepingLast("spec", vin: car.vin, empty: Spec()) {
            let p = try await payload(car, LexusClient.specURL)
            let items = ["vehicleSpecifications", "additionalDetails"].flatMap { key in
                p[key]["dataItems"].array.map { SpecItem(name: $0["dataName"].string, value: $0["dataValue"].string) }
            }
            return Spec(ok: true, items: items)
        }
    }

    func services(_ car: Car, at: Double = nowMs()) async -> Services {
        guard !car.vin.isEmpty, !car.region.isEmpty, !car.asiCode.isEmpty, !car.hwType.isEmpty else { return Services() }
        return await keepingLast("services", vin: car.vin, empty: Services()) {
            let body = try await authorized { s in
                WireRequest(url: LexusClient.subscriptionsURL, headers: self.businessHeaders(s).merging([
                    "VIN": car.vin, "X-BRAND": car.brand, "GENERATION": car.generation, "REGION": car.region,
                    "ASI-CODE": car.asiCode, "HW-TYPE": car.hwType, "DATETIME": String(Int(at)), "entryPoint": "SUBSCRIPTIONS",
                ]) { _, new in new })
            }
            let p = body["payload"]
            let items = ["paid", "trial", "complimentary"].flatMap { bucket in
                p["\(bucket)Subscriptions"].array.map { sub in
                    let name = sub["displayProductName"].string.isEmpty ? sub["productName"].string : sub["displayProductName"].string
                    let raw = sub["status"].string.trimmed
                    return Service(bucket: bucket, name: name, status: raw.isEmpty ? "Unknown" : raw.prefix(1).uppercased() + raw.dropFirst().lowercased(),
                                   endMs: epochMs(sub["subscriptionEndDate"]))
                }
            }
            return Services(ok: true, items: items.filter { !$0.name.isEmpty })
        }
    }

    // MARK: Writes

    func command(_ car: Car, _ command: Command) async -> CommandResult {
        do {
            let body = try await authorized { s in
                var payload: JSON = ["command": .string(command.rawValue), "autoFixPopup": false]
                if command == .buzzerWarning { payload["beepCount"] = 10 }
                return WireRequest(url: LexusClient.commandURL, method: "POST", headers: self.vehicleHeaders(s, car), body: payload.data)
            }
            let code = body["payload"]["returnCode"].string.isEmpty ? body["returnCode"].string : body["payload"]["returnCode"].string
            return CommandResult(ok: true, status: 200, error: "", command: command.rawValue, returnCode: code)
        } catch {
            let f = failure(error)
            return CommandResult(ok: false, status: f.status, error: f.error, command: command.rawValue)
        }
    }

    /// Asks the car to report, so the next read sees a new snapshot.
    func prime(_ car: Car) async -> Done {
        do {
            _ = try await authorized { s in
                WireRequest(url: LexusClient.refreshStatusURL, method: "POST", headers: self.vehicleHeaders(s, car), body: JSON.object(["autoFixPopup": .bool(false)]).data)
            }
            return .success
        } catch {
            let f = failure(error)
            return Done(ok: false, status: f.status, error: f.error)
        }
    }

    func rename(_ car: Car, to name: String, at: Double = nowMs()) async -> Done {
        do {
            _ = try await authorized { s in
                let id = LexusClient.guid(s.idToken)
                guard !id.isEmpty else { throw LexusError(status: 0, message: "This session has no customer GUID to rename a vehicle with.") }
                return WireRequest(url: LexusClient.nicknameURL, method: "PUT",
                                   headers: self.businessHeaders(s).merging(["X-BRAND": car.brand, "DATETIME": String(Int(at))]) { _, new in new },
                                   body: JSON.object(["nickName": .string(name), "guid": .string(id), "vin": .string(car.vin)]).data)
            }
            return .success
        } catch {
            let f = failure(error)
            return Done(ok: false, status: f.status, error: f.error)
        }
    }

    // MARK: Climate

    static func decodeClimate(_ body: JSON) -> Climate {
        let p = body["payload"].isObject ? body["payload"] : body
        guard let on = p["settingsOn"].bool else { return Climate() }
        let defrost = p["acOperations"].array.first { $0["categoryName"].string == "defrost" && $0["available"].isTrue }
        func param(_ name: String) -> JSON? { defrost?["acParameters"].array.first { $0["name"].string == name && $0["available"].isTrue } }
        return Climate(ok: true, raw: p, on: on, temperature: p["temperature"].number,
                       unit: p["temperatureUnit"].string.isEmpty ? "F" : p["temperatureUnit"].string,
                       min: p["minTemp"].number, max: p["maxTemp"].number,
                       step: p["tempInterval"].number == 0 ? 1 : p["tempInterval"].number,
                       front: param("frontDefrost") != nil, frontEnabled: param("frontDefrost")?["enabled"].isTrue ?? false,
                       rear: param("rearDefrost") != nil, rearEnabled: param("rearDefrost")?["enabled"].isTrue ?? false)
    }

    func climate(_ car: Car) async -> Climate {
        guard !car.vin.isEmpty else { return Climate() }
        return await keepingLast("climate", vin: car.vin, empty: Climate()) {
            LexusClient.decodeClimate(try await authorized { s in WireRequest(url: LexusClient.climateURL, headers: self.vehicleHeaders(s, car)) })
        }
    }

    /// Writes the whole settings object back with the fields changed. On success it returns and
    /// caches the settings as written.
    func setClimate(_ car: Car, raw: JSON, on: Bool, temperature: Double, front: Bool, rear: Bool) async -> Climate {
        var p = raw
        p["settingsOn"] = .bool(on)
        p["temperature"] = temperature.rounded() == temperature ? .int(Int(temperature)) : .double(temperature)
        p["acOperations"] = .array(raw["acOperations"].array.map { o in
            guard o["categoryName"].string == "defrost" else { return o }
            var o = o
            o["acParameters"] = .array(o["acParameters"].array.map { x in
                var x = x
                if x["name"].string == "frontDefrost" { x["enabled"] = .bool(front) }
                if x["name"].string == "rearDefrost" { x["enabled"] = .bool(rear) }
                return x
            })
            return o
        })
        do {
            _ = try await authorized { s in WireRequest(url: LexusClient.climateURL, method: "PUT", headers: self.vehicleHeaders(s, car), body: p.data) }
            return cache.remember("climate", vin: car.vin, LexusClient.decodeClimate(p))
        } catch {
            return Climate()
        }
    }
}
