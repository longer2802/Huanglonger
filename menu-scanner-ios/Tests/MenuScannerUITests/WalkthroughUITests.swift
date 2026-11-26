import XCTest

/// 模擬器操作流程：選測試圖 → 辨識 → 修正一筆 → 匯出 CSV。
/// 每一步截圖：存在測試結果（xcresult）中；若設定環境變數 TEST_RUNNER_SCREENSHOT_DIR，另存 PNG 到該資料夾。
final class WalkthroughUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()
    }

    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"], !dir.isEmpty {
            let url = URL(fileURLWithPath: dir, isDirectory: true)
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            try? screenshot.pngRepresentation.write(to: url.appendingPathComponent("\(name).png"))
        }
    }

    /// 在 Form／List 中往下捲，直到元素出現。
    @discardableResult
    private func scrollTo(_ element: XCUIElement, maxSwipes: Int = 6) -> Bool {
        var n = 0
        while !element.isHittable && n < maxSwipes {
            app.swipeUp()
            n += 1
        }
        return element.exists
    }

    func testSampleImageRecognizeFixOneAndExportCSV() throws {
        // 1. 首頁 → 示範測試圖
        let sample = app.buttons["useSampleImage"]
        XCTAssertTrue(sample.waitForExistence(timeout: 10))
        shot("01-首頁")
        scrollTo(sample)
        sample.tap()

        // 2. 確認照片 → 開始辨識
        let start = app.buttons["startRecognition"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        shot("02-確認照片")
        start.tap()

        // 3. 辨識結果
        let firstRow = app.buttons["entryRow"].firstMatch
        if !firstRow.waitForExistence(timeout: 90) {
            shot("錯誤-辨識沒有產生品項")
            XCTFail("辨識沒有產生品項；請看截圖上的錯誤訊息")
            return
        }
        shot("03-辨識結果")

        // 4. 只看待確認
        let pendingToggle = app.switches["onlyPendingToggle"]
        XCTAssertTrue(pendingToggle.waitForExistence(timeout: 5))
        pendingToggle.tap()
        shot("04-只看待確認")

        // 5. 修正一筆：點第一筆（有詞庫建議就採用），價格改成 65
        let row = app.buttons["entryRow"].firstMatch
        if !row.waitForExistence(timeout: 3) {
            pendingToggle.tap() // 沒有待確認時改看全部
        }
        app.buttons["entryRow"].firstMatch.tap()
        let price = app.textFields["priceField"]
        XCTAssertTrue(price.waitForExistence(timeout: 5))
        let accept = app.buttons["acceptSuggestion"]
        if accept.exists {
            scrollTo(accept)
            accept.tap()
        }
        scrollTo(price)
        price.tap()
        price.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 6) + "65")
        shot("05-修正一筆")
        app.buttons["confirmEntry"].tap()

        if (pendingToggle.value as? String) == "1" {
            pendingToggle.tap()
        }
        shot("06-修正後表格")

        // 6. 匯出 CSV
        app.buttons["exportButton"].tap()
        let store = app.textFields["storeNameField"]
        XCTAssertTrue(store.waitForExistence(timeout: 5))
        let partial = app.buttons["exportConfirmedOnly"]
        if partial.waitForExistence(timeout: 2) {
            shot("07-匯出前的待確認清單")
            scrollTo(partial)
            partial.tap()
        }
        let csvSegment = app.buttons["CSV"]
        XCTAssertTrue(csvSegment.waitForExistence(timeout: 5))
        csvSegment.tap()

        let preview = app.staticTexts["exportPreview"]
        scrollTo(preview)
        XCTAssertTrue(preview.waitForExistence(timeout: 5))
        XCTAssertTrue(preview.label.contains("店家,分店,分類,品名,規格,價格"), preview.label)
        XCTAssertTrue(preview.label.contains(",65"), "修正後的價格應出現在 CSV：\(preview.label)")
        shot("08-CSV預覽")

        let share = app.buttons["shareFile"]
        XCTAssertTrue(share.waitForExistence(timeout: 5))
        // 只在分享按鈕被捲出畫面時往回捲（內容已在頂端時往下滑會關掉 sheet）
        var swipes = 0
        while !share.isHittable && swipes < 4 {
            app.collectionViews.firstMatch.swipeDown()
            swipes += 1
        }
        share.tap()
        // 分享面板出現（系統 UI）
        _ = app.otherElements["ActivityListView"].waitForExistence(timeout: 5)
        Thread.sleep(forTimeInterval: 1.5)
        shot("09-分享面板")
    }
}

/// 店家菜單庫：內建示範菜單 → 版本 → 從舊版編輯新稿 → 另存新版。
final class LibraryUITests: XCTestCase {
    func testDemoMenuInLibraryAndSaveNewVersion() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        app.buttons["library"].tap()
        let store = app.buttons["storeRow"].firstMatch
        XCTAssertTrue(store.waitForExistence(timeout: 10), "應有內建示範菜單")
        store.tap()

        let version = app.buttons["versionRow"].firstMatch
        XCTAssertTrue(version.waitForExistence(timeout: 5))
        version.tap()
        let edit = app.buttons["editFromVersion"]
        XCTAssertTrue(edit.waitForExistence(timeout: 5))
        edit.tap()

        XCTAssertTrue(app.buttons["entryRow"].firstMatch.waitForExistence(timeout: 5))
        app.buttons["reviewMenu"].tap()
        app.buttons["saveToLibrary"].tap()
        // 回到店家頁，應有第 2 版
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.staticTexts["第 2 版"].waitForExistence(timeout: 5))
    }
}
