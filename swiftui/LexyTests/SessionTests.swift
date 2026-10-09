import Foundation
import Testing
@testable import Lexy

/// The session against a fake token server that rotates refresh tokens.
@Suite struct SessionTests {
    /// Any refresh token other than `current` gets `invalid_grant`.
    nonisolated final class Rotating: @unchecked Sendable {
        var current = "r1"
        let lock = NSLock()
        func answer(_ request: WireRequest) async throws -> WireReply {
            try await Task.sleep(for: .milliseconds(30))
            return lock.withLock {
                guard request.form["refresh_token"] == current else { return .json(400, ["error": "invalid_grant"]) }
                let next = "r\(Int(current.dropFirst())! + 1)"
                current = next
                return .json(200, ["access_token": .string("a-\(next)"), "refresh_token": .string(next),
                                   "id_token": DemoLexus.tokens["id_token"], "expires_in": 3600, "token_type": "Bearer"])
            }
        }
    }

    let now = 1_790_900_000_000.0

    @Test func concurrentAsksShareOneRefresh() async {
        let server = Rotating()
        let fake = FakeLexus { try await server.answer($0) }
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r1", expiresAt: now - 1000))
        let client = LexusClient(store: store, cache: temporaryCache(), live: fake)
        async let a = client.session(at: now)
        async let b = client.session(at: now)
        let (x, y) = await (a, b)
        #expect(fake.calls == 1)
        #expect(x.signedIn && y.signedIn)
        #expect(client.readSession()?.refreshToken == "r2")
    }

    @Test func aStaleRejectionKeepsTheSession() async {
        let server = Rotating()
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r1", expiresAt: now - 1000))
        let fake = FakeLexus { request in
            // Another refresh stores r9 while this one still holds r1.
            await MainActor.run { store.set("lexy.session", sessionJSON(refresh: "r9", expiresAt: 1_790_900_000_000 + 3_600_000)) }
            server.current = "r5"
            return try await server.answer(request)
        }
        let client = LexusClient(store: store, cache: temporaryCache(), live: fake)
        let account = await client.session(at: now)
        #expect(account.signedIn)
        #expect(client.readSession()?.refreshToken == "r9")
    }

    @Test func aRevokedTokenSignsOut() async {
        let server = Rotating()
        server.current = "zz"
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r3", expiresAt: now - 1000))
        let client = LexusClient(store: store, cache: temporaryCache(), live: FakeLexus { try await server.answer($0) })
        let account = await client.session(at: now)
        #expect(!account.signedIn)
        #expect(account.status == 401)
        #expect(store.get("lexy.session") == nil)
    }

    @Test func anOfflineRefreshKeepsTheSession() async {
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r1", expiresAt: now - 1000))
        let client = LexusClient(store: store, cache: temporaryCache(), live: FakeLexus { _ in throw URLError(.notConnectedToInternet) })
        let account = await client.session(at: now)
        #expect(account.signedIn)
        #expect(account.status == 0)
        #expect(!account.error.isEmpty)
    }

    @Test func aFreshTokenAsksNoOne() async {
        let store = MemoryStore()
        store.set("lexy.session", sessionJSON(refresh: "r1", expiresAt: now + 3_600_000))
        let fake = FakeLexus { _ in .json(500, [:]) }
        let client = LexusClient(store: store, cache: temporaryCache(), live: fake)
        let account = await client.session(at: now)
        #expect(account.signedIn && fake.calls == 0)
    }
}
