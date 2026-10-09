import SwiftUI

@main
struct LexyApp: App {
    @State private var model: AppModel

    init() {
        _ = Timings.shared
        let arguments = ProcessInfo.processInfo.arguments
        let store: SecretStore = arguments.contains("-lexy-memory-store") ? MemoryStore() : KeychainStore()
        let cache = AnswerCache.standard()
        // UI tests start with no session and no cached answers.
        if arguments.contains("-lexy-reset") {
            store.forget("lexy.session")
            store.forget("lexy.demo")
            cache.forgetAll()
        }
        _model = State(initialValue: AppModel(client: LexusClient(store: store, cache: cache)))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
    }
}

/// The signed-in tabs or the sign-in screen, the 5-second tick, and the return to the foreground.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if model.shell {
                MainTabs()
            } else {
                SignInView(machine: model.signIn, error: model.signInError) { await model.signIn.tryDemo() }
                    .onAppear {
                        model.timings.launchFrame(route: "sign-in")
                        model.timings.launchInteractive(route: "sign-in")
                    }
            }
        }
        .animation(.default, value: model.shell)
        .task { await model.start() }
        .task(id: phase) {
            guard phase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if Task.isCancelled { break }
                model.tick()
            }
        }
        .onChange(of: phase) { old, new in
            if new == .background { model.enteredBackground() }
            if new == .active && old != .active { model.becameActive() }
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            Tab("Status", systemImage: "car", value: AppTab.status) {
                NavigationStack { StatusView() }
            }
            .accessibilityIdentifier("tab-status")
            Tab("Specs", systemImage: "list.bullet.rectangle", value: AppTab.specs) {
                NavigationStack { SpecsView() }
            }
            .accessibilityIdentifier("tab-specs")
            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                NavigationStack(path: $model.settingsPath) {
                    SettingsView()
                        .navigationDestination(for: SettingsRoute.self) { route in
                            switch route {
                            case .rename: RenameView()
                            case .dataState: DataStateView()
                            case .login: LoginPreviewView()
                            case .performance: PerformanceView()
                            case .eas: EasView()
                            }
                        }
                }
            }
            .accessibilityIdentifier("tab-settings")
        }
    }
}
