import Foundation
import Observation

/// Lexus's ForgeRock sign-in as a step machine. One press walks start → email → password, then
/// lands on the delivery-method choice or the code, as the tree decides. With a `scenario`, it runs
/// Login Flow against a mock tree and never touches the Keychain.
@Observable
final class SignInMachine {
    enum Step: String { case credentials, choice, otp }

    let client: LexusClient
    /// Login Flow's scenario; nil for the real sign-in.
    var scenario: PreviewScenario?

    var step = Step.credentials
    var email = "" { didSet { if email != oldValue { error = "" } } }
    var password = "" { didSet { if password != oldValue { error = "" } } }
    var code = "" { didSet { if code != oldValue { error = ""; info = "" } } }
    var error = ""
    /// Shown when Resend sent a new code.
    var info = ""
    private(set) var busy = false
    /// Resend is in progress.
    private(set) var resending = false
    private(set) var choices: [String] = []
    /// The choice step's prompt from the server.
    private(set) var prompt = ""
    /// Resend picks the last method by its label, since the tree may reorder methods.
    private(set) var lastChoice = -1
    private var lastChoiceLabel = ""
    /// Set when Resend or Use a Different Method restarts the walk, so its errors stay on the code
    /// screen and name that action.
    private var restartStage: Rules.Stage?
    private var raw: JSON = .null
    private var types: [String] = []
    /// A Login Flow preview that ended signed in.
    var done = false

    var onSignedIn: () async -> Void = {}
    var onSubmit: () -> Void = {}
    var onDemoChanged: () async -> Void = {}

    init(client: LexusClient, scenario: PreviewScenario? = nil) {
        self.client = client
        self.scenario = scenario
    }

    /// The method the code was sent by.
    var method: String { lastChoice >= 0 && lastChoice < choices.count ? choices[lastChoice] : "" }

    func reset(keepEmail: Bool = false) {
        step = .credentials
        if !keepEmail { email = "" }
        password = ""
        code = ""
        error = ""
        info = ""
        lastChoice = -1
        done = false
    }

    private func walking(_ body: () async -> Void) async {
        busy = true
        await body()
        busy = false
    }

    func signIn() async {
        guard !busy else { return }
        onSubmit()
        restartStage = nil
        resending = false
        Haptic.light.play()
        guard !email.trimmed.isEmpty, !password.isEmpty else {
            error = "Enter your email and password."
            return
        }
        error = ""
        lastChoice = -1
        await walking {
            // A real sign-in turns demo mode off first; otherwise the credentials would go to the
            // demo.
            if scenario == nil && client.isDemo {
                client.useDemo(false)
                await onDemoChanged()
            }
            await walk()
        }
    }

    /// Signs in to the in-memory Lexus. The demo password goes straight to the tree, never into the
    /// field, so iOS doesn't offer to save it.
    func tryDemo() async {
        guard !busy else { return }
        onSubmit()
        error = ""
        await walking {
            client.useDemo(true)
            await onDemoChanged()
            email = "driver@example.com"
            password = ""
            await walk()
        }
    }

    func resend() async {
        guard !busy else { return }
        Haptic.light.play()
        error = ""
        code = ""
        resending = true
        restartStage = .resend
        await walking { await walk() }
    }

    func differentMethod() async {
        guard !busy else { return }
        Haptic.light.play()
        error = ""
        code = ""
        lastChoice = -1
        restartStage = .choice
        await walking { await walk() }
    }

    func choose(_ index: Int) async {
        guard !busy, index < choices.count else { return }
        Haptic.light.play()
        error = ""
        lastChoice = index
        lastChoiceLabel = choices[index]
        await walking { afterChoice(await client.authChoose(scenario, raw: raw, index: index)) }
    }

    func verify() async {
        guard !busy else { return }
        Haptic.light.play()
        guard !code.trimmed.isEmpty else {
            error = "Enter the code we sent you."
            return
        }
        error = ""
        await walking {
            let n = await client.authAnswer(scenario, raw: raw, type: Rules.otpCallback(types), value: code.trimmed)
            if !n.ok {
                error = Rules.signInError(.otp, status: n.status, error: n.error)
            } else if !n.tokenId.isEmpty {
                await finish(n.tokenId)
            } else {
                // Some trees ask for a second code; it is answered the same way.
                raw = n.raw
                types = n.types
                error = "Enter the new code we sent you."
            }
        }
    }

    // MARK: The walk

    private func failed(_ status: Int, _ message: String, backToStart: Bool = true) {
        error = Rules.signInError(restartStage ?? .credentials, status: status, error: message)
        if backToStart && restartStage == nil { step = .credentials }
        restartStage = nil
        resending = false
    }

    private func walk() async {
        let started = await client.authStart(scenario)
        guard started.ok else { return failed(started.status, started.error) }
        guard Rules.stepOf(started) == .username else {
            error = Rules.unreadableNode
            restartStage = nil
            resending = false
            return
        }
        let named = await client.authAnswer(scenario, raw: started.raw, type: "NameCallback", value: email.trimmed)
        // A tree that answers but doesn't ask for the password rejected the email.
        guard named.ok, Rules.stepOf(named) == .password else {
            return failed(named.ok ? 401 : named.status, named.error, backToStart: false)
        }
        let secret = password.isEmpty && scenario == nil && client.isDemo ? "demo" : password
        // Login Flow clears its made-up password while the mock tree answers, before the field
        // leaves the screen, so iOS doesn't offer to save it. The mock accepts any password,
        // including Resend's empty one.
        if scenario != nil { password = "" }
        await afterPassword(await client.authAnswer(scenario, raw: named.raw, type: "PasswordCallback", value: secret))
    }

    private func afterPassword(_ n: AuthNode) async {
        guard n.ok else { return failed(n.status, n.error) }
        let wasResending = resending
        error = ""
        let next = Rules.stepOf(n)
        // A restart that doesn't land on the choice step is over.
        if next != .choice {
            restartStage = nil
            resending = false
        }
        switch next {
        case .complete:
            await finish(n.tokenId)
        case .otp:
            step = .otp
            raw = n.raw
            types = n.types
            info = wasResending ? "Lexus sent a new code." : ""
        case .choice:
            if n.choices.isEmpty {
                // A choice with no options means there is no such account.
                failed(401, "")
            } else if lastChoice >= 0, let index = n.choices.firstIndex(of: lastChoiceLabel) {
                afterChoice(await client.authChoose(scenario, raw: n.raw, index: index))
            } else {
                resending = false
                restartStage = nil
                step = .choice
                raw = n.raw
                choices = n.choices
                prompt = n.prompts.first ?? ""
            }
        case .username, .password:
            break
        }
    }

    private func afterChoice(_ n: AuthNode) {
        let wasResending = resending
        if n.ok && Rules.stepOf(n) == .otp {
            step = .otp
            raw = n.raw
            types = n.types
            error = ""
            info = wasResending ? "Lexus sent a new code." : ""
        } else {
            error = Rules.signInError(wasResending ? .resend : .choice, status: n.status, error: n.error)
        }
        resending = false
        restartStage = nil
    }

    private func finish(_ tokenId: String) async {
        let f = await client.authFinish(scenario, tokenId: tokenId)
        guard f.ok else {
            error = Rules.signInError(.otp, status: f.status, error: f.error)
            step = .credentials
            return
        }
        step = .credentials
        password = ""
        code = ""
        if scenario != nil {
            // A Login Flow preview ends on its own screen; the app's session is untouched.
            done = true
        } else {
            await onSignedIn()
        }
    }
}
