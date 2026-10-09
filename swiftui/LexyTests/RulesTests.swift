import Foundation
import Testing
@testable import Lexy

@Suite struct RulesTests {
    @Test func classifiesForgeRockSteps() {
        #expect(Rules.stepOf(AuthNode(tokenId: "t")) == .complete)
        #expect(Rules.stepOf(AuthNode(types: ["NameCallback"])) == .username)
        #expect(Rules.stepOf(AuthNode(types: ["PasswordCallback"])) == .password)
        // ForgeRock's OTP node uses a PasswordCallback whose prompt asks for
        // the code.
        #expect(Rules.stepOf(AuthNode(types: ["PasswordCallback"], asksCode: true)) == .otp)
        #expect(Rules.stepOf(AuthNode(types: ["TextInputCallback"])) == .otp)
        #expect(Rules.stepOf(AuthNode(types: ["ChoiceCallback"])) == .choice)
        #expect(Rules.otpCallback(["TextInputCallback"]) == "TextInputCallback")
        #expect(Rules.otpCallback(["PasswordCallback"]) == "PasswordCallback")
    }

    @Test func asksCodeIgnoresCase() {
        #expect(Rules.asksCode(["One Time Password"]))
        #expect(Rules.asksCode(["Enter your OTP"]))
        #expect(Rules.asksCode(["Enter the VERIFICATION CODE"]))
        #expect(!Rules.asksCode(["Password"]))
        #expect(!Rules.asksCode(["Hotpot"]))
    }

    @Test func signInErrorsSayWhatToDo() {
        #expect(Rules.signInError(.credentials, status: 0, error: "").hasSuffix("then tap Sign In again."))
        #expect(Rules.signInError(.otp, status: 429, error: "").hasSuffix("then tap Verify again."))
        #expect(Rules.signInError(.resend, status: 503, error: "").hasSuffix("then request a code again."))
        #expect(Rules.signInError(.choice, status: 401, error: "").hasPrefix("Lexus couldn't send a code"))
        #expect(Rules.signInError(.credentials, status: 200, error: "boom") == "Something unexpected stopped sign-in (boom). Try again, and restart Lexy if it keeps happening.")
    }

    @Test func failures() {
        #expect(Rules.failureKind(status: 401, error: "Your Lexus session expired.") == .session)
        #expect(Rules.failureKind(status: 403, error: "") == .permission)
        #expect(Rules.failureKind(status: 0, error: "The Internet connection appears to be offline.") == .network)
        #expect(Rules.failureText(status: 0, error: "x") == "Couldn’t reach Lexus. Check your connection and try again.")
        #expect(Rules.failureText(status: 404, error: "") == "Something went wrong (404).")
    }

    @Test func relativeTime() {
        let now = 1_790_900_000_000.0
        #expect(Rules.relative(now: now, then: 0) == "unknown")
        #expect(Rules.relative(now: now, then: now - 2_000) == "just now")
        #expect(Rules.relative(now: now, then: now - 40_000) == "40 seconds ago")
        #expect(Rules.relative(now: now, then: now - 60_000) == "1 minute ago")
        #expect(Rules.relative(now: now, then: now - 2 * 3_600_000) == "2 hours ago")
        #expect(Rules.relative(now: now, then: now - (2 * 60 + 5) * 60_000) == "2 hours 5 minutes ago")
        #expect(Rules.relative(now: now, then: now - (3 * 24 + 4) * 3_600_000) == "3 days 4 hours ago")
    }

    @Test func numbers() {
        #expect(Rules.grouped(12482) == "12,482")
        #expect(Rules.grouped(1_234_567.4) == "1,234,567")
        #expect(Rules.grouped(980) == "980")
        #expect(Rules.tenths(1272.14) == "1,272.1")
        #expect(Rules.tenths(980) == "980")
        #expect(Rules.distanceUnit("Mile") == "mi")
        #expect(Rules.distanceUnit("Km") == "km")
        #expect(Rules.monthYear(epochMs("2028-04-01")) == "April 2028")
    }

    @Test func extraControls() {
        let all = ["doorLockUnlockCapable", "trunkLockUnlockCapable", "lightsCapable", "hazardCapable", "hornCapable", "buzzerCapable"]
        #expect(Rules.extrasText(all) == "Trunk, headlights, hazards, horn, and buzzer")
        #expect(Rules.extrasText(["hornCapable"]) == "Horn")
        #expect(Rules.extrasText(["hornCapable", "buzzerCapable"]) == "Horn and buzzer")
        #expect(Rules.extrasText(["doorLockUnlockCapable"]) == "")
    }

    @Test func mapsResolution() {
        #expect(Rules.mapsResolved(MapsApps(provider: "", apple: true, google: false, waze: false)) == "apple")
        #expect(Rules.mapsResolved(MapsApps(provider: "", apple: true, google: true, waze: false)) == "")
        #expect(Rules.mapsResolved(MapsApps(provider: "waze", apple: true, google: true, waze: true)) == "waze")
        #expect(Rules.mapsResolved(MapsApps(provider: "", apple: false, google: false, waze: false)) == "")
    }

    @Test func signInCopy() {
        #expect(Rules.heroTitle(step: "otp", method: "Email") == "Check Your Email")
        #expect(Rules.heroTitle(step: "otp", method: "Text message") == "Check Your Messages")
        #expect(Rules.heroSubtitle(step: "choice", method: "", prompt: "OTP_VIA_PHONE") == "Choose how you'd like to receive your verification code.")
        #expect(Rules.heroSubtitle(step: "choice", method: "", prompt: "How would you like it?") == "How would you like it?")
    }

    @Test func doorLock() {
        let locked = [StatusSection(category: "Driver Side", section: "Door", values: ["Closed", "Locked"])]
        let mixed = locked + [StatusSection(category: "Passenger Side", section: "Door", values: ["Closed", "Unlocked"])]
        #expect(Rules.doorLock(locked) == "locked")
        #expect(Rules.doorLock(mixed) == "unlocked")
        #expect(Rules.doorLock([StatusSection(category: "Other", section: "Trunk", values: ["Locked"])]) == "unknown")
    }
}

@Suite struct ClosureSummaryTests {
    private func s(_ category: String, _ section: String, _ values: String...) -> StatusSection {
        StatusSection(category: category, section: section, values: values)
    }

    @Test func oneWindowOpen() {
        let sections = [
            s("Driver Side", "Door", "Closed", "Locked"), s("Driver Side", "Window", "Closed"),
            s("Passenger Side", "Door", "Closed", "Locked"), s("Passenger Side", "Window", "Open"),
            s("Other", "Trunk", "Closed"), s("Trip Details", "Trip A", "272.1 miles"),
        ]
        let summary = ClosureSummary(sections: sections, lockPending: false, lockTarget: "")
        #expect(summary.headline == "Front passenger window open")
        #expect(summary.subline == "Everything else closed and locked")
        #expect(summary.symbol == "car.window.left")
        #expect(summary.tint == .orange)
        #expect(summary.rows.count == 5)
    }

    @Test func allSecure() {
        let sections = [s("Driver Side", "Door", "Closed", "Locked"), s("Driver Side", "Window", "Closed"), s("Other", "Moonroof", "Closed")]
        let summary = ClosureSummary(sections: sections, lockPending: false, lockTarget: "")
        #expect(summary.headline == "All secure")
        #expect(summary.subline == "Doors locked · Windows and moonroof closed")
        #expect(summary.symbol == "checkmark.shield.fill")
    }

    @Test func pendingLock() {
        let sections = [s("Driver Side", "Door", "Closed", "Unlocked"), s("Driver Side", "Window", "Closed")]
        let summary = ClosureSummary(sections: sections, lockPending: true, lockTarget: "locked")
        #expect(summary.headline == "Locking…")
        #expect(summary.subline == "Windows closed")
        #expect(summary.tint == .secondary)
    }

    @Test func severalUnlocked() {
        let sections = [s("Driver Side", "Door", "Unlocked"), s("Passenger Side", "Door", "Unlocked")]
        #expect(ClosureSummary(sections: sections, lockPending: false, lockTarget: "").headline == "2 doors unlocked")
    }
}
