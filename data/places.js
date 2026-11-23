// State capitals used for prayer-time calculation. Label shown as "State, Country".
export const COUNTRIES = {
  Nigeria: [
    ['Abia', 5.5250, 7.4922], ['Adamawa', 9.2035, 12.4954], ['Akwa Ibom', 5.0377, 7.9128],
    ['Anambra', 6.2120, 7.0740], ['Bauchi', 10.3158, 9.8442], ['Bayelsa', 4.9267, 6.2676],
    ['Benue', 7.7322, 8.5391], ['Borno', 11.8333, 13.1500], ['Cross River', 4.9757, 8.3417],
    ['Delta', 6.1980, 6.7319], ['Ebonyi', 6.3249, 8.1137], ['Edo', 6.3350, 5.6037],
    ['Ekiti', 7.6211, 5.2214], ['Enugu', 6.4584, 7.5464], ['FCT', 9.0765, 7.3986],
    ['Gombe', 10.2897, 11.1673], ['Imo', 5.4836, 7.0333], ['Jigawa', 11.7562, 9.3389],
    ['Kaduna', 10.5105, 7.4165], ['Kano', 12.0022, 8.5920], ['Katsina', 12.9908, 7.6018],
    ['Kebbi', 12.4539, 4.1975], ['Kogi', 7.8023, 6.7333], ['Kwara', 8.4966, 4.5426],
    ['Lagos', 6.6018, 3.3515], ['Nasarawa', 8.4939, 8.5153], ['Niger', 9.6139, 6.5569],
    ['Ogun', 7.1475, 3.3619], ['Ondo', 7.2571, 5.2058], ['Osun', 7.7827, 4.5418],
    ['Oyo', 7.3775, 3.9470], ['Plateau', 9.8965, 8.8583], ['Rivers', 4.8156, 7.0498],
    ['Sokoto', 13.0059, 5.2476], ['Taraba', 8.8937, 11.3596], ['Yobe', 11.7470, 11.9608],
    ['Zamfara', 12.1628, 6.6614]
  ]
};

export function placeLabel(country, state) {
  return (state === 'FCT' ? 'Abuja' : state) + ', ' + country;
}
