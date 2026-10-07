// Lexy's native module (LLP 1024, 1067.000): what Exact does not expose and
// Lexy needs from iOS.
//
// - `<lexy-map>`: MapKit centred on the car with its marker
//   (src/features/vehicle/vehicle-location-map.tsx).
// - `native.later({op: "open"})`: a maps app by its own URL scheme
// - `native.later({op: "geocode"})`: the parked street line
//   (src/hooks/use-parking-address.ts, src/data/parking-address.ts).
// - `native.later({op: "installed"})`: which maps apps the phone has.
// - `native.later({op: "observe"})`: this device's Observe metrics, from
//   Exact's Observe service (`service("observe", …)`).
// - `native.later({op: "wait"})`: the demo server's latency (demo.ts), at
//   once under the agent's clock.
// - `native.call({op: "haptic"})`: UIKit feedback (src/utils/haptics.ts).
//
// Lexy is iOS-only. The build also compiles these sources for macOS to read
// the roster, so the UIKit parts are behind `os(iOS)` and the Mac gets inert
// stand-ins.
import CoreLocation
import Foundation
import MapKit
#if os(iOS)
import UIKit
#else
import AppKit
#endif

final class LexyModule: ExactModule {
    override class var views: [String: ExactNativeFactory] {
        [
            "lexy-map": ExactNativeFactory(snapshot: true) { props, events in MapView(props: props, events: events) },
        ]
    }

    /// The street line for a coordinate, as the Lexus app shows it: number
    /// and street, else the place's name; empty when there is none.
    override func later(_ request: [String: Any], reply: ExactReply) {
        // The demo's server latency (demo.ts): TypeScript sources have no
        // timers. Under the agent, whose clock is the driver's, at once.
        if request["op"] as? String == "wait" {
            let ms = (request["ms"] as? Double) ?? 0
            if context.agent || ms <= 0 { return reply.send([:]) }
            DispatchQueue.main.asyncAfter(deadline: .now() + ms / 1000) { reply.send([:]) }
            return
        }
        // This device's Observe metrics: the service's own answer, as it gives it.
        if request["op"] as? String == "observe" {
            let limit = (request["limit"] as? Int) ?? Int((request["limit"] as? Double) ?? 50)
            service("observe", ["op": "recent", "limit": limit]) { answer in
                reply.send(answer ?? [:])
            }
            return
        }
        // Any app's URL: Contract's openURL takes only http(s), mailto and tel,
        // and the maps apps answer their own schemes (maps:, comgooglemaps:, waze:).
        if request["op"] as? String == "open" {
            guard let text = request["url"] as? String, let url = URL(string: text) else { return reply.fail("open: no URL") }
            if context.agent { return reply.send(["opened": true]) }
            #if os(iOS)
            DispatchQueue.main.async { UIApplication.shared.open(url) { opened in reply.send(["opened": opened]) } }
            #else
            reply.send(["opened": NSWorkspace.shared.open(url)])
            #endif
            return
        }
        // Which maps apps are installed: canOpenURL on each one's scheme
        // (declared under LSApplicationQueriesSchemes in app.json).
        if request["op"] as? String == "installed" {
            if context.agent { return reply.send(["apple": true, "google": true, "waze": true]) }
            #if os(iOS)
            DispatchQueue.main.async {
                let has = { (scheme: String) in URL(string: "\(scheme)://").map(UIApplication.shared.canOpenURL) ?? false }
                reply.send(["apple": has("maps"), "google": has("comgooglemaps"), "waze": has("waze")])
            }
            #else
            reply.send(["apple": true, "google": false, "waze": false])
            #endif
            return
        }
        guard request["op"] as? String == "geocode",
              let latitude = request["latitude"] as? Double, let longitude = request["longitude"] as? Double else {
            return reply.fail("Lexy answers only geocode later")
        }
        if context.agent { return reply.send(["line": "1 Apple Park Way"]) }
        CLGeocoder().reverseGeocodeLocation(CLLocation(latitude: latitude, longitude: longitude)) { placemarks, error in
            if let error { return reply.fail(error.localizedDescription) }
            let place = placemarks?.first
            let number = place?.subThoroughfare?.trimmingCharacters(in: .whitespaces) ?? ""
            let street = place?.thoroughfare?.trimmingCharacters(in: .whitespaces) ?? ""
            let line: String
            if !street.isEmpty {
                line = number.isEmpty || street == number || street.hasPrefix(number + " ") ? street : "\(number) \(street)"
            } else {
                line = place?.name?.trimmingCharacters(in: .whitespaces) ?? ""
            }
            reply.send(["line": line])
        }
    }

    override func call(_ request: [String: Any]) throws -> [String: Any] {
        guard request["op"] as? String == "haptic" else { throw ExactNativeRefusal("Lexy answers only haptic now") }
        #if os(iOS)
        switch request["style"] as? String {
        case "selection": UISelectionFeedbackGenerator().selectionChanged()
        case "impact-light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
        default: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        #endif
        return ["ok": true]
    }
}
let exactModule: ExactModule.Type = LexyModule.self

#if os(iOS)
private func png(_ view: UIView) throws -> Data {
    let size = view.bounds.size
    guard size.width > 0, size.height > 0 else { throw ExactNativeRefusal("no bounds yet") }
    return UIGraphicsImageRenderer(bounds: view.bounds).pngData { _ in view.drawHierarchy(in: view.bounds, afterScreenUpdates: true) }
}

// MARK: - <lexy-map>

/// Props: `latitude`, `longitude`, `zoom` (a web-map zoom level, default 16),
/// `pin` and `places` ("true" | "false"), `interactive` ("true" | "false"),
/// `marker-title` (the marker's: the car's name).
/// The map fades in once MapKit has drawn its first region, as Lexy's does.
private final class MapDelegate: NSObject, MKMapViewDelegate {
    var rendered: (() -> Void)?
    /// Only a whole render at the map's own size shows the car's region:
    /// one at no size, or with tiles still missing, is MapKit's ocean or
    /// its empty grid, which would flash before the street.
    func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
        if fullyRendered, !mapView.bounds.isEmpty { rendered?() }
    }
    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        let view = MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: "car")
        view.glyphImage = UIImage(systemName: "car.fill")
        view.markerTintColor = .systemBlue
        view.displayPriority = .required
        return view
    }
}

/// A map that sets its camera again once it has a size: a camera set at no
/// size frames the wrong region until the next render.
private final class SizedMap: MKMapView {
    var cameraAtSize: MKMapCamera?
    private var sized = CGSize.zero
    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.size != sized, !bounds.isEmpty else { return }
        sized = bounds.size
        if let c = cameraAtSize { setCamera(c, animated: false) }
    }
}

/// The view Exact places: the live map, or first a still picture of it.
/// Says when its size or its appearance changes, which a still is drawn for.
private final class MapBox: UIView {
    var changed: (() -> Void)?
    private var sized = CGSize.zero
    override init(frame: CGRect) {
        super.init(frame: frame)
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (box: MapBox, _: UITraitCollection) in box.changed?() }
    }
    required init?(coder: NSCoder) { nil }
    override func layoutSubviews() {
        super.layoutSubviews()
        for v in subviews { v.frame = bounds }
        guard bounds.size != sized, !bounds.isEmpty else { return }
        sized = bounds.size
        changed?()
    }
}

/// A still map (`interactive="false"`, no pin) starts as an MKMapSnapshotter
/// picture, drawn off the main thread. Making an MKMapView costs the main
/// thread tens of ms (MapKit's engine starts with the first one), which at
/// launch landed right where the app becomes usable. The live map, whose
/// Legal link MapKit requires to work, joins under the still once it has
/// shown, and replaces it when it has drawn the same region.
private final class MapView: ExactNativeInstance {
    private let box = MapBox()
    private var map: SizedMap?
    private let still = UIImageView()
    private let delegate = MapDelegate()
    private let pin = MKPointAnnotation()
    private var props: [String: String] = [:]
    private var camera = MKMapCamera()
    private var snapshotter: MKMapSnapshotter?
    private var shown = false

    init(props: [String: String], events: ExactNativeEvents) {
        super.init(events: events)
        box.alpha = 0
        box.clipsToBounds = true
        delegate.rendered = { [weak self] in self?.liveRendered() }
        // Shown anyway if the tiles never finish (offline): late, not wrong.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in self?.fadeIn() }
        apply(props)
        if stillFirst {
            box.addSubview(still)
            box.changed = { [weak self] in self?.drawStill() }
        } else {
            makeLive()
        }
        events.load()
    }

    override var view: ExactNativeView { box }
    override func setProps(_ props: [String: String]) throws {
        apply(props)
        if map == nil { stillFirst ? drawStill() : makeLive() }
    }

    private var stillFirst: Bool { props["interactive"] == "false" && props["pin"] == "false" }

    private func fadeIn(then done: (() -> Void)? = nil) {
        guard !shown else { done?(); return }
        shown = true
        UIView.animate(withDuration: 0.32) { self.box.alpha = 1 } completion: { _ in done?() }
    }

    private func drawStill() {
        guard map == nil, !box.bounds.isEmpty else { return }
        snapshotter?.cancel()
        let options = MKMapSnapshotter.Options()
        options.camera = camera
        options.size = box.bounds.size
        options.pointOfInterestFilter = props["places"] == "false" ? .excludingAll : .includingAll
        options.traitCollection = box.traitCollection
        let snapshotter = MKMapSnapshotter(options: options)
        self.snapshotter = snapshotter
        snapshotter.start(with: .main) { [weak self] snap, _ in
            guard let self, self.snapshotter === snapshotter, map == nil else { return }
            self.snapshotter = nil
            guard let snap else { return makeLive() } // offline: the live map waits for its tiles
            still.image = snap.image
            // The live map after the still's fade, so its making drops no
            // frame of it.
            fadeIn { [weak self] in self?.makeLive() }
        }
    }

    private func makeLive() {
        guard map == nil else { return }
        snapshotter?.cancel(); snapshotter = nil
        let map = SizedMap(frame: box.bounds)
        map.delegate = delegate
        if still.superview != nil { map.alpha = 0 }
        box.addSubview(map)
        self.map = map
        configure(map)
    }

    /// The live map drew its region: it shows, and the still goes.
    private func liveRendered() {
        guard let map else { return }
        fadeIn()
        guard still.superview != nil, map.alpha == 0 else { return }
        UIView.animate(withDuration: 0.2) { map.alpha = 1 } completion: { [weak self] _ in
            self?.still.removeFromSuperview(); self?.still.image = nil
        }
    }

    private func apply(_ props: [String: String]) {
        self.props = props
        let centre = CLLocationCoordinate2D(latitude: Double(props["latitude"] ?? "") ?? 0, longitude: Double(props["longitude"] ?? "") ?? 0)
        let zoom = Double(props["zoom"] ?? "") ?? 16
        // A web-map zoom level as a camera distance: zoom 16 is a few blocks.
        let distance = 40_000_000 / pow(2, zoom) * 1.6
        camera = MKMapCamera(lookingAtCenter: centre, fromDistance: distance, pitch: 0, heading: 0)
        pin.coordinate = centre
        pin.title = props["marker-title"].flatMap { $0.isEmpty ? nil : $0 }
        if let map { configure(map) }
    }

    private func configure(_ map: SizedMap) {
        map.cameraAtSize = camera
        map.setCamera(camera, animated: false)
        map.pointOfInterestFilter = props["places"] == "false" ? .excludingAll : .includingAll
        let interactive = props["interactive"] != "false"
        map.isScrollEnabled = interactive; map.isZoomEnabled = interactive
        map.isRotateEnabled = interactive; map.isPitchEnabled = interactive
        // status-map-screen: every built-in control hidden, the compass too.
        map.showsCompass = false
        // Still touchable when still: MapKit's Legal link must open.
        map.isUserInteractionEnabled = true
        if props["pin"] != "false" { if map.annotations.isEmpty { map.addAnnotation(pin) } } else { map.removeAnnotations(map.annotations) }
    }

    override func snapshot() throws -> Data {
        let size = box.bounds.size
        guard size.width > 0, size.height > 0 else { throw ExactNativeRefusal("no bounds yet") }
        let options = MKMapSnapshotter.Options()
        options.camera = map?.camera ?? camera
        options.size = size
        options.pointOfInterestFilter = props["places"] == "false" ? .excludingAll : .includingAll
        let done = DispatchSemaphore(value: 0)
        var result: MKMapSnapshotter.Snapshot?
        MKMapSnapshotter(options: options).start(with: .global()) { snap, _ in result = snap; done.signal() }
        guard done.wait(timeout: .now() + 4) == .success, let snap = result else { throw ExactNativeRefusal("map snapshot failed") }
        return UIGraphicsImageRenderer(size: size).pngData { _ in
            snap.image.draw(in: CGRect(origin: .zero, size: size))
            if props["pin"] != "false" {
                let p = snap.point(for: pin.coordinate)
                UIColor.systemBlue.setFill()
                UIBezierPath(ovalIn: CGRect(x: p.x - 9, y: p.y - 9, width: 18, height: 18)).fill()
            }
        }
    }
}

#else
private final class MapView: ExactNativeInstance {
    private let empty = NSView()
    init(props: [String: String], events: ExactNativeEvents) { super.init(events: events); events.load() }
    override var view: ExactNativeView { empty }
    override func prepareForReuse() throws {}
}
#endif

