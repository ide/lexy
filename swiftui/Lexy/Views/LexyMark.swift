import SwiftUI

/// The app icon's tach ring, redline and L, without the icon's black tile. Drawn with semantic
/// colors so it follows light and dark mode.
struct LexyMark: View {
    var size: CGFloat = 76

    private static let viewBox = CGRect(x: 148, y: 163, width: 744, height: 744)
    private static let metal = SVGPath("M 436.58 896.58 A 371.30 371.30 0 1 1 705.19 212.92 L 692.33 235.29 A 345.50 345.50 0 1 0 442.38 871.44 Z")
    private static let red = SVGPath("M 706.31 213.57 A 371.30 371.30 0 0 1 891.39 531.56 L 865.59 531.78 A 345.50 345.50 0 0 0 693.37 235.89 Z")
    private static let redline = SVGPath("M 891.36 539.98 A 371.30 371.30 0 0 1 758.77 819.23 L 742.18 799.47 A 345.50 345.50 0 0 0 865.57 539.62 Z")
    private static let glyph = SVGPath("M 505.19 370.66 A 14.00 14.00 0 0 1 517.45 363.99 L 592.07 365.79 A 5.00 5.00 0 0 1 596.18 373.46 L 440.06 620.08 A 12.00 12.00 0 0 0 450.20 638.50 L 742.55 638.50 A 4.00 4.00 0 0 1 745.22 645.48 L 697.02 688.72 A 5.00 5.00 0 0 1 693.69 690.00 L 394.90 690.00 A 48.00 48.00 0 0 1 354.00 616.88 Z")

    var body: some View {
        Canvas { context, canvas in
            let box = LexyMark.viewBox
            let scale = canvas.width / box.width
            context.scaleBy(x: scale, y: scale)
            context.translateBy(x: -box.minX, y: -box.minY)
            let label = Color.primary
            context.fill(LexyMark.metal, with: .linearGradient(
                Gradient(stops: [.init(color: label.opacity(0.9), location: 0), .init(color: label.opacity(0.55), location: 0.55),
                                 .init(color: label.opacity(0.2), location: 0.95)]),
                startPoint: CGPoint(x: 0, y: 163), endPoint: CGPoint(x: 0, y: 906)))
            context.fill(LexyMark.red, with: .color(.red))
            context.fill(LexyMark.redline, with: .linearGradient(
                Gradient(colors: [.red.opacity(0.7), .red.opacity(0.12)]),
                startPoint: CGPoint(x: 878, y: 540), endPoint: CGPoint(x: 750, y: 809)))
            context.fill(LexyMark.glyph, with: .linearGradient(
                Gradient(colors: [label, label.opacity(0.78)]),
                startPoint: CGPoint(x: 0, y: 364), endPoint: CGPoint(x: 0, y: 690)))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Lexy")
        .accessibilityAddTraits(.isImage)
        .accessibilityIdentifier("lexy-mark")
    }
}

/// Parses an SVG path of absolute M, L, A and Z commands. Arcs become cubic Béziers (SVG 1.1
/// implementation notes, F.6).
nonisolated func SVGPath(_ d: String) -> Path {
    var path = Path()
    let tokens = d.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
    var i = 0
    var current = CGPoint.zero
    func number() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i]) ?? 0) }
    while i < tokens.count {
        let command = tokens[i]
        i += 1
        switch command {
        case "M":
            current = CGPoint(x: number(), y: number())
            path.move(to: current)
        case "L":
            current = CGPoint(x: number(), y: number())
            path.addLine(to: current)
        case "A":
            let rx = number(), ry = number(), rotation = number(), large = number() != 0, sweep = number() != 0
            let end = CGPoint(x: number(), y: number())
            addArc(&path, from: current, to: end, rx: rx, ry: ry, rotation: rotation * .pi / 180, large: large, sweep: sweep)
            current = end
        case "Z":
            path.closeSubpath()
        default:
            break
        }
    }
    return path
}

nonisolated private func addArc(_ path: inout Path, from p1: CGPoint, to p2: CGPoint, rx: CGFloat, ry: CGFloat,
                                rotation phi: CGFloat, large: Bool, sweep: Bool) {
    var rx = abs(rx), ry = abs(ry)
    guard rx > 0, ry > 0, p1 != p2 else { path.addLine(to: p2); return }
    let cosPhi = cos(phi), sinPhi = sin(phi)
    let dx = (p1.x - p2.x) / 2, dy = (p1.y - p2.y) / 2
    let x1p = cosPhi * dx + sinPhi * dy
    let y1p = -sinPhi * dx + cosPhi * dy
    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lambda > 1 { rx *= sqrt(lambda); ry *= sqrt(lambda) }
    let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    let den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    var coef = sqrt(max(0, num / den))
    if large == sweep { coef = -coef }
    let cxp = coef * rx * y1p / ry
    let cyp = -coef * ry * x1p / rx
    let cx = cosPhi * cxp - sinPhi * cyp + (p1.x + p2.x) / 2
    let cy = sinPhi * cxp + cosPhi * cyp + (p1.y + p2.y) / 2
    func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
        let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a
    }
    let theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    var delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if !sweep && delta > 0 { delta -= 2 * .pi }
    if sweep && delta < 0 { delta += 2 * .pi }
    let segments = max(1, Int(ceil(abs(delta) / (.pi / 2))))
    let step = delta / CGFloat(segments)
    let t = 4 / 3 * tan(step / 4)
    func point(_ a: CGFloat) -> CGPoint {
        CGPoint(x: cx + rx * cos(a) * cosPhi - ry * sin(a) * sinPhi, y: cy + rx * cos(a) * sinPhi + ry * sin(a) * cosPhi)
    }
    func derivative(_ a: CGFloat) -> CGPoint {
        CGPoint(x: -rx * sin(a) * cosPhi - ry * cos(a) * sinPhi, y: -rx * sin(a) * sinPhi + ry * cos(a) * cosPhi)
    }
    var a = theta1
    for _ in 0..<segments {
        let b = a + step
        let pa = point(a), pb = point(b), da = derivative(a), db = derivative(b)
        path.addCurve(to: pb, control1: CGPoint(x: pa.x + t * da.x, y: pa.y + t * da.y), control2: CGPoint(x: pb.x - t * db.x, y: pb.y - t * db.y))
        a = b
    }
}
