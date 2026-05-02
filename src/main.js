class QuantumFlow {
  constructor() {
    this.state = {
      currentView: "gateway",
      requests: [],
      filteredRequests: [],
      stressTest: {
        active: false,
        url: "",
        count: 0,
        rps: 10,
        profile: "constant",
        errorThreshold: 15,
        success: 0,
        error: 0,
        history: [],
        startTime: null,
        abortController: null,
      },
      stressTestRecords: [],
      pulse: {
        data: [],
        bufferSize: 1000,
        bufferIndex: 0,
        threshold: 300,
        watchdogEnabled: true,
        stressMarkers: [],
        snapshots: [],
        ghostMode: false,
        ghostData: null,
        ghostOpacity: 0.5,
      },
      latencyData: [],
      filter: {
        query: "",
        statusCode: null,
        headers: {},
      },
      selectedRequest: null,
      selectedRequests: [], // For diffing
      diffMode: false,
      status: "IDLE",
      envVars: {
        base_url: "https://api.example.com",
        api_key: "your-api-key-here",
        user_id: "12345",
      },
    };

    this.db = null;
    this.abortController = null;
    this.graphAnimationId = null;
    this.pulseAnimationId = null;
    this.radarAnimationId = null;
    this.forensicsAnimationId = null;
    this.maxInterceptedRequests = 5;
    this.stressWorker = null;

    // Beta restrictions
    this.betaMode = true;
    this.securityLevel = "medium";
    this.gatewayUsageCount = 0;
    this.maxGatewayUses = 20; // Beta limit for Gateway
    this.stressTestUsed = false; // One-time execution flag
    this.gatewayLimitReached = false;
    this.stressLimitReached = false;
    this.sessionId = this.generateSecureSessionId();
    this.securityBadge = null;
    this.fingerprintAttempts = 0;
    this.maxFingerprintAttempts = 3;

    this.init();
  }

  async init() {
    // Show loading screen
    this.showLoadingScreen();

    // Wait 3 seconds for loading animation
    await this.waitForLoading();

    // Check privacy policy acceptance
    const hasAccepted = await this.checkPrivacyAcceptance();
    if (!hasAccepted) {
      await this.showPrivacyPolicy();
    }

    // Initialize app
    await this.initIndexedDB();
    this.bindEvents();
    this.loadArchivedRequests();
    this.initGatewaySlots();
    this.initPayloadEditor();
    this.initPulseGraph();
    this.initStressRadar();
    this.loadPulseSnapshots();
    this.loadStressTestRecords();

    // Initialize security features
    this.initializeSecurity();

    // Initialize waitlist and legal functionality
    this.initializeWaitlist();
    this.initializeLegal();

    // Reset database to zero for all users
    this.resetAllUsageData();
    this.loadBetaUsageData();

    // Initialize totalUsage to prevent NaN
    this.totalUsage = 0;

    this.updateGatewayUsageHeader();

    // Initialize countdown timer
    this.initializeCountdown();

    // Show main app
    const mainApp = document.querySelector("main.quantum-flow");
    if (mainApp) {
      mainApp.classList.remove("hidden");
    }

    this.updateStatusBar("Ready");
  }

  initGatewaySlots() {
    const requestsList = document.getElementById("gate-requests-list");
    requestsList.innerHTML = "";
    for (let i = 0; i < this.maxInterceptedRequests; i++) {
      const slot = document.createElement("div");
      slot.className = "request-slot empty";
      slot.dataset.index = i;
      slot.innerHTML = `
        <span class="slot-number">${i + 1}</span>
        <span class="slot-label">Awaiting intercept...</span>
      `;
      requestsList.appendChild(slot);
    }
  }

  initPayloadEditor() {
    const bodyTextarea = document.querySelector(".body-input textarea");
    const headersTextarea = document.querySelector(".headers-input textarea");

    if (bodyTextarea) {
      this.setupIntellisense(bodyTextarea, "body");
    }
    if (headersTextarea) {
      this.setupIntellisense(headersTextarea, "headers");
    }
  }

  setupIntellisense(textarea, type) {
    let debounceTimer;

    textarea.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.highlightJsonSyntax(textarea);
      }, 300);
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        this.insertVariableTemplate(textarea);
      }
    });
  }

  highlightJsonSyntax(textarea) {
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;

    if (!value.trim()) return;

    try {
      JSON.parse(value);
      textarea.classList.remove("json-invalid");
      textarea.classList.add("json-valid");
    } catch {
      textarea.classList.remove("json-valid");
      textarea.classList.add("json-invalid");
    }
  }

  insertVariableTemplate(textarea) {
    const template = "{{base_url}}";
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value =
      value.substring(0, startPos) + template + value.substring(endPos);
    textarea.selectionStart = textarea.selectionEnd =
      startPos + template.length;
    textarea.focus();
  }

  replaceEnvVars(text) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return this.state.envVars[varName] || match;
    });
  }

  async initIndexedDB() {
    try {
      this.db = await this.openDB();
    } catch (error) {
      this.updateStatusBar("IndexedDB unavailable - using memory");
      this.db = null;
    }
  }

  initPulseGraph() {
    const canvas = document.getElementById("pulse-canvas");
    if (!canvas) return;

    const container = document.getElementById("pulse-graph-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    this.startPulseAnimation();
  }

  initStressRadar() {
    const canvas = document.getElementById("stress-radar-canvas");
    if (!canvas) return;

    const container = document.getElementById("stress-radar-view");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    this.startRadarAnimation();
  }

  initForensicsGraph() {
    const canvas = document.getElementById("fx-canvas");
    if (!canvas) return;

    const container = document.getElementById("fx-graph-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    this.startForensicsAnimation();
  }

  async loadPulseSnapshots() {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(["pulseSnapshots"], "readonly");
      const store = tx.objectStore("pulseSnapshots");
      const snapshots = await this.getAllFromStore(store);
      this.state.pulse.snapshots = snapshots;
      this.updateSnapshotSelect();
    } catch (error) {
      // Store might not exist yet
    }
  }

  updateSnapshotSelect() {
    const select = document.getElementById("fx-snapshot-select");
    if (!select) return;

    select.innerHTML =
      '<option value="">Select historical snapshot...</option>';
    this.state.pulse.snapshots.forEach((snapshot, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `Snapshot ${new Date(snapshot.timestamp).toLocaleString()}`;
      select.appendChild(option);
    });
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("QuantumFlowDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("requests")) {
          const store = db.createObjectStore("requests", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("url", "url", { unique: false });
          store.createIndex("method", "method", { unique: false });
        }
        if (!db.objectStoreNames.contains("pulseSnapshots")) {
          const store = db.createObjectStore("pulseSnapshots", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("forensicsVault")) {
          const store = db.createObjectStore("forensicsVault", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("privacyAcceptance")) {
          const store = db.createObjectStore("privacyAcceptance", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("fingerprint", "fingerprint", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("betaUsage")) {
          const store = db.createObjectStore("betaUsage", {
            keyPath: "id",
          });
          store.createIndex("lastUpdated", "lastUpdated", { unique: false });
        }
      };
    });
  }

  showLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.remove("hidden");
      this.animateLoadingScreen();
    }
  }

  async animateLoadingScreen() {
    const progressFill = document.querySelector(".progress-fill");
    const progressPercentage = document.querySelector(".progress-percentage");
    const statusText = document.querySelector(".status-text");
    const statusDots = document.querySelectorAll(".status-dot");

    const loadingSteps = [
      { progress: 0, status: "Initializing quantum core...", activeDot: 0 },
      { progress: 25, status: "Calibrating neural pathways...", activeDot: 1 },
      {
        progress: 50,
        status: "Establishing secure connections...",
        activeDot: 2,
      },
      {
        progress: 75,
        status: "Optimizing performance matrix...",
        activeDot: 0,
      },
      { progress: 90, status: "Finalizing initialization...", activeDot: 1 },
      { progress: 100, status: "System ready", activeDot: 2 },
    ];

    for (let i = 0; i < loadingSteps.length; i++) {
      const step = loadingSteps[i];

      // Update progress bar
      if (progressFill) {
        progressFill.style.width = `${step.progress}%`;
      }

      // Update percentage text
      if (progressPercentage) {
        progressPercentage.textContent = `${step.progress}%`;
      }

      // Update status text
      if (statusText) {
        statusText.textContent = step.status;
      }

      // Update active dot
      statusDots.forEach((dot, index) => {
        dot.classList.toggle("active", index === step.activeDot);
      });

      // Wait between steps
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  async waitForLoading() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
          loadingScreen.classList.add("hidden");
        }
        resolve();
      }, 3000);
    });
  }

  async checkPrivacyAcceptance() {
    try {
      // Generate unique browser fingerprint instead of IP
      const browserFingerprint = await this.generateBrowserFingerprint();

      // Check if this fingerprint has accepted privacy policy
      const acceptanceKey = `privacy_accepted_${browserFingerprint}`;
      const hasAccepted = localStorage.getItem(acceptanceKey);

      return hasAccepted === "true";
    } catch (error) {
      console.warn("Failed to check privacy acceptance:", error);
      return false; // Default to showing privacy policy if check fails
    }
  }

  async generateBrowserFingerprint() {
    // Create a unique fingerprint from browser characteristics
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("Browser fingerprint", 2, 2);

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || "unknown",
      navigator.platform,
    ].join("|");

    // Create hash from fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  async showPrivacyPolicy() {
    return new Promise((resolve) => {
      const privacyOverlay = document.getElementById("privacy-overlay");
      const privacyCheckbox = document.getElementById("privacy-accept");
      const continueBtn = document.getElementById("privacy-continue");

      if (privacyOverlay) {
        privacyOverlay.classList.remove("hidden");
      }

      const handleContinue = async () => {
        if (privacyCheckbox && privacyCheckbox.checked) {
          try {
            // Generate browser fingerprint and store acceptance
            const browserFingerprint = await this.generateBrowserFingerprint();

            const acceptanceKey = `privacy_accepted_${browserFingerprint}`;
            localStorage.setItem(acceptanceKey, "true");

            // Store acceptance record in IndexedDB
            await this.storePrivacyAcceptance(browserFingerprint);
          } catch (error) {
            console.warn("Failed to store privacy acceptance:", error);
          }

          // Hide privacy overlay
          if (privacyOverlay) {
            privacyOverlay.classList.add("hidden");
          }

          // Clean up event listeners
          if (continueBtn) {
            continueBtn.removeEventListener("click", handleContinue);
          }
          if (privacyCheckbox) {
            privacyCheckbox.removeEventListener("change", handleCheckboxChange);
          }

          resolve();
        }
      };

      const handleCheckboxChange = () => {
        if (continueBtn && privacyCheckbox) {
          continueBtn.disabled = !privacyCheckbox.checked;
        }
      };

      // Add event listeners
      if (continueBtn) {
        continueBtn.addEventListener("click", handleContinue);
      }
      if (privacyCheckbox) {
        privacyCheckbox.addEventListener("change", handleCheckboxChange);
      }
    });
  }

  async storePrivacyAcceptance(fingerprint) {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(["privacyAcceptance"], "readwrite");
      const store = tx.objectStore("privacyAcceptance");

      const acceptanceRecord = {
        fingerprint: fingerprint,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        accepted: true,
      };

      await store.add(acceptanceRecord);
    } catch (error) {
      console.warn("Failed to store privacy acceptance in IndexedDB:", error);
    }
  }

  bindEvents() {
    // Navigation
    document.getElementById("nav-gateway-tab").addEventListener("click", () => {
      this.switchView("gateway");
    });
    document.getElementById("nav-pulse-tab").addEventListener("click", () => {
      this.switchView("pulse");
    });
    document.getElementById("nav-stress-tab").addEventListener("click", () => {
      this.switchView("stress");
    });
    document.getElementById("nav-archive-tab").addEventListener("click", () => {
      this.switchView("archive");
    });
    document
      .getElementById("nav-waitlist-tab")
      ?.addEventListener("click", () => {
        this.switchView("waitlist");
      });
    document.getElementById("nav-legal-tab")?.addEventListener("click", () => {
      this.switchView("legal");
    });

    // Gateway controls
    document.getElementById("gate-send-btn").addEventListener("click", () => {
      this.sendRequest();
    });
    const clearBtn = document.getElementById("gate-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clearGateway();
      });
    }
    document
      .getElementById("gate-method-select")
      .addEventListener("change", (e) => {});

    // Schema Generator Button
    document
      .getElementById("gate-schema-btn")
      ?.addEventListener("click", () => this.copySchemaToClipboard());

    // Archive
    document
      .getElementById("arch-search-input")
      .addEventListener("input", (e) => {
        this.filterRequests(e.target.value);
      });
    document.getElementById("arch-replay-btn").addEventListener("click", () => {
      this.replaySelectedRequest();
    });
    document.getElementById("arch-export-btn").addEventListener("click", () => {
      this.exportSchema();
    });
    document.getElementById("arch-clear-btn").addEventListener("click", () => {
      this.clearArchive();
    });
    document.getElementById("arch-diff-btn")?.addEventListener("click", () => {
      this.toggleDiffMode();
    });
    document
      .getElementById("arch-compare-btn")
      ?.addEventListener("click", () => {
        this.compareSelectedRequests();
      });

    // Stress
    document
      .getElementById("stress-start-btn")
      .addEventListener("click", () => {
        this.startStressTest();
      });
    document.getElementById("stress-stop-btn").addEventListener("click", () => {
      this.stopStressTest();
    });
    document
      .getElementById("stress-export-btn")
      ?.addEventListener("click", () => {
        this.exportStressResults();
      });

    // Pulse
    document.getElementById("pulse-reset-btn").addEventListener("click", () => {
      this.resetPulseGraph();
    });
    document.getElementById("pl-thresh-inp")?.addEventListener("input", (e) => {
      this.state.pulse.threshold = parseInt(e.target.value) || 300;
    });
    document
      .getElementById("pl-watchdog-toggle")
      ?.addEventListener("change", (e) => {
        this.state.pulse.watchdogEnabled = e.target.checked;
      });

    // Forensics
    const ghostToggleBtn = document.getElementById("fx-ghost-toggle-btn");
    if (ghostToggleBtn) {
      ghostToggleBtn.addEventListener("click", () => {
        this.toggleForensicsGhostMode();
      });
    }
    const analyzeBtn = document.getElementById("fx-analyze-btn");
    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", () => {
        this.analyzeAnomalies();
      });
    }
    const headerAuditBtn = document.getElementById("fx-header-audit-btn");
    if (headerAuditBtn) {
      headerAuditBtn.addEventListener("click", () => {
        this.performHeaderAudit();
      });
    }
    const exportBtn = document.getElementById("fx-export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportForensicEvidence();
      });
    }
    const snapshotSelect = document.getElementById("fx-snapshot-select");
    if (snapshotSelect) {
      snapshotSelect.addEventListener("change", (e) => {
        this.loadForensicsSnapshot(e.target.value);
      });
    }
    const opacityInput = document.getElementById("fx-opacity-input");
    if (opacityInput) {
      opacityInput.addEventListener("input", (e) => {
        this.state.forensics.ghostOpacity = e.target.value / 100;
      });
    }
  }

  switchView(view) {
    this.state.currentView = view;

    // Update navigation
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.view === view);
    });

    // Update views
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.id === `${view}-view`);
    });

    // Initialize view-specific features
    if (view === "pulse") {
      this.initPulseGraph();
    } else if (view === "archive") {
      this.renderArchive();
    }
  }

  async sendRequest() {
    const urlInput = document.getElementById("gate-request-input");
    const methodSelect = document.getElementById("gate-method-select");
    const headersTextarea = document.querySelector(".headers-input textarea");
    const bodyTextarea = document.querySelector(".body-input textarea");

    let url = urlInput.value.trim();
    if (!url) {
      this.updateStatusBar("Please enter a URL");
      return;
    }

    url = this.replaceEnvVars(url);
    const method = methodSelect.value;
    let headers = {};
    let body = null;

    try {
      if (headersTextarea.value.trim()) {
        const headersStr = this.replaceEnvVars(headersTextarea.value);
        headers = JSON.parse(headersStr);
      }
      if (
        bodyTextarea.value.trim() &&
        ["POST", "PUT", "PATCH"].includes(method)
      ) {
        const bodyStr = this.replaceEnvVars(bodyTextarea.value);
        body = JSON.parse(bodyStr);
      }
    } catch (error) {
      this.updateStatusBar("Invalid JSON in headers or body");
      return;
    }

    this.setState("PROCESSING");
    this.updateStatusBar("Sending request...");

    const startTime = performance.now();
    const perfStart = performance.getEntriesByType("navigation").length;

    try {
      const response = await this.fetchWithTimeout(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const responseData = await response.text();

      const perfMetrics = this.extractPerformanceMetrics(
        url,
        startTime,
        endTime,
      );

      const request = {
        id: Date.now(),
        url,
        method,
        headers,
        body,
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        latency,
        timestamp: new Date().toISOString(),
        perfMetrics,
      };

      this.state.latencyData.push({
        timestamp: Date.now(),
        latency,
      });

      // Add to Pulse data (circular buffer)
      this.state.pulse.data.push({
        timestamp: Date.now(),
        latency,
        status: response.status,
      });
      if (this.state.pulse.data.length > this.state.pulse.bufferSize) {
        this.state.pulse.data.shift();
      }

      this.renderGatewayRequestFIFO(request);
      this.displayPayload(request);
      this.archiveRequest(request);

      document.getElementById("gate-latency-badge").textContent =
        `${latency}ms`;

      this.setState("SUCCESS");
      this.updateStatusBar(`Request completed - ${latency}ms`);

      setTimeout(() => this.setState("IDLE"), 1000);
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const request = {
        id: Date.now(),
        url,
        method,
        headers,
        body,
        status: 0,
        statusText: error.name,
        response: error.message,
        latency,
        timestamp: new Date().toISOString(),
        error: true,
      };

      this.renderGatewayRequestFIFO(request);
      this.displayPayload(request);
      this.archiveRequest(request);

      this.setState("ERROR");
      this.updateStatusBar(`Request failed - ${error.message}`);

      setTimeout(() => this.setState("IDLE"), 3000);
    }
  }

  async fetchWithTimeout(url, options, timeout = 10000) {
    this.abortController = new AbortController();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (this.abortController) {
          this.abortController.abort();
        }
        reject(new Error("Request timeout"));
      }, timeout);
    });

    try {
      const response = await Promise.race([
        fetch(url, {
          ...options,
          signal: this.abortController.signal,
          mode: "cors",
          headers: {
            ...options.headers,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
        timeoutPromise,
      ]);
      return response;
    } finally {
      this.abortController = null;
    }
  }

  renderGatewayRequestFIFO(request) {
    const requestsList = document.getElementById("gate-requests-list");
    const slots = Array.from(requestsList.children);

    // Shift existing requests down (FIFO - First In First Out)
    for (let i = slots.length - 1; i > 0; i--) {
      const currentSlot = slots[i];
      const prevSlot = slots[i - 1];

      currentSlot.className = prevSlot.className;
      currentSlot.dataset.id = prevSlot.dataset.id || "";
      currentSlot.innerHTML = prevSlot.innerHTML;

      // Copy click handler
      const requestId = prevSlot.dataset.id;
      if (requestId) {
        const req = this.state.requests.find((r) => r.id == requestId);
        currentSlot.onclick = () => {
          if (req) {
            document
              .querySelectorAll(".request-slot")
              .forEach((s) => s.classList.remove("selected"));
            currentSlot.classList.add("selected");
            this.displayPayload(req);
          }
        };
      }
    }

    // Fill first slot with new request
    const firstSlot = slots[0];
    if (firstSlot) {
      firstSlot.className = "request-slot filled";
      firstSlot.dataset.id = request.id;

      const statusClass = request.error ? "error" : "success";
      firstSlot.innerHTML = `
        <span class="slot-number">1</span>
        <span class="method">${request.method}</span>
        <span class="url">${this.truncateUrl(request.url, 25)}</span>
        <span class="status ${statusClass}">${request.status}</span>
      `;

      firstSlot.onclick = () => {
        document
          .querySelectorAll(".request-slot")
          .forEach((s) => s.classList.remove("selected"));
        firstSlot.classList.add("selected");
        this.displayPayload(request);
      };
    }
  }

  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + "...";
  }

  extractPerformanceMetrics(url, startTime, endTime) {
    const entries = performance.getEntriesByName(url, "resource");
    const latestEntry = entries[entries.length - 1];

    if (!latestEntry) {
      return {
        ttfb: Math.round(endTime - startTime),
        dns: 0,
        tcp: 0,
        ssl: 0,
        download: 0,
        total: Math.round(endTime - startTime),
      };
    }

    const metrics = {
      ttfb: Math.round(latestEntry.responseStart - latestEntry.fetchStart),
      dns: Math.round(
        latestEntry.domainLookupEnd - latestEntry.domainLookupStart,
      ),
      tcp: Math.round(latestEntry.connectEnd - latestEntry.connectStart),
      ssl: Math.round(
        latestEntry.secureConnectionStart > 0
          ? latestEntry.connectEnd - latestEntry.secureConnectionStart
          : 0,
      ),
      download: Math.round(latestEntry.responseEnd - latestEntry.responseStart),
      total: Math.round(latestEntry.duration),
    };

    performance.clearResourceTimings();
    return metrics;
  }

  displayPayload(request) {
    const headersView = document.getElementById("gate-headers-view");
    const payloadView = document.getElementById("gate-payload-view");

    // Display headers with performance metrics
    const headers = {
      Method: request.method,
      URL: request.url,
      Status: `${request.status} ${request.statusText}`,
      Latency: `${request.latency}ms`,
      Timestamp: request.timestamp,
      ...(request.perfMetrics && {
        "📊 TTFB": `${request.perfMetrics.ttfb}ms`,
        "🌐 DNS": `${request.perfMetrics.dns}ms`,
        "🔗 TCP": `${request.perfMetrics.tcp}ms`,
        "🔒 SSL": `${request.perfMetrics.ssl}ms`,
        "⬇️ Download": `${request.perfMetrics.download}ms`,
      }),
      ...request.headers,
    };

    headersView.innerHTML = this.syntaxHighlightJSON(headers);

    // Display response
    let responseData;
    try {
      responseData = JSON.parse(request.response);
      payloadView.innerHTML = this.syntaxHighlightJSON(responseData);
    } catch {
      payloadView.innerHTML = `<span class="json-string">${this.escapeHtml(request.response)}</span>`;
    }

    // Store current response for schema generation
    this.state.currentResponse = responseData || request.response;
  }

  copySchemaToClipboard() {
    if (!this.state.currentResponse) {
      this.updateStatusBar("No response data to generate schema");
      return;
    }

    let schema;
    try {
      const data =
        typeof this.state.currentResponse === "string"
          ? JSON.parse(this.state.currentResponse)
          : this.state.currentResponse;
      schema = this.generateTypeScriptInterface(
        data,
        "ResponseSchema",
        0,
        true,
      );
    } catch {
      schema =
        "// Response is not valid JSON\nexport interface ResponseSchema {\n  // Unable to generate schema\n}";
    }

    navigator.clipboard
      .writeText(schema)
      .then(() => {
        this.updateStatusBar("✓ TypeScript schema copied to clipboard");
        setTimeout(() => this.setState("IDLE"), 2000);
      })
      .catch(() => {
        this.updateStatusBar("Failed to copy to clipboard");
      });
  }

  syntaxHighlightJSON(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
      .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/: null/g, ': <span class="json-null">null</span>');
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async archiveRequest(request) {
    console.log("🔍 DEBUG: archiveRequest called", request);
    console.log("🔍 DEBUG: DB status", !!this.db);

    if (!this.db) {
      console.log("🔍 DEBUG: No DB, using localStorage fallback");
      // Fallback to localStorage
      try {
        const requests = JSON.parse(
          localStorage.getItem("quantumFlow_requests") || "[]",
        );
        requests.unshift(request);
        localStorage.setItem(
          "quantumFlow_requests",
          JSON.stringify(requests.slice(0, 1000)),
        ); // Limit to 1000

        // Add to current state
        this.state.requests.unshift(request);
        this.state.filteredRequests = [...this.state.requests];

        console.log("🔍 DEBUG: localStorage fallback successful");
        this.flashArchiveTab();

        // Update gateway usage counter in real-time
        await this.calculateTotalUsage();
        this.updateGatewayUsageHeader();

        if (this.state.currentView === "archive") {
          this.renderArchive();
        }
      } catch (error) {
        console.error("🔍 DEBUG: localStorage fallback failed", error);
      }
      return;
    }

    try {
      console.log("🔍 DEBUG: Using IndexedDB");
      const tx = this.db.transaction(["requests"], "readwrite");
      const store = tx.objectStore("requests");
      await store.add(request);

      // Add to current state for real-time updates
      this.state.requests.unshift(request);
      this.state.filteredRequests = [...this.state.requests];

      console.log("🔍 DEBUG: IndexedDB add successful");

      // Flash Archive tab to show new request was added
      this.flashArchiveTab();

      // Update gateway usage counter in real-time
      await this.calculateTotalUsage();
      this.updateGatewayUsageHeader();

      // Update archive view if active
      if (this.state.currentView === "archive") {
        console.log("🔍 DEBUG: Rendering archive view");
        this.renderArchive();
      }
    } catch (error) {
      console.error("🔍 DEBUG: IndexedDB error", error);
      // Handle quota exceeded
      if (error.name === "QuotaExceededError") {
        this.pruneArchive();
        try {
          const tx = this.db.transaction(["requests"], "readwrite");
          const store = tx.objectStore("requests");
          await store.add(request);

          // Add to current state for real-time updates
          this.state.requests.unshift(request);
          this.state.filteredRequests = [...this.state.requests];

          // Flash Archive tab to show new request was added
          this.flashArchiveTab();

          // Update gateway usage counter in real-time
          await this.calculateTotalUsage();
          this.updateGatewayUsageHeader();

          // Update archive view if active
          if (this.state.currentView === "archive") {
            this.renderArchive();
          }
        } catch (retryError) {
          // Still fails, give up on archiving
        }
      }
    }
  }

  async loadArchivedRequests() {
    console.log("🔍 DEBUG: loadArchivedRequests called");

    if (!this.db) {
      console.log("🔍 DEBUG: No DB, loading from localStorage");
      // Load from localStorage fallback
      try {
        const requests = JSON.parse(
          localStorage.getItem("quantumFlow_requests") || "[]",
        );
        this.state.requests = requests.reverse();
        this.state.filteredRequests = [...this.state.requests];
        console.log(
          "🔍 DEBUG: Loaded from localStorage",
          requests.length,
          "requests",
        );

        if (this.state.currentView === "archive") {
          this.renderArchive();
        }
      } catch (error) {
        console.error("🔍 DEBUG: Failed to load from localStorage", error);
        this.state.requests = [];
        this.state.filteredRequests = [];
      }
      return;
    }

    try {
      console.log("🔍 DEBUG: Loading from IndexedDB");
      const tx = this.db.transaction(["requests"], "readonly");
      const store = tx.objectStore("requests");
      const requests = await this.getAllFromStore(store);
      // Sort by timestamp descending (newest first)
      this.state.requests = requests.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      );
      this.state.filteredRequests = [...this.state.requests];
      console.log(
        "🔍 DEBUG: Loaded from IndexedDB",
        requests.length,
        "requests",
      );

      if (this.state.currentView === "archive") {
        this.renderArchive();
      }
    } catch (error) {
      console.error("🔍 DEBUG: IndexedDB load failed", error);
      this.updateStatusBar("Failed to load archived requests");
    }
  }

  getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const requests = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          requests.push(cursor.value);
          cursor.continue();
        } else {
          resolve(requests);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async pruneArchive() {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(["requests"], "readwrite");
      const store = tx.objectStore("requests");
      const index = store.index("timestamp");

      // Get oldest records
      const request = index.openCursor(null, "next");
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < 1000) {
          cursor.delete();
          count++;
          cursor.continue();
        }
      };
    } catch (error) {
      // Ignore pruning errors
    }
  }

  renderArchive() {
    const archivedRequests = document.getElementById("arch-requests-list");
    archivedRequests.innerHTML = "";

    const requests =
      this.state.filteredRequests.length > 0
        ? this.state.filteredRequests
        : this.state.requests;

    if (requests.length === 0) {
      archivedRequests.innerHTML =
        '<div class="empty-archive">No archived requests</div>';
      return;
    }

    // Calculate best and worst performing requests (only status 200)
    const status200Requests = requests.filter((r) => r.status === 200);
    let bestRequest = null;
    let worstRequest = null;

    if (status200Requests.length > 0) {
      bestRequest = status200Requests.reduce((min, r) =>
        r.latency < min.latency ? r : min,
      );
      worstRequest = status200Requests.reduce((max, r) =>
        r.latency > max.latency ? r : max,
      );
    }

    requests.forEach((request) => {
      const requestElement = document.createElement("div");
      const statusClass = this.getStatusTagClass(request.status);
      const isBest = bestRequest && request.id === bestRequest.id;
      const isWorst = worstRequest && request.id === worstRequest.id;
      const isSelected = this.state.selectedRequests.includes(request.id);
      const isDiffMode = this.state.diffMode;

      let extraClasses = statusClass;
      if (isBest) extraClasses += " best-performance";
      if (isWorst) extraClasses += " worst-performance";
      if (isSelected && isDiffMode) extraClasses += " diff-selected";

      requestElement.className = `request-item ${extraClasses}`;
      requestElement.dataset.id = request.id;

      const timestamp = new Date(request.timestamp).toLocaleTimeString();
      const shortTimestamp = new Date(request.timestamp).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      requestElement.innerHTML = `
        <div class="request-main">
          <span class="method-tag ${statusClass}">${request.method}</span>
          <span class="url" title="${request.url}">${this.truncateUrl(request.url, 40)}</span>
          <span class="status-badge ${statusClass}">${request.status}</span>
        </div>
        <div class="request-meta">
          <span class="latency-tag ${request.latency > 1000 ? "slow" : "fast"}">${request.latency}ms</span>
          <span class="timestamp">${shortTimestamp}</span>
          ${isBest ? '<span class="performance-badge best" title="Fastest response">⚡ BEST</span>' : ""}
          ${isWorst ? '<span class="performance-badge worst" title="Slowest response">🐢 SLOW</span>' : ""}
        </div>
      `;

      requestElement.addEventListener("click", (e) => {
        if (isDiffMode) {
          this.toggleRequestSelection(request.id, requestElement);
        } else {
          document
            .querySelectorAll(".archived-requests .request-item")
            .forEach((item) => {
              item.classList.remove("selected");
            });
          requestElement.classList.add("selected");
          this.state.selectedRequest = request;
          this.displayRequestDetails(request);
        }
      });

      archivedRequests.appendChild(requestElement);
    });
  }

  getStatusTagClass(status) {
    if (status >= 200 && status < 300) return "success";
    if (status >= 300 && status < 400) return "redirect";
    if (status >= 400 && status < 500) return "client-error";
    if (status >= 500) return "server-error";
    if (status === 0) return "error";
    return "unknown";
  }

  toggleDiffMode() {
    this.state.diffMode = !this.state.diffMode;
    this.state.selectedRequests = [];

    const diffBtn = document.getElementById("arch-diff-btn");
    const compareBtn = document.getElementById("arch-compare-btn");

    if (this.state.diffMode) {
      diffBtn?.classList.add("active");
      compareBtn?.classList.remove("hidden");
      this.updateStatusBar("Diff mode: Select 2 requests to compare");
    } else {
      diffBtn?.classList.remove("active");
      compareBtn?.classList.add("hidden");
      this.updateStatusBar("Diff mode disabled");
    }

    this.renderArchive();
  }

  toggleRequestSelection(requestId, element) {
    const index = this.state.selectedRequests.indexOf(requestId);

    if (index > -1) {
      this.state.selectedRequests.splice(index, 1);
      element.classList.remove("diff-selected");
    } else {
      if (this.state.selectedRequests.length < 2) {
        this.state.selectedRequests.push(requestId);
        element.classList.add("diff-selected");
      } else {
        // Remove first and add new
        const firstId = this.state.selectedRequests.shift();
        document
          .querySelector(`.request-item[data-id="${firstId}"]`)
          ?.classList.remove("diff-selected");
        this.state.selectedRequests.push(requestId);
        element.classList.add("diff-selected");
      }
    }

    this.updateStatusBar(
      `Selected ${this.state.selectedRequests.length}/2 requests for comparison`,
    );
  }

  compareSelectedRequests() {
    if (this.state.selectedRequests.length !== 2) {
      this.updateStatusBar("Select exactly 2 requests to compare");
      return;
    }

    const [id1, id2] = this.state.selectedRequests;
    const req1 = this.state.requests.find((r) => r.id == id1);
    const req2 = this.state.requests.find((r) => r.id == id2);

    if (!req1 || !req2) {
      this.updateStatusBar("Could not find selected requests");
      return;
    }

    this.showDiffModal(req1, req2);
  }

  showDiffModal(req1, req2) {
    const diffContent = this.generateDiffHTML(req1, req2);

    // Create modal
    const modal = document.createElement("div");
    modal.className = "diff-modal";
    modal.innerHTML = `
      <div class="diff-modal-content">
        <div class="diff-header">
          <h3>🔍 Visual Diff</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="diff-body">
          ${diffContent}
        </div>
      </div>
    `;

    modal
      .querySelector(".close-btn")
      .addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }

  generateDiffHTML(req1, req2) {
    // Compare headers
    const headerDiffs = this.compareObjects(
      req1.headers || {},
      req2.headers || {},
      "Headers",
    );

    // Compare responses
    let body1, body2;
    try {
      body1 = JSON.parse(req1.response);
      body2 = JSON.parse(req2.response);
    } catch {
      body1 = req1.response;
      body2 = req2.response;
    }
    const bodyDiffs = this.compareObjects(body1, body2, "Body");

    return `
      <div class="diff-summary">
        <div class="diff-request-card">
          <h4>Request A</h4>
          <p><strong>${req1.method}</strong> ${this.truncateUrl(req1.url, 30)}</p>
          <p>Status: <span class="status-badge ${this.getStatusTagClass(req1.status)}">${req1.status}</span></p>
          <p>Latency: ${req1.latency}ms</p>
          <p>Time: ${new Date(req1.timestamp).toLocaleString()}</p>
        </div>
        <div class="diff-vs">VS</div>
        <div class="diff-request-card">
          <h4>Request B</h4>
          <p><strong>${req2.method}</strong> ${this.truncateUrl(req2.url, 30)}</p>
          <p>Status: <span class="status-badge ${this.getStatusTagClass(req2.status)}">${req2.status}</span></p>
          <p>Latency: ${req2.latency}ms</p>
          <p>Time: ${new Date(req2.timestamp).toLocaleString()}</p>
        </div>
      </div>
      <div class="diff-sections">
        ${headerDiffs}
        ${bodyDiffs}
      </div>
    `;
  }

  compareObjects(obj1, obj2, title) {
    const diffs = [];
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    allKeys.forEach((key) => {
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (val1 === undefined) {
        diffs.push(
          `<div class="diff-line added"><span class="diff-key">+ ${key}:</span> ${JSON.stringify(val2)}</div>`,
        );
      } else if (val2 === undefined) {
        diffs.push(
          `<div class="diff-line removed"><span class="diff-key">- ${key}:</span> ${JSON.stringify(val1)}</div>`,
        );
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diffs.push(
          `<div class="diff-line changed"><span class="diff-key">~ ${key}:</span> <span class="diff-old">${JSON.stringify(val1)}</span> → <span class="diff-new">${JSON.stringify(val2)}</span></div>`,
        );
      }
    });

    if (diffs.length === 0) {
      return `<div class="diff-section"><h4>${title}</h4><div class="diff-no-changes">✓ No changes detected</div></div>`;
    }

    return `<div class="diff-section"><h4>${title} Changes</h4>${diffs.join("")}</div>`;
  }

  displayRequestDetails(request) {
    // Show request details in a side panel or modal
    const headersView = document.getElementById("gate-headers-view");
    const payloadView = document.getElementById("gate-payload-view");

    if (headersView && payloadView) {
      this.displayPayload(request);
      // Switch to gateway view to see details
      document.getElementById("nav-gateway-tab")?.click();
    }
  }

  filterRequests(query) {
    this.state.filter.query = query.toLowerCase();

    if (!query) {
      this.state.filteredRequests = [...this.state.requests];
    } else {
      this.state.filteredRequests = this.state.requests.filter((request) => {
        const searchText = query.toLowerCase();

        // Deep search in all fields
        const urlMatch = request.url.toLowerCase().includes(searchText);
        const methodMatch = request.method.toLowerCase().includes(searchText);
        const statusMatch = String(request.status).includes(searchText);
        const latencyMatch = String(request.latency).includes(searchText);
        const responseMatch = request.response
          .toLowerCase()
          .includes(searchText);
        const timestampMatch = request.timestamp
          .toLowerCase()
          .includes(searchText);
        const headersMatch = JSON.stringify(request.headers)
          .toLowerCase()
          .includes(searchText);

        // Status code smart tagging search
        const statusTagMatch = this.matchesStatusTag(
          request.status,
          searchText,
        );

        return (
          urlMatch ||
          methodMatch ||
          statusMatch ||
          latencyMatch ||
          responseMatch ||
          timestampMatch ||
          headersMatch ||
          statusTagMatch
        );
      });
    }

    this.renderArchive();
  }

  matchesStatusTag(status, query, latency = 0) {
    // Smart tagging: allow searching by status category
    const tagMappings = {
      success: [200, 201, 202, 204],
      ok: [200],
      created: [201],
      redirect: [301, 302, 304],
      "not found": [404],
      error: [400, 401, 403, 404, 500, 502, 503],
      "client error": [400, 401, 403, 404, 405, 422],
      "server error": [500, 502, 503, 504],
      bad: [400, 401, 403, 404, 500],
    };

    for (const [tag, codes] of Object.entries(tagMappings)) {
      if (query.includes(tag)) {
        return codes.includes(status);
      }
    }

    // Special case for slow requests (>1000ms)
    if (query.includes("slow") && latency > 1000) {
      return true;
    }

    return false;
  }

  async replaySelectedRequest() {
    if (!this.state.selectedRequest) {
      this.updateStatusBar("No request selected");
      return;
    }

    const request = this.state.selectedRequest;

    // Switch to gateway view
    this.switchView("gateway");

    // Populate form
    document.getElementById("gate-request-input").value = request.url;
    document.getElementById("gate-method-select").value = request.method;
    document.querySelector(".headers-input textarea").value = JSON.stringify(
      request.headers,
      null,
      2,
    );
    document.querySelector(".body-input textarea").value = request.body
      ? JSON.stringify(request.body, null, 2)
      : "";

    // Send request
    this.sendRequest();
  }

  exportSchema() {
    const selected = this.state.selectedRequest || this.state.requests[0];

    if (!selected) {
      this.updateStatusBar("No request to export");
      return;
    }

    let schema;
    try {
      const data = JSON.parse(selected.response);
      schema = this.generateTypeScriptInterface(data, "ResponseSchema");
    } catch {
      schema =
        "// Response is not valid JSON\nexport interface ResponseSchema {\n  // Unable to generate schema\n}";
    }

    this.downloadFile("schema.ts", schema);
    this.updateStatusBar("Schema exported");
  }

  generateTypeScriptInterface(obj, name, depth = 0, isRoot = false) {
    if (depth > 5) return "any";

    if (obj === null) return "null";
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "any[]";
      const itemType = this.generateTypeScriptInterface(
        obj[0],
        this.singularize(name),
        depth + 1,
      );
      return `${itemType}[]`;
    }

    if (typeof obj === "object") {
      const nestedInterfaces = [];
      const properties = Object.entries(obj)
        .map(([key, value]) => {
          const type = this.generateTypeScriptInterface(value, key, depth + 1);

          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            const nestedName = this.pascalCase(key);
            nestedInterfaces.push(
              this.generateTypeScriptInterface(value, nestedName, depth + 1),
            );
            return `  ${key}: ${nestedName};`;
          }

          if (
            Array.isArray(value) &&
            value.length > 0 &&
            typeof value[0] === "object"
          ) {
            const itemName = this.pascalCase(this.singularize(key));
            nestedInterfaces.push(
              this.generateTypeScriptInterface(value[0], itemName, depth + 1),
            );
            return `  ${key}: ${itemName}[];`;
          }

          return `  ${key}: ${type};`;
        })
        .join("\n");

      const interfaceDef = `export interface ${this.pascalCase(name)} {\n${properties}\n}`;

      if (isRoot && nestedInterfaces.length > 0) {
        return [...nestedInterfaces.reverse(), interfaceDef].join("\n\n");
      }

      return isRoot ? `export ${interfaceDef}` : interfaceDef;
    }

    if (typeof obj === "string") return "string";
    if (typeof obj === "number") return "number";
    if (typeof obj === "boolean") return "boolean";
    return "any";
  }

  pascalCase(str) {
    return str.replace(/(?:^|_)([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  singularize(str) {
    return str.replace(/s$/, "").replace(/ies$/, "y");
  }

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async clearArchive() {
    if (!confirm("Are you sure you want to clear all archived requests?")) {
      return;
    }

    if (this.db) {
      try {
        const tx = this.db.transaction(["requests"], "readwrite");
        const store = tx.objectStore("requests");
        await store.clear();
      } catch (error) {
        this.updateStatusBar("Failed to clear archive");
        return;
      }
    }

    this.state.requests = [];
    this.state.filteredRequests = [];
    this.state.selectedRequest = null;

    document.getElementById("arch-requests-list").innerHTML = "";
    document.getElementById("gate-requests-list").innerHTML = "";

    this.updateStatusBar("Archive cleared");
  }

  startStressTest() {
    // Check stress test limits
    if (!this.checkStressTestLimit()) {
      return;
    }

    const urlInput = document.getElementById("stress-url-input");
    const countInput = document.getElementById("stress-count-input");

    const url = urlInput.value.trim();
    let count = parseInt(countInput.value) || 10;

    if (!url) {
      this.updateStatusBar("Please enter a URL");
      return;
    }

    // Validate URL against whitelist
    if (!this.validateStressUrl(url)) {
      this.updateStatusBar(
        "URL not allowed in beta mode - only localhost and API endpoints permitted",
      );
      return;
    }

    this.state.stressTest.active = true;
    this.state.stressTest.url = url;
    this.state.stressTest.count = count;
    this.state.stressTest.success = 0;
    this.state.stressTest.error = 0;
    this.state.stressTest.history = [];
    this.state.stressTest.startTime = Date.now();

    // Disable start button during test
    const startButton = document.getElementById("stress-start-btn");
    if (startButton) {
      startButton.disabled = true;
      startButton.style.opacity = "0.5";
      startButton.style.cursor = "not-allowed";
    }

    this.updateStatusBar(`Starting stress test: ${count} requests`);

    // Run stress test
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.sendStressRequest(i));
    }

    Promise.allSettled(promises).then(() => {
      this.state.stressTest.active = false;
      this.updateStatusBar(`Stress test completed`);
    });
  }

  async sendStressRequest(index) {
    if (!this.state.stressTest.active) return;

    // Check demo limits before each stress request
    if (!this.checkDemoLimits()) {
      this.state.stressTest.active = false;
      return;
    }

    const startTime = performance.now();

    try {
      const response = await fetch(this.state.stressTest.url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
        mode: "cors",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      this.state.stressTest.success++;
      this.state.stressTest.history.push({
        index,
        status: response.status,
        latency,
        timestamp: Date.now(),
      });

      this.updateStressStats();
      this.updateStressProgress();
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      this.state.stressTest.error++;
      this.state.stressTest.history.push({
        index,
        status: 0,
        latency,
        error: error.message,
        timestamp: Date.now(),
      });

      this.updateStressStats();
      this.updateStressProgress();
    }
  }

  stopStressTest() {
    this.state.stressTest.active = false;
    document.getElementById("stress-stop-btn").disabled = true;
    this.updateStatusBar("Stress test stopped");
  }

  updateStressStats() {
    const statsView = document.getElementById("stress-stats-view");
    const successElement = statsView.querySelector(".stat-value.success");
    const errorElement = statsView.querySelector(".stat-value.error");
    const totalElement = statsView.querySelector(".stat-value.total");

    successElement.textContent = this.state.stressTest.success;
    errorElement.textContent = this.state.stressTest.error;
    totalElement.textContent =
      this.state.stressTest.success + this.state.stressTest.error;

    this.renderRadar();
  }

  renderRadar() {
    const radarView = document.getElementById("stress-radar-view");
    const success = this.state.stressTest.success;
    const error = this.state.stressTest.error;
    const total = success + error;

    if (total === 0) {
      radarView.innerHTML = '<div class="radar-empty">No data</div>';
      return;
    }

    const successAngle = (success / total) * 360;
    const errorAngle = (error / total) * 360;

    radarView.innerHTML = `
      <div class="radar-chart">
        <div class="radar-section success" style="transform: rotate(${successAngle}deg)"></div>
        <div class="radar-section error" style="transform: rotate(${errorAngle}deg)"></div>
      </div>
      <div class="radar-legend">
        <div class="legend-item success">Success: ${success}</div>
        <div class="legend-item error">Error: ${error}</div>
      </div>
    `;
  }

  initLatencyGraph() {
    const canvas = document.getElementById("pulse-canvas");
    const ctx = canvas.getContext("2d");

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    this.drawLatencyGraph();
  }

  drawLatencyGraph() {
    const canvas = document.getElementById("pulse-canvas");
    const ctx = canvas.getContext("2d");

    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = this.state.latencyData.slice(-100); // Last 100 requests

    if (data.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No latency data", canvas.width / 2, canvas.height / 2);
      return;
    }

    const maxLatency = Math.max(...data.map((d) => d.latency));
    const minLatency = Math.min(...data.map((d) => d.latency));
    const range = maxLatency - minLatency || 1;

    const padding = 40;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;

    // Draw grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }

    // Draw latency line
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding + (graphWidth / (data.length - 1)) * index;
      const y =
        padding +
        graphHeight -
        ((point.latency - minLatency) / range) * graphHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = "#06b6d4";
    data.forEach((point, index) => {
      const x = padding + (graphWidth / (data.length - 1)) * index;
      const y =
        padding +
        graphHeight -
        ((point.latency - minLatency) / range) * graphHeight;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Update stats
    this.updateLatencyStats();

    // Continue animation
    if (this.state.currentView === "pulse") {
      this.graphAnimationId = requestAnimationFrame(() =>
        this.drawLatencyGraph(),
      );
    }
  }

  updateLatencyStats() {
    const data = this.state.latencyData;

    if (data.length === 0) {
      document.getElementById("pulse-stats-view").innerHTML = `
        <div class="stat-item">
          <span class="stat-label">Avg Latency:</span>
          <span class="stat-value">0ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Min Latency:</span>
          <span class="stat-value">0ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Max Latency:</span>
          <span class="stat-value">0ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Requests:</span>
          <span class="stat-value">0</span>
        </div>
      `;
      return;
    }

    const latencies = data.map((d) => d.latency);
    const avg = Math.round(
      latencies.reduce((a, b) => a + b, 0) / latencies.length,
    );
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);

    document.getElementById("pulse-stats-view").innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Avg Latency:</span>
        <span class="stat-value">${avg}ms</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Min Latency:</span>
        <span class="stat-value">${min}ms</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Max Latency:</span>
        <span class="stat-value">${max}ms</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Requests:</span>
        <span class="stat-value">${data.length}</span>
      </div>
    `;
  }

  resetLatencyGraph() {
    this.state.latencyData = [];

    if (this.graphAnimationId) {
      cancelAnimationFrame(this.graphAnimationId);
      this.graphAnimationId = null;
    }

    this.drawLatencyGraph();
    this.updateStatusBar("Latency graph reset");
  }

  // ========== PULSE FUNCTIONS ==========

  startPulseAnimation() {
    if (this.pulseAnimationId) {
      cancelAnimationFrame(this.pulseAnimationId);
    }

    const animate = () => {
      this.drawPulseGraph();
      this.pulseAnimationId = requestAnimationFrame(animate);
    };

    animate();
  }

  drawPulseGraph() {
    const canvas = document.getElementById("pulse-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with abyss background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(124, 58, 237, 0.1)";
    ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw stress markers
    this.state.pulse.stressMarkers.forEach((marker) => {
      const x = ((Date.now() - marker.timestamp) / 10000) * width;
      if (x >= 0 && x <= width) {
        ctx.strokeStyle = marker.type === "start" ? "#10b981" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw ghost data if enabled
    if (this.state.pulse.ghostMode && this.state.pulse.ghostData) {
      this.drawGhostData(ctx, width, height);
    }

    // Draw latency line with jitter shadow
    if (this.state.pulse.data.length > 1) {
      const data = this.state.pulse.data;
      const maxLatency = Math.max(...data.map((d) => d.latency), 1000);
      const jitter = this.calculateJitter(data);

      // Draw jitter shadow (glow)
      ctx.shadowColor = "rgba(124, 58, 237, 0.5)";
      ctx.shadowBlur = jitter / 5;
      ctx.strokeStyle = "rgba(124, 58, 237, 0.3)";
      ctx.lineWidth = jitter / 2;

      ctx.beginPath();
      data.forEach((d, i) => {
        const x = (i / data.length) * width;
        const y = height - (d.latency / maxLatency) * height * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Draw main line
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 2;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = (i / data.length) * width;
        const y = height - (d.latency / maxLatency) * height * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw threshold line
      const thresholdY =
        height - (this.state.pulse.threshold / maxLatency) * height * 0.8;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Update stats
    this.updatePulseStats();

    // Check watchdog
    this.checkWatchdog();
  }

  drawGhostData(ctx, width, height) {
    const data = this.state.pulse.ghostData;
    if (!data || data.length === 0) return;

    const maxLatency = Math.max(...data.map((d) => d.latency), 1000);

    ctx.globalAlpha = this.state.pulse.ghostOpacity;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / data.length) * width;
      const y =
        ctx.canvas.height - (d.latency / maxLatency) * ctx.canvas.height * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  calculatePercentiles(data) {
    if (data.length === 0) return { p50: 0, p90: 0, p99: 0 };

    const sorted = [...data].sort((a, b) => a.latency - b.latency);
    const latencies = sorted.map((d) => d.latency);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    return { p50, p90, p99 };
  }

  calculateJitter(data) {
    if (data.length < 2) return 0;

    const latencies = data.map((d) => d.latency);
    let sum = 0;

    for (let i = 1; i < latencies.length; i++) {
      sum += Math.abs(latencies[i] - latencies[i - 1]);
    }

    return sum / (latencies.length - 1);
  }

  updatePulseStats() {
    const data = this.state.pulse.data;
    if (data.length === 0) return;

    const latencies = data.map((d) => d.latency);
    const avg = Math.round(
      latencies.reduce((a, b) => a + b, 0) / latencies.length,
    );
    const { p50, p90, p99 } = this.calculatePercentiles(data);
    const jitter = Math.round(this.calculateJitter(data));

    document.querySelector(".pulse-stats .p50").textContent = `${p50}ms`;
    document.querySelector(".pulse-stats .p90").textContent = `${p90}ms`;
    document.querySelector(".pulse-stats .p99").textContent = `${p99}ms`;
    document.querySelector(".pulse-stats .jitter").textContent = `${jitter}ms`;
    document.querySelector(".pulse-stats .avg").textContent = `${avg}ms`;
    document.querySelector(".pulse-stats .count").textContent = data.length;
  }

  checkWatchdog() {
    if (!this.state.pulse.watchdogEnabled) return;

    const data = this.state.pulse.data;
    if (data.length === 0) return;

    const { p99 } = this.calculatePercentiles(data);
    const threshold = this.state.pulse.threshold;

    const alertOverlay = document.getElementById("pulse-alert-overlay");
    const pulseTab = document.getElementById("nav-pulse-tab");

    if (p99 > threshold) {
      alertOverlay?.classList.remove("hidden");
      pulseTab?.classList.add("alert-active");
    } else {
      alertOverlay?.classList.add("hidden");
      pulseTab?.classList.remove("alert-active");
    }
  }

  resetPulseGraph() {
    this.state.pulse.data = [];
    this.state.pulse.stressMarkers = [];

    // Clear alerts and reset tab styling
    const alertOverlay = document.getElementById("pulse-alert-overlay");
    const pulseTab = document.getElementById("nav-pulse-tab");

    alertOverlay?.classList.add("hidden");
    pulseTab?.classList.remove("alert-active");

    if (this.pulseAnimationId) {
      cancelAnimationFrame(this.pulseAnimationId);
      this.pulseAnimationId = null;
    }

    this.startPulseAnimation();
    this.updateStatusBar("Pulse graph reset - alerts cleared");
  }

  // ========== STRESS FUNCTIONS ==========

  startRadarAnimation() {
    if (this.radarAnimationId) {
      cancelAnimationFrame(this.radarAnimationId);
    }

    const animate = () => {
      this.drawRadarChart();
      this.radarAnimationId = requestAnimationFrame(animate);
    };

    animate();
  }

  drawRadarChart() {
    const canvas = document.getElementById("stress-radar-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    // Clear canvas
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    // Draw radar grid
    ctx.strokeStyle = "rgba(124, 58, 237, 0.2)";
    ctx.lineWidth = 1;

    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI * 2) / 4 - Math.PI / 2;
        const r = (radius / 4) * i;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw axis lines with Spanish labels
    const axes = ["Caudal", "Fatalidad", "P99", "Consistencia"];
    ctx.strokeStyle = "rgba(124, 58, 237, 0.3)";
    axes.forEach((label, i) => {
      const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
      );
      ctx.stroke();
    });

    // Calculate metrics
    const metrics = this.calculateStressMetrics();

    // Draw data polygon with enhanced visualization
    if (
      this.state.stressTest.active ||
      this.state.stressTest.history.length > 0
    ) {
      const values = [
        metrics.throughput / 1000, // Normalize to 0-1 (Caudal)
        metrics.errorRate / 100, // Normalize to 0-1 (Fatalidad)
        metrics.p99 / 1000, // Normalize to 0-1 (P99 Latency)
        metrics.jitter / 100, // Normalize to 0-1 (Consistencia)
      ];

      // Enhanced polygon styling with gradient
      // Ensure radius is positive for gradient creation
      const safeRadius = Math.max(radius, 1);
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        safeRadius,
      );
      gradient.addColorStop(0, "rgba(124, 58, 237, 0.6)");
      gradient.addColorStop(1, "rgba(124, 58, 237, 0.1)");

      ctx.fillStyle = gradient;
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(124, 58, 237, 0.8)";
      ctx.shadowBlur = 15;

      ctx.beginPath();
      values.forEach((value, i) => {
        const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
        const r = radius * Math.min(value, 1);
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw data points
      ctx.fillStyle = "#a78bfa";
      values.forEach((value, i) => {
        const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
        const r = radius * Math.min(value, 1);
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw labels with enhanced styling
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    axes.forEach((label, i) => {
      const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius + 25);
      const y = centerY + Math.sin(angle) * (radius + 25);

      // Add glow effect for labels
      ctx.shadowColor = "rgba(167, 139, 250, 0.5)";
      ctx.shadowBlur = 10;
      ctx.fillText(label, x, y);
      ctx.shadowBlur = 0;
    });
  }

  calculateStressMetrics() {
    const history = this.state.stressTest.history;
    if (history.length === 0) {
      return { throughput: 0, errorRate: 0, p99: 0, jitter: 0 };
    }

    const total = history.length;
    const errors = history.filter(
      (h) => h.status === 0 || h.status >= 400,
    ).length;
    const errorRate = (errors / total) * 100;

    const latencies = history.map((h) => h.latency).sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const jitter = this.calculateJitter(history);

    const duration = this.state.stressTest.startTime
      ? (Date.now() - this.state.stressTest.startTime) / 1000
      : 1;
    const throughput = total / duration;

    return { throughput, errorRate, p99, jitter };
  }

  async startStressTest() {
    // Check demo limits before starting stress test
    if (!this.checkDemoLimits()) {
      return;
    }

    const urlInput = document.getElementById("stress-url-input");
    const countInput = document.getElementById("stress-count-input");
    const rpsInput = document.getElementById("stress-rps-input");
    const thresholdInput = document.getElementById(
      "stress-error-threshold-input",
    );

    const url = urlInput.value.trim();
    let count = parseInt(countInput.value);
    const rps = parseInt(rpsInput.value);
    const profile = "constant"; // Fixed to constant mode only
    const errorThreshold = parseInt(thresholdInput.value);

    if (!url) {
      this.updateStatusBar("Please enter a URL for stress testing");
      return;
    }

    // Enforce demo limit on stress test count
    if (this.demoMode) {
      const remainingRequests = this.maxDemoRequests - this.requestCount;
      count = Math.min(count, remainingRequests);

      if (count <= 0) {
        this.showDemoLimitModal();
        return;
      }
    }

    if (count < 1 || count > 10000) {
      this.updateStatusBar("Request count must be between 1 and 10000");
      return;
    }

    this.state.stressTest = {
      active: true,
      url,
      count,
      rps,
      profile,
      errorThreshold,
      success: 0,
      error: 0,
      history: [],
      startTime: Date.now(),
      abortController: new AbortController(),
      thresholdStopped: false,
    };

    document.getElementById("stress-start-btn").disabled = true;
    document.getElementById("stress-stop-btn").disabled = false;

    // Add stress marker to Pulse
    this.state.pulse.stressMarkers.push({
      timestamp: Date.now(),
      type: "start",
    });

    this.updateStatusBar(`Stress test started: constant mode, ${rps} RPS`);

    // Execute constant rate test only
    await this.executeConstantRateTest(count, rps);

    this.state.stressTest.active = false;
    document.getElementById("stress-start-btn").disabled = false;
    document.getElementById("stress-stop-btn").disabled = true;

    // Add stop marker to Pulse
    this.state.pulse.stressMarkers.push({
      timestamp: Date.now(),
      type: "stop",
    });

    this.updateStatusBar(
      `Stress test complete - ${this.state.stressTest.success} success, ${this.state.stressTest.error} errors`,
    );

    // Trigger appropriate screen flash based on test result
    if (this.state.stressTest.thresholdStopped) {
      // Already handled by triggerRedScreenFlash() in the execution loops
    } else if (this.state.stressTest.error > 0) {
      this.triggerYellowScreenFlash();
    } else {
      this.triggerGreenScreenFlash();
    }

    // Update progress bar status to show completion
    this.updateStressProgress();

    // Save test record
    this.saveStressTestRecord();
  }

  async executeConstantRateTest(count, rps) {
    const interval = 1000 / rps;

    for (let i = 0; i < count; i++) {
      if (!this.state.stressTest.active) break;

      // Check auto-stop BEFORE sending request
      if (this.state.stressTest.error >= this.state.stressTest.errorThreshold) {
        this.state.stressTest.thresholdStopped = true;
        this.state.stressTest.active = false;
        this.triggerRedScreenFlash();
        this.updateStatusBar(
          `Auto-stop: ${this.state.stressTest.error} errors exceeded maximum allowed ${this.state.stressTest.errorThreshold}`,
        );
        this.updateStressProgress();
        break;
      }

      // Send request individually to avoid pending promises
      await this.sendStressRequest(i);

      // Check again after request in case threshold was reached during this request
      if (this.state.stressTest.error >= this.state.stressTest.errorThreshold) {
        this.state.stressTest.thresholdStopped = true;
        this.state.stressTest.active = false;
        this.triggerRedScreenFlash();
        this.updateStatusBar(
          `Auto-stop: ${this.state.stressTest.error} errors exceeded maximum allowed ${this.state.stressTest.errorThreshold}`,
        );
        this.updateStressProgress();
        break;
      }

      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
  }

  stopStressTest() {
    this.state.stressTest.active = false;
    this.state.stressTest.abortController?.abort();
    document.getElementById("stress-start-btn").disabled = false;
    document.getElementById("stress-stop-btn").disabled = true;

    this.state.pulse.stressMarkers.push({
      timestamp: Date.now(),
      type: "stop",
    });

    this.updateStatusBar("Stress test stopped (Kill-Switch activated)");
  }

  updateStressStats() {
    const metrics = this.calculateStressMetrics();

    // Update stat values
    document.querySelector(".stat-value.throughput").textContent =
      `${metrics.throughput.toFixed(1)} RPS`;
    document.querySelector(".stat-value.error-rate").textContent =
      `${metrics.errorRate.toFixed(1)}%`;
    document.querySelector(".stat-value.p99").textContent = `${metrics.p99}ms`;
    document.querySelector(".stat-value.jitter").textContent =
      `${metrics.jitter.toFixed(2)}ms`;
    document.querySelector(".stat-value.success").textContent =
      this.state.stressTest.success;
    document.querySelector(".stat-value.error").textContent =
      this.state.stressTest.error;

    // Update stress progress bar
    this.updateStressProgress();
  }

  updateStressProgress() {
    const progressBar = document.getElementById("stress-progress-fill");
    const percentageText = document.getElementById(
      "stress-progress-percentage",
    );
    const statusText = document.getElementById("stress-progress-status");

    if (!progressBar || !percentageText || !statusText) return;

    const total = this.state.stressTest.success + this.state.stressTest.error;
    const targetCount = this.state.stressTest.count;
    const progress = targetCount > 0 ? (total / targetCount) * 100 : 0;

    // Reset classes
    progressBar.className = "progress-fill";

    // Update progress with smooth transition
    progressBar.style.width = `${progress}%`;
    percentageText.textContent = `${Math.round(progress)}%`;

    // Update status and color based on test state
    if (!this.state.stressTest.active && total === 0) {
      statusText.textContent = "Listo para iniciar";
      progressBar.style.width = "0%";
      percentageText.textContent = "0%";
    } else if (this.state.stressTest.active) {
      statusText.textContent = `Ejecutando... (${total}/${targetCount})`;
      progressBar.classList.add("running");
    } else if (this.state.stressTest.thresholdStopped) {
      statusText.textContent = `Detenido: Máximo error alcanzado (${this.state.stressTest.error}/${this.state.stressTest.errorThreshold})`;
      progressBar.classList.add("error");
    } else {
      const errorRate =
        targetCount > 0 ? (this.state.stressTest.error / targetCount) * 100 : 0;
      if (errorRate > 10) {
        statusText.textContent = `Completado con errores (${this.state.stressTest.error} fallos)`;
        progressBar.classList.add("warning");
      } else {
        statusText.textContent = `Completado exitosamente (${this.state.stressTest.success}/${targetCount})`;
        progressBar.classList.add("success");
      }
    }
  }

  exportStressResults() {
    const results = {
      timestamp: new Date().toISOString(),
      config: {
        url: this.state.stressTest.url,
        count: this.state.stressTest.count,
        rps: this.state.stressTest.rps,
        profile: this.state.stressTest.profile,
      },
      metrics: this.calculateStressMetrics(),
      history: this.state.stressTest.history,
    };

    this.downloadFile("stress-results.json", JSON.stringify(results, null, 2));
    this.updateStatusBar("Stress results exported");
  }

  triggerRedScreenFlash() {
    const flash = document.createElement("div");
    flash.className = "screen-flash";
    document.body.appendChild(flash);

    setTimeout(() => {
      document.body.removeChild(flash);
    }, 1000);
  }

  triggerYellowScreenFlash() {
    const flash = document.createElement("div");
    flash.className = "screen-flash warning";
    document.body.appendChild(flash);

    setTimeout(() => {
      document.body.removeChild(flash);
    }, 1000);
  }

  triggerGreenScreenFlash() {
    const flash = document.createElement("div");
    flash.className = "screen-flash success";
    document.body.appendChild(flash);

    setTimeout(() => {
      document.body.removeChild(flash);
    }, 1000);
  }

  async saveStressTestRecord() {
    const record = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      config: {
        url: this.state.stressTest.url,
        count: this.state.stressTest.count,
        rps: this.state.stressTest.rps,
        profile: this.state.stressTest.profile,
        errorThreshold: this.state.stressTest.errorThreshold,
      },
      metrics: this.calculateStressMetrics(),
      success: this.state.stressTest.success,
      error: this.state.stressTest.error,
      thresholdStopped: this.state.stressTest.thresholdStopped,
      history: this.state.stressTest.history,
    };

    // Add record to the beginning of array
    this.state.stressTestRecords.unshift(record);

    // Keep only last 5 records for display
    if (this.state.stressTestRecords.length > 5) {
      this.state.stressTestRecords = this.state.stressTestRecords.slice(0, 5);
    }

    // Save to persistent storage
    await this.saveStressTestRecordsToStorage();
    this.renderStressRecords();
  }

  async saveStressTestRecordsToStorage() {
    try {
      localStorage.setItem(
        "stressTestRecords",
        JSON.stringify(this.state.stressTestRecords),
      );
    } catch (error) {
      console.error("Failed to save stress test records:", error);
    }
  }

  loadStressTestRecords() {
    try {
      const stored = localStorage.getItem("stressTestRecords");
      if (stored) {
        this.state.stressTestRecords = JSON.parse(stored);
        this.renderStressRecords();
      }
    } catch (error) {
      console.error("Failed to load stress test records:", error);
      this.state.stressTestRecords = [];
    }
  }

  renderStressRecords() {
    const recordsList = document.getElementById("records-list");
    const recordsCount = document.getElementById("records-count");

    if (!recordsList || !recordsCount) return;

    recordsCount.textContent = this.state.stressTestRecords.length;

    if (this.state.stressTestRecords.length === 0) {
      recordsList.innerHTML =
        '<div style="color: var(--color-text-muted); font-size: var(--text-xs); text-align: center; padding: var(--space-md);">No hay registros de tests</div>';
      return;
    }

    recordsList.innerHTML = this.state.stressTestRecords
      .map((record) => {
        const date = new Date(record.timestamp);
        const timeStr = date.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dateStr = date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
        });

        return `
        <div class="record-item" data-record-id="${record.id}">
          <div class="record-info">
            <span class="record-timestamp">${dateStr} ${timeStr}</span>
            <span class="record-profile">${record.config.profile}</span>
            <div class="record-metrics">
              <span class="record-metric success">${record.success}</span>
              <span class="record-metric error">${record.error}</span>
            </div>
          </div>
          <button class="record-download" onclick="quantumFlow.downloadStressTestRecord(${record.id})">📄 MD</button>
        </div>
      `;
      })
      .join("");
  }

  downloadStressTestRecord(recordId) {
    const record = this.state.stressTestRecords.find((r) => r.id === recordId);
    if (!record) return;

    const markdown = this.generateStressTestMarkdown(record);
    const filename = `stress-test-${new Date(record.timestamp).toISOString().slice(0, 19).replace(/[:.]/g, "-")}.md`;
    this.downloadFile(filename, markdown);
  }

  generateStressTestMarkdown(record) {
    const date = new Date(record.timestamp);
    const metrics = record.metrics;

    return `# Stress Test Report

## Configuration
- **URL**: ${record.config.url}
- **Profile**: ${record.config.profile}
- **Total Requests**: ${record.config.count}
- **Requests/Second**: ${record.config.rps}
- **Maximum Allowed Errors**: ${record.config.errorThreshold}
- **Test Date**: ${date.toLocaleString("es-ES")}

## Results
- **Successful Requests**: ${record.success}
- **Failed Requests**: ${record.error}
- **Error Rate**: ${metrics.errorRate.toFixed(2)}%
- **Throughput**: ${metrics.throughput.toFixed(2)} RPS
- **P99 Latency**: ${metrics.p99}ms
- **Jitter**: ${metrics.jitter}ms
- **Status**: ${record.thresholdStopped ? "Stopped by error limit" : "Completed"}

## Performance Analysis
${record.thresholdStopped ? "⚠️ **Test was automatically stopped due to exceeding maximum allowed errors**" : "✅ **Test completed successfully**"}

### Error Analysis
- **Actual Errors**: ${record.error}
- **Maximum Allowed**: ${record.config.errorThreshold}
- **Status**: ${record.error <= record.config.errorThreshold ? "✅ Within acceptable limits" : "❌ Exceeded maximum allowed errors"}

### Latency Analysis
- **P99 Latency**: ${metrics.p99}ms
- **Jitter**: ${metrics.jitter}ms

## Request History
${record.history
  .map(
    (req, index) => `
${index + 1}. Status: ${req.status}, Latency: ${req.latency}ms, Timestamp: ${new Date(req.timestamp).toLocaleTimeString("es-ES")}
`,
  )
  .join("")}

---
*Report generated by Quantum-Flow Stress Testing Tool*
`;
  }

  flashArchiveTab() {
    const archiveTab = document.getElementById("nav-archive-tab");
    if (!archiveTab) return;

    // Add flash class
    archiveTab.classList.add("tab-flash");

    // Remove flash class after animation completes
    setTimeout(() => {
      archiveTab.classList.remove("tab-flash");
    }, 1000);
  }

  setState(newState) {
    this.state.status = newState;
    this.updateStatusBar(newState);
  }

  updateStatusBar(message) {
    const statusText = document.querySelector(".status-text");
    const statusIndicator = document.querySelector(".status-indicator");

    statusText.textContent = message;

    // Update indicator color based on status
    statusIndicator.style.background = this.getStatusColor(this.state.status);
    statusIndicator.style.boxShadow = `0 0 10px ${this.getStatusColor(this.state.status)}`;
  }

  getStatusColor(status) {
    switch (status) {
      case "IDLE":
        return "#10b981";
      case "PROCESSING":
        return "#f59e0b";
      case "SUCCESS":
        return "#10b981";
      case "ERROR":
        return "#ef4444";
      case "EMPTY":
        return "#64748b";
      default:
        return "#06b6d4";
    }
  }

  // Security Methods
  generateSecureSessionId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  initializeSecurity() {
    // Set up CSP headers
    this.setupContentSecurityPolicy();

    // Initialize rate limiting
    this.initializeRateLimiting();

    // Add input sanitization
    this.setupInputSanitization();
  }

  setupContentSecurityPolicy() {
    // Add meta tag for CSP - allow external APIs and inline handlers for demo functionality
    const cspMeta = document.createElement("meta");
    cspMeta.httpEquiv = "Content-Security-Policy";
    cspMeta.content =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://httpbin.org https://api.example.com https://*.httpbin.org; font-src 'self'; object-src 'none';";
    document.head.appendChild(cspMeta);
  }

  initializeRateLimiting() {
    this.rateLimitData = {
      requests: [],
      windowMs: 60000, // 1 minute window
      maxRequests: 100,
    };
  }

  setupInputSanitization() {
    // Override console.log in production
    if (this.demoMode) {
      const originalLog = console.log;
      console.log = (...args) => {
        if (
          args[0] &&
          typeof args[0] === "string" &&
          args[0].includes("password")
        ) {
          return;
        }
        originalLog.apply(console, args);
      };
    }
  }

  checkRateLimit() {
    const now = Date.now();
    this.rateLimitData.requests = this.rateLimitData.requests.filter(
      (timestamp) => now - timestamp < this.rateLimitData.windowMs,
    );

    if (this.rateLimitData.requests.length >= this.rateLimitData.maxRequests) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    this.rateLimitData.requests.push(now);
  }

  sanitizeInput(input) {
    if (typeof input !== "string") return input;

    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  }

  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      // Only allow https and http protocols
      if (!["https:", "http:"].includes(urlObj.protocol)) {
        throw new Error("Invalid protocol");
      }
      // Block localhost and private IPs in demo mode
      if (this.demoMode) {
        const hostname = urlObj.hostname;
        if (
          hostname === "localhost" ||
          hostname.startsWith("127.") ||
          hostname.startsWith("192.168.") ||
          hostname.startsWith("10.")
        ) {
          throw new Error("Localhost access blocked in demo mode");
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  checkDemoLimits() {
    if (!this.demoMode) return true;

    // Check session time limit
    const sessionTime = Date.now() - this.demoStartTime;
    if (sessionTime > this.maxDemoSessionTime) {
      this.showTimeLimitModal();
      return false;
    }

    // Check request count limit
    this.requestCount++;
    if (this.requestCount > this.maxDemoRequests) {
      this.showDemoLimitModal();
      return false;
    }

    // Update demo progress indicator
    this.updateDemoProgress();

    return true;
  }

  updateDemoProgress() {
    const progress = (this.requestCount / this.maxDemoRequests) * 100;
    const sessionTime = Date.now() - this.demoStartTime;
    const timeRemaining = Math.max(0, this.maxDemoSessionTime - sessionTime);
    const minutesRemaining = Math.floor(timeRemaining / 60000);
    const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

    // Update security badge with progress
    if (this.securityBadge) {
      this.securityBadge.innerHTML = `
        🔒 Demo: ${this.requestCount}/${this.maxDemoRequests} | ${minutesRemaining}:${secondsRemaining.toString().padStart(2, "0")}
      `;

      // Add warning color when near limit
      if (progress > 70) {
        this.securityBadge.style.background = "var(--color-neon-yellow)";
        this.securityBadge.style.borderColor = "var(--color-neon-yellow)";
        this.securityBadge.style.color = "var(--color-bg-primary)";
      }

      if (progress > 90) {
        this.securityBadge.style.background = "var(--color-neon-red)";
        this.securityBadge.style.borderColor = "var(--color-neon-red)";
        this.securityBadge.style.animation = "pulse 1s infinite";
      }
    }
  }

  showDemoLimitModal() {
    this.demoLimitReached = true;

    const overlay = document.createElement("div");
    overlay.className = "demo-overlay active";
    overlay.innerHTML = `
      <div class="demo-modal demo-limit-modal">
        <div class="demo-limit-header">
          <div class="limit-icon">🚀</div>
          <h3>Ready for More?</h3>
          <div class="limit-stats">
            <div class="stat">
              <span class="stat-number">${this.requestCount}/${this.maxDemoRequests}</span>
              <span class="stat-label">Demo Requests Used</span>
            </div>
          </div>
        </div>

        <div class="demo-limit-content">
          <div class="limit-message">
            <p><strong>You've experienced 0.01% of Quantum-Flow</strong></p>
            <p>Unlock the complete webhook testing platform with unlimited requests, advanced analytics, and enterprise features.</p>
          </div>

          <div class="demo-features-preview">
            <div class="feature-item">
              <span class="feature-icon">⚡</span>
              <span class="feature-text">Unlimited Requests</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <span class="feature-text">Advanced Analytics</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔒</span>
              <span class="feature-text">Enterprise Security</span>
            </div>
          </div>
        </div>

        <div class="demo-limit-actions">
          <button class="waitlist-btn-primary" onclick="window.quantumFlow.switchView('waitlist'); this.closest('.demo-overlay').remove();">
            Join Waitlist
          </button>
          <p style="font-size: var(--text-xs); opacity: 0.7; margin-top: var(--space-sm);">
            Get unlimited access with the full version
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Disable all demo functionality
    this.disableDemoFeatures();

    // Add visual effects
    this.addDemoLimitEffects();
  }

  showTimeLimitModal() {
    this.demoLimitReached = true;

    const overlay = document.createElement("div");
    overlay.className = "demo-overlay active";
    overlay.innerHTML = `
      <div class="demo-modal time-limit-modal">
        <div class="demo-limit-header">
          <div class="limit-icon">⌛</div>
          <h3>Session Time Expired</h3>
          <div class="limit-stats">
            <div class="stat">
              <span class="stat-number">5:00</span>
              <span class="stat-label">Session Duration</span>
            </div>
          </div>
        </div>

        <div class="demo-limit-content">
          <div class="limit-message">
            <p>⏰ <strong>Your demo session has ended</strong></p>
            <p>Thank you for trying Quantum-Flow! To continue exploring with extended sessions and unlimited features, join our waitlist.</p>
          </div>
        </div>

        <div class="demo-limit-actions">
          <button class="waitlist-btn-primary" onclick="window.quantumFlow.switchView('waitlist'); this.closest('.demo-overlay').remove();">
            🚀 Join Waitlist for Extended Access
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.disableDemoFeatures();
    this.addDemoLimitEffects();
  }

  disableDemoFeatures() {
    // More targeted approach - only disable specific areas
    const areasToDisable = [
      "#gateway-view input:not([data-allow-demo])",
      "#gateway-view button:not([data-allow-demo])",
      "#stress-view input:not([data-allow-demo])",
      "#stress-view button:not([data-allow-demo])",
      "#archive-view button:not([data-allow-demo])",
      "#pulse-view button:not([data-allow-demo])",
      'button:not(.waitlist-submit-btn):not(.legal-tab):not(.nav-tab[data-view="waitlist"]):not(.nav-tab[data-view="legal"]):not(.waitlist-btn-primary)',
    ];

    areasToDisable.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // Skip waitlist elements
        if (el.closest("#waitlist-view") || el.closest("#legal-view")) {
          return;
        }
        el.disabled = true;
        el.style.opacity = "0.3";
        el.style.cursor = "not-allowed";
        el.style.filter = "grayscale(1)";
      });
    });

    // Add overlay to main content areas
    const mainViews = document.querySelectorAll(
      ".view:not(#waitlist-view):not(#legal-view)",
    );
    mainViews.forEach((view) => {
      view.style.position = "relative";
      view.style.pointerEvents = "none";
      view.style.filter = "grayscale(0.8) brightness(0.7)";

      const overlay = document.createElement("div");
      overlay.className = "demo-view-overlay";
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: var(--border-radius-lg);
      `;
      overlay.innerHTML = `
        <div style="text-align: center; color: white; padding: var(--space-xl);">
          <div style="font-size: 4rem; margin-bottom: 1rem; animation: pulse 2s infinite;">🔒</div>
          <h3 style="margin-bottom: 0.5rem; font-size: var(--text-xl);">Demo Limit Reached</h3>
          <p style="margin-bottom: 1rem; opacity: 0.9;">Get unlimited access with the full version</p>
          <button onclick="window.quantumFlow.switchView('waitlist'); this.closest('.demo-view-overlay').parentElement.style.filter=''; this.closest('.demo-view-overlay').remove();"
                  style="background: var(--color-purple-primary); border: none; color: white; padding: var(--space-sm) var(--space-lg); border-radius: var(--border-radius); cursor: pointer; font-weight: bold;">
            Join Waitlist
          </button>
        </div>
      `;
      view.appendChild(overlay);
    });

    // Enhanced tab blocking with visual disabled state
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      if (tab.dataset.view !== "waitlist" && tab.dataset.view !== "legal") {
        tab.classList.add("tab-disabled");
        tab.style.opacity = "0.2";
        tab.style.cursor = "not-allowed";
        tab.style.filter = "grayscale(1) brightness(0.5)";
        tab.style.position = "relative";

        // Add disabled indicator
        const disabledIndicator = document.createElement("div");
        disabledIndicator.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 1.2rem;
          opacity: 0;
          transition: opacity 0.3s ease;
        `;
        disabledIndicator.textContent = "🔒";
        tab.appendChild(disabledIndicator);

        tab.onmouseenter = () => {
          disabledIndicator.style.opacity = "0.7";
        };

        tab.onmouseleave = () => {
          disabledIndicator.style.opacity = "0";
        };

        tab.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showDemoLimitModal();
        };
      } else {
        // Highlight allowed tabs
        tab.style.boxShadow = "0 0 15px rgba(124, 58, 237, 0.5)";
        tab.style.border = "1px solid var(--color-purple-secondary)";
      }
    });
  }

  addDemoLimitEffects() {
    // Add confetti effect
    this.createConfettiEffect();

    // Add celebration animation to badge
    if (this.securityBadge) {
      this.securityBadge.style.animation = "celebration 2s ease-in-out";
      this.securityBadge.innerHTML = "🎉 Demo Complete!";
      this.securityBadge.style.background = "var(--color-neon-green)";
      this.securityBadge.style.borderColor = "var(--color-neon-green)";
    }
  }

  createConfettiEffect() {
    const colors = ["#7c3aed", "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b"];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        const confetti = document.createElement("div");
        confetti.style.cssText = `
          position: fixed;
          width: 10px;
          height: 10px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}%;
          top: -10px;
          opacity: 0.8;
          transform: rotate(${Math.random() * 360}deg);
          animation: confetti-fall ${2 + Math.random() * 2}s linear forwards;
          z-index: 9999;
          pointer-events: none;
        `;
        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 4000);
      }, i * 50);
    }
  }

  startDemoProgressTracking() {
    // Update progress every second
    this.progressTimer = setInterval(() => {
      if (!this.demoLimitReached) {
        this.updateDemoProgress();

        // Check if session time has expired
        const sessionTime = Date.now() - this.demoStartTime;
        if (sessionTime >= this.maxDemoSessionTime) {
          this.showTimeLimitModal();
          clearInterval(this.progressTimer);
        }
      } else {
        clearInterval(this.progressTimer);
      }
    }, 1000);
  }

  showTimeLimitModal() {
    this.demoLimitReached = true;

    const overlay = document.createElement("div");
    overlay.className = "demo-overlay active";
    overlay.innerHTML = `
      <div class="demo-modal time-limit-modal">
        <div class="demo-limit-header">
          <div class="limit-icon">⌛</div>
          <h3>Session Expired</h3>
          <div class="limit-stats">
            <div class="stat">
              <span class="stat-number">5:00</span>
              <span class="stat-label">Time Limit</span>
            </div>
          </div>
        </div>

        <div class="demo-limit-content">
          <div class="limit-message">
            <p><strong>Session time limit reached</strong></p>
            <p>Join waitlist for unlimited access.</p>
          </div>
        </div>

        <div class="demo-limit-actions">
          <button class="waitlist-btn-primary" onclick="window.quantumFlow.switchView('waitlist'); this.closest('.demo-overlay').remove();">
            Join Waitlist
          </button>
          <p style="font-size: var(--text-xs); opacity: 0.7; margin-top: var(--space-sm);">
            Get unlimited access with the full version
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.disableDemoFeatures();
    this.addDemoLimitEffects();
  }

  // Waitlist Methods
  initializeWaitlist() {
    const form = document.getElementById("waitlist-form");
    if (form) {
      form.addEventListener("submit", (e) => this.handleWaitlistSubmit(e));
    }

    // Handle legal links
    document.querySelectorAll('[data-action="show-terms"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchView("legal");
        this.showLegalSection("terms");
      });
    });

    document
      .querySelectorAll('[data-action="show-privacy"]')
      .forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.switchView("legal");
          this.showLegalSection("privacy");
        });
      });
  }

  async handleWaitlistSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector(".waitlist-submit-btn");
    const successDiv = document.getElementById("waitlist-success");

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").classList.add("hidden");
    submitBtn.querySelector(".btn-loading").classList.remove("hidden");

    try {
      // Validate form data
      const name = this.sanitizeInput(formData.get("name"));
      const email = this.sanitizeInput(formData.get("email"));
      const company = this.sanitizeInput(formData.get("company")) || "";
      const usecase = formData.get("usecase");

      if (!name || !email || !usecase) {
        throw new Error("Please fill in all required fields");
      }

      if (!this.validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Store waitlist entry
      const entry = {
        id: Date.now(),
        name,
        email,
        company,
        usecase,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
      };

      await this.storeWaitlistEntry(entry);

      // Show success message
      form.classList.add("hidden");
      successDiv.classList.remove("hidden");

      // Update stats
      this.updateWaitlistStats();

      this.updateStatusBar("Successfully joined waitlist!");
    } catch (error) {
      this.updateStatusBar(error.message);
      submitBtn.disabled = false;
      submitBtn.querySelector(".btn-text").classList.remove("hidden");
      submitBtn.querySelector(".btn-loading").classList.add("hidden");
    }
  }

  validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  async storeWaitlistEntry(entry) {
    if (!this.db) {
      // Fallback to localStorage
      const waitlist = JSON.parse(
        localStorage.getItem("quantumFlow_waitlist") || "[]",
      );
      waitlist.push(entry);
      localStorage.setItem("quantumFlow_waitlist", JSON.stringify(waitlist));
      return;
    }

    try {
      // Create waitlist store if it doesn't exist
      if (!this.db.objectStoreNames.contains("waitlist")) {
        const version = this.db.version + 1;
        this.db.close();

        const openDB = indexedDB.open("QuantumFlowDB", version);
        await new Promise((resolve, reject) => {
          openDB.onsuccess = () => resolve(openDB.result);
          openDB.onerror = () => reject(openDB.error);
          openDB.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("waitlist")) {
              const store = db.createObjectStore("waitlist", { keyPath: "id" });
              store.createIndex("email", "email", { unique: false });
              store.createIndex("timestamp", "timestamp", { unique: false });
            }
          };
        });
        this.db = openDB.result;
      }

      const tx = this.db.transaction(["waitlist"], "readwrite");
      const store = tx.objectStore("waitlist");
      await store.add(entry);
    } catch (error) {
      console.warn("Failed to store waitlist entry:", error);
      throw error;
    }
  }

  async updateWaitlistStats() {
    try {
      let total = 0;

      if (this.db) {
        const tx = this.db.transaction(["waitlist"], "readonly");
        const store = tx.objectStore("waitlist");
        const count = await store.count();
        total = count;
      } else {
        const waitlist = JSON.parse(
          localStorage.getItem("quantumFlow_waitlist") || "[]",
        );
        total = waitlist.length;
      }

      // Update UI
      const positionEl = document.getElementById("waitlist-position");
      const totalEl = document.getElementById("waitlist-total");

      if (positionEl) positionEl.textContent = `#${total}`;
      if (totalEl) totalEl.textContent = total.toString();
    } catch (error) {
      console.warn("Failed to update waitlist stats:", error);
    }
  }

  // Legal Methods
  initializeLegal() {
    // Handle legal tab switching
    document.querySelectorAll(".legal-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        this.showLegalSection(targetTab);
      });
    });
  }

  showLegalSection(sectionName) {
    // Update tabs
    document.querySelectorAll(".legal-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === sectionName);
    });

    // Update sections
    document.querySelectorAll(".legal-section").forEach((section) => {
      section.classList.toggle("active", section.id === `legal-${sectionName}`);
    });
  }

  // Enhanced sendRequest with security
  async sendRequest() {
    console.log("🔍 DEBUG: sendRequest called");

    // Check Gateway usage limit
    if (!this.checkGatewayLimit()) {
      console.log("🔍 DEBUG: Gateway limit blocked request");
      return;
    }

    // Check rate limiting
    this.checkRateLimit();

    const urlInput = document.getElementById("gate-request-input");
    console.log("🔍 DEBUG: URL input found", !!urlInput);
    const methodSelect = document.getElementById("gate-method-select");
    const headersTextarea = document.querySelector(".headers-input textarea");
    const bodyTextarea = document.querySelector(".body-input textarea");

    let url = urlInput.value.trim();
    if (!url) {
      this.updateStatusBar("Please enter a URL");
      return;
    }

    // Validate URL
    if (!this.validateUrl(url)) {
      this.updateStatusBar("Invalid URL or access blocked in demo mode");
      return;
    }

    url = this.replaceEnvVars(url);
    const method = methodSelect.value;
    let headers = {};
    let body = null;

    try {
      if (headersTextarea.value.trim()) {
        const headersStr = this.replaceEnvVars(headersTextarea.value);
        headers = JSON.parse(headersStr);
      }
      if (
        bodyTextarea.value.trim() &&
        ["POST", "PUT", "PATCH"].includes(method)
      ) {
        const bodyStr = this.replaceEnvVars(bodyTextarea.value);
        body = JSON.parse(bodyStr);
      }
    } catch (error) {
      this.updateStatusBar("Invalid JSON in headers or body");
      return;
    }

    this.setState("PROCESSING");
    this.updateStatusBar("Sending request...");

    const startTime = performance.now();
    const perfStart = performance.getEntriesByType("navigation").length;

    try {
      const response = await this.fetchWithTimeout(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Mode": "true",
          "X-Session-ID": this.sessionId,
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const responseData = await response.text();

      const perfMetrics = this.extractPerformanceMetrics(
        url,
        startTime,
        endTime,
      );

      const request = {
        id: Date.now(),
        url,
        method,
        headers,
        body,
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        latency,
        timestamp: new Date().toISOString(),
        perfMetrics,
        demoMode: this.demoMode,
      };

      this.state.latencyData.push({
        timestamp: Date.now(),
        latency,
      });

      // Add to Pulse data (circular buffer)
      this.state.pulse.data.push({
        timestamp: Date.now(),
        latency,
        status: response.status,
      });
      if (this.state.pulse.data.length > this.state.pulse.bufferSize) {
        this.state.pulse.data.shift();
      }

      this.renderGatewayRequestFIFO(request);
      this.displayPayload(request);
      this.archiveRequest(request);

      document.getElementById("gate-latency-badge").textContent =
        `${latency}ms`;

      this.setState("SUCCESS");
      this.updateStatusBar(`Request completed - ${latency}ms`);

      setTimeout(() => this.setState("IDLE"), 1000);
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const request = {
        id: Date.now(),
        url,
        method,
        headers,
        body,
        status: 0,
        statusText: error.name,
        response: error.message,
        latency,
        timestamp: new Date().toISOString(),
        error: true,
        demoMode: this.demoMode,
      };

      this.renderGatewayRequestFIFO(request);
      this.displayPayload(request);
      this.archiveRequest(request);

      this.setState("ERROR");
      this.updateStatusBar(`Request failed - ${error.message}`);

      setTimeout(() => this.setState("IDLE"), 3000);
    }
  }

  // Beta restriction methods
  checkGatewayLimit() {
    // Update header display
    this.updateGatewayUsageHeader();

    if (this.gatewayUsageCount >= this.maxGatewayUses) {
      this.gatewayLimitReached = true;
      this.disableGatewayButton();
      return false;
    }

    // Increment usage
    this.gatewayUsageCount++;

    return true;
  }

  async calculateTotalUsage() {
    try {
      // Count current requests
      let requestCount = 0;

      if (this.db) {
        const tx = this.db.transaction(["requests"], "readonly");
        const store = tx.objectStore("requests");
        requestCount = await store.count();
      } else {
        const requests = JSON.parse(
          localStorage.getItem("quantumFlow_requests") || "[]",
        );
        requestCount = requests.length;
      }

      // Total usage = requests sent + archived requests
      this.totalUsage = requestCount;

      // Save to persistent storage
      await this.saveBetaUsageData();
    } catch (error) {
      console.warn("Failed to calculate total usage:", error);
      this.totalUsage = 0;
    }
  }

  disableGatewayButton() {
    const sendBtn = document.getElementById("gate-send-btn");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = "0.3";
      sendBtn.style.cursor = "not-allowed";
      sendBtn.style.filter = "grayscale(1)";
      sendBtn.onclick = () => this.switchView("waitlist");
    }
  }

  updateGatewayUsageHeader() {
    const header = document.getElementById("gateway-usage-header");
    if (header) {
      const remaining = this.maxGatewayUses - this.gatewayUsageCount;
      header.textContent = `${remaining}/${this.maxGatewayUses}`;

      if (this.gatewayUsageCount >= this.maxGatewayUses) {
        header.classList.add("limit-reached");
      } else {
        header.classList.remove("limit-reached");
      }
    }
  }

  checkStressTestLimit() {
    if (this.stressTestUsed) {
      this.stressLimitReached = true;
      this.disableStressButton();
      return false;
    }

    // Mark as used
    this.stressTestUsed = true;
    return true;
  }

  disableStressButton() {
    const startBtn = document.getElementById("stress-start-btn");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.style.opacity = "0.3";
      startBtn.style.cursor = "not-allowed";
      startBtn.style.filter = "grayscale(1)";
      startBtn.onclick = () => this.switchView("waitlist");
    }
  }

  updateStressUsageDisplay() {
    const display = document.getElementById("stress-usage-display");
    if (display) {
      display.textContent = `${this.stressTestCount}/${this.maxStressTests}`;

      if (this.stressTestCount <= 0) {
        display.classList.add("limit-reached");
      } else {
        display.classList.remove("limit-reached");
      }
    }
  }

  validateStressUrl(url) {
    // Whitelist for beta mode
    const allowedPatterns = [
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
      /^https?:\/\/0\.0\.0\.0/,
      /^https:\/\/httpbin\.org/,
      /^https:\/\/api\.example\.com/,
      /^https:\/\/jsonplaceholder\.typicode\.com/,
      /^https:\/\/reqres\.in/,
      /^https:\/\/dummyjson\.com/,
    ];

    return allowedPatterns.some((pattern) => pattern.test(url));
  }

  showStressLimitModal() {
    const overlay = document.createElement("div");
    overlay.className = "demo-overlay active";
    overlay.innerHTML = `
      <div class="demo-modal stress-limit-modal">
        <div class="demo-limit-header">
          <div class="limit-icon">⚡</div>
          <h3>Stress Test Limit Reached</h3>
          <div class="limit-stats">
            <div class="stat">
              <span class="stat-number">${this.maxStressTests}/${this.maxStressTests}</span>
              <span class="stat-label">Tests Used</span>
            </div>
          </div>
        </div>

        <div class="demo-limit-content">
          <div class="limit-message">
            <p><strong>You've used your beta stress test credits</strong></p>
            <p>Get unlimited stress testing with advanced analytics in the full version.</p>
          </div>
        </div>

        <div class="demo-limit-actions">
          <button class="waitlist-btn-primary" onclick="window.open('https://tally.so/r/RG80Ql', '_blank')">
            Get Full Access
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // Beta usage persistence methods
  async loadBetaUsageData() {
    try {
      if (this.db) {
        // Try to load from IndexedDB
        const tx = this.db.transaction(["betaUsage"], "readonly");
        const store = tx.objectStore("betaUsage");
        const usageData = await this.getUsageFromStore(store);

        if (usageData) {
          this.gatewayUsageCount = usageData.gatewayUsage || 0;
          this.stressTestCount =
            usageData.stressTests !== undefined
              ? usageData.stressTests
              : this.maxStressTests;
        } else {
          // Create initial usage record
          this.stressTestCount = this.maxStressTests;
          await this.saveBetaUsageData();
        }
      } else {
        // Fallback to localStorage
        this.gatewayUsageCount = parseInt(
          localStorage.getItem("quantumFlow_gatewayUsage") || "0",
        );
        const storedStressCount = localStorage.getItem(
          "quantumFlow_stressTests",
        );
        this.stressTestCount =
          storedStressCount !== null
            ? parseInt(storedStressCount)
            : this.maxStressTests;
      }
    } catch (error) {
      console.warn(
        "Failed to load beta usage data, using localStorage fallback:",
        error,
      );
      this.gatewayUsageCount = parseInt(
        localStorage.getItem("quantumFlow_gatewayUsage") || "0",
      );
      this.stressTestCount = this.maxStressTests;
    }
  }

  async saveBetaUsageData() {
    const usageData = {
      id: "beta_usage",
      gatewayUsage: this.gatewayUsageCount,
      stressTests: this.stressTestCount,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (this.db) {
        // Save to IndexedDB
        const tx = this.db.transaction(["betaUsage"], "readwrite");
        const store = tx.objectStore("betaUsage");
        await store.put(usageData);
      } else {
        // Fallback to localStorage
        localStorage.setItem(
          "quantumFlow_gatewayUsage",
          this.gatewayUsageCount.toString(),
        );
        localStorage.setItem(
          "quantumFlow_stressTests",
          this.stressTestCount.toString(),
        );
      }
    } catch (error) {
      console.warn(
        "Failed to save beta usage data, using localStorage fallback:",
        error,
      );
      localStorage.setItem(
        "quantumFlow_gatewayUsage",
        this.gatewayUsageCount.toString(),
      );
      localStorage.setItem(
        "quantumFlow_stressTests",
        this.stressTestCount.toString(),
      );
    }
  }

  async getUsageFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.get("beta_usage");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async resetAllUsageData() {
    try {
      // Clear localStorage
      localStorage.removeItem("quantumFlow_gatewayUsage");
      localStorage.removeItem("quantumFlow_stressTests");
      localStorage.removeItem("quantumFlow_requests");

      // Clear IndexedDB if available
      if (this.db) {
        // Clear requests
        const requestsTx = this.db.transaction(["requests"], "readwrite");
        const requestsStore = requestsTx.objectStore("requests");
        await this.clearStore(requestsStore);

        // Clear beta usage
        const betaTx = this.db.transaction(["betaUsage"], "readwrite");
        const betaStore = betaTx.objectStore("betaUsage");
        await this.clearStore(betaStore);

        // Initialize with zero values
        await this.saveBetaUsageData();
      }

      // Reset internal counters
      this.gatewayUsageCount = 0;
      this.stressTestCount = this.maxStressTests; // Start with 1 available test
      this.state.requests = [];
      this.state.filteredRequests = [];

      console.log("✅ All usage data reset to zero");
    } catch (error) {
      console.warn("Failed to reset all usage data:", error);
    }
  }

  async clearStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Countdown timer methods
  initializeCountdown() {
    // Target date: 19/06/2026 at 21:00 PM
    this.targetDate = new Date("2026-06-19T21:00:00").getTime();

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000);

    // Initial update
    this.updateCountdown();
  }

  updateCountdown() {
    const now = new Date().getTime();
    const distance = this.targetDate - now;

    if (distance < 0) {
      // Countdown expired
      clearInterval(this.countdownInterval);
      this.setCountdownExpired();
      return;
    }

    // Calculate time units
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Update DOM elements
    const daysEl = document.getElementById("countdown-days");
    const hoursEl = document.getElementById("countdown-hours");
    const minutesEl = document.getElementById("countdown-minutes");
    const secondsEl = document.getElementById("countdown-seconds");

    if (daysEl) daysEl.textContent = String(days).padStart(2, "0");
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, "0");
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, "0");
  }

  setCountdownExpired() {
    const daysEl = document.getElementById("countdown-days");
    const hoursEl = document.getElementById("countdown-hours");
    const minutesEl = document.getElementById("countdown-minutes");
    const secondsEl = document.getElementById("countdown-seconds");

    if (daysEl) daysEl.textContent = "00";
    if (hoursEl) hoursEl.textContent = "00";
    if (minutesEl) minutesEl.textContent = "00";
    if (secondsEl) secondsEl.textContent = "00";

    // Update label to show expired
    const labelEl = document.querySelector(".countdown-label");
    if (labelEl) labelEl.textContent = "Access period ended";
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  window.quantumFlow = new QuantumFlow();
});
