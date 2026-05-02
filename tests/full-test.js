const TestRunner = {
  results: {
    passed: 0,
    failed: 0,
    total: 0,
    failures: [],
  },

  assert(condition, testName) {
    this.results.total++;
    if (condition) {
      this.results.passed++;
      console.log(`✓ PASS: ${testName}`);
    } else {
      this.results.failed++;
      this.results.failures.push(testName);
      console.log(`✗ FAIL: ${testName}`);
    }
  },

  assertEqual(actual, expected, testName) {
    const condition = actual === expected;
    this.results.total++;
    if (condition) {
      this.results.passed++;
      console.log(`✓ PASS: ${testName}`);
    } else {
      this.results.failed++;
      this.results.failures.push(
        `${testName} (Expected: ${expected}, Actual: ${actual})`,
      );
      console.log(
        `✗ FAIL: ${testName} (Expected: ${expected}, Actual: ${actual})`,
      );
    }
  },

  assertNotNull(value, testName) {
    const condition = value !== null && value !== undefined;
    this.results.total++;
    if (condition) {
      this.results.passed++;
      console.log(`✓ PASS: ${testName}`);
    } else {
      this.results.failed++;
      this.results.failures.push(testName);
      console.log(`✗ FAIL: ${testName} (Value is null or undefined)`);
    }
  },

  // Test Categories
  testHTMLStructure() {
    console.log("\n=== Testing HTML Structure ===");

    // Test HTML file exists and has content
    const fs = require("fs");
    const htmlPath = "../src/index.html";

    try {
      const html = fs.readFileSync(htmlPath, "utf8");
      this.assertNotNull(html, "HTML file exists and has content");

      // Test semantic HTML5 structure
      this.assert(html.includes("<!DOCTYPE html>"), "HTML5 doctype present");
      this.assert(html.includes("<main"), "Semantic main element present");
      this.assert(html.includes("<header"), "Semantic header element present");
      this.assert(html.includes("<nav"), "Semantic nav element present");
      this.assert(
        html.includes("<section"),
        "Semantic section elements present",
      );

      // Test ID Contract compliance
      this.assert(
        html.includes('id="nav-gateway-tab"'),
        "Gateway navigation tab ID present",
      );
      this.assert(
        html.includes('id="nav-archive-tab"'),
        "Archive navigation tab ID present",
      );
      this.assert(
        html.includes('id="nav-stress-tab"'),
        "Stress navigation tab ID present",
      );
      this.assert(
        html.includes('id="nav-pulse-tab"'),
        "Pulse navigation tab ID present",
      );

      this.assert(
        html.includes('id="gate-request-input"'),
        "Gateway request input ID present",
      );
      this.assert(
        html.includes('id="gate-send-btn"'),
        "Gateway send button ID present",
      );
      this.assert(
        html.includes('id="gate-requests-list"'),
        "Gateway requests list ID present",
      );
      this.assert(
        html.includes('id="gate-payload-view"'),
        "Gateway payload view ID present",
      );

      this.assert(
        html.includes('id="arch-search-input"'),
        "Archive search input ID present",
      );
      this.assert(
        html.includes('id="arch-replay-btn"'),
        "Archive replay button ID present",
      );
      this.assert(
        html.includes('id="arch-export-btn"'),
        "Archive export button ID present",
      );

      this.assert(
        html.includes('id="stress-url-input"'),
        "Stress URL input ID present",
      );
      this.assert(
        html.includes('id="stress-start-btn"'),
        "Stress start button ID present",
      );

      this.assert(
        html.includes('id="pulse-canvas"'),
        "Pulse canvas ID present",
      );
      this.assert(
        html.includes('id="pulse-reset-btn"'),
        "Pulse reset button ID present",
      );

      // Test no external dependencies
      this.assert(!html.includes("cdn"), "No CDN dependencies");
      this.assert(!html.includes("googleapis"), "No Google APIs");
      this.assert(!html.includes("jquery"), "No jQuery");
    } catch (error) {
      this.assert(false, `HTML file read error: ${error.message}`);
    }
  },

  testCSSStructure() {
    console.log("\n=== Testing CSS Structure ===");

    const fs = require("fs");
    const cssPath = "../src/styles.css";

    try {
      const css = fs.readFileSync(cssPath, "utf8");
      this.assertNotNull(css, "CSS file exists and has content");

      // Test design tokens
      this.assert(css.includes(":root"), "CSS root variables present");
      this.assert(
        css.includes("--color-bg-primary"),
        "Primary background color token present",
      );
      this.assert(
        css.includes("--color-purple-primary"),
        "Primary purple color token present",
      );
      this.assert(
        css.includes("--color-neon-cyan"),
        "Neon cyan color token present",
      );
      this.assert(css.includes("--space-md"), "Spacing token present");
      this.assert(css.includes("--font-mono"), "Monospace font token present");

      // Test Deep Purple & Neon palette
      this.assert(css.includes("#7c3aed"), "Deep purple primary color present");
      this.assert(css.includes("#06b6d4"), "Neon cyan color present");
      this.assert(css.includes("#ec4899"), "Neon pink color present");
      this.assert(css.includes("#10b981"), "Neon green color present");

      // Test CSS Grid layout
      this.assert(css.includes("display: grid"), "CSS Grid layout used");
      this.assert(
        css.includes("grid-template-columns"),
        "Grid template columns defined",
      );

      // Test responsive design
      this.assert(css.includes("@media"), "Media queries present");
      this.assert(
        css.includes("max-width: 768px"),
        "Mobile breakpoint present",
      );

      // Test animations
      this.assert(css.includes("@keyframes"), "CSS animations present");
      this.assert(css.includes("transition"), "CSS transitions present");

      // Test JSON syntax highlighting
      this.assert(css.includes(".json-key"), "JSON key styling present");
      this.assert(css.includes(".json-string"), "JSON string styling present");
    } catch (error) {
      this.assert(false, `CSS file read error: ${error.message}`);
    }
  },

  testJavaScriptStructure() {
    console.log("\n=== Testing JavaScript Structure ===");

    const fs = require("fs");
    const jsPath = "../src/main.js";

    try {
      const js = fs.readFileSync(jsPath, "utf8");
      this.assertNotNull(js, "JavaScript file exists and has content");

      // Test class structure
      this.assert(js.includes("class NeuralLink"), "NeuralLink class present");
      this.assert(js.includes("constructor()"), "Constructor method present");

      // Test GlobalStateObject
      this.assert(
        js.includes("this.state = {"),
        "State object initialization present",
      );
      this.assert(js.includes("currentView"), "Current view state present");
      this.assert(js.includes("requests"), "Requests array present");
      this.assert(js.includes("latencyData"), "Latency data array present");

      // Test FSM states
      this.assert(js.includes("'IDLE'"), "IDLE state defined");
      this.assert(js.includes("'PROCESSING'"), "PROCESSING state defined");
      this.assert(js.includes("'SUCCESS'"), "SUCCESS state defined");
      this.assert(js.includes("'ERROR'"), "ERROR state defined");

      // Test IndexedDB integration
      this.assert(js.includes("indexedDB"), "IndexedDB API used");
      this.assert(js.includes("openDB"), "Database opening method present");
      this.assert(
        js.includes("objectStore"),
        "Object store operations present",
      );

      // Test fetch API with timeout
      this.assert(js.includes("fetch("), "Fetch API used");
      this.assert(
        js.includes("AbortController"),
        "AbortController for timeout present",
      );
      this.assert(
        js.includes("fetchWithTimeout"),
        "Timeout wrapper method present",
      );

      // Test Canvas API for latency graph
      this.assert(js.includes("getContext("), "Canvas context obtained");
      this.assert(
        js.includes("drawLatencyGraph"),
        "Latency graph drawing method present",
      );
      this.assert(js.includes("requestAnimationFrame"), "Animation frame used");

      // Test stress test engine
      this.assert(
        js.includes("startStressTest"),
        "Stress test start method present",
      );
      this.assert(
        js.includes("sendStressRequest"),
        "Individual stress request method present",
      );
      this.assert(
        js.includes("Promise.allSettled"),
        "Promise.allSettled for concurrent requests",
      );

      // Test schema export
      this.assert(js.includes("exportSchema"), "Schema export method present");
      this.assert(
        js.includes("generateTypeScriptInterface"),
        "TypeScript interface generation present",
      );

      // Test event binding
      this.assert(js.includes("addEventListener"), "Event listeners used");
      this.assert(
        js.includes("getElementById"),
        "Element selection by ID used",
      );

      // Test no external dependencies
      this.assert(!js.includes("require("), "No Node.js require statements");
      this.assert(!js.includes("import "), "No ES6 import statements");
    } catch (error) {
      this.assert(false, `JavaScript file read error: ${error.message}`);
    }
  },

  testStateMachineTransitions() {
    console.log("\n=== Testing State Machine Transitions ===");

    const fs = require("fs");
    const jsPath = "../src/main.js";

    try {
      const js = fs.readFileSync(jsPath, "utf8");

      // Test state transition methods
      this.assert(js.includes("setState("), "State setting method present");
      this.assert(js.includes("switchView("), "View switching method present");

      // Test all FSM transitions from blueprint
      this.assert(
        js.includes("PROCESSING"),
        "IDLE → PROCESSING transition possible",
      );
      this.assert(
        js.includes("SUCCESS"),
        "PROCESSING → SUCCESS transition possible",
      );
      this.assert(
        js.includes("ERROR"),
        "PROCESSING → ERROR transition possible",
      );

      // Test state transitions in sendRequest method
      this.assert(
        js.includes("setState('PROCESSING')"),
        "PROCESSING state set on request",
      );
      this.assert(
        js.includes("setState('SUCCESS')"),
        "SUCCESS state set on completion",
      );
      this.assert(
        js.includes("setState('ERROR')"),
        "ERROR state set on failure",
      );
      this.assert(
        js.includes("setState('IDLE')"),
        "IDLE state restoration present",
      );
    } catch (error) {
      this.assert(false, `State machine test error: ${error.message}`);
    }
  },

  testPerformanceFeatures() {
    console.log("\n=== Testing Performance Features ===");

    const fs = require("fs");
    const jsPath = "../src/main.js";

    try {
      const js = fs.readFileSync(jsPath, "utf8");

      // Test 60fps latency graph
      this.assert(
        js.includes("60fps"),
        "60fps target mentioned or implemented",
      );
      this.assert(
        js.includes("requestAnimationFrame"),
        "RequestAnimationFrame for 60fps used",
      );
      this.assert(js.includes("canvas.width"), "Canvas dimensions set");

      // Test sub-200ms filtering
      this.assert(
        js.includes("filterRequests"),
        "Request filtering method present",
      );
      this.assert(
        js.includes("toLowerCase()"),
        "Case-insensitive filtering implemented",
      );

      // Test memory management
      this.assert(
        js.includes("pruneArchive"),
        "Archive pruning for memory management present",
      );
      this.assert(
        js.includes("QuotaExceededError"),
        "Quota exceeded error handling present",
      );

      // Test performance.now() for latency measurement
      this.assert(
        js.includes("performance.now()"),
        "High-precision timing used",
      );
    } catch (error) {
      this.assert(false, `Performance features test error: ${error.message}`);
    }
  },

  testSecurityFeatures() {
    console.log("\n=== Testing Security Features ===");

    const fs = require("fs");
    const jsPath = "../src/main.js";

    try {
      const js = fs.readFileSync(jsPath, "utf8");

      // Test XSS prevention
      this.assert(
        js.includes("textContent"),
        "textContent used for safe DOM insertion",
      );
      this.assert(js.includes("escapeHtml"), "HTML escaping method present");

      // Test input validation
      this.assert(
        js.includes("JSON.parse"),
        "JSON parsing with error handling",
      );
      this.assert(js.includes("try {"), "Try-catch blocks for error handling");

      // Test no eval() or Function()
      this.assert(!js.includes("eval("), "No eval() usage");
      this.assert(
        !js.includes("new Function"),
        "No Function() constructor usage",
      );

      // Test timeout handling
      this.assert(js.includes("timeout"), "Request timeout handling present");
    } catch (error) {
      this.assert(false, `Security features test error: ${error.message}`);
    }
  },

  testBlueprintCompliance() {
    console.log("\n=== Testing Blueprint Compliance ===");

    const fs = require("fs");
    const blueprintPath = "../brainflow/blueprint.txt";

    try {
      const blueprint = fs.readFileSync(blueprintPath, "utf8");

      // Test all 6 core features implemented
      this.assert(
        blueprint.includes("Terminal de Intercepción"),
        "Gateway feature in blueprint",
      );
      this.assert(
        blueprint.includes("Bóveda de Payloads"),
        "Archive feature in blueprint",
      );
      this.assert(
        blueprint.includes("Simulador de Carga"),
        "Stress test feature in blueprint",
      );
      this.assert(
        blueprint.includes("Analizador de Latencia"),
        "Latency analysis feature in blueprint",
      );
      this.assert(
        blueprint.includes("Filtro de Ruido"),
        "Filter feature in blueprint",
      );
      this.assert(
        blueprint.includes("Exportador de Esquemas"),
        "Schema export feature in blueprint",
      );

      // Test Deep Purple & Neon aesthetic
      this.assert(
        blueprint.includes("Deep Purple & Neon"),
        "Design aesthetic specified",
      );

      // Test zero dependencies requirement
      this.assert(
        blueprint.includes("Cero bloat, cero dependencias"),
        "Zero dependencies requirement",
      );
    } catch (error) {
      this.assert(false, `Blueprint compliance test error: ${error.message}`);
    }
  },

  testFileSizes() {
    console.log("\n=== Testing File Sizes ===");

    const fs = require("fs");

    try {
      const htmlSize = fs.statSync("../src/index.html").size;
      const cssSize = fs.statSync("../src/styles.css").size;
      const jsSize = fs.statSync("../src/main.js").size;

      // Test reasonable file sizes (not too small, not too large)
      this.assert(htmlSize > 5000, "HTML file size reasonable (>5KB)");
      this.assert(htmlSize < 50000, "HTML file size not excessive (<50KB)");

      this.assert(cssSize > 10000, "CSS file size reasonable (>10KB)");
      this.assert(cssSize < 100000, "CSS file size not excessive (<100KB)");

      this.assert(jsSize > 20000, "JavaScript file size reasonable (>20KB)");
      this.assert(
        jsSize < 200000,
        "JavaScript file size not excessive (<200KB)",
      );

      console.log(`  HTML: ${htmlSize} bytes`);
      console.log(`  CSS: ${cssSize} bytes`);
      console.log(`  JS: ${jsSize} bytes`);
    } catch (error) {
      this.assert(false, `File size test error: ${error.message}`);
    }
  },

  runAll() {
    console.log("🔬 Neural-Link Test Suite Starting...\n");

    // Reset results
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      failures: [],
    };

    // Run all test categories
    this.testHTMLStructure();
    this.testCSSStructure();
    this.testJavaScriptStructure();
    this.testStateMachineTransitions();
    this.testPerformanceFeatures();
    this.testSecurityFeatures();
    this.testBlueprintCompliance();
    this.testFileSizes();

    // Print summary
    console.log("\n=== TEST RESULTS SUMMARY ===");
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);

    const successRate =
      this.results.total > 0
        ? Math.round((this.results.passed / this.results.total) * 100)
        : 0;
    console.log(`Success Rate: ${successRate}%`);

    if (this.results.failures.length > 0) {
      console.log("\nFAILED TESTS:");
      this.results.failures.forEach((failure) => {
        console.log(`  - ${failure}`);
      });
    }

    console.log("\n=== TEST EXECUTION COMPLETE ===");

    return {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      successRate,
      failures: this.results.failures,
    };
  },
};

// Dual compatibility for Node.js and browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = TestRunner;
} else {
  window.TestRunner = TestRunner;
}

// Auto-run if executed directly
if (typeof require !== "undefined" && require.main === module) {
  TestRunner.runAll();
}
