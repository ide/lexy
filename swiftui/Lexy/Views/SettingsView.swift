import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var choosingMaps = false
    @State private var noMaps = false

    var body: some View {
        let apps = model.mapsApps
        let car = model.car
        List {
            Section("Developer Tools") {
                DevRow(route: .dataState, symbol: "cylinder.split.1x2.fill", title: "Data State", subtitle: "Force loading, offline, error, and empty states.")
                DevRow(route: .login, symbol: "person.badge.key.fill", title: "Login Flow", subtitle: "Walk the sign-in screens without signing out.")
                DevRow(route: .performance, symbol: "gauge.with.dots.needle.67percent", title: "Performance", subtitle: "This device’s launch and screen times, as SwiftUI measures them.")
                DevRow(route: .eas, symbol: "cloud.fill", title: "Expo Application Services", subtitle: "Open this project’s EAS dashboard.")
            }
            Section {
                // The same chooser as the map sheet's, listing installed apps only.
                Button {
                    if Rules.mapsCount(apps) == 0 { noMaps = true } else { choosingMaps = true }
                } label: {
                    RowFace(symbol: "map.fill", title: "Maps App", subtitle: mapsSubtitle(apps))
                }
                .accessibilityIdentifier("maps-app")
                .confirmationDialog("Open location in", isPresented: $choosingMaps, titleVisibility: .visible) {
                    MapsChoices(apps: apps) { model.chooseMaps($0) }
                }
            } header: {
                Text("Maps")
            } footer: {
                Text("The app used to open your vehicle’s location for directions.")
            }
            Section("Vehicle") {
                Button { model.editName() } label: {
                    RowFace(symbol: "car.fill", title: "Name", subtitle: car.vin.isEmpty ? "…" : car.name)
                }
                .disabled(car.vin.isEmpty)
                .accessibilityIdentifier("edit-name")
            }
            Section {
                Button(role: .destructive) {
                    Task { await model.signOut() }
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .disabled(model.signingOut)
                .accessibilityIdentifier("sign-out")
            } header: {
                Text("Lexus Account")
            } footer: {
                if model.account.demo { Text("Signed in to the demo Lexus.") }
            }
            if model.account.demo {
                Section {
                    Toggle("Simulate Server Errors", isOn: Binding(get: { model.demoFailing }, set: { model.setDemoFailing($0) }))
                        .accessibilityIdentifier("demo-failures")
                } header: {
                    Text("Demo")
                } footer: {
                    Text("Commands, climate changes and renames fail as a server error does, so you can see how the app recovers.")
                }
            }
            Section("About") {
                LabeledContent("Version") {
                    Text(Self.version).textSelection(.enabled).accessibilityIdentifier("version")
                }
                LabeledContent("Built with") {
                    Text("SwiftUI · iOS \(UIDevice.current.systemVersion)").textSelection(.enabled).accessibilityIdentifier("built-with")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .alert("No maps app installed", isPresented: $noMaps) {
            Button("OK") {}
        } message: {
            Text("Install Apple Maps, Google Maps, or Waze from the App Store to open your vehicle's location for directions.")
        }
        .timedScreen("settings")
    }

    private func mapsSubtitle(_ apps: MapsApps) -> String {
        if !apps.provider.isEmpty { return Rules.mapsName(apps.provider) }
        switch Rules.mapsCount(apps) {
        case 0: return "Unavailable"
        case 1: return Rules.mapsName(Rules.mapsResolved(apps))
        default: return "Not set"
        }
    }

    static var version: String {
        let info = Bundle.main.infoDictionary
        return "\(info?["CFBundleShortVersionString"] as? String ?? "?") (\(info?["CFBundleVersion"] as? String ?? "?"))"
    }
}

struct RowFace: View {
    let symbol: String
    let title: String
    let subtitle: String
    var tint: Color = .accentColor

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(Color(.label))
                Text(subtitle).font(.footnote.weight(.medium)).foregroundStyle(Color(.secondaryLabel))
            }
        }
        .padding(.vertical, 4)
    }
}

private struct DevRow: View {
    @Environment(AppModel.self) private var model
    let route: SettingsRoute
    let symbol: String
    let title: String
    let subtitle: String

    var body: some View {
        Button { model.openDevTool(route) } label: {
            HStack {
                RowFace(symbol: symbol, title: title, subtitle: subtitle)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(.tertiaryLabel))
            }
        }
        .accessibilityIdentifier("dev-\(route.rawValue)")
    }
}

struct RenameView: View {
    @Environment(AppModel.self) private var model
    @FocusState private var focused: Bool

    var body: some View {
        @Bindable var model = model
        List {
            Section {
                TextField("My Vehicle", text: $model.draftName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .focused($focused)
                    .onSubmit { Task { await model.saveName() } }
                    .accessibilityIdentifier("name-input")
                    .overlay(alignment: .trailing) {
                        if !model.draftName.isEmpty {
                            Button("Clear", systemImage: "xmark.circle.fill") {
                                model.draftName = ""
                                focused = true
                            }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(.tertiary)
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("clear-name")
                        }
                    }
            } footer: {
                Text("Your car’s name, saved to the Lexus app.")
            }
            if !model.renameError.isEmpty {
                Section {
                    Label(model.renameError, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.medium))
                        .symbolRenderingMode(.multicolor)
                        .accessibilityIdentifier("rename-error")
                }
            }
            Section {
                Button { Task { await model.saveName() } } label: {
                    Text(model.renaming ? "Saving…" : "Save").font(.headline).frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.large)
                .disabled(!model.nameChanged || model.renaming)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .accessibilityIdentifier("save-name")
            }
        }
        .navigationTitle("Vehicle Name")
        .onAppear { focused = true }
        .timedScreen(SettingsRoute.rename.rawValue)
    }
}
