/**
 * MNav — Configuration
 * ---------------------------------------------------------------
 * MNav fonctionne en mode 100 % gratuit avec Leaflet :
 * le fond de carte sombre par défaut (Esri Dark Gray Canvas) et le
 * fond clair (OpenStreetMap) ne demandent AUCUNE clé API.
 *
 * La clé Google Maps n'est utile QUE si vous souhaitez basculer sur le
 * moteur « Google Maps » via le sélecteur en haut du panneau.
 */
window.MNAV_CONFIG = {
  // Optionnel : clé Google Maps (Maps JavaScript API + Places + Directions).
  // Laissez "VOTRE_CLE_ICI" pour rester en mode gratuit.
  googleMapsApiKey: "VOTRE_CLE_ICI",

  // Optionnel : clé CARTO Basemaps (gratuite, 5 M tuiles/mois).
  // CARTO exige une clé depuis septembre 2026 : sans elle, les tuiles
  // affichent « API KEY REQUIRED ». Laissez "" pour ne pas utiliser CARTO.
  // Demande de clé : https://carto.com/basemaps/apikey/
  cartoApiKey: "",

  // Position utilisée avant la première localisation GPS
  defaultLocation: { lat: 48.8566, lng: 2.3522 },

  // Langue de l'interface Google Maps
  language: "fr",

  // Options de géolocalisation
  geoOptions: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000
  }
};
