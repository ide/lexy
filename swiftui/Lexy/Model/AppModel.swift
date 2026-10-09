import Foundation
import Observation
import UIKit

enum AppTab: String, Hashable { case status, specs, settings }

enum SettingsRoute: String, Hashable {
    case rename, dataState, login, performance, eas
}

/// The app's state and decisions: the session and its refresh, when each read runs, lock and engine
/// reconciliation after a command, the refresh policy, climate, maps, Developer Tools' overrides,
/// and navigation.
@Observable
final class AppModel {
    let client: LexusClient
    let connectivity: Connectivity
    let timings: Timings
    let signIn: SignInMachine
    /// Developer Tools' Login Flow, run against a mock tree.
    let preview: SignInMachine

    // MARK: Session

    private(set) var account: Account
    private(set) var accountLoading = false
    private var sessionAt: Double = 0
    private var retried = false
    /// Set once the person acts on the sign-in screen, which hides the session-ended notice.
    private var sessionNoticeSeen = false

    /// Signed in, or not known yet. Either way the tabs show, so a signed-in launch never flashes
    /// the sign-in screen.
    var shell: Bool { account.signedIn || (account.status == 0 && account.error.isEmpty) }

    /// The sign-in screen's error, or why a saved session ended when there is no other error.
    var signInError: String {
        if !signIn.error.isEmpty || sessionNoticeSeen || account.status != 401 || account.error.isEmpty { return signIn.error }
        return Rules.sessionEnded
    }

    // MARK: Vehicle data

    private(set) var garage = Garage()
    private(set) var status = VehicleStatus()
    private(set) var tires = Tires()
    private(set) var engine = Engine()
    private(set) var spec = Spec()
    private(set) var services = Services()
    private var climateRead = Climate()
    /// The last change the car accepted. It shows until a pull re-reads the settings.
    private var climateWritten: Climate?
    var climate: Climate { climateWritten ?? climateRead }

    private(set) var garageLoading = false
    private(set) var statusLoading = false
    private(set) var primeLoading = false
    private(set) var climateLoading = false
    @ObservationIgnored private var garageSeq = 0
    @ObservationIgnored private var statusSeq = 0
    @ObservationIgnored private var engineSeq = 0
    @ObservationIgnored private var detailsSeq = 0
    @ObservationIgnored private var climateSeq = 0

    var car: Car { garage.car }

    // MARK: Refresh policy

    /// The wall clock as of the last tick, for relative times.
    private(set) var clock = nowMs()
    private var lastPrimeAt: Double = 0
    private var lastTick: Double = 0
    private var primeOnLaunch = false
    /// Set on a return from the background while the session needs a refresh, so the resume refresh
    /// waits for it.
    private var resumeDue = false
    /// A refresh the app started on its own (launch, resume). Only these dim the Status hero.
    private var autoRefresh = false
    /// Set once an app-started refresh has run for 1.5 s. The hero pulses only after that, and for
    /// at least 600 ms, so short refreshes never flicker it.
    private var updatingSlow = false
    private var held = false
    private var pulseOn = false
    /// The hero's pulse: dims and brightens each second while a refresh runs.
    private(set) var pulseDim = false
    /// A pull to refresh is running; its spinner shows instead of the pulse.
    private(set) var pulling = false
    private var backgrounded = false

    private var updating: Bool { autoRefresh && (statusLoading || garageLoading || primeLoading) }
    private var heroPulsing: Bool { account.signedIn && !shownGarage.car.vin.isEmpty && updatingSlow && (updating || held) && !pulling }

    // MARK: Commands and their reconciliation

    /// After a lock or unlock is accepted, status is re-read every tick until the doors agree,
    /// priming the car at the 5th poll and giving up at the 10th. After an engine start or stop,
    /// engine status is re-read up to four times, 20 s apart.
    private(set) var lockTarget = ""
    private var lockPolls = 0
    /// Set when a lock command reverses one the car hasn't confirmed. The reading held predates
    /// both, so only a newer report settles it.
    private var lockChained = false
    private var lockPrev = ""
    private var lockBaseline: Double = 0
    private(set) var engineTarget = ""
    private var enginePrev = ""
    private var enginePolls = 0
    private var engineAt: Double = 0
    private(set) var hazardsOn = false
    private(set) var commandInFlight = false
    var commandError = ""

    var doorLock: String { Rules.doorLock(status.sections) }
    private var lockSettled: Bool { lockTarget == doorLock && (!lockChained || status.occurredMs > lockBaseline) }
    var lockPending: Bool { !lockTarget.isEmpty && !lockSettled }
    var engineRunning: Bool { engine.running }
    var enginePending: Bool { !engineTarget.isEmpty && engineTarget != (engineRunning ? "running" : "stopped") }

    // MARK: Climate

    var climateError = ""
    private(set) var climateSaving = false
    /// The switch's position while the change is being saved.
    private var climateWanted = false
    private var climateTouched = false
    private var defrostFront = false
    private var defrostRear = false
    private var defrostHeld = false
    /// The setpoint while dragging and saving.
    private var tempDraft: Double = 0
    private var tempHeld = false

    var shownClimateOn: Bool { climateTouched ? climateWanted : climate.on }
    var shownFront: Bool { defrostHeld ? defrostFront : climate.frontEnabled }
    var shownRear: Bool { defrostHeld ? defrostRear : climate.rearEnabled }
    var shownTemperature: Double { tempHeld ? tempDraft : climate.temperature }

    // MARK: Maps

    private(set) var mapsApps = MapsApps()
    private(set) var opening = false
    var openError = ""
    private(set) var mapsTried = ""
    private(set) var address = ""
    private var addressFor = ""

    // MARK: Developer Tools

    /// Data State's override for the Status and Specs tabs. It resets to Live at launch.
    var dataState = "live"
    var demoFailing = false

    var shownGarage: Garage {
        let blank = Garage(ok: garage.ok, status: garage.status, error: garage.error, car: Car(), cars: [])
        switch dataState {
        case "error-cached": return Garage(ok: false, status: 503, error: "Service Unavailable", car: garage.car, cars: garage.cars)
        case "loading", "offline-empty": return blank
        case "error-empty": return Garage(ok: false, status: 503, error: "Service Unavailable")
        case "no-vehicle": return Garage(ok: true, status: 200, error: "")
        default: return garage
        }
    }

    var shownOnline: Bool {
        switch dataState {
        case "offline-cached", "offline-empty": false
        case "live", "loading": connectivity.online
        default: true
        }
    }

    private var forcedLoading: Bool { dataState == "loading" || dataState == "offline-empty" }
    var statusScreenLoading: Bool { dataState == "live" ? (garageLoading || statusLoading || !account.signedIn) : forcedLoading }
    var specsScreenLoading: Bool { dataState == "live" ? (garageLoading || !account.signedIn) : forcedLoading }

    // MARK: Settings

    var draftName = "" { didSet { renameError = "" } }
    var renameError = ""
    private(set) var renaming = false
    private(set) var signingOut = false

    // MARK: Navigation

    var tab = AppTab.status {
        didSet {
            guard tab != oldValue else { return }
            timings.asked(tab.rawValue)
            if tab == .settings { mapsApps = MapsHandoff.probe() }
        }
    }
    var settingsPath: [SettingsRoute] = [] {
        didSet {
            if let top = settingsPath.last, settingsPath.count > oldValue.count { timings.asked(top.rawValue) }
            // Leaving Login Flow resets its machine.
            if oldValue.contains(.login) && !settingsPath.contains(.login) { preview.reset() }
        }
    }
    var mapShown = false

    // MARK: Lifecycle

    init(client: LexusClient, connectivity: Connectivity = Connectivity(), timings: Timings = .shared) {
        self.client = client
        self.connectivity = connectivity
        self.timings = timings
        signIn = SignInMachine(client: client)
        preview = SignInMachine(client: client, scenario: .successMulti)
        account = client.storedAccount()
        // No session in the Keychain means signed out, with nothing to check.
        if !account.signedIn { account.status = 401 }
        // The cached answers show on the first frame.
        if account.signedIn, let kept = client.cachedGarage() {
            garage = kept
            let vin = kept.car.vin
            status = client.cached("status", vin: vin) ?? VehicleStatus()
            tires = client.cached("tires", vin: vin) ?? Tires()
            engine = client.cached("engine", vin: vin) ?? Engine()
            spec = client.cached("spec", vin: vin) ?? Spec()
            services = client.cached("services", vin: vin) ?? Services()
            climateRead = client.cached("climate", vin: vin) ?? Climate()
        }
        mapsApps = MapsHandoff.probe()
        signIn.onSubmit = { [unowned self] in sessionNoticeSeen = true }
        signIn.onDemoChanged = { [unowned self] in await refreshSession(loadData: false) }
        signIn.onSignedIn = { [unowned self] in await signedIn() }
    }

    /// Refreshes the session, then re-reads everything. The hero pulses only if this takes a while.
    func start() async {
        let now = nowMs()
        clock = now
        lastTick = now
        autoRefresh = account.signedIn && !car.vin.isEmpty
        updatingSlow = false
        if autoRefresh { waitThenPulse() }
        // A cached status over fifteen minutes old also asks the car to report.
        primeOnLaunch = autoRefresh && status.fetchedMs > 0 && now - status.fetchedMs >= 900_000
        await refreshSession(details: true, force: true)
    }

    /// Re-reads the garage when the session changed.
    func refreshSession(loadData: Bool = true, details: Bool = false, force: Bool = false) async {
        accountLoading = true
        sessionAt = nowMs()
        let before = account
        let next = await client.session()
        account = next
        accountLoading = false
        guard loadData else { return }
        if !next.signedIn && before.signedIn { clearVehicle() }
        if next.signedIn && (force || next.signedIn != before.signedIn || next.expiresAt != before.expiresAt) {
            await loadGarage(details: details, everything: force)
        }
    }

    private func signedIn() async {
        sessionNoticeSeen = false
        tab = .status
        settingsPath = []
        clock = nowMs()
        engineAt = nowMs()
        await refreshSession(details: true, force: true)
    }

    func signOut() async {
        signingOut = true
        client.signOut()
        clearVehicle()
        signIn.reset()
        account = Account(signedIn: false, demo: false, expiresAt: 0, status: 401, error: "")
        tab = .status
        settingsPath = []
        signingOut = false
    }

    private func clearVehicle() {
        garageSeq += 1; statusSeq += 1; engineSeq += 1; detailsSeq += 1; climateSeq += 1
        garage = Garage()
        status = VehicleStatus()
        tires = Tires()
        engine = Engine()
        spec = Spec()
        services = Services()
        climateRead = Climate()
        climateWritten = nil
        lockTarget = ""
        engineTarget = ""
        primeOnLaunch = false
        autoRefresh = false
        garageLoading = false
        statusLoading = false
        climateLoading = false
    }

    // MARK: Reads

    /// Re-reads the car's other data when the car changed. `details` also re-reads the spec,
    /// services and climate; `everything` re-reads all of it.
    func loadGarage(details: Bool = false, everything: Bool = false) async {
        garageSeq += 1
        let seq = garageSeq
        garageLoading = true
        let next = await client.garage()
        guard seq == garageSeq else { return }
        let before = garage.car
        garage = next
        garageLoading = false
        if next.car != before || everything {
            async let a: Void = loadStatus()
            async let b: Void = loadEngine()
            async let c: Void = loadDetails()
            _ = await (a, b, c)
        } else if details {
            await loadDetails()
        }
    }

    func loadStatus() async {
        statusSeq += 1
        let seq = statusSeq
        statusLoading = true
        let car = self.car
        async let s = client.status(car)
        async let t = client.tires(car)
        let (nextStatus, nextTires) = await (s, t)
        guard seq == statusSeq else { return }
        status = nextStatus
        tires = nextTires
        statusLoading = false
    }

    func loadEngine() async {
        engineSeq += 1
        let seq = engineSeq
        let next = await client.engine(car)
        guard seq == engineSeq else { return }
        engine = next
    }

    private func loadDetails() async {
        detailsSeq += 1
        let seq = detailsSeq
        let car = self.car
        async let s = client.spec(car)
        async let v = client.services(car)
        async let c: Void = loadClimate()
        let (nextSpec, nextServices, _) = await (s, v, c)
        guard seq == detailsSeq else { return }
        spec = nextSpec
        services = nextServices
    }

    private func loadClimate() async {
        climateSeq += 1
        let seq = climateSeq
        climateLoading = !car.vin.isEmpty
        let next = await client.climate(car)
        guard seq == climateSeq else { return }
        climateRead = next
        climateLoading = false
    }

    /// Asks the car to report, then re-reads status.
    private func prime() async {
        primeLoading = true
        _ = await client.prime(car)
        primeLoading = false
        await loadStatus()
    }

    // MARK: The tick

    /// Runs every five seconds while the app is active: refreshes the session ahead of expiry,
    /// reconciles lock and engine commands, primes the car once after launch, and refreshes after a
    /// return from the background.
    func tick() {
        let now = nowMs()
        clock = now
        if primeOnLaunch && !account.signedIn && !accountLoading { primeOnLaunch = false }
        if autoRefresh && !(statusLoading || primeLoading || garageLoading || (primeOnLaunch && account.signedIn)) { autoRefresh = false }

        // A failed refresh (offline) is retried after 15 s, not every tick.
        if account.signedIn && !accountLoading {
            if (now > account.expiresAt - LexusClient.expiryMarginMs && (account.error.isEmpty || now - sessionAt > 15_000))
                || (garage.status == 401 && !retried) {
                retried = garage.status == 401
                Task { await refreshSession() }
            }
            if garage.ok { retried = false }
        }

        var primeLock = false
        if !lockTarget.isEmpty && !statusLoading && !commandInFlight {
            if lockSettled || lockPolls >= 10 {
                lockTarget = ""
            } else {
                primeLock = lockPolls == 5
                lockPolls += 1
                Task { await loadStatus() }
            }
        }

        if !engineTarget.isEmpty && now - engineAt >= 20_000 && !commandInFlight {
            if !enginePending || enginePolls >= 4 {
                engineTarget = ""
            } else {
                enginePolls += 1
                engineAt = now
                Task { await loadEngine() }
            }
        }

        let primeLaunch = primeOnLaunch && account.signedIn && !car.vin.isEmpty
        if primeLaunch {
            primeOnLaunch = false
            autoRefresh = true
            updatingSlow = false
            lastPrimeAt = now
        }

        // After a return from the background: data under a minute old stays, older data is re-read,
        // and data over fifteen minutes old asks the car to report first (at most every three
        // minutes).
        let away = resumeDue || (lastTick > 0 && now - lastTick > 15_000)
        if away && !account.signedIn { resumeDue = false }
        if away && account.signedIn && (accountLoading || now > account.expiresAt - LexusClient.expiryMarginMs) { resumeDue = true }
        let resumes = away && lockTarget.isEmpty && account.signedIn && !car.vin.isEmpty && !accountLoading && !statusLoading
            && !primeLoading && now <= account.expiresAt - LexusClient.expiryMarginMs
        var primeResume = false
        if resumes {
            resumeDue = false
            if now - status.fetchedMs >= 900_000 && now - lastPrimeAt > 180_000 {
                lastPrimeAt = now
                autoRefresh = true
                updatingSlow = false
                primeResume = true
            } else if now - status.fetchedMs >= 60_000 {
                autoRefresh = true
                updatingSlow = false
                Task { await loadStatus() }
            }
        }
        // Maps apps may have been installed or removed meanwhile.
        if away { mapsApps = MapsHandoff.probe() }
        if primeLock || primeLaunch || primeResume { Task { await prime() } }
        if primeLaunch || (resumes && now - status.fetchedMs >= 60_000) { waitThenPulse() }
        lastTick = now
    }

    /// iOS can suspend the app before a tick sees it leave, so the return itself triggers the
    /// resume refresh.
    func becameActive() {
        guard backgrounded else { return }
        backgrounded = false
        if lastTick > 0 { resumeDue = true }
        tick()
    }

    func enteredBackground() { backgrounded = true }

    // MARK: The hero's pulse

    private func waitThenPulse() {
        updatingSlow = false
        Task {
            try? await Task.sleep(for: .milliseconds(1500))
            updatingSlow = updating
            guard updating else { return }
            held = true
            Task {
                try? await Task.sleep(for: .milliseconds(600))
                held = false
            }
            if !pulseOn { startPulse() }
        }
    }

    /// The pulse ends only at full opacity, so it never jumps.
    private func startPulse() {
        pulseOn = true
        pulseDim = true
        Task {
            while pulseOn {
                try? await Task.sleep(for: .seconds(1))
                if pulseDim { pulseDim = false } else if heroPulsing { pulseDim = true } else { pulseOn = false }
            }
        }
    }

    // MARK: Status actions

    /// Asks the car to report and re-reads status, the garage and climate. The 3-minute limit on
    /// asking the car applies only to refreshes the app starts itself.
    func pullRefresh() async {
        pulling = true
        climateWritten = nil
        async let read: Void = car.vin.isEmpty ? loadStatus() : primeNow()
        async let garageRead: Void = loadGarage()
        async let climateLoad: Void = loadClimate()
        _ = await (read, garageRead, climateLoad)
        pulling = false
    }

    private func primeNow() async {
        lastPrimeAt = nowMs()
        await prime()
    }

    func reloadGarage() async {
        pulling = true
        await loadGarage(details: true)
        pulling = false
    }

    /// Shows the pending state as soon as the command is sent, and restores the previous state if
    /// the car refuses it.
    func run(_ command: Command) {
        Haptic.medium.play()
        if command.isLock {
            let chained = lockPending
            lockPrev = lockTarget
            lockTarget = command == .doorLock ? "locked" : "unlocked"
            lockPolls = 0
            lockChained = chained
            lockBaseline = status.occurredMs
        }
        if command.isEngine {
            enginePrev = engineTarget
            engineTarget = command == .engineStart ? "running" : "stopped"
            enginePolls = 0
            engineAt = nowMs()
        }
        commandInFlight = true
        let car = self.car
        Task {
            let c = await client.command(car, command)
            commandInFlight = false
            afterCommand(c, command)
        }
    }

    private func afterCommand(_ c: CommandResult, _ command: Command) {
        (c.accepted ? Haptic.success : Haptic.error).play()
        if c.accepted {
            if command.isLock { lockPolls = 0 }
            if command == .hazardOn || command == .hazardOff { hazardsOn = command == .hazardOn }
            if command.isEngine {
                enginePolls = 0
                engineAt = nowMs()
            }
            Task { await loadStatus() }
        } else {
            if command.isLock { lockTarget = lockPrev }
            if command.isEngine { engineTarget = enginePrev }
            commandError = c.ok ? "The car didn’t accept the command." : Rules.failureText(status: c.status, error: c.error)
        }
    }

    // MARK: Climate actions

    private func saveClimate(on: Bool, temperature: Double, front: Bool, rear: Bool) {
        climateSaving = true
        let car = self.car, raw = climate.raw
        Task {
            let r = await client.setClimate(car, raw: raw, on: on, temperature: temperature, front: front, rear: rear)
            climateSaving = false
            climateError = r.ok ? "" : "The vehicle API rejected the change."
            (r.ok ? Haptic.success : Haptic.error).play()
            // A saved change shows what was written until the next read; a refused one shows the
            // car's own settings again.
            if r.ok { climateWritten = r }
            climateTouched = false
            defrostHeld = false
            tempHeld = false
        }
    }

    func setClimateOn(_ on: Bool) {
        climateWanted = on
        climateTouched = true
        saveClimate(on: on, temperature: shownTemperature, front: shownFront, rear: shownRear)
    }

    func dragTemperature(_ value: Double) {
        tempDraft = value
        tempHeld = true
    }

    /// Saves on release, and only when the value changed.
    func setTemperature(_ value: Double) {
        tempDraft = value
        if value == climate.temperature {
            tempHeld = false
        } else {
            tempHeld = true
            saveClimate(on: shownClimateOn, temperature: value, front: shownFront, rear: shownRear)
        }
    }

    func toggleDefrost(front: Bool) {
        guard !climateSaving else { return }
        Haptic.selection.play()
        let f = front ? !shownFront : shownFront
        let r = front ? shownRear : !shownRear
        defrostFront = f
        defrostRear = r
        defrostHeld = true
        saveClimate(on: shownClimateOn, temperature: shownTemperature, front: f, rear: r)
    }

    // MARK: Maps actions

    func openMap() {
        openError = ""
        mapsApps = MapsHandoff.probe()
        Haptic.selection.play()
        timings.asked("map")
        mapShown = true
    }

    func loadAddress() async {
        let key = "\(status.latitude),\(status.longitude)"
        guard key != addressFor else { return }
        addressFor = key
        address = ""
        address = await ParkingAddress.line(latitude: status.latitude, longitude: status.longitude)
    }

    /// A pick from the chooser is saved. A lone installed app opens without being saved, so
    /// installing a second app asks again.
    func openMaps(_ provider: String, remember: Bool) async {
        mapsTried = provider
        if remember {
            MapsHandoff.save(provider)
            mapsApps = MapsHandoff.probe()
        }
        opening = true
        if let error = await MapsHandoff.open(provider, latitude: status.latitude, longitude: status.longitude, name: car.name) {
            openError = error
        }
        opening = false
    }

    func chooseMaps(_ provider: String) {
        Haptic.selection.play()
        MapsHandoff.save(provider)
        mapsApps = MapsHandoff.probe()
    }

    func clearMaps() {
        Haptic.medium.play()
        MapsHandoff.save("")
        mapsApps = MapsHandoff.probe()
    }

    // MARK: Settings actions

    func editName() {
        // With no nickname, the name is the model's.
        draftName = car.name
        settingsPath.append(.rename)
    }

    /// Only a real change saves, and only once at a time.
    var nameChanged: Bool { !draftName.trimmed.isEmpty && draftName.trimmed != car.name }

    func saveName() async {
        guard nameChanged, !renaming else { return }
        renaming = true
        let r = await client.rename(car, to: draftName.trimmed)
        renaming = false
        if r.ok {
            Haptic.success.play()
            if settingsPath.last == .rename { settingsPath.removeLast() }
            await loadGarage(details: true)
        } else {
            Haptic.error.play()
            renameError = Rules.failureText(status: r.status, error: r.error)
        }
    }

    func setDemoFailing(_ on: Bool) {
        demoFailing = on
        Task { await client.demo.setFailing(on) }
    }

    func openDevTool(_ route: SettingsRoute) {
        Haptic.selection.play()
        if route == .login {
            preview.scenario = .successMulti
            preview.reset()
        }
        settingsPath.append(route)
    }
}
