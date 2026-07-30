export type StreetPlacemark = {
  streetNumber?: string | null;
  street?: string | null;
  name?: string | null;
};

/**
 * Keep the dashboard intentionally terse: Lexus shows the street line, not a
 * full postal address. Native geocoders occasionally include the house number
 * in `street`, so avoid rendering it twice.
 */
export function formatStreetAddress(placemark: StreetPlacemark | undefined): string | null {
  if (!placemark) {
    return null;
  }

  const number = placemark.streetNumber?.trim();
  const street = placemark.street?.trim();
  if (street) {
    if (!number || street === number || street.startsWith(`${number} `)) {
      return street;
    }
    return `${number} ${street}`;
  }

  return placemark.name?.trim() || null;
}
