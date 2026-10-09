import Foundation

/// The Doors & Windows summary: a headline verdict, a subline naming the settled readings, and the
/// badge's symbol and tint.
nonisolated struct ClosureSummary: Equatable, Sendable {
    enum Tint: Sendable { case secondary, green, orange }

    let rows: [StatusSection]
    let corners: [StatusSection]
    let openings: [StatusSection]
    let headline: String
    let subline: String
    let symbol: String
    let tint: Tint

    init(sections: [StatusSection], lockPending: Bool, lockTarget: String) {
        let rows = sections.filter { $0.category != "Trip Details" && Rules.reports($0) }
        let corners = rows.filter(Rules.isCorner)
        let openings = rows.filter { !Rules.isCorner($0) }
        let doorRows = corners.filter(Rules.isDoor)
        let openRows = rows.filter(Rules.isOpen)
        let unlockedRows = rows.filter { Rules.isUnlocked($0) && !Rules.isOpen($0) }
        let issues = openRows.count + unlockedRows.count
        let allLocked = !doorRows.isEmpty && doorRows.allSatisfy(Rules.isLocked)

        let single: String
        if let s = openRows.first { single = "\(Rules.closureName(s)) open" }
        else if let s = unlockedRows.first { single = "\(Rules.closureName(s)) unlocked" }
        else { single = "" }

        let headline: String
        if lockPending { headline = lockTarget == "locked" ? "Locking…" : "Unlocking…" }
        else if issues == 0 { headline = allLocked ? "All secure" : "All closed" }
        else if issues == 1 { headline = single }
        else if openRows.isEmpty { headline = "\(unlockedRows.count) doors unlocked" }
        else if unlockedRows.isEmpty { headline = "\(openRows.count) open" }
        else { headline = "\(openRows.count) open, \(unlockedRows.count) unlocked" }

        let settledDoors = doorRows.filter { !Rules.isOpen($0) && !Rules.isUnlocked($0) }
        let doorsPart = settledDoors.isEmpty ? "" : (settledDoors.allSatisfy(Rules.isLocked) ? "Doors locked" : "Doors closed")
        let settledWindows = corners.filter { !Rules.isDoor($0) && !Rules.isOpen($0) }
        let settledOpenings = openings.filter { !Rules.isOpen($0) && !Rules.isUnlocked($0) }
        let restCount = (settledWindows.isEmpty ? 0 : 1) + settledOpenings.count
        let o1 = settledOpenings.first?.section ?? ""
        let o2 = settledOpenings.count > 1 ? Rules.lowerName(settledOpenings[1].section) : ""
        let restText: String
        if restCount == 0 { restText = "" }
        else if restCount >= 3 { restText = "Everything else closed" }
        else if !settledWindows.isEmpty { restText = restCount == 1 ? "Windows closed" : "Windows and \(Rules.lowerName(o1)) closed" }
        else { restText = restCount == 1 ? "\(o1) closed" : "\(o1) and \(o2) closed" }

        let subline: String
        if lockPending { subline = restText }
        else if issues == 0 { subline = !doorsPart.isEmpty && !restText.isEmpty ? "\(doorsPart) · \(restText)" : doorsPart + restText }
        else if (doorsPart.isEmpty ? 0 : 1) + restCount == 0 { subline = "" }
        else { subline = doorsPart == "Doors locked" ? "Everything else closed and locked" : "Everything else closed" }

        let singleSymbol: String
        if let s = openRows.first {
            if Rules.isCorner(s) {
                singleSymbol = Rules.isDoor(s) ? "lock.open.fill" : (Rules.isPassenger(s) ? "car.window.left" : "car.window.right")
            } else {
                singleSymbol = s.section.contains("Moon") ? "moon.fill" : (s.section.contains("Hood") ? "engine.combustion.fill" : "car.side.rear.crop.trunk.partition.fill")
            }
        } else { singleSymbol = "lock.open.fill" }

        self.rows = rows
        self.corners = corners
        self.openings = openings
        self.headline = headline
        self.subline = subline
        self.tint = lockPending ? .secondary : (issues == 0 ? .green : .orange)
        if lockPending { symbol = lockTarget == "locked" ? "lock.fill" : "lock.open.fill" }
        else if issues == 0 { symbol = allLocked ? "checkmark.shield.fill" : "checkmark.circle.fill" }
        else if issues == 1 { symbol = singleSymbol }
        else { symbol = openRows.isEmpty ? "lock.open.fill" : "exclamationmark.triangle.fill" }
    }

    func corner(_ key: String, door: Bool) -> StatusSection? {
        corners.first { Rules.cornerOf($0) == key && Rules.isDoor($0) == door }
    }

    func hasCorners(_ prefix: String) -> Bool {
        corners.contains { Rules.cornerOf($0).hasPrefix(prefix) }
    }

    var orderedOpenings: [StatusSection] {
        let rank = { (s: StatusSection) -> Int in
            s.section.contains("Moon") ? 0 : (s.section.contains("Trunk") ? 1 : (s.section.contains("Hood") ? 2 : 3))
        }
        return openings.enumerated().sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }.map(\.element)
    }
}
