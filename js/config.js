/* Moore 311 – app configuration. Edit these values; no build step needed. */
window.APP_CONFIG = {
  appTitle: "Report a problem",
  orgName: "Moore Engineering, Inc.",

  // ArcGIS Online hosted feature layer that stores reports (layer 0 of the service).
  reportsLayerUrl:
    "https://services.arcgis.com/unxYrwb3eK5uevNZ/arcgis/rest/services/Moore%20311%20-%20Public%20Reports%20%28GIS%20App%20Builder%29/FeatureServer/0",

  // Optional ArcGIS location-services API key (basemap + geocoding). Leave blank to use anonymous access.
  apiKey: "",

  // Starting map view (Fargo–Moorhead).
  center: [-96.7898, 46.8772],
  zoom: 13,
  basemap: "streets-navigation-vector",

  // Search results are biased to this area.
  searchExtent: { xmin: -97.2, ymin: 46.6, xmax: -96.4, ymax: 47.1 },

  // Report categories shown to the public (value is stored in the Category field).
  categories: [
    { value: "Pothole", icon: "pothole", hint: "Hole or crack in the road" },
    { value: "Streetlight out", icon: "light", hint: "Light off, flickering or damaged" },
    { value: "Traffic signal", icon: "signal", hint: "Signal not working or timed wrong" },
    { value: "Damaged sign", icon: "sign", hint: "Missing, bent or hard to read" },
    { value: "Debris in road", icon: "debris", hint: "Objects or spills on the road" },
    { value: "Sidewalk or curb", icon: "sidewalk", hint: "Trip hazard or broken curb" },
    { value: "Snow or ice", icon: "snow", hint: "Unplowed or icy road" },
    { value: "Drainage or flooding", icon: "water", hint: "Blocked drain or standing water" },
    { value: "Graffiti", icon: "graffiti", hint: "On signs, bridges or structures" },
    { value: "Other", icon: "other", hint: "Something else on the road" }
  ],

  // Minimum seconds between submissions from the same browser (simple spam guard).
  submitCooldownSeconds: 30
};
