import XCTest

/// Drives the app against the demo Lexus.
@MainActor
final class LexyUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-lexy-reset", "-lexy-memory-store"]
        app.launch()
    }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }

    /// Checks `condition` every 0.1 s until it holds or `timeout` passes.
    /// `waitForExistence(timeout:)` checks about once a second.
    private func poll(_ timeout: TimeInterval, _ condition: () -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() {
            if Date() >= deadline { return false }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        return true
    }

    private func waitFor(_ element: XCUIElement, timeout: TimeInterval = 10, file: StaticString = #filePath, line: UInt = #line) {
        let appeared = poll(timeout) { element.exists }
        if !appeared { print("UI TREE:\n\(app.debugDescription)") }
        XCTAssertTrue(appeared, "\(element) never appeared", file: file, line: line)
    }

    private func waitUntil(_ timeout: TimeInterval, _ condition: () -> Bool, _ message: @autoclosure () -> String, file: StaticString = #filePath, line: UInt = #line) {
        if !poll(timeout, condition) { XCTFail(message(), file: file, line: line) }
    }

    private func back(file: StaticString = #filePath, line: UInt = #line) {
        let bar = app.navigationBars.firstMatch
        let button = [bar.buttons["Settings"], bar.buttons["Back"], bar.buttons["BackButton"]].first { $0.exists } ?? bar.buttons.element(boundBy: 0)
        button.tap()
        waitUntil(5, { self.app.navigationBars["Settings"].exists }, "not back in Settings: \(self.app.navigationBars.firstMatch.identifier)", file: file, line: line)
    }

    private func signInToTheDemo() {
        waitFor(element("try-demo"))
        XCTAssertTrue(app.staticTexts["Welcome to Lexy"].exists)
        element("try-demo").tap()
        waitFor(app.navigationBars["Demo Vehicle"], timeout: 15)
    }

    func testTheDemoEndToEnd() {
        signInToTheDemo()

        waitFor(element("fuel-value"))
        XCTAssertTrue(element("fuel-value").label.contains("62%"), element("fuel-value").label)
        XCTAssertTrue(element("fuel-value").label.contains("214 mi"), element("fuel-value").label)
        waitFor(element("lock-state"))
        XCTAssertEqual(element("lock-state").label, "Locked")

        // Unlocking stays pending until the car reports.
        element("command-door-unlock").tap()
        let alert = app.alerts["Unlock your vehicle?"]
        waitFor(alert)
        alert.buttons["Unlock"].firstMatch.tap()
        waitUntil(5, { self.element("lock-state").label == "Unlocking" }, "never said Unlocking")
        waitUntil(15, { self.element("lock-state").label == "Unlocked" }, "never settled on Unlocked: \(element("lock-state").label)")

        app.swipeUp()
        waitFor(element("toggle-closures"))
        XCTAssertTrue(app.staticTexts["4 doors unlocked"].exists || app.staticTexts["5 doors unlocked"].exists || app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'unlocked'")).count > 0)
        element("toggle-closures").tap()
        waitFor(app.staticTexts["Window open"])
        waitFor(element("odometer-value"))
        XCTAssertTrue(element("odometer-value").label.contains("12,482"))
        app.swipeDown()
        app.swipeDown()

        element("last-parked").tap()
        waitFor(app.navigationBars["Last Parked"])
        waitFor(element("open-maps"))
        element("close-map").tap()

        app.tabBars.buttons["Specs"].tap()
        waitFor(element("row-VIN"))
        XCTAssertTrue(element("row-VIN").label.contains("DEMO0000000000000"), element("row-VIN").label)
        waitFor(element("row-Transmission"))
        XCTAssertTrue(element("row-Transmission").label.contains("8-Speed Automatic"))

        app.tabBars.buttons["Settings"].tap()
        waitFor(element("dev-dataState"))
        element("dev-dataState").tap()
        element("data-state-offline-cached").tap()
        app.tabBars.buttons["Status"].tap()
        waitFor(element("offline"))
        app.tabBars.buttons["Settings"].tap()
        element("data-state-live").tap()
        back()

        waitFor(element("edit-name"))
        element("edit-name").tap()
        let field = element("name-input")
        waitFor(field)
        element("clear-name").tap()
        field.typeText("Daily")
        element("save-name").tap()
        waitFor(element("edit-name"), timeout: 10)
        waitUntil(10, { self.element("edit-name").label.contains("Daily") }, "the new name never showed: \(element("edit-name").label)")

        element("dev-login").tap()
        waitFor(element("email"))
        element("email").tap()
        element("email").typeText("someone@example.com")
        element("password").tap()
        element("password").typeText("secret")
        element("sign-in-button").tap()
        waitFor(element("method-0"))
        element("method-0").tap()
        waitFor(element("code"))
        element("code").typeText("123456")
        element("verify-button").tap()
        waitFor(app.staticTexts["You’re Signed In"])
        back()

        element("dev-performance").tap()
        waitFor(element("perf-launch-ttr"))
        back()

        app.swipeUp()
        element("sign-out").tap()
        waitFor(element("try-demo"))
    }

    func testAFailedCommandPutsBackWhatShowed() {
        signInToTheDemo()
        app.tabBars.buttons["Settings"].tap()
        app.swipeUp()
        waitFor(element("demo-failures"))
        element("demo-failures").switches.firstMatch.tap()
        app.tabBars.buttons["Status"].tap()
        waitFor(element("lock-state"))
        XCTAssertEqual(element("lock-state").label, "Locked")
        element("command-door-unlock").tap()
        app.alerts["Unlock your vehicle?"].buttons["Unlock"].firstMatch.tap()
        let failed = app.alerts["Command failed"]
        waitFor(failed, timeout: 10)
        XCTAssertTrue(failed.staticTexts["Lexus is having trouble right now. Try again in a moment."].exists)
        failed.buttons["OK"].firstMatch.tap()
        XCTAssertEqual(element("lock-state").label, "Locked")
    }
}
