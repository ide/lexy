import Foundation
import Security

/// Where the session tokens and the demo flag live: the Keychain in the app, memory in tests.
protocol SecretStore: AnyObject {
    func get(_ key: String) -> String?
    func set(_ key: String, _ value: String)
    func forget(_ key: String)
}

final class KeychainStore: SecretStore {
    private let service = "app.ide.lexy.swiftui"

    private func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    }

    func get(_ key: String) -> String? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func set(_ key: String, _ value: String) {
        let data = Data(value.utf8)
        let status = SecItemUpdate(query(key) as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var q = query(key)
            q[kSecValueData as String] = data
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(q as CFDictionary, nil)
        }
    }

    func forget(_ key: String) {
        SecItemDelete(query(key) as CFDictionary)
    }
}

final class MemoryStore: SecretStore {
    var values: [String: String] = [:]
    func get(_ key: String) -> String? { values[key] }
    func set(_ key: String, _ value: String) { values[key] = value }
    func forget(_ key: String) { values[key] = nil }
}

/// The last good answer of each read, on disk. A failed read returns it alongside the failure, and
/// a launch shows it on the first frame. Each answer is stored with its owner: the car's VIN, or
/// the account's guid for the garage.
final class AnswerCache {
    static let keys = ["closures", "garage", "status", "tires", "engine", "spec", "services", "climate"]

    let directory: URL
    /// Incremented when the cache is cleared, so a read still in flight can't write a signed-out
    /// account's data back.
    private(set) var generation = 0
    private var held: [String: Data?] = [:]

    init(directory: URL) {
        self.directory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    static func standard() -> AnswerCache {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return AnswerCache(directory: base.appending(path: "lexy", directoryHint: .isDirectory))
    }

    private func url(_ key: String) -> URL { directory.appending(path: "\(key).json") }

    func load(_ key: String) -> Data? {
        if let kept = held[key] { return kept }
        let data = try? Data(contentsOf: url(key))
        held[key] = data
        return data
    }

    func save(_ key: String, _ data: Data, since: Int? = nil) {
        guard since == nil || since == generation, held[key] != .some(data) else { return }
        held[key] = data
        try? data.write(to: url(key), options: .atomic)
    }

    private struct Kept<T: Codable>: Codable {
        var vin: String
        var answer: T
    }

    @discardableResult
    func remember<T: Codable>(_ key: String, vin: String, _ answer: T, since: Int? = nil) -> T {
        if let data = try? JSONEncoder().encode(Kept(vin: vin, answer: answer)) { save(key, data, since: since) }
        return answer
    }

    func recall<T: Codable>(_ key: String, vin: String) -> T? {
        guard let data = load(key), let kept = try? JSONDecoder().decode(Kept<T>.self, from: data), kept.vin == vin else { return nil }
        return kept.answer
    }

    func forgetAll() {
        generation += 1
        for key in AnswerCache.keys {
            held[key] = .some(nil)
            try? FileManager.default.removeItem(at: url(key))
        }
    }
}
