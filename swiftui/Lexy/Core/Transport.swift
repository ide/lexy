import Foundation

nonisolated struct WireRequest: Sendable {
    var url: URL
    var method = "GET"
    var headers: [String: String] = [:]
    var body: Data?

    var json: JSON { body.map(JSON.parse) ?? .null }
    var form: [String: String] {
        var c = URLComponents()
        c.percentEncodedQuery = body.map { String(decoding: $0, as: UTF8.self) }
        return Dictionary((c.queryItems ?? []).map { ($0.name, $0.value ?? "") }, uniquingKeysWith: { a, _ in a })
    }
}

nonisolated struct WireReply: Sendable {
    var status: Int
    var headers: [String: String] = [:]
    var body = Data()

    var ok: Bool { (200..<300).contains(status) }
    var json: JSON { JSON.parse(body) }
    func header(_ name: String) -> String? {
        headers.first { $0.key.caseInsensitiveCompare(name) == .orderedSame }?.value
    }

    static func json(_ status: Int, _ body: JSON, location: String? = nil) -> WireReply {
        WireReply(status: status, headers: location.map { ["Location": $0] } ?? [:], body: body.data)
    }
}

/// How a request reaches Lexus: the network, the demo's in-memory Lexus, or the Login Flow
/// preview's mock tree.
nonisolated protocol LexusTransport: Sendable {
    func send(_ request: WireRequest) async throws -> WireReply
    /// Called when a sign-in starts, to drop the previous one's cookies.
    func startSignIn() async
}

nonisolated extension LexusTransport {
    func startSignIn() async {}
}

/// The network. Redirects aren't followed, because the OAuth authorize step's 302 carries the code
/// in its Location. The identity host's cookies are kept per sign-in: ForgeRock pins a sign-in to
/// one server with `route` and `amlbcookie`, and a step that lands on another server fails.
nonisolated final class LiveTransport: LexusTransport {
    private let session: URLSession
    private let jar = CookieJar()

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.timeoutIntervalForRequest = 30
        session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }

    func startSignIn() async { await jar.clear() }

    func send(_ request: WireRequest) async throws -> WireReply {
        var r = URLRequest(url: request.url)
        r.httpMethod = request.method
        r.httpBody = request.body
        for (k, v) in request.headers { r.setValue(v, forHTTPHeaderField: k) }
        let identity = request.url.host == LexusClient.identityHost
        if identity, let cookie = await jar.header() { r.setValue(cookie, forHTTPHeaderField: "Cookie") }
        let (data, response) = try await session.data(for: r)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        var headers: [String: String] = [:]
        for (k, v) in http.allHeaderFields { headers["\(k)"] = "\(v)" }
        if identity {
            let fields = headers.filter { $0.key.caseInsensitiveCompare("Set-Cookie") == .orderedSame }
            for cookie in HTTPCookie.cookies(withResponseHeaderFields: fields, for: request.url) {
                await jar.keep(cookie.name, cookie.value)
            }
        }
        return WireReply(status: http.statusCode, headers: headers, body: data)
    }

    private actor CookieJar {
        private var cookies: [(String, String)] = []
        func clear() { cookies = [] }
        func keep(_ name: String, _ value: String) {
            cookies.removeAll { $0.0 == name }
            cookies.append((name, value))
        }
        func header() -> String? {
            cookies.isEmpty ? nil : cookies.map { "\($0.0)=\($0.1)" }.joined(separator: "; ")
        }
    }

}

nonisolated private final class NoRedirects: NSObject, URLSessionTaskDelegate, Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
