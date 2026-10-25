import Foundation
#if os(iOS)
import UIKit

// Let UIKit place the columns around the fold and give each its own scroll view
class DeveloperSplitScreen: ExactNativeScreen {
    let split = UISplitViewController(style: .doubleColumn)
    fileprivate let recent: DeveloperList
    fileprivate let secondary: DeveloperList

    init(prefix: String, events: ExactNativeEvents) {
        recent = DeveloperList(id: "\(prefix)-recent")
        secondary = DeveloperList(id: "\(prefix)-secondary")
        super.init(screen: split, events: events)
        split.preferredSplitBehavior = .tile
        split.preferredDisplayMode = .oneBesideSecondary
        split.preferredPrimaryColumnWidthFraction = 0.5
        split.minimumPrimaryColumnWidth = 0
        split.maximumPrimaryColumnWidth = .greatestFiniteMagnitude
        split.displayModeButtonVisibility = .never
        split.presentsWithGesture = false
        for (list, column) in [(recent, UISplitViewController.Column.primary), (secondary, .secondary)] {
            let navigation = UINavigationController(rootViewController: list)
            navigation.setNavigationBarHidden(true, animated: false)
            split.setViewController(navigation, for: column)
        }
    }
}

final class PerformanceScreen: DeveloperSplitScreen {
    private var payload = ""
    private var offset = ""
    init(props: [String: String], events: ExactNativeEvents) throws {
        super.init(prefix: "performance", events: events)
        try setProps(props)
        events.load()
    }

    override func setProps(_ props: [String: String]) throws {
        let next = props["payload"] ?? ""
        let zone = props["utc-offset"] ?? "0"
        guard next != payload || zone != offset else { return }
        let data = next.isEmpty ? nil : try JSONDecoder().decode(PerformanceData.self, from: Data(next.utf8))
        payload = next
        offset = zone
        let format = DateFormatter()
        format.dateStyle = .medium
        format.timeStyle = .short
        format.timeZone = TimeZone(secondsFromGMT: Int((Double(zone) ?? 0) * 60))
        guard let data, data.ok else {
            recent.sections = [DeveloperSection(title: "", rows: [], footer: "Observe isn’t running in this build, so there is nothing recorded on this device.")]
            secondary.sections = []
            return
        }
        var sections: [DeveloperSection] = []
        if !data.latest.isEmpty {
            sections.append(DeveloperSection(title: data.launch == data.session ? "This Launch" : "Last Launch", rows: data.latest.map { $0.row(format: format, launch: true) }))
        }
        let screens = data.metrics.filter { $0.session == data.session && $0.category == "navigation" }
        if !screens.isEmpty {
            sections.append(DeveloperSection(title: "Screens", rows: screens.enumerated().map { index, metric in
                var row = metric.row(format: format, launch: false)
                row.id = "perf-nav-\(index)"
                return row
            }))
        }
        if sections.isEmpty {
            sections = [DeveloperSection(title: "", rows: [], footer: "Nothing recorded yet. Open a screen or relaunch the app.")]
        }
        recent.sections = sections
        secondary.sections = data.summary.isEmpty ? [] : [DeveloperSection(title: "Median", rows: data.summary.map {
            DeveloperRow(id: "perf-median-\($0.name)", title: metricTitle($0.name, route: ""), value: milliseconds($0.median), detail: $0.count == 1 ? "1 launch" : "\($0.count) launches", numeric: true)
        }, footer: "\(data.metrics.filter(\.sent).count) of \(data.metrics.count) sent to Observe.")]
    }
}

final class UpdatesScreen: DeveloperSplitScreen {
    init(props: [String: String], events: ExactNativeEvents) {
        super.init(prefix: "updates", events: events)
        secondary.choose = { events.message($0) }
        setProps(props)
        events.load()
    }
    override func setProps(_ props: [String: String]) {
        let sequence = Double(props["sequence"] ?? "0") ?? 0
        let embedded = Double(props["embedded"] ?? "0") ?? 0
        let staged = props["staged"] == "true"
        func fact(_ id: String, _ title: String, _ value: String) -> DeveloperRow {
            DeveloperRow(id: "updates-\(id)", title: title, value: value, detail: "", report: value, numeric: id == "seq" || id == "embedded-seq")
        }
        var sections = [DeveloperSection(title: "Running", rows: [
            fact("version", "Version", props["version"] ?? ""),
            fact("source", "Source", sequence > embedded ? "Downloaded update" : "Embedded in the build"),
            fact("seq", "Sequence", props["sequence"] ?? "0"),
            fact("embedded-seq", "Embedded sequence", props["embedded"] ?? "0"),
        ], footer: "Built with Exact \(props["exact"] ?? "")."), DeveloperSection(title: "Stream", rows: [
            fact("stream", "Stream", props["stream"] ?? ""),
            fact("compat", "Compatibility", props["compatibility"] ?? "—"),
            fact("interpreted", "Interpreted", props["interpreted"] ?? "None"),
        ], footer: "A binary takes updates only from the stream its compatibility id names: a bundle built against other native code never reaches it.")]
        if let sunset = props["sunset"], !sunset.isEmpty {
            sections.append(DeveloperSection(title: "This build is being retired", rows: [], footer: sunset))
        }
        recent.sections = sections
        secondary.sections = [DeveloperSection(title: "Actions", rows: [
            DeveloperRow(id: "updates-check", title: "Check for Update", value: "", detail: "", action: "check"),
            DeveloperRow(id: "updates-apply", title: staged ? "Apply Downloaded Update" : "No Update Downloaded", value: "", detail: "", action: "apply", enabled: staged),
        ], footer: props["did-check"] == "true" && !staged ? "Checked. A newer bundle downloads in the background and appears here when it is ready." : "An update downloads in the background and applies at the next launch, or now with Apply.")]
    }
}

private struct PerformanceData: Decodable {
    let ok: Bool
    let session: String
    let launch: String
    let latest: [PerformanceMetric]
    let metrics: [PerformanceMetric]
    let summary: [Summary]
    struct Summary: Decodable { let name: String; let count: Int; let median: Double }
}

private struct PerformanceMetric: Decodable {
    let session: String, category: String, name: String, route: String
    let time: Double, value: Double
    let sent: Bool
    let fromStart: String, phases: String, items: String, changes: String, trace: String, steps: String

    func row(format: DateFormatter, launch: Bool) -> DeveloperRow {
        let timestamp = format.string(from: Date(timeIntervalSince1970: time))
        var lines = [timestamp]
        if launch {
            for (label, value) in [("", fromStart), ("Phases: ", phases), ("Held by (ms from process start): ", items), ("Still changing: ", changes), ("Waited on: ", trace)] where !value.isEmpty {
                lines.append(label + value)
            }
        } else if !steps.isEmpty {
            lines.append(steps)
        }
        let detail = lines.joined(separator: "\n")
        let report = ([timestamp, milliseconds(value)] + Array(lines.dropFirst())).joined(separator: "\n")
        return DeveloperRow(id: "perf-launch-\(name)", title: metricTitle(name, route: route), value: milliseconds(value), detail: detail, report: launch && name == "timeToInteractive" ? report : nil, numeric: true)
    }
}

private func milliseconds(_ seconds: Double) -> String { "\(Int((seconds * 1000).rounded())) ms" }

private func metricTitle(_ name: String, route: String) -> String {
    let labels = ["coldLaunchTime": "LAUNCH · cold", "warmLaunchTime": "LAUNCH · warm", "timeToFirstRender": "TTR", "timeToInteractive": "TTI", "cold_ttr": "COLD TTR", "warm_ttr": "WARM TTR", "ttr": "TTR", "tti": "TTI", "download_time": "UPDATE", "downloadTime": "UPDATE"]
    if name == "coldLaunchTime" || name == "warmLaunchTime" { return labels[name]! }
    return "\(labels[name] ?? name) · \(route.isEmpty ? "launch" : route)"
}

fileprivate struct DeveloperRow {
    var id: String
    let title: String, value: String, detail: String
    var report: String? = nil
    var numeric = false
    var action: String? = nil
    var enabled = true
}

fileprivate struct DeveloperSection {
    let title: String
    let rows: [DeveloperRow]
    var footer: String? = nil
}

fileprivate final class DeveloperList: UITableViewController {
    var sections: [DeveloperSection] = [] { didSet { if isViewLoaded { tableView.reloadData() } } }
    var choose: ((String) -> Void)?
    private let identifier: String
    init(id: String) { identifier = id; super.init(style: .insetGrouped) }
    required init?(coder: NSCoder) { nil }
    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.accessibilityIdentifier = identifier
        tableView.register(DeveloperCell.self, forCellReuseIdentifier: "metric")
        tableView.allowsSelection = true
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 100
    }
    override func numberOfSections(in tableView: UITableView) -> Int { sections.count }
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { sections[section].rows.count }
    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? { sections[section].title }
    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? { sections[section].footer }
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "metric", for: indexPath) as! DeveloperCell
        cell.show(sections[indexPath.section].rows[indexPath.row])
        return cell
    }
    override func tableView(_ tableView: UITableView, willSelectRowAt indexPath: IndexPath) -> IndexPath? {
        let row = sections[indexPath.section].rows[indexPath.row]
        return row.action != nil && row.enabled ? indexPath : nil
    }
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let row = sections[indexPath.section].rows[indexPath.row]
        if row.enabled, let action = row.action { choose?(action) }
    }
    override func tableView(_ tableView: UITableView, contextMenuConfigurationForRowAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
        let row = sections[indexPath.section].rows[indexPath.row]
        guard row.action == nil else { return nil }
        let report = row.report ?? [row.title, row.value, row.detail].filter { !$0.isEmpty }.joined(separator: "\n")
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { _ in
            UIMenu(children: [UIAction(title: "Copy", image: UIImage(systemName: "doc.on.doc")) { _ in UIPasteboard.general.string = report }])
        }
    }
}

private final class DeveloperCell: UITableViewCell {
    private let name = UILabel()
    private let value = UILabel()
    private let detail = UILabel()
    private let heading = UIStackView()
    private var valueWidth: NSLayoutConstraint?
    private var actionEnabled: Bool?
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        name.numberOfLines = 0
        detail.numberOfLines = 0
        value.numberOfLines = 0
        detail.textColor = .secondaryLabel
        value.textColor = .secondaryLabel
        value.setContentCompressionResistancePriority(.required, for: .horizontal)
        value.setContentHuggingPriority(.required, for: .horizontal)
        for label in [name, value, detail] { label.adjustsFontForContentSizeCategory = true }
        heading.addArrangedSubview(name)
        heading.addArrangedSubview(value)
        heading.alignment = .firstBaseline
        heading.spacing = 8
        let stack = UIStackView(arrangedSubviews: [heading, detail])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        let margins = contentView.layoutMarginsGuide
        valueWidth = value.widthAnchor.constraint(lessThanOrEqualTo: margins.widthAnchor, multiplier: 0.55)
        registerForTraitChanges([UITraitPreferredContentSizeCategory.self]) { (cell: DeveloperCell, _: UITraitCollection) in cell.adjustLayout() }
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: margins.leadingAnchor), stack.trailingAnchor.constraint(equalTo: margins.trailingAnchor), stack.topAnchor.constraint(equalTo: margins.topAnchor), stack.bottomAnchor.constraint(equalTo: margins.bottomAnchor)])
    }
    required init?(coder: NSCoder) { nil }
    override func tintColorDidChange() {
        super.tintColorDidChange()
        if let actionEnabled { name.textColor = actionEnabled ? tintColor : .tertiaryLabel }
    }
    private func adjustLayout() {
        let stacked = traitCollection.preferredContentSizeCategory.isAccessibilityCategory
        heading.axis = stacked ? .vertical : .horizontal
        heading.alignment = stacked ? .leading : .firstBaseline
        valueWidth?.isActive = !stacked
    }
    func show(_ row: DeveloperRow) {
        adjustLayout()
        name.font = .preferredFont(forTextStyle: .body)
        detail.font = .preferredFont(forTextStyle: .footnote)
        value.font = row.numeric ? UIFontMetrics(forTextStyle: .body).scaledFont(for: .monospacedDigitSystemFont(ofSize: 17, weight: .regular)) : .preferredFont(forTextStyle: .body)
        accessibilityIdentifier = row.action == nil ? nil : row.id
        accessibilityTraits = row.action == nil ? [] : (row.enabled ? .button : [.button, .notEnabled])
        actionEnabled = row.action == nil ? nil : row.enabled
        name.textColor = row.action == nil ? .label : (row.enabled ? tintColor : .tertiaryLabel)
        selectionStyle = row.action != nil && row.enabled ? .default : .none
        name.text = row.title
        value.text = row.value
        value.accessibilityIdentifier = row.id
        detail.text = row.detail
        detail.isHidden = row.detail.isEmpty
    }
}
#else
import AppKit
final class DeveloperScreenPlaceholder: ExactNativeInstance {
    private let placeholder = NSView()
    override var view: ExactNativeView { placeholder }
}
#endif
