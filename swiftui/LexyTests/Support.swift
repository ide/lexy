import Foundation
@testable import Lexy

/// A fake Lexus that answers from a closure and counts its calls.
nonisolated final class FakeLexus: LexusTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var handler: @Sendable (WireRequest) async throws -> WireReply
    private(set) var calls = 0

    init(_ handler: @escaping @Sendable (WireRequest) async throws -> WireReply) { self.handler = handler }

    func answer(with handler: @escaping @Sendable (WireRequest) async throws -> WireReply) {
        lock.withLock { self.handler = handler }
    }

    func send(_ request: WireRequest) async throws -> WireReply {
        let h = lock.withLock { calls += 1; return handler }
        return try await h(request)
    }
}

func temporaryCache() -> AnswerCache {
    AnswerCache(directory: FileManager.default.temporaryDirectory.appending(path: "lexy-tests-\(UUID().uuidString)", directoryHint: .isDirectory))
}

func sessionJSON(refresh: String, expiresAt: Double, access: String = "a0", idToken: String = "x") -> String {
    let s = Session(accessToken: access, refreshToken: refresh, idToken: idToken, expiresAt: expiresAt, tokenType: "Bearer")
    return String(decoding: try! JSONEncoder().encode(s), as: UTF8.self)
}
