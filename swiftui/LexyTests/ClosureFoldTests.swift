import Foundation
import Testing
@testable import Lexy

/// Status reads over a full snapshot, a sparse one (lock-only doors, as after a
/// drive), and a failed read.
@Suite struct ClosureFoldTests {
    let car = Car(vin: "VIN1")
    let now = 1_790_900_000_000.0

    nonisolated private static func snapshot(_ occurred: String, _ categories: [(String, [(String, [String])])]) -> JSON {
        ["payload": ["status": [
            "occurrenceDate": .string(occurred),
            "vehicleStatus": .array(categories.map { category in
                ["category": .string(category.0), "sections": .array(category.1.map { section in
                    ["section": .string(section.0), "values": .array(section.1.map { ["value": .string($0)] })]
                })]
            }),
        ]]]
    }

    private func show(_ s: VehicleStatus) -> String {
        s.sections.map { "\($0.category)/\($0.section)=\($0.values.joined(separator: "+"))" }.joined(separator: " ")
    }

    @Test func foldsSparseSnapshotsAndKeepsTheLastGoodRead() async throws {
        let full = Self.snapshot("2026-10-01T10:00:00Z", [
            ("Driver Side", [("Door", ["Closed", "Locked"]), ("Window", ["Closed"])]),
            ("Other", [("Trunk", ["Closed", "Locked"])]),
        ])
        let sparse = Self.snapshot("2026-10-01T12:00:00Z", [("Driver Side", [("Door", ["Unlocked"])])])
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r", expiresAt: now + 3_600_000))
        let cache = temporaryCache()
        let fake = FakeLexus { _ in .json(200, full) }
        let client = LexusClient(store: store, cache: cache, live: fake)

        let a = await client.status(car, at: now)
        #expect(show(a) == "Driver Side/Door=Closed+Locked Driver Side/Window=Closed Other/Trunk=Closed+Locked")
        #expect(a.closuresStaleMs == 0)

        fake.answer { _ in .json(200, sparse) }
        let b = await client.status(car, at: now)
        #expect(show(b) == "Driver Side/Door=Closed+Unlocked Driver Side/Window=Closed Other/Trunk=Closed+Locked")
        #expect(b.closuresStaleMs == epochMs("2026-10-01T10:00:00Z"))

        fake.answer { _ in throw URLError(.notConnectedToInternet) }
        let c = await client.status(car, at: now)
        #expect(c.ok && c.status == 0 && !c.error.isEmpty)
        #expect(show(c) == show(b))

        fake.answer { _ in .json(200, Self.snapshot("2026-10-01T09:00:00Z", [("Driver Side", [("Window", ["Open"])])])) }
        let d = await client.status(car, at: now)
        #expect(show(d).contains("Driver Side/Window=Closed"))

        let disk = try #require(try? Data(contentsOf: cache.directory.appending(path: "closures.json")))
        #expect(JSON.parse(disk)["vin"].string == "VIN1")
        fake.answer { _ in .json(200, Self.snapshot("2026-10-02T09:00:00Z", [("Other", [("Hood’s", ["Closed"])])])) }
        let e = await client.status(Car(vin: "VIN2"), at: now)
        #expect(show(e) == "Other/Hood’s=Closed")
    }

    @Test func aSignOutForgetsWhatWasKept() async {
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r", expiresAt: now + 3_600_000))
        let cache = temporaryCache()
        let client = LexusClient(store: store, cache: cache, live: FakeLexus { _ in .json(200, ["payload": ["status": ["occurrenceDate": "2026-10-01T10:00:00Z"]]]) })
        _ = await client.status(car, at: now)
        #expect((client.cached("status", vin: "VIN1") as VehicleStatus?) != nil)
        client.signOut()
        #expect((client.cached("status", vin: "VIN1") as VehicleStatus?) == nil)
        #expect(client.readSession() == nil)
    }
}
