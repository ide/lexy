import Darwin
import Foundation
import Observation
import QuartzCore

/// Launch and screen timings for Developer Tools' Performance screen, kept on the device for seven
/// days. A launch records process start to `init`, to the first frame (TTR), and to the first frame
/// with nothing loading (TTI). A screen records the time from the tap that opened it to its first
/// frame: cold the first time it shows in a launch, warm after.
@Observable
final class Timings {
    nonisolated struct Metric: Codable, Identifiable, Equatable {
        enum Kind: String, Codable { case premain, ttr, tti, screen }
        var id = UUID()
        var session: String
        /// Epoch milliseconds.
        var time: Double
        var kind: Kind
        var route: String
        /// Milliseconds.
        var value: Double
        var warm = false
    }

    static let shared = Timings()

    let session = UUID().uuidString
    private let processStart: Double
    private let initAt: Double
    private(set) var metrics: [Metric] = []
    /// Metrics recorded before this are hidden.
    private(set) var clearedAt: Double
    private var launchRoute = ""
    private var firstFrameSeen = false
    private var interactiveSeen = false
    private var asked: (route: String, at: Double)?
    private var seen: Set<String> = []
    private let file: URL

    init() {
        initAt = nowMs()
        processStart = Timings.processStartMs() ?? initAt
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        file = base.appending(path: "lexy-timings.json")
        clearedAt = UserDefaults.standard.double(forKey: "lexy.timings.cleared")
        let week = initAt - 7 * 86_400_000
        metrics = ((try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode([Metric].self, from: $0) } ?? [])
            .filter { $0.time > week }
        record(.premain, route: "", value: initAt - processStart)
    }

    private static func processStartMs() -> Double? {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return nil }
        let t = info.kp_proc.p_un.__p_starttime
        return Double(t.tv_sec) * 1000 + Double(t.tv_usec) / 1000
    }

    private func record(_ kind: Metric.Kind, route: String, value: Double, warm: Bool = false) {
        metrics.insert(Metric(session: session, time: nowMs(), kind: kind, route: route, value: value, warm: warm), at: 0)
        if metrics.count > 500 { metrics.removeLast(metrics.count - 500) }
        if let data = try? JSONEncoder().encode(metrics) { try? data.write(to: file, options: .atomic) }
    }

    func launchFrame(route: String) {
        guard !firstFrameSeen else { return }
        firstFrameSeen = true
        launchRoute = route
        seen.insert(route)
        Timings.afterNextFrame { [self] at in record(.ttr, route: route, value: at - processStart) }
    }

    func launchInteractive(route: String) {
        guard !interactiveSeen else { return }
        interactiveSeen = true
        Timings.afterNextFrame { [self] at in record(.tti, route: route, value: at - processStart) }
    }

    func asked(_ route: String) {
        asked = (route, nowMs())
    }

    func appeared(_ route: String) {
        guard firstFrameSeen, let ask = asked, ask.route == route else { return }
        asked = nil
        let warm = seen.contains(route)
        seen.insert(route)
        Timings.afterNextFrame { [self] at in record(.screen, route: route, value: at - ask.at, warm: warm) }
    }

    func clear() {
        clearedAt = nowMs()
        UserDefaults.standard.set(clearedAt, forKey: "lexy.timings.cleared")
    }

    // MARK: What Performance shows

    private var shown: [Metric] { metrics.filter { $0.time > clearedAt } }

    /// The newest launch's marks, in the order they happen.
    var latestLaunch: [Metric] {
        guard let launch = shown.first(where: { $0.kind != .screen })?.session else { return [] }
        let order: [Metric.Kind] = [.premain, .ttr, .tti]
        return shown.filter { $0.session == launch && $0.kind != .screen }
            .sorted { order.firstIndex(of: $0.kind)! < order.firstIndex(of: $1.kind)! }
    }

    var latestIsThisLaunch: Bool { latestLaunch.first?.session == session }

    /// Screens shown this launch, newest first.
    var screens: [Metric] { shown.filter { $0.session == session && $0.kind == .screen } }

    var medians: [(kind: Metric.Kind, count: Int, median: Double)] {
        [Metric.Kind.premain, .ttr, .tti].compactMap { kind in
            let values = shown.filter { $0.kind == kind }.map(\.value).sorted()
            guard !values.isEmpty else { return nil }
            let mid = values.count / 2
            return (kind, values.count, values.count % 2 == 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2)
        }
    }

    var launchRouteName: String { launchRoute }

    // MARK: Frames

    /// Calls `body` with the wall time of the next frame the display shows.
    static func afterNextFrame(_ body: @escaping (Double) -> Void) {
        FrameWaiter(body).start()
    }

    private final class FrameWaiter: NSObject {
        private let body: (Double) -> Void
        private var link: CADisplayLink?
        private var retained: FrameWaiter?

        init(_ body: @escaping (Double) -> Void) { self.body = body }

        func start() {
            retained = self
            link = CADisplayLink(target: self, selector: #selector(tick(_:)))
            link?.add(to: .main, forMode: .common)
        }

        @objc private func tick(_ link: CADisplayLink) {
            // The frame being prepared shows at `targetTimestamp`, in media time.
            let ahead = max(0, link.targetTimestamp - CACurrentMediaTime()) * 1000
            link.invalidate()
            self.link = nil
            body(nowMs() + ahead)
            retained = nil
        }
    }
}

extension Timings.Metric.Kind {
    var pill: String {
        switch self {
        case .premain: "PRE-MAIN"
        case .ttr: "TTR"
        case .tti: "TTI"
        case .screen: "TTR"
        }
    }
}
