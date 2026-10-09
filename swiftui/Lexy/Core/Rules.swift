import Foundation

/// Pure rules for what the app shows and decides.
nonisolated enum Rules {
    // MARK: Sign-in

    enum Step: String, Sendable { case complete, username, password, otp, choice }

    static func stepOf(_ node: AuthNode) -> Step {
        if !node.tokenId.isEmpty { return .complete }
        if node.types.contains("NameCallback") { return .username }
        if node.asksCode { return .otp }
        if node.types.contains("PasswordCallback") { return .password }
        if node.types.contains("TextInputCallback") { return .otp }
        return .choice
    }

    static func otpCallback(_ types: [String]) -> String {
        types.contains("TextInputCallback") ? "TextInputCallback" : "PasswordCallback"
    }

    /// Case-insensitive: ForgeRock's OTP prompt is "One Time Password".
    static func asksCode(_ prompts: [String]) -> Bool {
        let text = prompts.joined(separator: " ")
        return text.range(of: #"(\botp\b|one[ -]?time password|verification code)"#,
                          options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// What happened, why, and what to do next, by the stage that failed.
    enum Stage: String, Sendable { case credentials, choice, otp, resend }

    static func retryAction(_ stage: Stage) -> String {
        switch stage {
        case .choice: "choose your verification method again"
        case .otp: "tap Verify again"
        case .resend: "request a code again"
        case .credentials: "tap Sign In again"
        }
    }

    static func rejectedText(_ stage: Stage) -> String {
        switch stage {
        case .otp: "Lexus didn't accept that verification code. It may be mistyped, expired, or already used, since codes work once and only for a few minutes. Tap Resend Code and enter the fresh code right away."
        case .choice: "Lexus couldn't send a code by that method. The contact info on your account may be out of date. Try another method, or update your details in the Lexus app."
        case .resend: "Lexus refused to send another code, usually because too many were requested in a row. Wait a few minutes and request a code again."
        case .credentials: "Lexus didn't accept that email and password. One of them is likely mistyped (passwords are case-sensitive), or the account is locked after too many attempts. Check both fields and try again, or reset your password in the Lexus app."
        }
    }

    static func signInError(_ stage: Stage, status: Int, error: String) -> String {
        if status == 0 { return "Couldn't reach Lexus. Your device looks offline, or the connection dropped mid-request. Check Wi-Fi or cellular, then \(retryAction(stage))." }
        if status == 429 { return "Lexus is limiting sign-in attempts after too many recent tries. This clears on its own. Wait a few minutes, then \(retryAction(stage))." }
        if status >= 500 { return "The Lexus sign-in service hit an error on its end, not something you entered. It usually recovers quickly, so wait a moment, then \(retryAction(stage))." }
        if status >= 400 { return rejectedText(stage) }
        return "Something unexpected stopped sign-in\(error.isEmpty ? "" : " (\(error))"). Try again, and restart Lexy if it keeps happening."
    }

    static let unreadableNode = "Lexus sent a response the app couldn't understand, so sign-in couldn't continue. Their service may be having a hiccup. Try again in a moment, and update Lexy if it keeps happening."

    static let sessionEnded = "You've been signed out because Lexus no longer accepts the app's saved session. This happens after a password change, or when Lexus expires it on their end. Sign in again to reconnect your vehicle."

    // MARK: Sign-in copy

    enum Channel { case email, sms, unknown }

    static func channel(_ method: String) -> Channel {
        let m = method
        if m.contains("mail") || m.contains("Mail") || m.contains("E-mail") { return .email }
        for word in ["SMS", "sms", "Text", "text", "hone", "obile", "all"] where m.contains(word) { return .sms }
        return .unknown
    }

    static func heroSymbol(step: String, method: String) -> String {
        switch step {
        case "choice": return "lock.shield.fill"
        case "otp":
            switch channel(method) { case .email: return "envelope.fill"; case .sms: return "message.fill"; case .unknown: return "number" }
        default: return "key.fill"
        }
    }

    static func heroTitle(step: String, method: String) -> String {
        switch step {
        case "choice": return "Verify It's You"
        case "otp":
            switch channel(method) { case .email: return "Check Your Email"; case .sms: return "Check Your Messages"; case .unknown: return "Enter Your Code" }
        default: return "Welcome to Lexy"
        }
    }

    /// The server's prompt is shown only when it reads as prose; the real tree's choice step sends
    /// a message key instead.
    static func heroSubtitle(step: String, method: String, prompt: String) -> String {
        switch step {
        case "choice": return !prompt.isEmpty && prompt.contains(" ") ? prompt : "Choose how you'd like to receive your verification code."
        case "otp":
            switch channel(method) {
            case .email: return "We sent a verification code to your email address."
            case .sms: return "We texted a verification code to your phone."
            case .unknown: return "Enter the verification code you received."
            }
        default: return "Sign in with your Lexus account to see and control your vehicle."
        }
    }

    static func choiceSymbol(_ method: String) -> String {
        switch channel(method) { case .email: "envelope"; case .sms: "message"; case .unknown: "shield.lefthalf.filled" }
    }

    // MARK: Failures

    enum FailureKind { case session, permission, server, client, network, unknown }

    static func failureKind(status: Int, error: String) -> FailureKind {
        if status == 401 && error.contains("expired") { return .session }
        if status == 401 || status == 403 { return .permission }
        if status >= 500 { return .server }
        if status >= 400 { return .client }
        if status == 0 && ["etwork", "offline", "onnection", "nternet", "timed out", "Couldn’t reach"].contains(where: error.contains) { return .network }
        return .unknown
    }

    static func failureSummary(status: Int, error: String) -> String {
        switch failureKind(status: status, error: error) {
        case .permission: "Lexus denied access (a permission problem)."
        case .server: "The Lexus service had a server error."
        case .client: "Lexus rejected the request (a client error)."
        case .network: "The network connection failed."
        case .session: "Your Lexus session expired."
        case .unknown: "Something unexpected went wrong."
        }
    }

    static func failureAdvice(status: Int, error: String) -> String {
        switch failureKind(status: status, error: error) {
        case .permission: "Lexus denied access to your vehicle's data. Try signing out and back in."
        case .server: "The Lexus service ran into a server error. It usually recovers on its own — try again in a bit."
        case .client: "The Lexus service rejected the app's request. Try again, and update the app if it keeps happening."
        case .network: "The network connection failed. Check your connection and try again."
        case .session: "Your Lexus session expired. Please sign in again."
        case .unknown: "Something unexpected went wrong. Please try again."
        }
    }

    static func failureText(status: Int, error: String) -> String {
        if status == 0 { return "Couldn’t reach Lexus. Check your connection and try again." }
        if status >= 500 { return "Lexus is having trouble right now. Try again in a moment." }
        return error.isEmpty ? "Something went wrong (\(status))." : error
    }

    // MARK: Vehicle

    static func vehicleName(nick: String, model: String) -> String {
        !nick.isEmpty ? nick : (!model.isEmpty ? model : "My Vehicle")
    }

    static func fuelName(_ code: String) -> String {
        switch code {
        case "G", "": "Gasoline"
        case "H": "Hybrid"
        case "E": "Electric"
        case "P", "L": "Plug-in Hybrid"
        case "F": "Fuel Cell"
        default: code
        }
    }

    static func headUnit(_ generation: String) -> String {
        switch generation {
        case "21MM": "Lexus Multimedia (21MM)"
        case "24MM": "Lexus Interface (24MM)"
        default: generation
        }
    }

    /// An extra control's name in the More controls subtitle.
    static func extraName(_ flag: String) -> String? {
        switch flag {
        case "trunkLockUnlockCapable": "trunk"
        case "lightsCapable": "headlights"
        case "hazardCapable": "hazards"
        case "hornCapable": "horn"
        case "buzzerCapable": "buzzer"
        default: nil
        }
    }

    /// "Trunk, headlights, hazards, horn, and buzzer".
    static func extrasText(_ capabilities: [String]) -> String {
        let extras = capabilities.compactMap(extraName)
        guard let last = extras.last else { return "" }
        if extras.count == 1 { return last.capitalizedFirst }
        let head = extras.dropLast().enumerated().map { $0.offset == 0 ? $0.element.capitalizedFirst : $0.element }
        return "\(head.joined(separator: ", "))\(extras.count > 2 ? "," : "") and \(last)"
    }

    // MARK: Closures

    static func isCorner(_ s: StatusSection) -> Bool {
        s.category != "Other" && s.category != "Trip Details" && (s.section.contains("Door") || s.section.contains("Window"))
    }
    static func isRear(_ s: StatusSection) -> Bool { s.section.contains("Rear") }
    static func isPassenger(_ s: StatusSection) -> Bool { s.category.contains("Passenger") }
    static func cornerOf(_ s: StatusSection) -> String { "\(isRear(s) ? "rear" : "front")-\(isPassenger(s) ? "passenger" : "driver")" }
    static func isDoor(_ s: StatusSection) -> Bool { s.section.contains("Door") }
    static func closureName(_ s: StatusSection) -> String {
        isCorner(s) ? "\(isRear(s) ? "Rear" : "Front") \(isPassenger(s) ? "passenger" : "driver") \(isDoor(s) ? "door" : "window")" : s.section
    }
    /// An opening's name inside a sentence ("Windows and trunk closed").
    static func lowerName(_ name: String) -> String {
        if name.contains("Moon") { return "moonroof" }
        if name.contains("Trunk") { return "trunk" }
        if name.contains("Hood") { return "hood" }
        if name.contains("Hatch") { return "hatch" }
        return name
    }
    static func isOpen(_ s: StatusSection) -> Bool { s.values.contains("Open") }
    static func isUnlocked(_ s: StatusSection) -> Bool { s.values.contains("Unlocked") }
    static func isLocked(_ s: StatusSection) -> Bool { s.values.contains("Locked") }
    /// A section says something when it reports a position, a lock, or both.
    static func reports(_ s: StatusSection) -> Bool {
        s.values.contains { ["Open", "Closed", "Locked", "Unlocked"].contains($0) }
    }

    /// The doors' lock as a whole: unlocked if any door is, locked if any reports locked, unknown
    /// before any door has reported.
    static func doorLock(_ sections: [StatusSection]) -> String {
        let doors = sections.filter { $0.category != "Other" && $0.category != "Trip Details" && $0.section.contains("Door") }
        if doors.contains(where: isUnlocked) { return "unlocked" }
        if doors.contains(where: isLocked) { return "locked" }
        return "unknown"
    }

    // MARK: Formatting

    /// "12,482".
    static func grouped(_ n: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: (n + 0.5).rounded(.down))) ?? "\(Int(n))"
    }

    /// At most one decimal: "1,272.1", "980".
    static func tenths(_ n: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 1
        f.minimumFractionDigits = 0
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: (n * 10 + 0.5).rounded(.down) / 10)) ?? "\(n)"
    }

    static func distanceUnit(_ wire: String) -> String {
        wire.contains("K") || wire.contains("k") ? "km" : "mi"
    }

    static func plural(_ n: Int, _ unit: String) -> String { n == 1 ? "1 \(unit)" : "\(n) \(unit)s" }

    /// "just now", "40 seconds ago", "5 minutes ago", "2 hours 5 minutes ago", "3 days 4 hours
    /// ago".
    static func relative(now: Double, then: Double) -> String {
        guard then > 0 else { return "unknown" }
        let d = now - then
        if d < 5_000 { return "just now" }
        if d < 60_000 { return "\(plural(Int(d / 1000), "second")) ago" }
        if d < 3_600_000 { return "\(plural(Int(d / 60_000), "minute")) ago" }
        let minutes = Int(d / 60_000), hours = Int(d / 3_600_000)
        if d < 86_400_000 {
            return minutes % 60 == 0 ? "\(plural(hours, "hour")) ago" : "\(plural(hours, "hour")) \(plural(minutes % 60, "minute")) ago"
        }
        let days = Int(d / 86_400_000)
        return hours % 24 == 0 ? "\(plural(days, "day")) ago" : "\(plural(days, "day")) \(plural(hours % 24, "hour")) ago"
    }

    /// "Thu, Oct 1, 2026 at 9:41:07 PM".
    static func absoluteTime(_ ms: Double) -> String {
        guard ms > 0 else { return "Unknown time" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.setLocalizedDateFormatFromTemplate("EEE MMM d yyyy h:mm:ss a")
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    /// "April 2028", in UTC so a date-only value keeps its own month.
    static func monthYear(_ ms: Double) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "MMMM yyyy"
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    static func tireLabel(_ position: String) -> String {
        switch position {
        case "flTirePressure": "Front left"
        case "frTirePressure": "Front right"
        case "rlTirePressure": "Rear left"
        default: "Rear right"
        }
    }

    // MARK: Fuel

    enum FuelLevel { case high, medium, low, empty }
    static func fuelLevel(_ p: Double) -> FuelLevel {
        p > 25 ? .high : (p > 15 ? .medium : (p > 5 ? .low : .empty))
    }

    // MARK: Maps

    static func mapsCount(_ m: MapsApps) -> Int { (m.apple ? 1 : 0) + (m.google ? 1 : 0) + (m.waze ? 1 : 0) }

    /// The app Open in uses without asking: the saved one, else the only one installed (not saved,
    /// so installing another asks again); empty to ask.
    static func mapsResolved(_ m: MapsApps) -> String {
        if !m.provider.isEmpty { return m.provider }
        guard mapsCount(m) == 1 else { return "" }
        return m.apple ? "apple" : (m.google ? "google" : "waze")
    }

    static func mapsName(_ provider: String) -> String {
        switch provider {
        case "google": "Google Maps"
        case "waze": "Waze"
        case "apple": "Apple Maps"
        default: "Maps"
        }
    }

    // MARK: Developer Tools

    static let dataStates = ["live", "loading", "offline-cached", "offline-empty", "error-cached", "error-empty", "no-vehicle"]

    static func dataStateTitle(_ kind: String) -> String {
        switch kind {
        case "live": "Live"
        case "loading": "Loading skeleton"
        case "offline-cached": "Offline — cached data"
        case "offline-empty": "Offline — no cache"
        case "error-cached": "Fetch error — cached data"
        case "error-empty": "Fetch error — no cache"
        default: "No vehicle on account"
        }
    }

    static func dataStateDetail(_ kind: String) -> String {
        switch kind {
        case "live": "Use the real Lexus data — no override."
        case "loading": "Hold the first-load skeleton."
        case "offline-cached": "Show the last-seen dashboard behind the offline banner."
        case "offline-empty": "Offline before anything was ever loaded."
        case "error-cached": "Show the last-seen dashboard behind the refresh-failed banner."
        case "error-empty": "Force the full-screen “Vehicle data unavailable” error."
        default: "Force the “No vehicle found” empty state."
        }
    }

    static func scenarioTitle(_ id: PreviewScenario) -> String {
        switch id {
        case .successMulti: "Success · Email or SMS"
        case .successSingle: "Success · Single Method"
        case .wrongPassword: "Error · Wrong Password"
        case .wrongCode: "Error · Invalid Code"
        case .networkError: "Error · Network Failure"
        }
    }

    static func scenarioDetail(_ id: PreviewScenario) -> String {
        switch id {
        case .successMulti: "Two verification methods offered — the full happy path."
        case .successSingle: "One method only — the flow skips the picker straight to the code."
        case .wrongPassword: "Lexus rejects the credentials."
        case .wrongCode: "Lexus rejects the verification code."
        case .networkError: "Requests never reach Lexus."
        }
    }

    static func scenarioSymbol(_ id: PreviewScenario) -> String {
        switch id {
        case .successMulti: "checkmark.seal.fill"
        case .successSingle: "checkmark.seal"
        case .wrongPassword: "xmark.octagon.fill"
        case .wrongCode: "xmark.octagon"
        case .networkError: "wifi.slash"
        }
    }
}

nonisolated extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
