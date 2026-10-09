import SwiftUI

/// Email and password, then the delivery-method choice and the code when Lexus asks for them. Login
/// Flow shows the same screen with a scenario banner and no demo button.
struct SignInView: View {
    @Bindable var machine: SignInMachine
    /// The machine's error, or why a saved session ended.
    var error: String
    var preview = false
    var tryDemo: (() async -> Void)?

    private enum Field { case email, password, code }
    @FocusState private var focus: Field?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let scenario = machine.scenario, preview {
                    Label("Preview · \(Rules.scenarioTitle(scenario))", systemImage: Rules.scenarioSymbol(scenario))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 12)
                        .frame(height: 30)
                        .background(Color(.secondarySystemGroupedBackground), in: .capsule)
                        .accessibilityIdentifier("preview-banner")
                }
                hero
                switch machine.step {
                case .credentials: credentials
                case .choice: choice.transition(.opacity.combined(with: .offset(y: 8)))
                case .otp: otp.transition(.opacity.combined(with: .offset(y: 8)))
                }
                if !error.isEmpty {
                    Notice(symbol: "exclamationmark.triangle.fill", tint: .orange, message: error, id: "sign-in-error")
                } else if !machine.info.isEmpty {
                    Notice(symbol: "checkmark.circle.fill", tint: .green, message: machine.info, id: "sign-in-info")
                }
                if machine.step == .credentials { newToLexus }
                Text("Your password and verification code go directly to Lexus. Lexy never stores them or collects your information.")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding([.top, .horizontal], 8)
            }
            .padding(.horizontal, 16)
            .padding(.top, preview ? 24 : 64)
            .padding(.bottom, 16)
            .animation(.spring(duration: 0.35), value: machine.step)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color(.systemGroupedBackground))
        .overlay(alignment: .topTrailing) {
            // In the corner, where the keyboard never covers it.
            if let tryDemo, machine.step == .credentials, !preview {
                Button("Try Demo") { Task { await tryDemo() } }
                    .disabled(machine.busy)
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .accessibilityIdentifier("try-demo")
            }
        }
        .onChange(of: machine.step) { _, step in
            if step == .otp { focus = .code }
        }
    }

    private var hero: some View {
        VStack(spacing: 8) {
            if machine.step == .credentials {
                LexyMark(size: 76)
            } else {
                Image(systemName: Rules.heroSymbol(step: machine.step.rawValue, method: machine.method))
                    .font(.system(size: 44))
                    .foregroundStyle(.blue)
                    .padding(.bottom, 4)
            }
            Text(Rules.heroTitle(step: machine.step.rawValue, method: machine.method))
                .font(.title.bold())
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("sign-in-title")
            Text(Rules.heroSubtitle(step: machine.step.rawValue, method: machine.method, prompt: machine.prompt))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
                .accessibilityIdentifier("sign-in-subtitle")
        }
    }

    private var credentials: some View {
        VStack(spacing: 16) {
            VStack(spacing: 0) {
                // Login Flow's made-up credentials get no content type, so iOS doesn't offer to
                // save them.
                TextField("Email", text: $machine.email)
                    .textContentType(preview ? nil : .username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .email)
                    .onSubmit { focus = .password }
                    .padding(16)
                    .accessibilityIdentifier("email")
                Divider().padding(.leading, 16)
                SecureField("Password", text: $machine.password)
                    .textContentType(preview ? nil : .password)
                    .submitLabel(.go)
                    .focused($focus, equals: .password)
                    .onSubmit { Task { await machine.signIn() } }
                    .padding(16)
                    .accessibilityIdentifier("password")
            }
            .disabled(machine.busy)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
            PrimaryButton(label: machine.busy ? "Signing In…" : "Sign In", id: "sign-in-button") { await machine.signIn() }
                .disabled(machine.email.trimmed.isEmpty || machine.password.isEmpty)
        }
    }

    private var choice: some View {
        HStack(spacing: 8) {
            ForEach(Array(machine.choices.enumerated()), id: \.element) { index, method in
                Button {
                    Task { await machine.choose(index) }
                } label: {
                    Label(method, systemImage: Rules.choiceSymbol(method))
                        .font(.headline)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .disabled(machine.busy)
                .accessibilityIdentifier("method-\(index)")
            }
        }
    }

    private var otp: some View {
        VStack(spacing: 16) {
            TextField("Verification Code", text: $machine.code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($focus, equals: .code)
                .onSubmit { Task { await machine.verify() } }
                .disabled(machine.busy)
                .padding(16)
                .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
                .accessibilityIdentifier("code")
            PrimaryButton(label: machine.busy && !machine.resending ? "Verifying…" : "Verify", id: "verify-button") { await machine.verify() }
                .disabled(machine.code.trimmed.isEmpty)
            VStack(spacing: 8) {
                SecondaryButton(label: "Resend Code", id: "resend") { await machine.resend() }
                if machine.choices.count > 1 {
                    SecondaryButton(label: "Use a Different Method", id: "different-method") { await machine.differentMethod() }
                }
            }
            .disabled(machine.busy)
        }
    }

    private var newToLexus: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("New to Lexus?").font(.footnote.weight(.semibold))
            Text("Create an account and add your vehicle in the Lexus app, then come back here to sign in.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button("Get the Lexus App") {
                Haptic.light.play()
                UIApplication.shared.open(URL(string: "https://apps.apple.com/us/app/lexus/id1468484450")!)
            }
            .font(.footnote.weight(.semibold))
            .accessibilityIdentifier("get-lexus-app")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
    }
}

struct PrimaryButton: View {
    let label: String
    let id: String
    let action: () async -> Void

    var body: some View {
        Button { Task { await action() } } label: {
            Text(label).font(.headline).frame(maxWidth: .infinity, minHeight: 34)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.large)
        .accessibilityIdentifier(id)
    }
}

struct SecondaryButton: View {
    let label: String
    let id: String
    let action: () async -> Void

    var body: some View {
        Button { Task { await action() } } label: {
            Text(label).font(.headline).frame(maxWidth: .infinity, minHeight: 34)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .controlSize(.large)
        .accessibilityIdentifier(id)
    }
}

private struct Notice: View {
    let symbol: String
    let tint: Color
    let message: String
    let id: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.title3).foregroundStyle(tint)
            Text(message).font(.footnote.weight(.medium))
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(id)
    }
}
