import SwiftUI


extension View {
    func card(padding: CGFloat? = 16) -> some View {
        self.padding(padding.map { EdgeInsets(top: $0, leading: $0, bottom: $0, trailing: $0) } ?? EdgeInsets())
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
    }

    /// Pulses opacity between 0.4 and 1 every 800 ms while `active`.
    func pendingPulse(_ active: Bool) -> some View {
        modifier(PendingPulse(active: active))
    }

    func timedScreen(_ route: String) -> some View {
        onAppear { Timings.shared.appeared(route) }
    }
}

private struct PendingPulse: ViewModifier {
    let active: Bool
    @State private var dim = false

    func body(content: Content) -> some View {
        content
            .opacity(active && dim ? 0.4 : 1)
            .animation(active ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true) : .default, value: dim)
            .onAppear { dim = active }
            .onChange(of: active) { _, on in dim = on }
    }
}

/// A section heading over a card, in the type `List` uses for section headers.
struct CardTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .padding(.leading, 8)
            .padding(.top, 4)
            .accessibilityAddTraits(.isHeader)
    }
}

struct WarningBanner: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
                .font(.body)
                .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.bold))
                Text(message).font(.subheadline.weight(.medium)).opacity(0.85)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.orange)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.orange.opacity(0.15), in: .rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }
}

struct VehicleStateView: View {
    let symbol: String
    let title: String
    let message: String
    let label: String
    let action: () async -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: symbol)
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(label) { Task { await action() } }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .frame(maxWidth: 320)
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct StatusLine: View {
    let symbol: String
    let tint: Color
    let words: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.footnote)
                .foregroundStyle(tint)
                .frame(width: 22, height: 20)
            Text(words).font(.subheadline)
        }
    }
}

/// A card with a badge, a title over a subtitle, and a chevron that turns as the detail opens and
/// closes.
struct ExpandableCard<Detail: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String
    @Binding var open: Bool
    var id: String
    @ViewBuilder var detail: Detail

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.3)) { open.toggle() }
            } label: {
                HStack(spacing: 8) {
                    HStack(spacing: 12) {
                        Image(systemName: symbol)
                            .font(.body)
                            .foregroundStyle(tint)
                            .frame(width: 36, height: 36)
                            .background(tint.opacity(0.15), in: .circle)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title)
                                .font(.headline)
                                .foregroundStyle(Color(.label))
                                .lineLimit(1)
                            if !subtitle.isEmpty {
                                Text(subtitle)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(open ? 90 : 0))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("toggle-\(id)")
            .accessibilityValue(open ? "Expanded" : "Collapsed")
            // The detail is always laid out at its full height; opening animates the clip from 0 to
            // that height, so the contents are revealed in place.
            detail
                .fixedSize(horizontal: false, vertical: true)
                .frame(height: open ? nil : 0, alignment: .top)
                .clipped()
                .allowsHitTesting(open)
                .accessibilityHidden(!open)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
        .clipShape(.rect(cornerRadius: 18))
    }
}

struct Placeholder: View {
    var width: CGFloat?
    var height: CGFloat
    var radius: CGFloat = 6

    var body: some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(Color(.tertiarySystemFill))
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
    }
}
