import MapKit
import SwiftUI

struct StatusView: View {
    @Environment(AppModel.self) private var model
    @State private var moreOpen = false
    @State private var closuresOpen = false
    @State private var mapDetent = PresentationDetent.large

    private var garage: Garage { model.shownGarage }
    private var car: Car { garage.car }
    private var status: VehicleStatus { model.status }
    private var loading: Bool { model.statusScreenLoading }
    private var online: Bool { model.shownOnline }

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                banners
                if car.vin.isEmpty && loading {
                    StatusSkeleton(online: online)
                } else if !car.vin.isEmpty {
                    HeroCard(car: car, status: status, dim: model.pulseDim) {
                        mapDetent = .large
                        model.openMap()
                    }
                    FuelCard(status: status, electric: car.fuelType == "E")
                    ControlsSection(moreOpen: $moreOpen)
                    ClimateCard()
                    if !ClosureSummary(sections: status.sections, lockPending: false, lockTarget: "").rows.isEmpty {
                        ClosuresSection(open: $closuresOpen)
                    }
                    OdometerCard(status: status)
                    if model.tires.ok && !model.tires.tires.isEmpty {
                        TiresCard(tires: model.tires)
                    }
                    SyncedFooter(status: status, clock: model.clock)
                }
            }
            .padding([.horizontal, .top], 16)
            .frame(maxWidth: .infinity, minHeight: car.vin.isEmpty && !loading ? 500 : nil, alignment: .top)
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
        .background(Color(.systemGroupedBackground))
        .refreshable { await model.pullRefresh() }
        .navigationTitle(title)
        .alert("Command failed", isPresented: Binding(get: { !model.commandError.isEmpty }, set: { if !$0 { model.commandError = "" } })) {
            Button("OK") { model.commandError = "" }
        } message: {
            Text(model.commandError)
        }
        .alert("Couldn't save climate settings", isPresented: Binding(get: { !model.climateError.isEmpty }, set: { if !$0 { model.climateError = "" } })) {
            Button("OK") { model.climateError = "" }
        } message: {
            Text(model.climateError)
        }
        .sheet(isPresented: $model.mapShown) {
            NavigationStack { MapSheet() }
                // Opens at full height; dragging down stops at half height.
                .presentationDetents([.medium, .large], selection: $mapDetent)
                .presentationDragIndicator(.visible)
        }
        .onAppear {
            model.timings.launchFrame(route: "status")
            model.timings.appeared("status")
        }
        .onChange(of: !car.vin.isEmpty && !loading, initial: true) { _, ready in
            if ready { model.timings.launchInteractive(route: "status") }
        }
    }

    private var title: String {
        if car.vin.isEmpty { return loading && online ? " " : "My Vehicle" }
        return car.name
    }

    @ViewBuilder private var banners: some View {
        if !online {
            WarningBanner(symbol: "wifi.slash", title: "You're offline",
                          message: car.vin.isEmpty ? "Reconnect to see your vehicle." : "Showing the latest data we saved.")
                .accessibilityIdentifier("offline")
        }
        if online && !car.vin.isEmpty && !loading
            && ((!garage.ok && garage.status != 401) || (status.ok && !status.error.isEmpty && status.status != 401)) {
            let summary = !garage.ok ? Rules.failureSummary(status: garage.status, error: garage.error)
                : Rules.failureSummary(status: status.status, error: status.error)
            WarningBanner(symbol: "exclamationmark.triangle.fill", title: "Couldn’t refresh", message: "\(summary) Showing the latest data we saved.")
                .accessibilityIdentifier("garage-error")
        }
        if car.vin.isEmpty && !loading && garage.ok && garage.cars.isEmpty {
            VehicleStateView(symbol: "car.2", title: "No vehicle found",
                             message: "There's no vehicle associated with this Lexus account. Add your vehicle in the Lexus app, then check again here.",
                             label: "Check again") { await model.pullRefresh() }
                .accessibilityIdentifier("no-vehicle")
        }
        if car.vin.isEmpty && !loading && !garage.ok && garage.status != 401 {
            VehicleStateView(symbol: "exclamationmark.triangle", title: "Vehicle data unavailable",
                             message: Rules.failureAdvice(status: garage.status, error: garage.error), label: "Try again") { await model.pullRefresh() }
                .accessibilityIdentifier("vehicle-error")
        }
    }
}

// MARK: - Skeleton

/// Shown until the first garage arrives. It pulses while online and holds still offline.
private struct StatusSkeleton: View {
    let online: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Placeholder(width: 148, height: 48, radius: 24)
                .frame(maxWidth: .infinity, minHeight: 265, alignment: .bottomTrailing)
                .padding([.trailing, .bottom], 16)
                .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
            VStack(spacing: 12) {
                HStack {
                    Placeholder(width: 72, height: 16)
                    Spacer()
                    Placeholder(width: 110, height: 16)
                }
                Placeholder(height: 8, radius: 4)
            }
            .card()
            Placeholder(width: 140, height: 17).padding(.leading, 8)
            HStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18).fill(Color(.secondarySystemGroupedBackground)).frame(height: 76)
                }
            }
            RoundedRectangle(cornerRadius: 18).fill(Color(.secondarySystemGroupedBackground)).frame(height: 80)
        }
        .pendingPulse(online)
        .accessibilityIdentifier("skeleton")
        .accessibilityLabel("Loading")
    }
}

// MARK: - Hero

/// The car over its parked map. The card dims while the app refreshes on its own.
private struct HeroCard: View {
    let car: Car
    let status: VehicleStatus
    let dim: Bool
    let openMap: () -> Void
    @State private var mapShown = false

    var body: some View {
        VStack(spacing: 8) {
            // The render at 110% width, clipped to 185 pt, trims its empty margins.
            GeometryReader { geo in
                let width = geo.size.width * 1.1
                AsyncImage(url: URL(string: car.image)) { image in
                    image.resizable().aspectRatio(700 / 631, contentMode: .fit)
                } placeholder: {
                    Color.clear
                }
                .frame(width: width, height: width * 631 / 700)
                .frame(width: geo.size.width, height: geo.size.height)
                .accessibilityLabel(car.description)
            }
            .frame(height: 185)
            .clipped()
            .allowsHitTesting(false)
            HStack {
                Spacer()
                Button(action: openMap) {
                    HStack(spacing: 6) {
                        Image(systemName: "map.fill")
                            .font(.subheadline)
                            .foregroundStyle(.tint)
                            .frame(width: 20, height: 18)
                        Text("Last Parked")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color(.label))
                    }
                    .frame(width: 148, height: 48)
                    .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: .capsule)
                .accessibilityIdentifier("last-parked")
            }
        }
        .padding(EdgeInsets(top: 8, leading: 16, bottom: 16, trailing: 16))
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                if status.ok && status.hasLocation {
                    Map(initialPosition: .camera(MapCamera(centerCoordinate: CLLocationCoordinate2D(latitude: status.latitude, longitude: status.longitude), distance: 1000)),
                        interactionModes: [])
                        .mapStyle(.standard(pointsOfInterest: .excludingAll))
                        .mapControlVisibility(.hidden)
                        .opacity(mapShown ? 0.48 : 0)
                        .animation(.easeIn(duration: 0.32), value: mapShown)
                        .task {
                            try? await Task.sleep(for: .milliseconds(350))
                            mapShown = true
                        }
                        .id("\(status.latitude),\(status.longitude)")
                }
                Color(light: .white.opacity(0.22), dark: Color(white: 0.11).opacity(0.22))
                    .allowsHitTesting(false)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(.rect(cornerRadius: 18))
        .opacity(dim ? 0.6 : 1)
        .animation(.easeInOut(duration: 1), value: dim)
    }
}

extension Color {
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }
}

// MARK: - Fuel

/// The level in four segments, colored by how much is left.
private struct FuelCard: View {
    let status: VehicleStatus
    let electric: Bool

    private var fuel: Double { (status.fuel + 0.5).rounded(.down) }
    private var tint: Color {
        switch Rules.fuelLevel(fuel) { case .high: .green; case .medium: .yellow; case .low: .orange; case .empty: .red }
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Label {
                    Text(electric ? "Charge" : "Fuel").foregroundStyle(.secondary)
                } icon: {
                    Image(systemName: electric ? "bolt.fill" : "fuelpump.fill")
                        .foregroundStyle(status.ok ? tint : Color(.tertiaryLabel))
                }
                .font(.subheadline.weight(.bold))
                Spacer()
                if status.ok {
                    let level = Text(fuel >= 100 ? "Full" : "\(Int(fuel))%")
                        .foregroundStyle(fuel >= 100 ? .green : (fuel > 25 ? .primary : tint))
                    Text("\(level) · \(Rules.grouped(status.range)) \(Rules.distanceUnit(status.rangeUnit))")
                        .font(.subheadline.weight(.bold))
                        .monospacedDigit()
                        .accessibilityIdentifier("fuel-value")
                } else {
                    // Not read yet, as distinct from empty.
                    Placeholder(width: 110, height: 16).pendingPulse(true)
                }
            }
            HStack(spacing: 4) {
                ForEach(0..<4, id: \.self) { i in
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color(.tertiarySystemFill))
                            Capsule().fill(tint)
                                .frame(width: geo.size.width * min(1, max(0, (fuel - Double(i) * 25) / 25)))
                        }
                    }
                    .frame(height: 8)
                }
            }
            .accessibilityHidden(true)
        }
        .card()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("fuel")
    }
}

// MARK: - Remote controls

/// Confirms with a centered alert before sending.
private struct ControlButton: View {
    let command: Command
    let label: String
    let symbol: String
    let tint: Color
    let title: String
    let message: String
    let action: String
    var destructive = false
    var onCard = false
    @Environment(AppModel.self) private var model
    @State private var confirming = false

    var body: some View {
        Button {
            confirming = true
        } label: {
            VStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(tint)
                Text(label)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color(.label))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 18))
        .tint(onCard ? Color(.quaternarySystemFill) : Color(.secondarySystemGroupedBackground))
        .accessibilityIdentifier("command-\(command.rawValue)")
        .alert(title, isPresented: $confirming) {
            Button(action, role: destructive ? .destructive : nil) { model.run(command) }
                .accessibilityIdentifier("confirm-\(command.rawValue)")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(message)
        }
    }
}

private struct ControlsSection: View {
    @Environment(AppModel.self) private var model
    @Binding var moreOpen: Bool

    private var car: Car { model.shownGarage.car }

    var body: some View {
        let lockPending = model.lockPending
        let locked = lockPending ? model.lockTarget == "locked" : model.doorLock == "locked"
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 16) {
                CardTitle("Remote Controls")
                    .layoutPriority(1)
                Spacer(minLength: 0)
                HStack(spacing: 8) {
                    // Nothing shows until a door has reported, since a guess would read as a state.
                    if lockPending || model.doorLock != "unknown" {
                        Label(lockPending ? (locked ? "Locking" : "Unlocking") : (locked ? "Locked" : "Unlocked"),
                              systemImage: locked ? "lock.fill" : "lock.open.fill")
                            .foregroundStyle(locked ? .green : .orange)
                            .pendingPulse(lockPending)
                            .accessibilityIdentifier("lock-state")
                    }
                    if car.can("remoteEngineStartStop") && (model.engine.ok || model.enginePending) {
                        Label {
                            // Sized to the longest word, so the lock state beside it never moves.
                            ZStack(alignment: .leading) {
                                ForEach(["Stopped", "Starting", "Started", "Stopping"], id: \.self) { Text($0).hidden() }
                                Text(engineWord).pendingPulse(model.enginePending)
                            }
                        } icon: {
                            Image(systemName: "power")
                        }
                        .foregroundStyle(model.engineRunning ? Color.green : .secondary)
                        .accessibilityIdentifier("engine-state")
                    }
                }
                .font(.footnote.weight(.bold))
                .labelStyle(TightLabel())
                .lineLimit(1)
                .fixedSize()
                .padding(.trailing, 8)
            }
            HStack(spacing: 8) {
                ControlButton(command: .doorLock, label: "Lock", symbol: "lock.fill", tint: .green,
                              title: "Lock your vehicle?", message: "This locks all doors.", action: "Lock")
                ControlButton(command: .doorUnlock, label: "Unlock", symbol: "lock.open.fill", tint: .orange,
                              title: "Unlock your vehicle?", message: "This unlocks the doors. Only do this when you’re near the vehicle.",
                              action: "Unlock", destructive: true)
                if model.engineRunning {
                    ControlButton(command: .engineStop, label: "Stop", symbol: "power", tint: .red,
                                  title: "Stop the engine?", message: "This ends the remote start.", action: "Stop Engine")
                } else {
                    ControlButton(command: .engineStart, label: "Start", symbol: "power", tint: .blue,
                                  title: "Remotely start the engine?",
                                  message: "Never remotely start the engine in an enclosed space, or with a child or pet inside the vehicle.",
                                  action: "Start Engine", destructive: true)
                }
            }
            let extras = Rules.extrasText(car.capabilities)
            if !extras.isEmpty {
                ExpandableCard(symbol: "slider.horizontal.3", tint: .blue, title: "More controls", subtitle: extras, open: $moreOpen, id: "more") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        if car.can("trunkLockUnlockCapable") {
                            ControlButton(command: .trunkLock, label: "Lock Trunk", symbol: "car.side.rear.crop.trunk.partition.fill", tint: .green,
                                          title: "Lock the trunk?", message: "This locks the trunk.", action: "Lock Trunk", onCard: true)
                            ControlButton(command: .trunkUnlock, label: "Unlock Trunk", symbol: "car.side.rear.crop.trunk.partition", tint: .orange,
                                          title: "Unlock the trunk?", message: "This unlocks the trunk. Only do this when you’re near the vehicle.",
                                          action: "Unlock Trunk", destructive: true, onCard: true)
                        }
                        if car.can("hazardCapable") {
                            if model.hazardsOn {
                                ControlButton(command: .hazardOff, label: "Hazards Off", symbol: "car.rear.hazardsign", tint: .blue,
                                              title: "Turn off the hazards?", message: "This stops the hazard lights.", action: "Turn Off", onCard: true)
                            } else {
                                ControlButton(command: .hazardOn, label: "Hazard Lights", symbol: "car.rear.hazardsign.fill", tint: .red,
                                              title: "Flash the hazards?", message: "The hazard lights start flashing until you turn them off.",
                                              action: "Turn On", onCard: true)
                            }
                        }
                        if car.can("lightsCapable") {
                            ControlButton(command: .headlightOn, label: "Flash Lights", symbol: "headlight.low.beam.fill", tint: .cyan,
                                          title: "Flash the headlights?", message: "The headlights come on to help you find the vehicle.",
                                          action: "Flash", onCard: true)
                        }
                        if car.can("buzzerCapable") {
                            ControlButton(command: .buzzerWarning, label: "Play Beeps", symbol: "bell.and.waves.left.and.right.fill", tint: .yellow,
                                          title: "Sound the buzzer?", message: "The vehicle beeps ten times.", action: "Play Beeps", onCard: true)
                        }
                        if car.can("hornCapable") {
                            ControlButton(command: .soundHorn, label: "Honk Horn", symbol: "horn.blast.fill", tint: .orange,
                                          title: "Sound the horn?", message: "The vehicle will sound its horn. Be sure not to startle anyone.",
                                          action: "Honk Horn", destructive: true, onCard: true)
                        }
                    }
                    .padding([.horizontal, .bottom], 16)
                }
                .padding(.top, 8)
            }
        }
    }

    private var engineWord: String {
        model.enginePending ? (model.engineTarget == "running" ? "Starting" : "Stopping") : (model.engineRunning ? "Started" : "Stopped")
    }
}

private struct TightLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.font(.footnote)
            configuration.title
        }
    }
}

// MARK: - Climate

/// Disabled while a change is being saved, so a second change can't race the first.
private struct ClimateCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let climate = model.climate
        let disabled = model.climateSaving || !model.shownClimateOn
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Label {
                        Text("Remote Start Climate").foregroundStyle(.secondary)
                    } icon: {
                        Image(systemName: "thermometer.medium").foregroundStyle(.tint)
                    }
                    .font(.subheadline.weight(.bold))
                    Spacer()
                    // Shown from the first frame, disabled until the settings arrive, so the header
                    // never changes height.
                    Toggle("Remote start climate", isOn: Binding(get: { climate.ok && model.shownClimateOn }, set: { model.setClimateOn($0) }))
                        .labelsHidden()
                        .disabled(model.climateSaving || !climate.ok)
                        .accessibilityIdentifier("climate-switch")
                }
                Text("Settings for when you start your vehicle remotely.")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            if climate.ok {
                if climate.max > climate.min {
                    HStack(spacing: 16) {
                        Slider(value: Binding(get: { model.shownTemperature }, set: { model.dragTemperature($0) }),
                               in: climate.min...climate.max, step: climate.step) { editing in
                            if !editing { model.setTemperature(model.shownTemperature) }
                        }
                        .disabled(disabled)
                        .accessibilityLabel("Temperature")
                        .accessibilityIdentifier("climate-temperature")
                        Text("\(Rules.tenths(model.shownTemperature))°\(climate.unit)")
                            .font(.subheadline.weight(.bold))
                            .monospacedDigit()
                            .frame(minWidth: 52, alignment: .trailing)
                    }
                }
                if climate.front || climate.rear {
                    HStack(spacing: 8) {
                        if climate.front {
                            DefrostChip(title: "Front Defrost", symbol: "windshield.front.and.heat.waves", on: model.shownFront, id: "defrost-front") {
                                model.toggleDefrost(front: true)
                            }
                        }
                        if climate.rear {
                            DefrostChip(title: "Rear Defrost", symbol: "windshield.rear.and.heat.waves", on: model.shownRear, id: "defrost-rear") {
                                model.toggleDefrost(front: false)
                            }
                        }
                    }
                    .disabled(disabled)
                    // Dimmed rather than recolored, so disabled never reads as off.
                    .opacity(disabled ? 0.6 : 1)
                }
            }
        }
        .card()
    }
}

private struct DefrostChip: View {
    let title: String
    let symbol: String
    let on: Bool
    let id: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.subheadline)
                .labelStyle(TightLabel())
                .frame(maxWidth: .infinity, minHeight: 24)
        }
        .buttonStyle(ChipStyle(on: on))
        .accessibilityValue(on ? "On" : "Off")
        .accessibilityIdentifier(id)
    }
}

/// Fill and words both come from `on` and switch in the same frame.
private struct ChipStyle: ButtonStyle {
    let on: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(on ? Color.accentColor : Color(.secondaryLabel))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(on ? Color.accentColor.opacity(0.15) : Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
            // Only the press dimming animates.
            .transaction { $0.animation = nil }
            .animation(.easeOut(duration: 0.15)) { $0.opacity(configuration.isPressed ? 0.6 : 1) }
            .contentShape(.rect(cornerRadius: 12))
    }
}

// MARK: - Doors & windows

/// A verdict that expands to each corner's door and window and the openings.
private struct ClosuresSection: View {
    @Environment(AppModel.self) private var model
    @Binding var open: Bool

    var body: some View {
        let summary = ClosureSummary(sections: model.status.sections, lockPending: model.lockPending, lockTarget: model.lockTarget)
        let tint: Color = switch summary.tint { case .green: .green; case .orange: .orange; case .secondary: .secondary }
        VStack(alignment: .leading, spacing: 8) {
            CardTitle("Doors & Windows")
            ExpandableCard(symbol: summary.symbol, tint: tint, title: summary.headline, subtitle: summary.subline, open: $open, id: "closures") {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(["front", "rear"], id: \.self) { end in
                        if summary.hasCorners("\(end)-") {
                            HStack(alignment: .top, spacing: 16) {
                                Corner(title: "\(end.capitalizedFirst) driver", driver: true,
                                       door: summary.corner("\(end)-driver", door: true), window: summary.corner("\(end)-driver", door: false))
                                Corner(title: "\(end.capitalizedFirst) passenger", driver: false,
                                       door: summary.corner("\(end)-passenger", door: true), window: summary.corner("\(end)-passenger", door: false))
                            }
                        }
                    }
                    if !summary.openings.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(summary.orderedOpenings, id: \.self) { o in
                                StatusLine(symbol: o.section.contains("Moon") ? "moon.fill" : (o.section.contains("Hood") ? "engine.combustion.fill" : "car.side.rear.crop.trunk.partition.fill"),
                                           tint: Rules.isOpen(o) ? .orange : .green, words: "\(o.section) \(Rules.isOpen(o) ? "open" : "closed")")
                            }
                        }
                    }
                }
                .padding(EdgeInsets(top: 2, leading: 16, bottom: 16, trailing: 16))
            }
            // Says how old any reading the latest snapshot didn't include is.
            if model.status.closuresStaleMs > 0 {
                Label("Some readings as of \(Rules.relative(now: model.clock, then: model.status.closuresStaleMs))", systemImage: "clock.arrow.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .labelStyle(TightLabel())
                    .frame(maxWidth: .infinity)
                    .accessibilityIdentifier("closures-stale")
            }
        }
    }
}

private struct Corner: View {
    @Environment(AppModel.self) private var model
    let title: String
    let driver: Bool
    let door: StatusSection?
    let window: StatusSection?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
            if let d = door {
                if Rules.isOpen(d) {
                    StatusLine(symbol: "lock.open.fill", tint: .orange, words: "Door open")
                } else if model.lockPending {
                    let locking = model.lockTarget == "locked"
                    StatusLine(symbol: locking ? "lock.fill" : "lock.open.fill", tint: locking ? .green : .orange, words: locking ? "Locking…" : "Unlocking…")
                } else if Rules.isUnlocked(d) {
                    StatusLine(symbol: "lock.open.fill", tint: .orange, words: "Door unlocked")
                } else if Rules.isLocked(d) {
                    StatusLine(symbol: "lock.fill", tint: .green, words: "Door locked")
                } else {
                    StatusLine(symbol: "checkmark.circle.fill", tint: .green, words: "Door closed")
                }
            }
            if let w = window {
                StatusLine(symbol: driver ? "car.window.right" : "car.window.left", tint: Rules.isOpen(w) ? .orange : .green,
                           words: Rules.isOpen(w) ? "Window open" : "Window closed")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Odometer and tires

private struct OdometerCard: View {
    let status: VehicleStatus

    var body: some View {
        let unit = Rules.distanceUnit(status.odometerUnit)
        VStack(alignment: .leading, spacing: 8) {
            CardTitle("Odometer")
            // The total takes a third of the width; the trips take the rest.
            ThirdsRow(spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Total", systemImage: "gauge.with.dots.needle.67percent")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.secondary)
                        .labelStyle(TightLabel())
                    Reading(value: Rules.grouped(status.odometer), unit: unit)
                        .accessibilityElement(children: .combine)
                        .accessibilityIdentifier("odometer-value")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Trip A").font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
                        Reading(value: Rules.tenths(status.tripA), unit: unit)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Trip B").font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
                        Reading(value: Rules.tenths(status.tripB), unit: unit)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color(.quaternarySystemFill), in: .rect(cornerRadius: 12))
            }
            .card()
        }
    }
}

/// Lays out two views: the first a third of the width, the second the rest.
private struct ThirdsRow: Layout {
    var spacing: CGFloat

    private func widths(_ total: CGFloat) -> (CGFloat, CGFloat) {
        let first = (total - spacing) / 3
        return (first, total - spacing - first)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let total = proposal.width ?? 320
        let (a, b) = widths(total)
        let heights = zip(subviews, [a, b]).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }
        return CGSize(width: total, height: heights.max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (a, b) = widths(bounds.width)
        for (i, (subview, width)) in zip(subviews, [a, b]).enumerated() {
            let x = i == 0 ? bounds.minX : bounds.minX + a + spacing
            subview.place(at: CGPoint(x: x, y: bounds.midY), anchor: .leading, proposal: ProposedViewSize(width: width, height: nil))
        }
    }
}

private struct Reading: View {
    let value: String
    let unit: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(value).font(.headline).monospacedDigit()
            Text(unit).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
        }
    }
}

private struct TiresCard: View {
    let tires: Tires

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            CardTitle("Tire Pressure")
            HStack(alignment: .top, spacing: 32) {
                column(["flTirePressure", "rlTirePressure"])
                column(["frTirePressure", "rrTirePressure"])
            }
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
        }
    }

    private func column(_ positions: [String]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(tires.tires.filter { positions.contains($0.position) }, id: \.position) { t in
                VStack(alignment: .leading, spacing: 2) {
                    Text(Rules.tireLabel(t.position)).font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text(Rules.grouped(t.value))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(t.low ? .orange : .primary)
                            .monospacedDigit()
                        Text(" \(tires.unit)").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("tire-\(t.position)")
            }
        }
    }
}

// MARK: - Footer

/// When the car last synced and when the app last checked. A tap shows the exact time in a popover.
private struct SyncedFooter: View {
    let status: VehicleStatus
    let clock: Double
    @State private var syncedShown = false
    @State private var checkedShown = false

    var body: some View {
        VStack(spacing: 2) {
            Button {
                syncedShown = true
            } label: {
                Text(status.ok ? "Vehicle last synced with Lexus \(Rules.relative(now: clock, then: status.observedMs))." : "Vehicle last synced with Lexus unknown.")
            }
            .popover(isPresented: $syncedShown) {
                Text(Rules.absoluteTime(status.observedMs)).padding(16).presentationCompactAdaptation(.popover)
            }
            .accessibilityIdentifier("synced-line")
            Button {
                checkedShown = true
            } label: {
                Text("Lexy checked for data \(Rules.relative(now: clock, then: status.fetchedMs)).")
            }
            .popover(isPresented: $checkedShown) {
                Text(Rules.absoluteTime(status.fetchedMs)).padding(16).presentationCompactAdaptation(.popover)
            }
            .accessibilityIdentifier("checked-line")
        }
        .buttonStyle(.plain)
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.bottom, 16)
    }
}
