import SwiftUI


/// One override at a time. It lives in memory, so every launch starts on Live.
struct DataStateView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            Section {
                ForEach(Rules.dataStates, id: \.self) { kind in
                    Button {
                        Haptic.selection.play()
                        model.dataState = kind
                    } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(Rules.dataStateTitle(kind)).foregroundStyle(Color(.label))
                                Text(Rules.dataStateDetail(kind)).font(.footnote).foregroundStyle(Color(.secondaryLabel))
                            }
                            Spacer()
                            if model.dataState == kind {
                                Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(.tint)
                            }
                        }
                    }
                    .accessibilityAddTraits(model.dataState == kind ? .isSelected : [])
                    .accessibilityIdentifier("data-state-\(kind)")
                }
            } header: {
                Text("Data State")
            } footer: {
                Text("The override applies to the Status and Specs tabs, and resets to Live when the app relaunches.")
            }
            Section {
                let provider = model.mapsApps.provider
                Button(role: .destructive) { model.clearMaps() } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Clear Maps provider")
                        Text(provider.isEmpty ? "No saved provider" : "Currently \(Rules.mapsName(provider))")
                            .font(.footnote)
                            .foregroundStyle(Color(.secondaryLabel))
                    }
                }
                .disabled(provider.isEmpty)
                .accessibilityIdentifier("clear-maps")
            } header: {
                Text("Persisted State")
            } footer: {
                Text("Forgetting it makes the next map hand-off pick the only app installed, or ask again.")
            }
        }
        .navigationTitle("Data State")
        .timedScreen(SettingsRoute.dataState.rawValue)
    }
}

/// The real sign-in screen and step machine against a mock tree. The stored session is never
/// touched.
struct LoginPreviewView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let machine = model.preview
        Group {
            if machine.done, let scenario = machine.scenario {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 56)).foregroundStyle(.green)
                    Text("You’re Signed In").font(.title.bold())
                    Text("That was the real sign-in flow against a mock Lexus. No real sign-in happened, and your session is as it was.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("\(Rules.scenarioTitle(scenario)): \(Rules.scenarioDetail(scenario))")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                    Button("Run Again") { machine.reset(keepEmail: true) }
                        .buttonStyle(.borderedProminent)
                        .buttonBorderShape(.capsule)
                        .controlSize(.large)
                        .padding(.top, 12)
                        .accessibilityIdentifier("run-again")
                }
                .multilineTextAlignment(.center)
                .padding(32)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemGroupedBackground))
            } else {
                SignInView(machine: machine, error: machine.error, preview: true)
            }
        }
        .navigationTitle("Login Flow")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu("Preview Scenario", systemImage: "wrench.and.screwdriver") {
                    Picker("Preview Scenario", selection: Binding(get: { machine.scenario ?? .successMulti }, set: { scenario in
                        Haptic.selection.play()
                        machine.scenario = scenario
                        machine.reset(keepEmail: true)
                    })) {
                        ForEach(PreviewScenario.allCases) { s in
                            Label(Rules.scenarioTitle(s), systemImage: Rules.scenarioSymbol(s)).tag(s)
                        }
                    }
                }
                .accessibilityIdentifier("scenario")
            }
        }
        .timedScreen(SettingsRoute.login.rawValue)
    }
}

/// The project's pages on expo.dev, opened in Safari, where the dashboard's sign-in lives.
struct EasView: View {
    private let pages: [(id: String, symbol: String, title: String, subtitle: String, url: String)] = [
        ("eas-home", "house.fill", "Project Home", "The project overview and its recent activity.", "https://expo.dev/accounts/ide/projects/lexy"),
        ("eas-observe", "waveform.path.ecg", "Observe", "Launch, render, and navigation metrics from real devices.", "https://expo.dev/accounts/ide/projects/lexy/observe"),
        ("eas-workflows", "flowchart.fill", "Workflows", "The runs that build Lexy’s apps.", "https://expo.dev/accounts/ide/projects/lexy/workflows"),
        ("eas-builds", "hammer.fill", "Builds", "Native builds, their logs, and install links.", "https://expo.dev/accounts/ide/projects/lexy/builds"),
    ]

    var body: some View {
        List {
            Section {
                ForEach(pages, id: \.id) { page in
                    Button {
                        Haptic.selection.play()
                        UIApplication.shared.open(URL(string: page.url)!)
                    } label: {
                        HStack {
                            RowFace(symbol: page.symbol, title: page.title, subtitle: page.subtitle, tint: .cyan)
                            Spacer()
                            // An external-link glyph, since the row leaves the app.
                            Image(systemName: "arrow.up.right.square").foregroundStyle(Color(.secondaryLabel))
                        }
                    }
                    .accessibilityIdentifier(page.id)
                }
            } header: {
                Text("Dashboard")
            } footer: {
                Text("Opens expo.dev in Safari for @ide/lexy. You need to be signed in on the dashboard to see anything.")
            }
        }
        .navigationTitle("EAS")
        .timedScreen(SettingsRoute.eas.rawValue)
    }
}

struct PerformanceView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let timings = model.timings
        let latest = timings.latestLaunch
        let screens = timings.screens
        let medians = timings.medians
        List {
            if latest.isEmpty && screens.isEmpty && medians.isEmpty {
                Section {} footer: { Text("Nothing recorded yet. Open a screen or relaunch the app.") }
            }
            if !latest.isEmpty {
                Section(timings.latestIsThisLaunch ? "This Launch" : "Last Launch") {
                    ForEach(latest) { m in
                        MetricRow(pill: m.kind.pill, tint: pillTint(m), where: m.kind == .premain ? "main" : (m.route.isEmpty ? "launch" : "/\(m.route)"),
                                  detail: Rules.absoluteTime(m.time), value: m.value, id: "perf-launch-\(m.kind.rawValue)")
                    }
                }
            }
            if !screens.isEmpty {
                Section("Screens") {
                    ForEach(Array(screens.enumerated()), id: \.element.id) { i, m in
                        MetricRow(pill: m.warm ? "WARM TTR" : "COLD TTR", tint: m.warm ? .orange : .blue, where: "/\(m.route)",
                                  detail: "Tap → first frame · \(Rules.absoluteTime(m.time))", value: m.value, id: "perf-nav-\(i)")
                    }
                }
            }
            if !medians.isEmpty {
                Section {
                    ForEach(medians, id: \.kind) { s in
                        MetricRow(pill: s.kind.pill, tint: s.kind == .tti ? .green : (s.kind == .ttr ? .blue : .secondary), where: "",
                                  detail: s.count == 1 ? "1 launch" : "\(s.count) launches", value: s.median, id: "perf-median-\(s.kind.rawValue)")
                    }
                } header: {
                    Text("Median")
                } footer: {
                    Text("Times from the kernel’s process start, kept on this device for 7 days. TTR is the first frame; TTI the first frame with nothing loading.")
                }
            }
        }
        .navigationTitle("Performance")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Clear") {
                    Haptic.selection.play()
                    timings.clear()
                }
                .accessibilityIdentifier("clear-performance")
            }
        }
        .timedScreen(SettingsRoute.performance.rawValue)
    }

    private func pillTint(_ m: Timings.Metric) -> Color {
        switch m.kind { case .tti: .green; case .ttr, .screen: .blue; case .premain: .secondary }
    }
}

private struct MetricRow: View {
    let pill: String
    let tint: Color
    let `where`: String
    let detail: String
    let value: Double
    let id: String

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(pill)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(tint)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 6))
                    if !`where`.isEmpty {
                        Text(`where`).font(.subheadline.monospaced()).lineLimit(1).truncationMode(.middle)
                    }
                }
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(Int(value.rounded())) ms")
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .accessibilityIdentifier(id)
        }
        .textSelection(.enabled)
    }
}
