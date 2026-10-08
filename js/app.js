/* Moore 311 — public road problem reporting.
 * Map: ArcGIS Maps SDK for JavaScript 4.30.
 * Storage: ArcGIS Online hosted feature layer (anonymous addFeatures via REST).
 */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG;
  var STORE_KEY = "moore311.reports";
  var LAST_KEY = "moore311.lastSubmit";

  var $ = function (id) { return document.getElementById(id); };
  var state = { step: 1, point: null, address: "", category: null, fields: null, serviceOk: null, geocodeSeq: 0 };

  // ---------- Icons for categories (stroke SVGs) ----------
  var ICONS = {
    pothole: '<ellipse cx="12" cy="14" rx="9" ry="4.5"/><path d="M7 13.5c1.5-1.6 3-1 4.2-.2 1.3.9 3 1 5-.3"/><path d="M3 9h3M18 9h3"/>',
    light: '<path d="M8 21h8M12 21V7"/><path d="M12 7c0-2 1.5-3.5 4-3.5h2"/><path d="M15.5 3.5h5l-1 3h-3z"/><path d="M18 9v1M15.5 8.5l-.6.8M20.5 8.5l.6.8"/>',
    signal: '<rect x="8" y="2.5" width="8" height="16" rx="2"/><circle cx="12" cy="6.5" r="1.5"/><circle cx="12" cy="10.5" r="1.5"/><circle cx="12" cy="14.5" r="1.5"/><path d="M12 18.5V22"/>',
    sign: '<path d="M12 2.5l8 8-8 8-8-8z"/><path d="M12 18.5V22M12 7.5v4M12 14h.01"/>',
    debris: '<path d="M3 19h18"/><path d="M5 19l3-5 3 2 2-4 3 3 3 4"/><circle cx="17" cy="7" r="2"/>',
    sidewalk: '<path d="M3 20L8 4h8l5 16z"/><path d="M5.5 12h13M10 4l-2 16M14 4l2 16"/>',
    snow: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
    water: '<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/><path d="M3 20c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1 2.5 1 4.5 1"/>',
    graffiti: '<rect x="6" y="9" width="7" height="12" rx="1.5"/><path d="M8 9V6.5h3V9M9.5 6.5V4"/><path d="M15 5h.01M17.5 3.5h.01M17.5 7h.01M20 5h.01"/>',
    other: '<circle cx="12" cy="12" r="9.5"/><circle cx="8" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="16" cy="12" r=".6"/>'
  };

  // ---------- Small helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var toastTimer;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast" + (isError ? " error" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 7000 : 3500);
  }
  function banner(msg) {
    var b = $("banner");
    b.textContent = msg || "";
    b.hidden = !msg;
  }
  function makeRef() {
    var d = new Date();
    var ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var rnd = "";
    var buf = new Uint32Array(5);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) rnd += alphabet[buf[i] % alphabet.length];
    return "SR-" + ymd + "-" + rnd;
  }
  function loadMine() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* private mode */ }
    updateMineCount();
  }
  function updateMineCount() {
    var n = loadMine().length;
    var c = $("my-count");
    c.textContent = n;
    c.hidden = n === 0;
  }
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  // ---------- Service check (no sign-in prompts for the public) ----------
  function checkService() {
    return fetch(CFG.reportsLayerUrl + "?f=json")
      .then(function (r) { return r.json(); })
      .then(function (info) {
        if (info.error) {
          console.warn("Reports layer not reachable anonymously:", info.error);
          state.serviceOk = false;
          banner("Online reporting isn't open yet. You can still look around the map, but reports can't be sent right now.");
          return;
        }
        state.fields = {};
        (info.fields || []).forEach(function (f) { state.fields[f.name.toLowerCase()] = f; });
        var caps = (info.capabilities || "").toLowerCase();
        state.serviceOk = caps.indexOf("create") !== -1;
        if (!state.serviceOk) {
          console.warn("Reports layer does not allow Create. Capabilities:", info.capabilities);
          banner("Online reporting isn't open yet. You can still look around the map, but reports can't be sent right now.");
        }
      })
      .catch(function (e) {
        console.warn("Service check failed", e);
        state.serviceOk = null; // unknown; we'll try on submit
      });
  }

  // Build attributes that match the layer's actual fields (names + types + lengths).
  function buildAttributes(values) {
    var out = {};
    Object.keys(values).forEach(function (key) {
      var v = values[key];
      if (v === "" || v == null) return;
      var f = state.fields && state.fields[key.toLowerCase()];
      if (state.fields && !f) return; // field not in layer
      var name = f ? f.name : key;
      var type = f ? f.type : "esriFieldTypeString";
      if (key === "SubmittedOn") {
        v = type === "esriFieldTypeDate" ? Date.now() : new Date().toISOString();
      } else if (type === "esriFieldTypeDouble" || type === "esriFieldTypeSingle") {
        v = Number(v);
      } else if (type === "esriFieldTypeString") {
        v = String(v);
        if (f && f.length && v.length > f.length) v = v.slice(0, f.length);
      }
      out[name] = v;
    });
    return out;
  }

  function submitReport(values) {
    var feature = {
      geometry: { x: state.point.longitude, y: state.point.latitude, spatialReference: { wkid: 4326 } },
      attributes: buildAttributes(values)
    };
    var body = new URLSearchParams();
    body.set("f", "json");
    body.set("features", JSON.stringify([feature]));
    body.set("rollbackOnFailure", "true");
    return fetch(CFG.reportsLayerUrl + "/addFeatures", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error) throw Object.assign(new Error(res.error.message || "Service error"), { code: res.error.code });
        var r0 = res.addResults && res.addResults[0];
        if (!r0 || !r0.success) throw new Error((r0 && r0.error && r0.error.description) || "The report was not saved.");
        return r0.objectId;
      });
  }

  // ---------- Steps ----------
  function goto(step) {
    state.step = step;
    ["1", "2", "3", "done", "mine"].forEach(function (s) { $("step-" + s).hidden = String(step) !== s; });
    var n = typeof step === "number" ? step : step === "done" ? 4 : 0;
    $("progress").hidden = step === "mine" || step === "done";
    var dots = document.querySelectorAll(".progress .dot");
    var bars = document.querySelectorAll(".progress .bar");
    dots.forEach(function (d, i) { d.classList.toggle("on", i < n); d.classList.toggle("current", i === n - 1); });
    bars.forEach(function (b, i) { b.classList.toggle("on", i < n - 1); });
    $("panel").scrollTop = 0;
    var h = document.querySelector("#step-" + step + " h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    if (step === 3) renderSummary();
    if (step === "mine") renderMine();
  }

  function renderTiles() {
    var host = $("tiles");
    host.innerHTML = CFG.categories.map(function (c, i) {
      return '<button type="button" class="tile" role="radio" aria-checked="false" data-value="' + esc(c.value) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[c.icon] || ICONS.other) + "</svg>" +
        '<span class="t-name">' + esc(c.value) + '</span><span class="t-hint">' + esc(c.hint || "") + "</span></button>";
    }).join("");
    var tiles = Array.prototype.slice.call(host.querySelectorAll(".tile"));
    function select(tile, focus) {
      tiles.forEach(function (t) { t.setAttribute("aria-checked", "false"); t.tabIndex = -1; });
      tile.setAttribute("aria-checked", "true");
      tile.tabIndex = 0;
      if (focus) tile.focus();
      state.category = tile.getAttribute("data-value");
      $("cat-error").hidden = true;
    }
    tiles.forEach(function (tile, i) {
      tile.addEventListener("click", function () { select(tile); });
      tile.addEventListener("dblclick", function () { select(tile); goto(3); });
      tile.addEventListener("keydown", function (e) {
        var k = e.key, j = null;
        if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % tiles.length;
        if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + tiles.length) % tiles.length;
        if (j !== null) { e.preventDefault(); select(tiles[j], true); }
      });
    });
  }

  function renderSummary() {
    $("summary").innerHTML =
      "<b>" + esc(state.category) + "</b>" +
      "<span>" + esc(state.address || coordText(state.point)) + "</span>";
  }

  function renderMine() {
    var list = loadMine();
    var ul = $("mine-list");
    if (!list.length) {
      ul.innerHTML = '<li class="empty">You haven\u2019t sent any reports from this device yet.</li>';
      return;
    }
    ul.innerHTML = list.map(function (r, i) {
      return "<li><div class=\"m-top\"><span class=\"m-cat\">" + esc(r.category) + "</span><span class=\"m-ref\">" + esc(r.ref) + "</span></div>" +
        "<div class=\"m-sub\">" + esc(r.address) + "<br>" + esc(fmtDate(r.date)) + "</div>" +
        "<button type=\"button\" class=\"m-go\" data-i=\"" + i + "\">Show on map</button></li>";
    }).join("");
    ul.querySelectorAll(".m-go").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = list[Number(b.getAttribute("data-i"))];
        if (window.__zoomTo) window.__zoomTo(r.lon, r.lat);
      });
    });
  }

  function coordText(p) {
    return p ? p.latitude.toFixed(5) + ", " + p.longitude.toFixed(5) : "";
  }

  // ---------- Init UI that doesn't need the map ----------
  $("year").textContent = new Date().getFullYear();
  $("app-title").textContent = CFG.appTitle;
  renderTiles();
  updateMineCount();
  checkService();

  document.querySelectorAll("[data-goto]").forEach(function (b) {
    b.addEventListener("click", function () { goto(Number(b.getAttribute("data-goto"))); });
  });
  $("to-2").addEventListener("click", function () {
    if (!state.point) { $("loc-error").hidden = false; return; }
    goto(2);
  });
  $("to-3").addEventListener("click", function () {
    if (!state.category) { $("cat-error").hidden = false; return; }
    goto(3);
  });
  var returnStep = 1;
  $("my-reports-btn").addEventListener("click", function () {
    if (state.step !== "mine") returnStep = state.step;
    goto("mine");
  });
  $("mine-back").addEventListener("click", function () { goto(returnStep === "done" ? 1 : returnStep); });

  // ---------- Map ----------
  require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/widgets/Search",
    "esri/rest/locator"
  ], function (esriConfig, Map, MapView, Graphic, Point, Extent, Search, locator) {
    if (CFG.apiKey) esriConfig.apiKey = CFG.apiKey;
    var GEOCODE_URL = CFG.apiKey
      ? "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer"
      : "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    var map = new Map({ basemap: CFG.basemap });
    var view = new MapView({
      container: "map",
      map: map,
      center: CFG.center,
      zoom: CFG.zoom,
      constraints: { snapToZoom: false },
      popupEnabled: false,
      ui: { components: ["zoom", "attribution"] }
    });
    view.ui.move("zoom", "bottom-right");

    var pinSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">' +
      '<ellipse cx="20" cy="49" rx="7" ry="2.5" fill="rgba(0,0,0,.25)"/>' +
      '<path d="M20 2C10.6 2 3 9.4 3 18.6 3 31 20 48 20 48s17-17 17-29.4C37 9.4 29.4 2 20 2z" fill="#c5221f" stroke="#fff" stroke-width="2.5"/>' +
      '<circle cx="20" cy="18.5" r="6.5" fill="#fff"/></svg>';
    var pinSymbol = {
      type: "picture-marker",
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(pinSvg),
      width: "34px",
      height: "44px",
      yoffset: "20px"
    };
    var pin = new Graphic({ symbol: pinSymbol });

    function setPin(point, label) {
      state.point = point;
      pin.geometry = point;
      if (!view.graphics.includes(pin)) view.graphics.add(pin);
      $("loc-error").hidden = true;
      $("map-hint").classList.add("fade");
      var card = $("location-card");
      card.classList.add("set");
      $("loc-sub").textContent = coordText(point) + " · tap the map again to move the pin";
      if (label) {
        state.address = label;
        $("loc-title").textContent = label;
      } else {
        state.address = "";
        $("loc-title").textContent = "Finding nearest address…";
        reverseGeocode(point);
      }
      if (state.step === 3) renderSummary();
    }

    function reverseGeocode(point) {
      var seq = ++state.geocodeSeq;
      locator.locationToAddress(GEOCODE_URL, { location: point, outSpatialReference: { wkid: 4326 } })
        .then(function (res) {
          if (seq !== state.geocodeSeq) return;
          var a = res && res.attributes;
          var label = (a && (a.ShortLabel || a.Match_addr)) || res.address || "";
          var city = a && a.City ? a.City : "";
          if (label && city && label.indexOf(city) === -1) label += ", " + city;
          state.address = label ? "Near " + label : "";
          $("loc-title").textContent = state.address || "Pinned location";
          if (state.step === 3) renderSummary();
        })
        .catch(function () {
          if (seq !== state.geocodeSeq) return;
          state.address = "";
          $("loc-title").textContent = "Pinned location";
        });
    }

    view.on("click", function (e) {
      if (!e.mapPoint) return;
      if (state.step === "done") $("again-btn").click();
      else if (state.step === "mine") goto(1);
      setPin(toWgs(e.mapPoint));
    });

    function toWgs(mp) {
      return new Point({ longitude: mp.longitude, latitude: mp.latitude });
    }

    var ext = CFG.searchExtent;
    var search = new Search({
      view: view,
      container: "search",
      popupEnabled: false,
      resultGraphicEnabled: false,
      includeDefaultSources: false,
      locationEnabled: false,
      sources: [{
        url: GEOCODE_URL,
        name: "Address",
        placeholder: "Search an address or place",
        singleLineFieldName: "SingleLine",
        filter: ext ? { geometry: new Extent({ xmin: ext.xmin, ymin: ext.ymin, xmax: ext.xmax, ymax: ext.ymax, spatialReference: { wkid: 4326 } }) } : undefined,
        withinViewEnabled: false,
        zoomScale: 4000,
        maxSuggestions: 6
      }]
    });
    search.on("select-result", function (e) {
      if (!e.result) return;
      var g = e.result.feature.geometry;
      var p = g.type === "point" ? g : g.centroid || g.extent.center;
      setPin(toWgs(p), e.result.name);
    });

    $("locate-btn").addEventListener("click", function () {
      var btn = $("locate-btn");
      if (!navigator.geolocation) { toast("Your browser can't share your location.", true); return; }
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(function (pos) {
        btn.disabled = false;
        var p = new Point({ longitude: pos.coords.longitude, latitude: pos.coords.latitude });
        view.goTo({ target: p, zoom: 18 }, { duration: 600 }).catch(function () {});
        setPin(p);
      }, function () {
        btn.disabled = false;
        toast("We couldn't get your location. Tap the map instead.", true);
      }, { enableHighAccuracy: true, timeout: 10000 });
    });

    window.__zoomTo = function (lon, lat) {
      view.goTo({ center: [lon, lat], zoom: 18 }, { duration: 600 }).catch(function () {});
      if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo(0, 0);
    };

    view.when(function () {
      $("loader").classList.add("hidden");
    }, function (err) {
      console.error(err);
      $("loader").querySelector("p").textContent = "The map couldn't load. Please refresh the page.";
    });

    // ---------- Submit ----------
    $("report-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var desc = $("f-desc").value.trim();
      var email = $("f-email").value.trim();
      var ok = true;

      $("desc-error").hidden = desc.length >= 3;
      $("f-desc").setAttribute("aria-invalid", desc.length < 3);
      if (desc.length < 3) ok = false;

      var emailBad = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      $("email-error").hidden = !emailBad;
      $("f-email").setAttribute("aria-invalid", !!emailBad);
      if (emailBad) ok = false;

      if (!ok) { (desc.length < 3 ? $("f-desc") : $("f-email")).focus(); return; }
      if (!state.point) { goto(1); $("loc-error").hidden = false; return; }
      if (!state.category) { goto(2); $("cat-error").hidden = false; return; }

      // Honeypot: silently "succeed" for bots.
      if ($("f-website").value) { showDone(makeRef(), false); return; }

      var last = Number(localStorage.getItem(LAST_KEY) || 0);
      var wait = (CFG.submitCooldownSeconds || 0) * 1000 - (Date.now() - last);
      if (wait > 0) { toast("Please wait " + Math.ceil(wait / 1000) + " seconds before sending another report.", true); return; }

      if (state.serviceOk === false) {
        toast("Online reporting isn't open yet, so this report can't be sent.", true);
        return;
      }

      var ref = makeRef();
      var btn = $("submit-btn");
      btn.disabled = true;
      btn.textContent = "Sending…";

      submitReport({
        ReportID: ref,
        Category: state.category,
        Description: desc,
        Status: "New",
        Address: state.address.replace(/^Near /, ""),
        ReporterName: $("f-name").value.trim(),
        ReporterEmail: email,
        ReporterPhone: $("f-phone").value.trim(),
        SubmittedOn: true,
        Source: "Web",
        Latitude: state.point.latitude,
        Longitude: state.point.longitude
      }).then(function () {
        localStorage.setItem(LAST_KEY, String(Date.now()));
        showDone(ref, true);
      }).catch(function (err) {
        console.error("Submit failed", err);
        var msg = err && (err.code === 499 || err.code === 498 || err.code === 403)
          ? "Online reporting isn't open yet, so this report can't be sent."
          : "Sorry, your report couldn't be sent. Please try again.";
        toast(msg, true);
      }).then(function () {
        btn.disabled = false;
        btn.textContent = "Submit report";
      });
    });

    function showDone(ref, save) {
      if (save) {
        var list = loadMine();
        list.unshift({
          ref: ref,
          category: state.category,
          address: state.address || coordText(state.point),
          date: new Date().toISOString(),
          lat: state.point.latitude,
          lon: state.point.longitude
        });
        saveMine(list);
      }
      $("done-ref").textContent = ref;
      goto("done");
    }

    $("again-btn").addEventListener("click", function () {
      state.point = null; state.address = ""; state.category = null;
      view.graphics.remove(pin);
      $("report-form").reset();
      document.querySelectorAll(".tile").forEach(function (t) { t.setAttribute("aria-checked", "false"); });
      $("location-card").classList.remove("set");
      $("loc-title").textContent = "No pin yet";
      $("loc-sub").textContent = "Your pin will appear here.";
      $("map-hint").classList.remove("fade");
      search.clear();
      goto(1);
    });
  });

  goto(1);
})();
