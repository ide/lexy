import Foundation

/// Loosely typed JSON with forgiving reads: a missing or mistyped value reads as an empty default
/// instead of failing.
nonisolated enum JSON: Sendable, Equatable, Codable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let i = try? c.decode(Int.self) { self = .int(i) }
        else if let d = try? c.decode(Double.self) { self = .double(d) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSON].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSON].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .int(let i): try c.encode(i)
        case .double(let d): try c.encode(d)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    static func parse(_ data: Data) -> JSON {
        (try? JSONDecoder().decode(JSON.self, from: data)) ?? .null
    }

    static func parse(_ text: String) -> JSON {
        parse(Data(text.utf8))
    }

    var data: Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(self)) ?? Data("null".utf8)
    }

    var text: String { String(decoding: data, as: UTF8.self) }


    subscript(key: String) -> JSON {
        get { if case .object(let o) = self { o[key] ?? .null } else { .null } }
        set {
            var o = object
            o[key] = newValue
            self = .object(o)
        }
    }

    var object: [String: JSON] { if case .object(let o) = self { o } else { [:] } }
    var array: [JSON] { if case .array(let a) = self { a } else { [] } }
    var isObject: Bool { if case .object = self { true } else { false } }

    /// A string, or a number as a string; "" otherwise.
    var string: String {
        switch self {
        case .string(let s): s
        case .int(let i): String(i)
        case .double(let d): d.rounded() == d && abs(d) < 1e15 ? String(Int(d)) : String(d)
        default: ""
        }
    }

    /// A number, or the number a string starts with ("272.1 miles" is 272.1); 0 otherwise.
    var number: Double {
        switch self {
        case .int(let i): Double(i)
        case .double(let d): d.isFinite ? d : 0
        case .string(let s): JSON.leadingNumber(s)
        default: 0
        }
    }

    var bool: Bool? { if case .bool(let b) = self { b } else { nil } }
    var isTrue: Bool { bool == true }
    var isNumber: Bool {
        switch self { case .int, .double: true; default: false }
    }

    private static func leadingNumber(_ s: String) -> Double {
        let scanner = Scanner(string: s.trimmingCharacters(in: .whitespaces))
        return scanner.scanDouble().flatMap { $0.isFinite ? $0 : nil } ?? 0
    }
}

nonisolated extension JSON: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral, ExpressibleByBooleanLiteral,
    ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral, ExpressibleByFloatLiteral, ExpressibleByNilLiteral {
    init(stringLiteral value: String) { self = .string(value) }
    init(integerLiteral value: Int) { self = .int(value) }
    init(floatLiteral value: Double) { self = .double(value) }
    init(booleanLiteral value: Bool) { self = .bool(value) }
    init(arrayLiteral elements: JSON...) { self = .array(elements) }
    init(dictionaryLiteral elements: (String, JSON)...) { self = .object(Dictionary(uniqueKeysWithValues: elements)) }
    init(nilLiteral: ()) { self = .null }
}

/// Epoch milliseconds for an ISO 8601 date, or 0.
nonisolated func epochMs(_ value: JSON) -> Double {
    let text = value.string
    guard !text.isEmpty else { return 0 }
    let full = ISO8601DateFormatter()
    full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = full.date(from: text) { return d.timeIntervalSince1970 * 1000 }
    let plain = ISO8601DateFormatter()
    if let d = plain.date(from: text) { return d.timeIntervalSince1970 * 1000 }
    let day = ISO8601DateFormatter()
    day.formatOptions = [.withFullDate]
    if let d = day.date(from: text) { return d.timeIntervalSince1970 * 1000 }
    return 0
}

nonisolated func isoString(_ ms: Double) -> String {
    let f = ISO8601DateFormatter()
    return f.string(from: Date(timeIntervalSince1970: ms / 1000))
}

nonisolated func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 }
