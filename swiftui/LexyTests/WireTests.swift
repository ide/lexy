import Foundation
import Testing
@testable import Lexy

@Suite struct WireTests {
    @Test func jsonKeepsTypes() {
        let j = JSON.parse(#"{"a":true,"b":1,"c":1.5,"d":"272.1 miles","e":[0,"x"],"f":null}"#)
        #expect(j["a"] == .bool(true))
        #expect(j["b"] == .int(1))
        #expect(j["c"] == .double(1.5))
        #expect(j["d"].number == 272.1)
        #expect(j["b"].string == "1")
        #expect(j["missing"]["deeper"].string == "")
        #expect(JSON.parse(j.text) == j)
    }

    @Test func answersTheFirstCallbackOfItsType() {
        let node = DemoLexus.node("choice", authId: "x")
        let answered = LexusClient.answered(node, type: "ChoiceCallback", value: .int(1))
        #expect(DemoLexus.answer(answered) == .int(1))
        #expect(answered["authId"].string == "x")
        let untouched = LexusClient.answered(node, type: "NameCallback", value: "a")
        #expect(untouched == node)
    }

    @Test func decodesANode() {
        let node = LexusClient.decodeNode(DemoLexus.node("choice", authId: "x"))
        #expect(node.types == ["ChoiceCallback"])
        #expect(node.choices == ["Email", "Text message"])
        #expect(node.prompts.first == "How would you like to receive your code?")
        #expect(Rules.stepOf(node) == .choice)
        #expect(Rules.stepOf(LexusClient.decodeNode(DemoLexus.node("otp", authId: "y"))) == .otp)
    }

    @Test func decodesClimate() {
        let climate = LexusClient.decodeClimate(["payload": [
            "settingsOn": true, "temperature": 72, "temperatureUnit": "F", "minTemp": 65, "maxTemp": 85, "tempInterval": 1,
            "acOperations": [["categoryName": "defrost", "available": true, "acParameters": [
                ["name": "frontDefrost", "available": true, "enabled": true],
                ["name": "rearDefrost", "available": false, "enabled": true],
            ]]],
        ]])
        #expect(climate.ok && climate.on && climate.temperature == 72)
        #expect(climate.front && climate.frontEnabled)
        #expect(!climate.rear && !climate.rearEnabled)
        #expect(!LexusClient.decodeClimate(["payload": [:]]).ok)
    }

    @Test func guidFromTheIdToken() {
        #expect(LexusClient.guid(DemoLexus.tokens["id_token"].string) == "demo-guid")
        #expect(LexusClient.guid("nonsense") == "")
    }

    @Test func epochs() {
        #expect(epochMs("2026-10-01T10:00:00Z") == 1_790_848_800_000)
        #expect(epochMs("2026-10-01T10:00:00.500Z") == 1_790_848_800_500)
        #expect(epochMs("") == 0)
    }
}
