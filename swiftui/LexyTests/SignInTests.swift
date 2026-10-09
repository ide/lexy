import Foundation
import Testing
@testable import Lexy

@Suite struct SignInTests {
    private func machine(_ scenario: PreviewScenario) -> SignInMachine {
        let m = SignInMachine(client: LexusClient(store: MemoryStore(), cache: temporaryCache()), scenario: scenario)
        m.email = "driver@example.com"
        m.password = "secret"
        return m
    }

    @Test func twoMethodsThenACode() async {
        let m = machine(.successMulti)
        await m.signIn()
        #expect(m.step == .choice)
        #expect(m.choices == ["Email", "Text message"])
        #expect(m.error.isEmpty)
        await m.choose(1)
        #expect(m.step == .otp)
        #expect(m.method == "Text message")
        #expect(Rules.heroTitle(step: m.step.rawValue, method: m.method) == "Check Your Messages")
        m.code = "123456"
        await m.verify()
        #expect(m.done)
        #expect(m.step == .credentials)
    }

    @Test func resendPicksTheSameMethodAgain() async {
        let m = machine(.successMulti)
        await m.signIn()
        await m.choose(0)
        await m.resend()
        #expect(m.step == .otp)
        #expect(m.info == "Lexus sent a new code.")
        #expect(m.error.isEmpty)
    }

    @Test func aDifferentMethodAsksAgain() async {
        let m = machine(.successMulti)
        await m.signIn()
        await m.choose(0)
        await m.differentMethod()
        #expect(m.step == .choice)
    }

    @Test func oneMethodSkipsTheChoice() async {
        let m = machine(.successSingle)
        await m.signIn()
        #expect(m.step == .otp)
    }

    @Test func aWrongPassword() async {
        let m = machine(.wrongPassword)
        await m.signIn()
        #expect(m.step == .credentials)
        #expect(m.error == Rules.rejectedText(.credentials))
    }

    @Test func aWrongCode() async {
        let m = machine(.wrongCode)
        await m.signIn()
        await m.choose(0)
        m.code = "111111"
        await m.verify()
        #expect(m.step == .otp)
        #expect(m.error == Rules.rejectedText(.otp))
        #expect(!m.done)
    }

    @Test func offline() async {
        let m = machine(.networkError)
        await m.signIn()
        #expect(m.error.hasPrefix("Couldn't reach Lexus."))
    }

    @Test func emptyFieldsAskForThem() async {
        let m = machine(.successMulti)
        m.password = ""
        await m.signIn()
        #expect(m.error == "Enter your email and password.")
    }

    @Test func aPreviewKeepsNoSession() async {
        let store = MemoryStore()
        let m = SignInMachine(client: LexusClient(store: store, cache: temporaryCache()), scenario: .successSingle)
        m.email = "a@b.c"
        m.password = "p"
        await m.signIn()
        m.code = "1"
        await m.verify()
        #expect(m.done)
        #expect(store.get("lexy.session") == nil)
    }

    @Test func theDemoSignsStraightIn() async {
        let store = MemoryStore()
        let client = LexusClient(store: store, cache: temporaryCache())
        let m = SignInMachine(client: client)
        var signedIn = false
        m.onSignedIn = { signedIn = true }
        await m.tryDemo()
        #expect(signedIn)
        #expect(client.isDemo)
        #expect(client.readSession()?.accessToken == "demo-access")
        #expect(m.password.isEmpty)
    }
}
