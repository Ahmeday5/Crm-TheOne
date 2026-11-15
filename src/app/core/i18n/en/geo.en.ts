import { TranslationFile } from '../i18n.types';

const geo: TranslationFile<'geo'> = {
  geo: {
    updating: 'Updating…',
    unknownCountry: 'Unknown country',
    noGovernorate: 'No governorate',
    map: {
      levels: 'Map level',
      world: 'World',
      egypt: 'Egypt',
      back: 'Back to the world map',
      openEgypt: "Egypt's governorates",
      allEgypt: 'All of Egypt',
      hint: 'Click a country or governorate for details · Ctrl + wheel to zoom',
      noShapes: "Region boundaries aren't available right now — showing places as points.",
      unavailable: "The map isn't available on this device (no WebGL support). The list still works.",
      listView: 'List',
      mapView: 'Map',
      worldAria: 'World map coloured by the number of {unit} across {n} countries',
      egyptAria: "Map of Egypt's governorates coloured by the number of {unit} across {n} governorates",
    },
    legend: {
      title: 'Count',
    },
    tooltip: {
      ofTotal: 'of the total',
      ofEgypt: "of Egypt's total",
      inferred: '{n} from the mobile number',
      click: 'Click for details',
      clickEgypt: 'Click to see the governorates',
    },
    ranking: {
      title: 'Region ranking',
      count: 'Count',
      inferred: 'Auto',
      inferredHint: 'Customers whose country was detected from the mobile number',
      empty: 'No data',
      countries: 'Countries',
      governorates: 'Governorates',
      country: 'Country',
      governorate: 'Governorate',
    },
    panel: {
      shareOfTotal: 'of the total',
      shareOfEgypt: "of Egypt's total",
      inferred: 'from the mobile number',
      byStatus: 'By status',
      unknownHint: 'Customers without a mobile number or without a country code. Set the country from Edit customer.',
      noGovernorateHint: "Customers in Egypt whose governorate isn't set yet. Set it from Edit customer.",
    },
  },
};

export default geo;
