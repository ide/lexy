import SwiftUI

struct SpecsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let garage = model.shownGarage
        let car = garage.car
        let loading = model.specsScreenLoading
        let online = model.shownOnline
        Group {
            if car.vin.isEmpty && loading {
                List {
                    Section {
                        Color.clear.frame(height: 600)
                    } header: {
                        Placeholder(width: 80, height: 17)
                    }
                }
                .pendingPulse(online)
                .accessibilityIdentifier("specs-skeleton")
            } else if car.vin.isEmpty && !loading && garage.ok && garage.cars.isEmpty {
                VStack(spacing: 16) {
                    if !online { offlineBanner(car) }
                    VehicleStateView(symbol: "car.2", title: "No vehicle found",
                                     message: "There's no vehicle associated with this Lexus account. Add your vehicle in the Lexus app, then check again here.",
                                     label: "Check again") { await model.reloadGarage() }
                }
                .padding(16)
                .accessibilityIdentifier("specs-no-vehicle")
            } else if car.vin.isEmpty && !loading && !garage.ok && garage.status != 401 {
                VStack(spacing: 16) {
                    if !online { offlineBanner(car) }
                    VehicleStateView(symbol: "exclamationmark.triangle", title: "Vehicle data unavailable",
                                     message: Rules.failureAdvice(status: garage.status, error: garage.error), label: "Try again") { await model.reloadGarage() }
                }
                .padding(16)
                .accessibilityIdentifier("specs-error")
            } else {
                list(garage: garage, car: car, loading: loading, online: online)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Specs")
        .timedScreen("specs")
    }

    private func offlineBanner(_ car: Car) -> some View {
        WarningBanner(symbol: "wifi.slash", title: "You're offline",
                      message: car.vin.isEmpty ? "Reconnect to see your vehicle." : "Showing the latest data we saved.")
            .accessibilityIdentifier("specs-offline")
    }

    private func list(garage: Garage, car: Car, loading: Bool, online: Bool) -> some View {
        let spec = model.spec
        return List {
            if !online {
                offlineBanner(car).listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
            } else if !car.vin.isEmpty && !garage.ok && !loading && garage.status != 401 {
                WarningBanner(symbol: "exclamationmark.triangle.fill", title: "Couldn’t refresh",
                              message: "\(Rules.failureSummary(status: garage.status, error: garage.error)) Showing the latest data we saved.")
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .accessibilityIdentifier("specs-garage-error")
            }
            if !car.vin.isEmpty {
                Section("Vehicle") {
                    InfoRow(label: "VIN", value: car.vin)
                    InfoRow(label: "Model Code", value: car.modelCode)
                    InfoRow(label: "Exterior", value: car.color)
                    InfoRow(label: "Trim", value: spec.value("Grade", or: car.grade))
                    InfoRow(label: "Region", value: car.region)
                    InfoRow(label: "Telematics", value: car.generation)
                    InfoRow(label: "Head Unit", value: Rules.headUnit(car.generation))
                    InfoRow(label: "Fuel Type", value: Rules.fuelName(car.fuelType))
                    InfoRow(label: "Transmission", value: spec.value("Transmission", or: ""))
                    InfoRow(label: "Drivetrain", value: spec.value("Drive Type", or: ""))
                    InfoRow(label: "Built", value: spec.value("Order Date", or: ""))
                    InfoRow(label: "In Service", value: spec.value("Date of First Use", or: ""))
                }
                // Every car lists the same four.
                Section("Remote Capabilities") {
                    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 16) {
                        GridRow {
                            Capability(symbol: "lock.fill", label: "Lock & unlock")
                            Capability(symbol: "power", label: "Engine start")
                        }
                        GridRow {
                            Capability(symbol: "thermometer.medium", label: "Climate")
                            Capability(symbol: "location.fill", label: "Location")
                        }
                    }
                    .padding(.vertical, 8)
                }
                if model.services.ok && !model.services.items.isEmpty {
                    Section("Connected Services") {
                        ForEach(Array(model.services.items.enumerated()), id: \.element) { i, s in
                            HStack(spacing: 16) {
                                VStack(alignment: .leading) {
                                    Text(s.name).textSelection(.enabled)
                                    let trial = s.bucket == "trial"
                                    if s.endMs > 0 || trial {
                                        Text(s.endMs > 0 ? "\(trial ? "Trial expires" : "Expires") \(Rules.monthYear(s.endMs))" : "Trial")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text(s.status)
                                    .fontWeight(.bold)
                                    .foregroundStyle(s.status == "Active" ? .green : .secondary)
                            }
                            .font(.subheadline.weight(.medium))
                            .accessibilityElement(children: .combine)
                            .accessibilityIdentifier("service-\(i)")
                        }
                        // Only the words are tappable. The Lexus app's universal link opens its App
                        // Store page when the app isn't installed.
                        Text("[Manage your subscriptions in the Lexus app](https://ctlexusapp.com/shop)")
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 6)
                            .environment(\.openURL, OpenURLAction { _ in
                                Haptic.light.play()
                                return .systemAction
                            })
                            .accessibilityIdentifier("manage-subscriptions")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        LabeledContent {
            Text(value.isEmpty ? "—" : value)
                .foregroundStyle(Color(.label))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        } label: {
            Text(label).foregroundStyle(.secondary)
        }
        .font(.subheadline.weight(.medium))
        .accessibilityIdentifier("row-\(label)")
    }
}

private struct Capability: View {
    let symbol: String
    let label: String

    var body: some View {
        Label {
            Text(label).font(.subheadline.weight(.medium))
        } icon: {
            Image(systemName: symbol).foregroundStyle(.tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
