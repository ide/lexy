import MapKit
import SwiftUI

/// Last Parked: the car's street, when it was there, the map, and a way into a maps app.
struct MapSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var choosing = false
    @State private var noMaps = false
    @State private var mapShown = false

    var body: some View {
        let status = model.status
        let apps = model.mapsApps
        let provider = Rules.mapsResolved(apps)
        Group {
            if !status.hasLocation {
                Text("Location unavailable")
                    .font(.body.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 2) {
                        // Holds the line's height while the address loads, so the map doesn't move
                        // when it arrives.
                        Text(model.address.isEmpty ? " " : model.address)
                            .font(.headline)
                            .accessibilityIdentifier("map-address")
                        // Ticks on its own, since the sheet can stay open a while.
                        TimelineView(.periodic(from: .now, by: 5)) { context in
                            Text("Location as of \(Rules.relative(now: context.date.timeIntervalSince1970 * 1000, then: status.observedMs))")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                    map(status)
                        .clipShape(.rect(cornerRadius: 18))
                        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 18))
                        .padding(.horizontal, 16)
                    openButton(provider: provider, apps: apps)
                        .padding(16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Last Parked")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Close", systemImage: "xmark") { dismiss() }
                    .accessibilityIdentifier("close-map")
            }
        }
        .task(id: "\(status.latitude),\(status.longitude)") { await model.loadAddress() }
        .alert("Couldn't open \(Rules.mapsName(model.mapsTried))", isPresented: Binding(get: { !model.openError.isEmpty }, set: { if !$0 { model.openError = "" } })) {
            Button("OK") { model.openError = "" }
        } message: {
            Text(model.openError)
        }
        .alert("No maps app installed", isPresented: $noMaps) {
            Button("OK") {}
        } message: {
            Text("Install Apple Maps, Google Maps, or Waze from the App Store to open your vehicle's location for directions.")
        }
        .timedScreen("map")
    }

    private func map(_ status: VehicleStatus) -> some View {
        let at = CLLocationCoordinate2D(latitude: status.latitude, longitude: status.longitude)
        return Map(initialPosition: .camera(MapCamera(centerCoordinate: at, distance: 900))) {
            Marker(model.car.name, systemImage: "car.fill", coordinate: at)
                .tint(.blue)
        }
        .mapStyle(.standard(pointsOfInterest: .all))
        .mapControlVisibility(.hidden)
        // Fades in rather than showing tiles as they load.
        .opacity(mapShown ? 1 : 0)
        .animation(.easeIn(duration: 0.32), value: mapShown)
        .task {
            try? await Task.sleep(for: .milliseconds(300))
            mapShown = true
        }
        .accessibilityIdentifier("map")
    }

    /// The saved or only app opens directly. With several, the chooser lists the installed ones;
    /// with none, an alert explains.
    @ViewBuilder
    private func openButton(provider: String, apps: MapsApps) -> some View {
        let none = Rules.mapsCount(apps) == 0
        Button {
            if !provider.isEmpty { Task { await model.openMaps(provider, remember: false) } }
            else if none { noMaps = true }
            else { choosing = true }
        } label: {
            Text(provider.isEmpty ? "Open in Maps" : "Open in \(Rules.mapsName(provider))")
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 34)
        }
        .buttonStyle(none ? AnyPrimitiveButtonStyle(.bordered) : AnyPrimitiveButtonStyle(.borderedProminent))
        .buttonBorderShape(.capsule)
        .controlSize(.large)
        .disabled(model.opening)
        .confirmationDialog("Open location in", isPresented: $choosing, titleVisibility: .visible) {
            MapsChoices(apps: apps) { picked in Task { await model.openMaps(picked, remember: true) } }
        }
        .accessibilityIdentifier("open-maps")
    }
}

struct MapsChoices: View {
    let apps: MapsApps
    let choose: (String) -> Void

    var body: some View {
        if apps.apple { Button("Apple Maps") { choose("apple") }.accessibilityIdentifier("maps-apple") }
        if apps.google { Button("Google Maps") { choose("google") }.accessibilityIdentifier("maps-google") }
        if apps.waze { Button("Waze") { choose("waze") }.accessibilityIdentifier("maps-waze") }
    }
}

struct AnyPrimitiveButtonStyle: PrimitiveButtonStyle {
    private let make: (Configuration) -> AnyView
    init<S: PrimitiveButtonStyle>(_ style: S) { make = { AnyView(style.makeBody(configuration: $0)) } }
    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}
