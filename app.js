/* =========================================================
   MNav — GPS web
   Moteurs : Leaflet + OpenStreetMap (gratuit) | Google Maps
   Thème "Bleu Nuit & Noir"
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. CONFIGURATION
     --------------------------------------------------------- */
  const CFG = window.MNAV_CONFIG || {};
  const API_KEY = (CFG.googleMapsApiKey || "").trim();
  const DEFAULT_LOC = CFG.defaultLocation || { lat: 48.8566, lng: 2.3522 };
  const LANGUAGE = CFG.language || "fr";
  const GEO_OPTIONS = CFG.geoOptions || { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };

  const STORE = {
    recent: "mnav.recent",
    favorites: "mnav.favorites",
    mode: "mnav.mode",
    engine: "mnav.engine"
  };

  /* Style de carte sombre (Google) */
  const GOOGLE_DARK_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#0a1020" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0a1020" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8fa7c7" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#0d1729" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7f97b8" }] },
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#131f34" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#18273f" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#20375a" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0a1020" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#0c1524" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#04070d" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#22354f" }] }
  ];
  const GOOGLE_SAT_STYLE = [
    { elementType: "labels.text.fill", stylers: [{ color: "#cfe0f5" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#06101f" }] }
  ];
  const GOOGLE_TERRAIN_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#0a1020" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8fa7c7" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0a1020" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#182741" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#04070d" }] }
  ];

  /* ---------------------------------------------------------
     2. RÉFÉRENCES DOM
     --------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);

  const el = {
    app: $("#app"),
    panel: $("#panel"),
    hidePanel: $("#hidePanel"),
    panelHandle: $("#panelHandle"),
    openPanel: $("#openPanel"),
    engineSwitch: $("#engineSwitch"),
    searchInput: $("#searchInput"),
    clearSearch: $("#clearSearch"),
    suggestions: $("#suggestions"),
    modes: $("#modes"),
    routeCard: $("#routeCard"),
    destName: $("#destName"),
    destAddress: $("#destAddress"),
    statDistance: $("#statDistance"),
    statDuration: $("#statDuration"),
    statArrival: $("#statArrival"),
    startNav: $("#startNav"),
    clearRoute: $("#clearRoute"),
    btnFavorite: $("#btnFavorite"),
    stepsWrap: $("#stepsWrap"),
    steps: $("#steps"),
    stepsCount: $("#stepsCount"),
    favCard: $("#favCard"),
    favList: $("#favList"),
    recentCard: $("#recentCard"),
    recentList: $("#recentList"),
    emptyState: $("#emptyState"),
    statusDot: $("#statusDot"),
    statusText: $("#statusText"),
    map: $("#map"),
    btnLocate: $("#btnLocate"),
    btnTraffic: $("#btnTraffic"),
    btnLayers: $("#btnLayers"),
    layerMenu: $("#layerMenu"),
    btnFullscreen: $("#btnFullscreen"),
    hud: $("#hud"),
    hudIcon: $("#hudIcon"),
    hudDist: $("#hudDist"),
    hudInstr: $("#hudInstr"),
    hudEta: $("#hudEta"),
    hudRemain: $("#hudRemain"),
    btnMute: $("#btnMute"),
    btnFollow: $("#btnFollow"),
    btnExitNav: $("#btnExitNav"),
    toast: $("#toast"),
    apiModal: $("#apiModal"),
    closeModal: $("#closeModal")
  };

  /* ---------------------------------------------------------
     3. ÉTAT GLOBAL
     --------------------------------------------------------- */
  const state = {
    engineName: "leaflet",
    engine: null,
    layerId: "dark",
    destination: null,
    route: null,
    path: [],
    cumDist: [],
    pathLength: 0,
    stepStarts: [],
    stepIndex: -1,
    travelMode: "DRIVING",
    userLocation: null,
    heading: null,
    lastRaw: null,
    watchId: null,
    navigating: false,
    voice: true,
    follow: true,
    routeDuration: 0,
    routeDistance: 0,
    ready: false
  };

  /* ---------------------------------------------------------
     4. UTILITAIRES
     --------------------------------------------------------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
    }
  };

  function formatDistance(meters) {
    if (!isFinite(meters)) return "—";
    if (meters < 1000) return Math.round(meters / 10) * 10 + " m";
    return (meters / 1000).toFixed(meters < 10000 ? 1 : 0).replace(".", ",") + " km";
  }

  function formatDuration(seconds) {
    if (!isFinite(seconds)) return "—";
    const min = Math.round(seconds / 60);
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? h + " h " + String(m).padStart(2, "0") : h + " h";
  }

  function formatTime(date) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function svgIcon(id) {
    return '<svg viewBox="0 0 24 24"><use href="#' + id + '"/></svg>';
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Icône normalisée de manœuvre */
  const MANEUVER_ICONS = {
    "left": "i-arrow-left",
    "right": "i-arrow-right",
    "slight-left": "i-slight-left",
    "slight-right": "i-slight-right",
    "sharp-left": "i-sharp-left",
    "sharp-right": "i-sharp-right",
    "straight": "i-arrow-up",
    "uturn": "i-uturn",
    "merge": "i-merge",
    "roundabout": "i-roundabout",
    "ferry": "i-ferry",
    "depart": "i-nav",
    "arrive": "i-flag"
  };

  function iconForManeuver(key) {
    return MANEUVER_ICONS[key] || "i-arrow-up";
  }

  let toastTimer = null;
  function toast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.toggle("is-error", !!isError);
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 4000);
  }

  function setStatus(text, kind) {
    el.statusText.textContent = text;
    el.statusDot.className = "dot" + (kind ? " is-" + kind : "");
  }

  function haversine(a, b) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fetchJSON(url, timeout) {
    const controller = ("AbortController" in window) ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, timeout || 12000) : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  /* ---------------------------------------------------------
     5. MOTEUR LEAFLET (OpenStreetMap) — 100 % gratuit
     --------------------------------------------------------- */
  function createLeafletEngine() {
    let map = null;
    let tileLayers = [];
    let userMarker = null;
    let accuracyCircle = null;
    let destMarker = null;
    let routeCasing = null;
    let routeLine = null;

    const ESRI_ATTRIBUTION =
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; ' +
      'Sources: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const TILES = {
      dark: {
        label: "Sombre",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        attribution: ESRI_ATTRIBUTION,
        maxZoom: 19,
        maxNativeZoom: 16
      },
      satellite: {
        label: "Satellite",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        attribution: ESRI_ATTRIBUTION,
        maxZoom: 19,
        maxNativeZoom: 19
      },
      osm: {
        label: "OSM clair",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        subdomains: "abc",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        maxNativeZoom: 19
      },
      carto: {
        label: "Sombre (CARTO)",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        subdomains: "abcd",
        key: CFG.cartoApiKey || "",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
        maxNativeZoom: 20
      }
    };

    const OSRM_HOSTS = {
      DRIVING: "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
      BICYCLING: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/",
      WALKING: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
      TRANSIT: "https://routing.openstreetmap.de/routed-car/route/v1/driving/"
    };

    const nominatimCache = {};

    function userDivIcon(heading) {
      const rot = isFinite(heading) ? Math.round(heading) : 0;
      return L.divIcon({
        className: "mnav-marker",
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        html:
          '<div class="mnav-user__halo"></div>' +
          '<div class="mnav-user__arrow" style="transform:rotate(' + rot + 'deg)">' +
          '<svg viewBox="0 0 24 24"><path d="M12 2.5 4.5 20 12 15.4 19.5 20Z"/></svg>' +
          '</div>' +
          '<div class="mnav-user__dot"></div>'
      });
    }

    const PIN_HTML =
      '<svg viewBox="0 0 40 52" width="40" height="52">' +
      '<path d="M20 51C20 51 37 30 37 19A17 17 0 1 0 3 19c0 11 17 32 17 32Z" fill="#2f6fed" stroke="#eaf2ff" stroke-width="2.5"/>' +
      '<circle cx="20" cy="19" r="6.5" fill="#0a1020"/></svg>';

    const api = {
      id: "leaflet",
      supportsTransit: false,
      layers: [
        { id: "dark", label: "Sombre" },
        { id: "satellite", label: "Satellite" },
        { id: "osm", label: "OSM clair" }
      ].concat(CFG.cartoApiKey ? [{ id: "carto", label: "Sombre (CARTO)" }] : []),

      init(container, handlers) {
        map = L.map(container, {
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true,
          worldCopyJump: true
        }).setView([DEFAULT_LOC.lat, DEFAULT_LOC.lng], 13);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        api.setLayer(state.layerId);

        map.on("click", function (e) {
          handlers.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      },

      destroy() {
        if (map) { map.remove(); map = null; }
        tileLayers = [];
        userMarker = accuracyCircle = destMarker = routeCasing = routeLine = null;
      },

      setLayer(id) {
        if (!map) return;
        const conf = TILES[id] || TILES.dark;
        tileLayers.forEach(function (layer) { map.removeLayer(layer); });
        tileLayers = [];

        const options = {
          maxZoom: conf.maxZoom,
          maxNativeZoom: conf.maxNativeZoom,
          minNativeZoom: 0,
          attribution: conf.attribution,
          crossOrigin: true
        };
        if (conf.subdomains) options.subdomains = conf.subdomains;
        const url = conf.key ? conf.url + "?key=" + encodeURIComponent(conf.key) : conf.url;

        const base = L.tileLayer(url, options).addTo(map);
        tileLayers.push(base);
        if (conf.labels) {
          const labelOptions = {};
          Object.keys(options).forEach(function (k) { if (k !== "attribution") labelOptions[k] = options[k]; });
          tileLayers.push(L.tileLayer(conf.labels, labelOptions).addTo(map));
        }
        base.bringToBack();
      },

      showUser(latlng, accuracy, heading) {
        if (!map) return;
        if (!userMarker) {
          userMarker = L.marker([latlng.lat, latlng.lng], {
            icon: userDivIcon(heading),
            interactive: false,
            zIndexOffset: 1000
          }).addTo(map);
        } else {
          userMarker.setLatLng([latlng.lat, latlng.lng]);
          userMarker.setIcon(userDivIcon(heading));
        }
        if (isFinite(accuracy) && accuracy > 0) {
          if (!accuracyCircle) {
            accuracyCircle = L.circle([latlng.lat, latlng.lng], {
              radius: accuracy,
              color: "#38bdf8",
              weight: 1,
              opacity: 0.35,
              fillColor: "#38bdf8",
              fillOpacity: 0.09,
              interactive: false
            }).addTo(map);
          } else {
            accuracyCircle.setLatLng([latlng.lat, latlng.lng]);
            accuracyCircle.setRadius(accuracy);
          }
        }
      },

      showDestination(latlng, name) {
        if (!map) return;
        if (!destMarker) {
          destMarker = L.marker([latlng.lat, latlng.lng], {
            icon: L.divIcon({
              className: "mnav-marker",
              iconSize: [40, 52],
              iconAnchor: [20, 51],
              html: PIN_HTML
            }),
            title: name || "Destination",
            zIndexOffset: 900
          }).addTo(map);
        } else {
          destMarker.setLatLng([latlng.lat, latlng.lng]);
          destMarker.setTooltipContent(name || "");
        }
      },

      clearDestination() {
        if (destMarker && map) map.removeLayer(destMarker);
        destMarker = null;
      },

      drawRoute(route) {
        if (!map || !route.path.length) return;
        const latlngs = route.path.map(function (p) { return [p.lat, p.lng]; });
        if (routeCasing) map.removeLayer(routeCasing);
        if (routeLine) map.removeLayer(routeLine);
        routeCasing = L.polyline(latlngs, { color: "#05070c", weight: 10, opacity: 0.85, interactive: false }).addTo(map);
        routeLine = L.polyline(latlngs, { color: "#38bdf8", weight: 5, opacity: 0.95, interactive: false }).addTo(map);
      },

      clearRoute() {
        if (map) {
          if (routeCasing) map.removeLayer(routeCasing);
          if (routeLine) map.removeLayer(routeLine);
        }
        routeCasing = routeLine = null;
      },

      fitRoute(route, origin) {
        if (!map || !route.path.length) return;
        const bounds = L.latLngBounds(route.path.map(function (p) { return [p.lat, p.lng]; }));
        if (origin) bounds.extend([origin.lat, origin.lng]);
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
      },

      panTo(latlng, zoom) {
        if (!map) return;
        if (isFinite(zoom)) map.setView([latlng.lat, latlng.lng], zoom, { animate: true });
        else map.panTo([latlng.lat, latlng.lng]);
      },

      followUser(latlng) {
        if (!map) return;
        map.panTo([latlng.lat, latlng.lng], { animate: true, duration: 0.6 });
        if (map.getZoom() < 16) map.setZoom(17);
      },

      setHeading() { /* non supporté par Leaflet */ },

      setTraffic() { return false; },

      /* --- Recherche d'adresses (Nominatim) --- */
      search(query) {
        const key = query.toLowerCase();
        if (nominatimCache[key]) return Promise.resolve(nominatimCache[key]);
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=fr&q=" + encodeURIComponent(query);
        return fetchJSON(url, 12000).then(function (items) {
          const results = (items || []).map(function (item) {
            const display = item.display_name || "";
            return {
              name: item.name || display.split(",")[0],
              address: display,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              placeId: "osm:" + item.place_id
            };
          });
          nominatimCache[key] = results;
          return results;
        });
      },

      /* --- Géocodage inverse --- */
      reverseGeocode(latlng) {
        const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=fr&lat=" +
          latlng.lat + "&lon=" + latlng.lng;
        return fetchJSON(url, 12000).then(function (item) {
          if (!item) throw new Error("adresse introuvable");
          const display = item.display_name || "";
          return {
            name: item.name || display.split(",")[0] || "Point de la carte",
            address: display,
            lat: latlng.lat,
            lng: latlng.lng
          };
        });
      },

      /* --- Itinéraire (OSRM) --- */
      route(origin, destination, mode) {
        const base = OSRM_HOSTS[mode] || OSRM_HOSTS.DRIVING;
        const url = base + origin.lng + "," + origin.lat + ";" + destination.lng + "," + destination.lat +
          "?alternatives=false&overview=full&geometries=geojson&steps=true";
        return fetchJSON(url, 15000).then(function (data) {
          if (!data || data.code !== "Ok" || !data.routes || !data.routes.length) {
            throw new Error("Aucun itinéraire trouvé");
          }
          const r = data.routes[0];
          const legs = r.legs || [];
          const steps = [];
          legs.forEach(function (leg) {
            (leg.steps || []).forEach(function (step) {
              const key = osrmManeuverKey(step.maneuver);
              steps.push({
                key: key,
                instruction: osrmInstruction(key, step),
                distanceText: formatDistance(step.distance),
                distanceValue: step.distance,
                start: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] }
              });
            });
          });
          const path = (r.geometry && r.geometry.coordinates ? r.geometry.coordinates : []).map(function (c) {
            return { lat: c[1], lng: c[0] };
          });
          if (!steps.length && path.length) {
            steps.push({
              key: "straight",
              instruction: "Continuez tout droit",
              distanceText: formatDistance(r.distance),
              distanceValue: r.distance,
              start: { lat: path[0].lat, lng: path[0].lng }
            });
          }
          return {
            distance: r.distance,
            duration: r.duration,
            steps: steps,
            path: path
          };
        });
      }
    };

    function osrmManeuverKey(maneuver) {
      const type = (maneuver && maneuver.type) || "";
      const mod = ((maneuver && maneuver.modifier) || "").toLowerCase();
      if (type === "arrive") return "arrive";
      if (type === "depart") return "depart";
      if (type.indexOf("roundabout") !== -1 || type.indexOf("rotary") !== -1) return "roundabout";
      if (type === "ferry") return "ferry";
      if (mod === "uturn") return "uturn";
      if (["merge", "fork", "end of road", "on ramp", "off ramp"].indexOf(type) !== -1) return "merge";
      if (mod === "left") return "left";
      if (mod === "right") return "right";
      if (mod === "slight left") return "slight-left";
      if (mod === "slight right") return "slight-right";
      if (mod === "sharp left") return "sharp-left";
      if (mod === "sharp right") return "sharp-right";
      return "straight";
    }

    function osrmInstruction(key, step) {
      const street = step.name || step.ref || step.destinations || "";
      const sur = street ? " sur " + street : "";
      const vers = street ? " vers " + street : "";
      switch (key) {
        case "depart": return "Départ" + vers;
        case "arrive": return "Arrivée à destination";
        case "left": return "Tournez à gauche" + sur;
        case "right": return "Tournez à droite" + sur;
        case "slight-left": return "Serrez à gauche" + sur;
        case "slight-right": return "Serrez à droite" + sur;
        case "sharp-left": return "Tournez fortement à gauche" + sur;
        case "sharp-right": return "Tournez fortement à droite" + sur;
        case "uturn": return "Faites demi-tour";
        case "merge": return street ? "Rejoignez " + street : "Restez sur votre voie";
        case "roundabout": return street ? "Au rond-point, prenez la sortie vers " + street : "Au rond-point, continuez tout droit";
        case "ferry": return "Traversez en ferry" + vers;
        default: return street ? "Continuez sur " + street : "Continuez tout droit";
      }
    }

    return api;
  }

  /* ---------------------------------------------------------
     6. MOTEUR GOOGLE MAPS (optionnel, nécessite une clé)
     --------------------------------------------------------- */
  function createGoogleEngine() {
    let map = null;
    let ds = null;
    let dr = null;
    let places = null;
    let autocomplete = null;
    let geocoder = null;
    let traffic = null;
    let userMarker = null;
    let accuracyCircle = null;
    let destMarker = null;
    let rawResult = null;

    const api = {
      id: "google",
      supportsTransit: true,
      layers: [
        { id: "dark", label: "Sombre" },
        { id: "satellite", label: "Satellite" },
        { id: "terrain", label: "Relief" }
      ],

      init(container, handlers) {
        map = new google.maps.Map(container, {
          center: DEFAULT_LOC,
          zoom: 13,
          mapTypeId: "roadmap",
          styles: GOOGLE_DARK_STYLE,
          backgroundColor: "#05070c",
          disableDefaultUI: true,
          zoomControl: false,
          clickableIcons: false,
          gestureHandling: "cooperative",
          draggableCursor: "crosshair"
        });

        ds = new google.maps.DirectionsService();
        dr = new google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#38bdf8",
            strokeOpacity: 0.95,
            strokeWeight: 6,
            icons: [{
              icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: "#ffffff", fillOpacity: 1, strokeWeight: 0 },
              offset: "70%",
              repeat: "110%"
            }]
          }
        });
        places = new google.maps.places.PlacesService(map);
        autocomplete = new google.maps.places.AutocompleteService(map);
        geocoder = new google.maps.Geocoder();
        traffic = new google.maps.TrafficLayer();

        map.addListener("click", function (event) {
          handlers.onMapClick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
      },

      destroy() {
        if (dr) dr.setDirections(null);
        map = null;
      },

      setLayer(id) {
        if (!map) return;
        if (id === "satellite") {
          map.setMapTypeId("hybrid");
          map.setOptions({ styles: GOOGLE_SAT_STYLE });
        } else if (id === "terrain") {
          map.setMapTypeId("terrain");
          map.setOptions({ styles: GOOGLE_TERRAIN_STYLE });
        } else {
          map.setMapTypeId("roadmap");
          map.setOptions({ styles: GOOGLE_DARK_STYLE });
        }
      },

      setTraffic(on) {
        if (!traffic) return false;
        if (on) traffic.setMap(map);
        else traffic.setMap(null);
        return true;
      },

      showUser(latlng, accuracy, heading) {
        if (!map) return;
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
          '<circle cx="28" cy="28" r="15" fill="rgba(56,189,248,0.16)"/>' +
          '<circle cx="28" cy="28" r="7" fill="#38bdf8" stroke="#eaf6ff" stroke-width="2.5"/>' +
          '<g transform="rotate(' + (isFinite(heading) ? Math.round(heading) : 0) + ' 28 28)">' +
          '<path d="M28 21 L34 5 L22 5 Z" fill="#38bdf8" stroke="#0a1020" stroke-width="1.2"/></g></svg>';
        const icon = {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28)
        };
        if (!userMarker) {
          userMarker = new google.maps.Marker({ map: map, position: latlng, icon: icon, zIndex: 1000, clickable: false, title: "Vous êtes ici" });
        } else {
          userMarker.setPosition(latlng);
          userMarker.setIcon(icon);
        }
        if (isFinite(accuracy) && accuracy > 0) {
          if (!accuracyCircle) {
            accuracyCircle = new google.maps.Circle({
              map: map, radius: accuracy, fillColor: "#38bdf8", fillOpacity: 0.09,
              strokeColor: "#38bdf8", strokeOpacity: 0.35, strokeWeight: 1, clickable: false, zIndex: 900
            });
          } else {
            accuracyCircle.setRadius(accuracy);
          }
          accuracyCircle.setCenter(latlng);
        }
      },

      showDestination(latlng, name) {
        if (!map) return;
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">' +
          '<path d="M20 51C20 51 37 30 37 19A17 17 0 1 0 3 19c0 11 17 32 17 32Z" fill="#2f6fed" stroke="#eaf2ff" stroke-width="2.5"/>' +
          '<circle cx="20" cy="19" r="6.5" fill="#0a1020"/></svg>';
        const icon = {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(40, 52),
          anchor: new google.maps.Point(20, 51),
          zIndex: 1001
        };
        if (!destMarker) {
          destMarker = new google.maps.Marker({ map: map, position: latlng, title: name, icon: icon, zIndex: 1001 });
        } else {
          destMarker.setPosition(latlng);
        }
      },

      clearDestination() {
        if (destMarker && map) destMarker.setMap(null);
        destMarker = null;
      },

      drawRoute(route) {
        if (!dr || !rawResult) return;
        dr.setDirections(rawResult);
      },

      clearRoute() {
        rawResult = null;
        if (dr) dr.setDirections(null);
      },

      fitRoute(route, origin) {
        if (!map || !route.path.length) return;
        const bounds = new google.maps.LatLngBounds();
        route.path.forEach(function (p) { bounds.extend(p); });
        if (origin) bounds.extend(origin);
        map.fitBounds(bounds, { top: 70, bottom: 130, left: 60, right: 60 });
      },

      panTo(latlng, zoom) {
        if (!map) return;
        if (isFinite(zoom)) { map.panTo(latlng); map.setZoom(zoom); }
        else map.panTo(latlng);
      },

      followUser(latlng) {
        if (!map) return;
        map.panTo(latlng);
        if (map.getZoom() < 16) map.setZoom(17);
        if (isFinite(state.heading) && typeof map.setHeading === "function") map.setHeading(state.heading);
      },

      setHeading(heading) {
        if (map && isFinite(heading) && typeof map.setHeading === "function") map.setHeading(heading);
      },

      search(query) {
        const request = {
          input: query,
          locationBias: state.userLocation
            ? { center: state.userLocation, radius: 50000 }
            : { center: DEFAULT_LOC, radius: 50000 },
          language: LANGUAGE
        };
        return new Promise(function (resolve, reject) {
          autocomplete.getPlacePredictions(request, function (results, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results) { resolve([]); return; }
            resolve(results.map(function (p) {
              return {
                name: (p.structured_formatting && p.structured_formatting.main_text) || p.description,
                address: (p.structured_formatting && p.structured_formatting.secondary_text) || "",
                placeId: p.place_id
              };
            }));
          });
        });
      },

      reverseGeocode(latlng) {
        return new Promise(function (resolve, reject) {
          geocoder.geocode({ location: latlng }, function (results, status) {
            if (status === "OK" && results && results[0]) {
              const r = results[0];
              resolve({
                name: (r.address_components && r.address_components[0] && r.address_components[0].long_name) || "Point de la carte",
                address: r.formatted_address || "",
                lat: latlng.lat,
                lng: latlng.lng
              });
            } else {
              resolve({
                name: "Point de la carte",
                address: latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5),
                lat: latlng.lat,
                lng: latlng.lng
              });
            }
          });
        });
      },

      /* Résolution d'un place_id Google en coordonnées */
      resolvePlace(placeId) {
        return new Promise(function (resolve, reject) {
          places.getDetails({ placeId: placeId, fields: ["name", "formatted_address", "geometry", "types"] }, function (place, status) {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !place) { reject(new Error("Lieu introuvable")); return; }
            const loc = place.geometry && place.geometry.location;
            resolve({
              name: place.name || "Lieu",
              address: place.formatted_address || "",
              lat: loc ? loc.lat() : null,
              lng: loc ? loc.lng() : null,
              placeId: placeId
            });
          });
        });
      },

      route(origin, destination, mode) {
        return new Promise(function (resolve, reject) {
          ds.route({
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode[mode],
            provideRouteAlternatives: false
          }, function (result, status) {
            if (status !== "OK" || !result) { reject(new Error("Aucun itinéraire")); return; }
            rawResult = result;
            const leg = result.routes[0].legs[0];
            const steps = leg.steps.map(function (step) {
              return {
                key: googleManeuverKey(step),
                instruction: stripHtml(step.html_instructions),
                distanceText: (step.distance && step.distance.text) || "",
                distanceValue: (step.distance && step.distance.value) || 0,
                start: { lat: step.start_location.lat(), lng: step.start_location.lng() }
              };
            });
            const path = [];
            if (result.routes[0].overview_polyline) {
              google.maps.geometry.encoding.decodePath(result.routes[0].overview_polyline.points).forEach(function (p) {
                path.push({ lat: p.lat(), lng: p.lng() });
              });
            }
            resolve({
              distance: leg.distance.value,
              duration: leg.duration.value,
              steps: steps,
              path: path
            });
          });
        });
      }
    };

    function googleManeuverKey(step) {
      const m = (step.maneuver || "").toLowerCase();
      const text = stripHtml(step.html_instructions || "").toLowerCase();
      if (m.indexOf("arrive") !== -1 || text.indexOf("destination") !== -1 || text.indexOf("arrivée") !== -1) return "arrive";
      if (m.indexOf("depart") !== -1 || text.indexOf("départ") !== -1) return "depart";
      if (m.indexOf("ferry") !== -1 || text.indexOf("traversier") !== -1) return "ferry";
      if (m.indexOf("roundabout") !== -1 || text.indexOf("rond-point") !== -1) return "roundabout";
      if (m.indexOf("merge") !== -1 || text.indexOf("empiler") !== -1) return "merge";
      if (m.indexOf("ramp") !== -1 || text.indexOf("péage") !== -1) return "merge";
      if (m.indexOf("slight-left") !== -1 || text.indexOf("serre à gauche") !== -1) return "slight-left";
      if (m.indexOf("slight-right") !== -1 || text.indexOf("serre à droite") !== -1) return "slight-right";
      if (m.indexOf("sharp-left") !== -1 || text.indexOf("à gauche") !== -1) return "sharp-left";
      if (m.indexOf("sharp-right") !== -1 || text.indexOf("à droite") !== -1) return "sharp-right";
      if (m.indexOf("uturn") !== -1 || text.indexOf("demi-tour") !== -1) return "uturn";
      if (m.indexOf("turn-left") !== -1 || text.indexOf("tourner à gauche") !== -1) return "left";
      if (m.indexOf("turn-right") !== -1 || text.indexOf("tourner à droite") !== -1) return "right";
      if (text.indexOf("gauche") !== -1) return "left";
      if (text.indexOf("droite") !== -1) return "right";
      return "straight";
    }

    return api;
  }

  /* ---------------------------------------------------------
     7. CHARGEMENT DE L'API GOOGLE (optionnel)
     --------------------------------------------------------- */
  function hasValidKey() {
    return !!API_KEY && API_KEY !== "VOTRE_CLE_ICI" && !/^YOUR_/i.test(API_KEY);
  }

  let googlePromise = null;
  function loadGoogleApi() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (googlePromise) return googlePromise;
    if (!hasValidKey()) return Promise.reject(new Error("Clé API Google Maps manquante"));
    googlePromise = new Promise(function (resolve, reject) {
      const params = new URLSearchParams({
        key: API_KEY,
        libraries: "places,geometry",
        v: "weekly",
        language: LANGUAGE
      });
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?" + params.toString();
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Chargement de l'API Google Maps impossible")); };
      document.head.appendChild(script);
    });
    return googlePromise;
  }

  /* ---------------------------------------------------------
     8. GESTION DU MOTEUR
     --------------------------------------------------------- */
  function setEngine(name) {
    if (state.engineName === name && state.engine) return;
    state.engineName = name;
    store.set(STORE.engine, name);

    el.engineSwitch.querySelectorAll(".engine__btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.engine === name);
    });

    if (state.engine) {
      state.engine.destroy();
      state.engine = null;
    }
    el.map.innerHTML = "";

    if (name === "google") {
      setStatus("Chargement de Google Maps…", "live");
      loadGoogleApi().then(function () {
        if (state.engineName !== "google") return;
        state.engine = createGoogleEngine();
        bootEngine();
      }).catch(function () {
        el.apiModal.hidden = false;
        setStatus("Clé API manquante", "error");
        state.engineName = "leaflet";
        store.set(STORE.engine, "leaflet");
        el.engineSwitch.querySelectorAll(".engine__btn").forEach(function (btn) {
          btn.classList.toggle("is-active", btn.dataset.engine === "leaflet");
        });
        state.engine = createLeafletEngine();
        bootEngine();
      });
      return;
    }

    state.engine = createLeafletEngine();
    bootEngine();
  }

  function bootEngine() {
    state.layerId = "dark";
    state.engine.init(el.map, {
      onMapClick: handleMapClick
    });
    state.engine.setLayer(state.layerId);
    renderLayerMenu();

    if (state.userLocation) {
      state.engine.showUser(state.userLocation, state.accuracy, state.heading);
      state.engine.panTo(state.userLocation, 15);
    }
    if (state.destination) {
      state.engine.showDestination(state.destination, state.destination.name);
      computeRoute();
    }
    setStatus(state.userLocation ? "Position acquise" : "Recherche de votre position…", state.userLocation ? "ok" : "live");
  }

  /* ---------------------------------------------------------
     9. GÉOLOCALISATION
     --------------------------------------------------------- */
  function startGeolocation() {
    if (!navigator.geolocation) {
      setStatus("Géolocalisation indisponible", "error");
      return;
    }
    setStatus("Recherche de votre position…", "live");
    state.watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, GEO_OPTIONS);
  }

  function onPosition(position) {
    const pos = position.coords;
    const latLng = { lat: pos.latitude, lng: pos.longitude };
    const first = !state.userLocation;

    state.userLocation = latLng;
    state.accuracy = pos.accuracy;
    if (isFinite(pos.heading)) state.heading = pos.heading;
    else state.heading = computeHeading(state.lastRaw, latLng) || state.heading;
    state.lastRaw = latLng;

    if (state.engine) state.engine.showUser(latLng, pos.accuracy, state.heading);

    if (first) {
      if (state.engine) state.engine.panTo(latLng, 15);
      setStatus("Position acquise", "ok");
      computeRoute();
    }
    if (state.navigating) updateNavigation();
  }

  function onGeoError(error) {
    const messages = { 1: "Accès à la position refusé", 2: "Position indisponible", 3: "Délai de localisation dépassé" };
    setStatus(messages[error.code] || "Erreur de localisation", "error");
    if (error.code === 1) toast("Autorisez la géolocalisation pour un GPS précis.", true);
  }

  function computeHeading(from, to) {
    if (!from || !to) return null;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const bearing = Math.atan2(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), 0);
    return (bearing * 180 / Math.PI + 360) % 360;
  }

  /* ---------------------------------------------------------
     10. RECHERCHE
     --------------------------------------------------------- */
  let searchTimer = null;
  let suggestionsList = [];

  el.searchInput.addEventListener("input", function () {
    const value = this.value.trim();
    el.clearSearch.hidden = value.length === 0;
    clearTimeout(searchTimer);
    if (value.length < 2) { hideSuggestions(); return; }
    searchTimer = setTimeout(function () { fetchSuggestions(value); }, 320);
  });

  el.searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(searchTimer);
      if (suggestionsList[0]) selectSuggestion(suggestionsList[0]);
      else if (this.value.trim()) fetchSuggestions(this.value.trim());
    } else if (event.key === "Escape") {
      this.value = "";
      el.clearSearch.hidden = true;
      hideSuggestions();
      this.blur();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(event.key === "ArrowDown" ? 1 : -1);
    }
  });

  el.clearSearch.addEventListener("click", function () {
    el.searchInput.value = "";
    this.hidden = true;
    hideSuggestions();
    el.searchInput.focus();
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".search") && !event.target.closest(".suggestions")) hideSuggestions();
  });

  function fetchSuggestions(query) {
    if (!state.engine) return;
    state.engine.search(query).then(function (results) {
      suggestionsList = results || [];
      renderSuggestions(suggestionsList);
    }).catch(function () {
      hideSuggestions();
    });
  }

  function renderSuggestions(results) {
    el.suggestions.innerHTML = "";
    if (!results.length) { hideSuggestions(); return; }
    results.slice(0, 6).forEach(function (item, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion" + (index === 0 ? " is-active" : "");
      button.setAttribute("role", "option");
      button.innerHTML = svgIcon("i-pin") + "<span>" + escapeHtml(item.name) +
        (item.address ? " <em>· " + escapeHtml(item.address) + "</em>" : "") + "</span>";
      button.addEventListener("click", function () { selectSuggestion(item); });
      el.suggestions.appendChild(button);
    });
    el.suggestions.hidden = false;
  }

  function moveSelection(direction) {
    const items = el.suggestions.querySelectorAll(".suggestion");
    if (!items.length) return;
    let index = -1;
    items.forEach(function (node, i) { if (node.classList.contains("is-active")) index = i; });
    index = Math.max(0, Math.min(items.length - 1, index + direction));
    items.forEach(function (node, i) { node.classList.toggle("is-active", i === index); });
    items[index].scrollIntoView({ block: "nearest" });
  }

  function hideSuggestions() {
    el.suggestions.hidden = true;
    el.suggestions.innerHTML = "";
  }

  function selectSuggestion(item) {
    hideSuggestions();
    if (item.lat != null && item.lng != null) {
      setDestination(item);
      return;
    }
    /* Google : le résultat est un place_id à résoudre */
    if (state.engine && typeof state.engine.resolvePlace === "function" && item.placeId) {
      state.engine.resolvePlace(item.placeId).then(function (place) {
        setDestination(place);
      }).catch(function () {
        setDestination(item);
      });
      return;
    }
    setDestination(item);
  }

  /* ---------------------------------------------------------
     11. DESTINATION
     --------------------------------------------------------- */
  function handleMapClick(latlng) {
    if (!state.engine) return;
    if (isMobileLayout()) closePanel();
    state.engine.reverseGeocode(latlng).then(function (place) {
      setDestination(place);
    }).catch(function () {
      setDestination({ name: "Point de la carte", address: latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5), lat: latlng.lat, lng: latlng.lng });
    });
  }

  function setDestination(place) {
    state.destination = place;
    el.destName.textContent = place.name || "Destination";
    el.destAddress.textContent = place.address || "—";
    el.routeCard.hidden = false;
    el.emptyState.hidden = true;
    el.btnFavorite.classList.toggle("is-active", isFavorite(place));

    if (state.engine && place.lat != null) {
      state.engine.showDestination(place, place.name);
      state.engine.panTo(place, 14);
    }
    if (place.placeId) addToRecent(place);
    computeRoute();
  }

  /* ---------------------------------------------------------
     12. ITINÉRAIRES
     --------------------------------------------------------- */
  function computeRoute() {
    const dest = state.destination;
    if (!dest || dest.lat == null || !state.engine) return;
    const origin = state.userLocation || DEFAULT_LOC;

    setStatus("Calcul de l'itinéraire…", "live");
    state.engine.route(origin, dest, state.travelMode).then(function (route) {
      state.route = route;
      state.routeDuration = route.duration;
      state.routeDistance = route.distance;
      state.engine.drawRoute(route);
      state.engine.fitRoute(route, origin);
      buildPathMetrics(route);
      renderRoute(route);
      setStatus(state.userLocation ? "Position acquise" : "Itinéraire calculé", "ok");
    }).catch(function (err) {
      state.route = null;
      state.engine.clearRoute();
      toast(err && err.message ? err.message : "Impossible de calculer l'itinéraire.", true);
      setStatus("Itinéraire indisponible", "error");
    });
  }

  /* Calcule distances cumulées et index de départ de chaque étape */
  function buildPathMetrics(route) {
    const path = route.path || [];
    const cum = [0];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += haversine(path[i - 1], path[i]);
      cum.push(total);
    }
    state.path = path;
    state.cumDist = cum;
    state.pathLength = total;

    state.stepStarts = (route.steps || []).map(function (step) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < path.length; i++) {
        const d = haversine(step.start, path[i]);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    });
  }

  function renderRoute(route) {
    el.statDistance.textContent = formatDistance(route.distance);
    el.statDuration.textContent = formatDuration(route.duration);
    el.statArrival.textContent = formatTime(new Date(Date.now() + route.duration * 1000));
    el.routeCard.hidden = false;
    renderSteps(route.steps || []);
  }

  function renderSteps(steps) {
    el.steps.innerHTML = "";
    el.stepsCount.textContent = "(" + steps.length + ")";
    steps.forEach(function (step, index) {
      const li = document.createElement("li");
      li.dataset.index = index;
      li.innerHTML =
        '<span class="step__icon">' + svgIcon(iconForManeuver(step.key)) + "</span>" +
        '<span class="step__text"><strong>' + escapeHtml(step.instruction) + "</strong>" +
        '<span>' + escapeHtml(step.distanceText || "") + "</span></span>";
      li.addEventListener("click", function () {
        if (state.engine) {
          state.engine.panTo(step.start, 16);
        }
      });
      el.steps.appendChild(li);
    });
  }

  /* ---------------------------------------------------------
     13. NAVIGATION PAS À PAS
     --------------------------------------------------------- */
  function startNavigation() {
    if (!state.route) { toast("Aucun itinéraire à suivre.", true); return; }
    state.navigating = true;
    state.stepIndex = -1;
    state.follow = true;
    el.hud.hidden = false;
    if (isMobileLayout()) closePanel();
    el.startNav.innerHTML = svgIcon("i-close") + "<span>Arrêter la navigation</span>";
    setStatus("Navigation en cours", "live");
    updateNavigation();
  }

  function stopNavigation() {
    state.navigating = false;
    state.follow = false;
    el.hud.hidden = true;
    el.startNav.innerHTML = svgIcon("i-nav") + "<span>Démarrer la navigation</span>";
    setStatus(state.userLocation ? "Position acquise" : "En attente de position", "ok");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  el.startNav.addEventListener("click", function () {
    state.navigating ? stopNavigation() : startNavigation();
  });
  el.btnExitNav.addEventListener("click", stopNavigation);

  el.btnFollow.addEventListener("click", function () {
    state.follow = !state.follow;
    el.btnFollow.classList.toggle("is-active", state.follow);
    if (state.follow && state.userLocation && state.engine) state.engine.followUser(state.userLocation);
  });

  el.btnMute.addEventListener("click", function () {
    state.voice = !state.voice;
    el.btnMute.innerHTML = svgIcon(state.voice ? "i-volume" : "i-mute");
    el.btnMute.title = state.voice ? "Couper la voix" : "Activer la voix";
    if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel();
  });

  function updateNavigation() {
    if (!state.navigating || !state.route || !state.userLocation) return;

    const steps = state.route.steps || [];
    if (!steps.length) return;
    const pos = state.userLocation;

    const near = nearestOnPath(pos);
    const traveled = Math.min(state.cumDist[near.index] || 0, state.pathLength);

    let index = 0;
    for (let i = 0; i < state.stepStarts.length; i++) {
      if (state.stepStarts[i] <= near.index) index = i;
    }

    if (index !== state.stepIndex) {
      state.stepIndex = index;
      highlightStep(index);
      announce(steps[index]);
    }

    const step = steps[index];
    const remainingToManeuver = Math.max(0, state.cumDist[state.stepStarts[index]] - traveled);
    const remainingTotal = Math.max(0, state.pathLength - traveled);

    el.hudIcon.innerHTML = svgIcon(iconForManeuver(step.key));
    el.hudDist.textContent = formatDistance(remainingToManeuver);
    el.hudInstr.textContent = step.instruction;

    const speedFactor = state.routeDuration ? state.routeDuration / Math.max(state.pathLength, 1) : 0;
    const remainingSeconds = remainingTotal * speedFactor;
    el.hudEta.textContent = "Arrivée " + formatTime(new Date(Date.now() + remainingSeconds * 1000));
    el.hudRemain.textContent = formatDistance(remainingTotal) + " restant";

    if (state.follow && state.engine) state.engine.followUser(pos);

    if (index === steps.length - 1 && remainingTotal < 40) {
      toast("Vous êtes arrivé à destination.");
      speak("Vous êtes arrivé à destination.");
      stopNavigation();
    }
  }

  function highlightStep(index) {
    const items = el.steps.querySelectorAll("li");
    items.forEach(function (li, i) { li.classList.toggle("is-current", i === index); });
    const current = items[index];
    if (current && el.stepsWrap.open) current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* Point le plus proche sur le tracé */
  function nearestOnPath(point) {
    const path = state.path;
    if (path.length < 2) return { index: 0, distance: 0 };
    const latRef = point.lat * Math.PI / 180;
    const kx = Math.cos(latRef) * 111320;
    const ky = 111320;
    const px = point.lng * kx;
    const py = point.lat * ky;

    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i].lng * kx, ay = path[i].lat * ky;
      const bx = path[i + 1].lng * kx, by = path[i + 1].lat * ky;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy;
      const d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (d < bestDist) { bestDist = d; bestIndex = i + t; }
    }
    return { index: Math.round(bestIndex), distance: bestDist };
  }

  function announce(step) {
    const text = step.instruction || "";
    if (!text) return;
    speak(text + ". Dans " + (step.distanceText || "quelques mètres") + ".");
  }

  function speak(text) {
    if (!state.voice || !window.speechSynthesis) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const fr = voices.find(function (v) { return v.lang && v.lang.indexOf("fr") === 0; });
      if (fr) utterance.voice = fr;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (e) { /* silencieux */ }
  }

  /* ---------------------------------------------------------
     14. FAVORIS & HISTORIQUE
     --------------------------------------------------------- */
  function loadStoredLists() {
    renderFavorites(store.get(STORE.favorites, []));
    renderRecent(store.get(STORE.recent, []));
  }

  function renderRecent(items) {
    el.recentList.innerHTML = "";
    el.recentCard.hidden = items.length === 0;
    items.forEach(function (item) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list__btn";
      btn.innerHTML = svgIcon("i-history") + "<span>" + escapeHtml(item.name) + "</span>";
      btn.addEventListener("click", function () {
        setDestination(item);
        el.searchInput.value = item.name;
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "list__del";
      del.title = "Supprimer";
      del.innerHTML = svgIcon("i-close");
      del.addEventListener("click", function () {
        const list = store.get(STORE.recent, []).filter(function (i) { return i.placeId !== item.placeId; });
        store.set(STORE.recent, list);
        renderRecent(list);
      });
      li.appendChild(btn);
      li.appendChild(del);
      el.recentList.appendChild(li);
    });
  }

  function renderFavorites(items) {
    el.favList.innerHTML = "";
    el.favCard.hidden = items.length === 0;
    items.forEach(function (item) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list__btn";
      btn.innerHTML = svgIcon("i-star") + "<span>" + escapeHtml(item.name) + "</span>";
      btn.addEventListener("click", function () {
        setDestination(item);
        el.searchInput.value = item.name;
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "list__del";
      del.title = "Supprimer";
      del.innerHTML = svgIcon("i-close");
      del.addEventListener("click", function () {
        const current = store.get(STORE.favorites, []);
        const index = current.indexOf(item);
        if (index !== -1) current.splice(index, 1);
        store.set(STORE.favorites, current);
        renderFavorites(current);
        el.btnFavorite.classList.remove("is-active");
      });
      li.appendChild(btn);
      li.appendChild(del);
      el.favList.appendChild(li);
    });
  }

  function isFavorite(place) {
    const list = store.get(STORE.favorites, []);
    return list.some(function (item) {
      return place.placeId ? item.placeId === place.placeId : item.name === place.name;
    });
  }

  function addToRecent(place) {
    if (!place.placeId) return;
    const list = store.get(STORE.recent, []);
    const filtered = list.filter(function (item) { return item.placeId !== place.placeId; });
    filtered.unshift({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId });
    const trimmed = filtered.slice(0, 8);
    store.set(STORE.recent, trimmed);
    renderRecent(trimmed);
  }

  el.btnFavorite.addEventListener("click", function () {
    const place = state.destination;
    if (!place) return;
    const list = store.get(STORE.favorites, []);
    const existing = list.findIndex(function (item) {
      return place.placeId ? item.placeId === place.placeId : item.name === place.name;
    });
    if (existing !== -1) {
      list.splice(existing, 1);
      this.classList.remove("is-active");
      toast("Retiré des favoris.");
    } else {
      list.unshift({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, placeId: place.placeId || null });
      this.classList.add("is-active");
      toast("Ajouté aux favoris.");
    }
    store.set(STORE.favorites, list);
    renderFavorites(list);
  });

  el.clearRoute.addEventListener("click", function () {
    state.destination = null;
    state.route = null;
    if (state.engine) { state.engine.clearRoute(); state.engine.clearDestination(); }
    el.routeCard.hidden = true;
    el.emptyState.hidden = false;
    el.btnFavorite.classList.remove("is-active");
    el.searchInput.value = "";
    el.clearSearch.hidden = true;
    stopNavigation();
  });

  /* ---------------------------------------------------------
     15. MODES DE TRANSPORT
     --------------------------------------------------------- */
  function setMode(button, mode) {
    state.travelMode = mode;
    el.modes.querySelectorAll(".mode").forEach(function (b) {
      const active = b === button;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    store.set(STORE.mode, mode);
    if (mode === "TRANSIT" && state.engine && !state.engine.supportsTransit) {
      toast("Transports en commun indisponibles en mode gratuit : itinéraire routier affiché.");
    }
    if (state.destination) computeRoute();
  }

  el.modes.addEventListener("click", function (event) {
    const button = event.target.closest(".mode");
    if (!button) return;
    setMode(button, button.dataset.mode);
  });

  /* ---------------------------------------------------------
     16. BARRE D'OUTILS & CALQUES
     --------------------------------------------------------- */
  el.btnLocate.addEventListener("click", function () {
    if (!state.userLocation) {
      setStatus("Recherche de votre position…", "live");
      startGeolocation();
      return;
    }
    if (state.engine) state.engine.followUser(state.userLocation);
    if (state.navigating) state.follow = true;
  });

  el.btnTraffic.addEventListener("click", function () {
    const active = this.classList.toggle("is-active");
    const ok = state.engine && typeof state.engine.setTraffic === "function" && state.engine.setTraffic(active);
    if (!ok) {
      this.classList.remove("is-active");
      toast("Le trafic en direct est réservé au moteur Google Maps.");
    }
  });

  el.btnLayers.addEventListener("click", function (event) {
    event.stopPropagation();
    renderLayerMenu();
    el.layerMenu.hidden = !el.layerMenu.hidden;
  });

  el.layerMenu.addEventListener("click", function (event) {
    const item = event.target.closest(".layer-menu__item");
    if (!item) return;
    state.layerId = item.dataset.map;
    if (state.engine) state.engine.setLayer(state.layerId);
    renderLayerMenu();
    el.layerMenu.hidden = true;
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".layer-menu") && !event.target.closest("#btnLayers")) el.layerMenu.hidden = true;
  });

  function renderLayerMenu() {
    if (!state.engine) return;
    el.layerMenu.innerHTML = "";
    state.engine.layers.forEach(function (layer) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-menu__item" + (layer.id === state.layerId ? " is-active" : "");
      button.dataset.map = layer.id;
      button.innerHTML = '<span class="layer-menu__swatch layer-menu__swatch--' + layer.id + '"></span> ' + layer.label;
      el.layerMenu.appendChild(button);
    });
  }

  el.btnFullscreen.addEventListener("click", function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });

  /* Sélecteur de moteur */
  el.engineSwitch.addEventListener("click", function (event) {
    const button = event.target.closest(".engine__btn");
    if (!button || button.classList.contains("is-active")) return;
    setEngine(button.dataset.engine);
  });

  /* Panneau (desktop / mobile) */
  function isMobileLayout() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 900px)").matches);
  }

  function syncPanelState() {
    const expanded = isMobileLayout()
      ? el.app.classList.contains("is-panel-open")
      : !el.app.classList.contains("is-panel-hidden");
    el.hidePanel.setAttribute("aria-expanded", expanded ? "true" : "false");
    el.panelHandle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function openPanel() {
    if (isMobileLayout()) {
      el.app.classList.add("is-panel-open");
      el.app.classList.remove("is-panel-hidden");
    } else {
      el.app.classList.remove("is-panel-hidden");
    }
    syncPanelState();
  }

  function closePanel() {
    if (isMobileLayout()) {
      el.app.classList.remove("is-panel-open");
    } else {
      el.app.classList.add("is-panel-hidden");
    }
    syncPanelState();
  }

  function togglePanel() {
    const open = isMobileLayout()
      ? el.app.classList.contains("is-panel-open")
      : !el.app.classList.contains("is-panel-hidden");
    if (open) closePanel(); else openPanel();
  }

  el.hidePanel.addEventListener("click", function () {
    togglePanel();
  });

  el.panelHandle.addEventListener("click", function (event) {
    event.stopPropagation();
    togglePanel();
  });

  el.openPanel.addEventListener("click", function () {
    openPanel();
  });

  /* Sur mobile, la feuille basse masque une partie de la carte :
     on la replie quand l'utilisateur interagit avec la carte. */
  el.searchInput.addEventListener("focus", function () {
    if (isMobileLayout()) openPanel();
  });

  el.closeModal.addEventListener("click", function () { el.apiModal.hidden = true; });

  /* ---------------------------------------------------------
     17. RACCOURCIS CLAVIER
     --------------------------------------------------------- */
  document.addEventListener("keydown", function (event) {
    const tag = (event.target.tagName || "").toLowerCase();
    if (event.target === el.searchInput) return;
    if (event.key === "/" && tag !== "input" && tag !== "textarea") {
      event.preventDefault();
      openPanel();
      el.searchInput.focus();
    } else if (event.key === "Escape") {
      if (state.navigating) stopNavigation();
      else hideSuggestions();
    } else if (event.key === "n" && state.route && !state.navigating) {
      startNavigation();
    }
  });

  /* ---------------------------------------------------------
     18. DÉMARRAGE
     --------------------------------------------------------- */
  function boot() {
    const storedMode = store.get(STORE.mode, "DRIVING");
    if (storedMode) {
      const btn = el.modes.querySelector('[data-mode="' + storedMode + '"]');
      if (btn) setMode(btn, storedMode);
    }
    loadStoredLists();

    const storedEngine = store.get(STORE.engine, "leaflet");
    state.engineName = null;
    setEngine(storedEngine === "google" && hasValidKey() ? "google" : "leaflet");

    if (location.protocol === "file:") {
      setTimeout(function () {
        toast("Ouvert en local (file://) : le calque OSM clair sera bloqué. Servez la page via http://localhost:8000", true);
      }, 1200);
    }

    startGeolocation();
  }

  boot();
})();
