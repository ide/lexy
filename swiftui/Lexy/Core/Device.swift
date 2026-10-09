import CoreLocation
import MapKit
import Network
import UIKit

enum Haptic {
    case selection, light, medium, success, error

    func play() {
        switch self {
        case .selection: UISelectionFeedbackGenerator().selectionChanged()
        case .light: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .medium: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .success: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .error: UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

/// Which maps apps are installed, the saved choice, and opening the car's location in one.
enum MapsHandoff {
    private static let key = "lexy.maps"

    /// A saved app that is no longer installed is forgotten, so the chooser asks again.
    static func probe() -> MapsApps {
        func has(_ scheme: String) -> Bool { URL(string: "\(scheme)://").map(UIApplication.shared.canOpenURL) ?? false }
        var apps = MapsApps(provider: "", apple: has("maps"), google: has("comgooglemaps"), waze: has("waze"))
        var saved = UserDefaults.standard.string(forKey: key) ?? ""
        let installed = ["apple": apps.apple, "google": apps.google, "waze": apps.waze]
        if !saved.isEmpty && installed[saved] != true {
            saved = ""
            UserDefaults.standard.removeObject(forKey: key)
        }
        apps.provider = saved
        return apps
    }

    static func save(_ provider: String) {
        if provider.isEmpty { UserDefaults.standard.removeObject(forKey: key) } else { UserDefaults.standard.set(provider, forKey: key) }
    }

    /// The provider's own URL scheme first, then its universal link.
    static func links(_ provider: String, latitude: Double, longitude: Double, name: String) -> [URL] {
        let at = "\(latitude),\(longitude)"
        let q = name.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        let texts: [String]
        switch provider {
        case "google": texts = ["comgooglemaps://?q=\(at)(\(q))&center=\(at)", "https://www.google.com/maps/search/?api=1&query=\(at)"]
        case "waze": texts = ["waze://?ll=\(at)&navigate=yes", "https://waze.com/ul?ll=\(at)&navigate=yes"]
        default: texts = ["maps://?ll=\(at)&q=\(q)", "https://maps.apple.com/?ll=\(at)&q=\(q)"]
        }
        return texts.compactMap(URL.init(string:))
    }

    /// Returns the error to show, or nil when an app opened the location.
    static func open(_ provider: String, latitude: Double, longitude: Double, name: String) async -> String? {
        for url in links(provider, latitude: latitude, longitude: longitude, name: name) {
            if await UIApplication.shared.open(url) { return nil }
        }
        return "The app didn't respond to the location link. It may have just been removed."
    }
}

/// The parked car's street line: number and street, else the place's name. Answers are cached per
/// coordinate, rounded to about a meter.
enum ParkingAddress {
    private static var answers: [String: String] = [:]

    static func line(latitude: Double, longitude: Double) async -> String {
        guard latitude != 0 || longitude != 0 else { return "" }
        let key = String(format: "%.5f,%.5f", latitude, longitude)
        if let known = answers[key] { return known }
        guard let request = MKReverseGeocodingRequest(location: CLLocation(latitude: latitude, longitude: longitude)) else { return "" }
        let item = try? await request.mapItems.first
        let address = item?.address?.shortAddress ?? item?.address?.fullAddress ?? ""
        let street = address.split(separator: ",").first.map { String($0).trimmed } ?? ""
        let line = street.isEmpty ? (item?.name?.trimmed ?? "") : street
        answers[key] = line
        return line
    }
}

@Observable
final class Connectivity {
    private(set) var online = true
    private let monitor = NWPathMonitor()

    init() {
        // The monitor calls this on its own queue, so the closure must not be main-actor isolated.
        monitor.pathUpdateHandler = { @Sendable [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.online = online }
        }
        monitor.start(queue: DispatchQueue(label: "lexy.connectivity"))
    }
}
