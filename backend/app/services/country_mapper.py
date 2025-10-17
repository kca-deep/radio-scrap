"""
Country code mapper service.
Maps source organization names to country codes (KR/US/UK/JP).
Legacy logic ported from previous system.
"""
import logging
from typing import Optional

from app.models.common import CountryCodeEnum

logger = logging.getLogger(__name__)

# Country mapping dictionary
# Based on legacy to_group_code() logic
COUNTRY_MAPPINGS = {
    # United States
    "fcc": CountryCodeEnum.US,
    "ntia": CountryCodeEnum.US,
    "federal communications commission": CountryCodeEnum.US,

    # United Kingdom
    "ofcom": CountryCodeEnum.UK,
    "office of communications": CountryCodeEnum.UK,

    # Japan
    "総務省": CountryCodeEnum.JP,
    "soumu": CountryCodeEnum.JP,
    "mic": CountryCodeEnum.JP,
    "ministry of internal affairs and communications": CountryCodeEnum.JP,

    # South Korea
    "과기정통부": CountryCodeEnum.KR,
    "과학기술정보통신부": CountryCodeEnum.KR,
    "방통위": CountryCodeEnum.KR,
    "방송통신위원회": CountryCodeEnum.KR,
    "msit": CountryCodeEnum.KR,
    "kcc": CountryCodeEnum.KR,
    "ministry of science and ict": CountryCodeEnum.KR,
}


def map_country_code(source: str) -> Optional[CountryCodeEnum]:
    """
    Map source organization name to country code.

    Args:
        source: Source organization name (e.g., "FCC", "Ofcom", "과기정통부")

    Returns:
        CountryCodeEnum if matched, None otherwise

    Examples:
        >>> map_country_code("FCC")
        <CountryCodeEnum.US: 'US'>
        >>> map_country_code("Ofcom")
        <CountryCodeEnum.UK: 'UK'>
        >>> map_country_code("과기정통부")
        <CountryCodeEnum.KR: 'KR'>
        >>> map_country_code("Unknown Source")
        None
    """
    if not source or not source.strip():
        logger.warning("Empty source provided for country mapping")
        return None

    # Normalize: lowercase and strip whitespace
    normalized_source = source.strip().lower()

    # Direct lookup
    country_code = COUNTRY_MAPPINGS.get(normalized_source)

    if country_code:
        logger.debug(f"Mapped '{source}' to {country_code.value}")
        return country_code

    # Partial match (contains)
    for key, code in COUNTRY_MAPPINGS.items():
        if key in normalized_source or normalized_source in key:
            logger.debug(f"Partial match: '{source}' contains '{key}' -> {code.value}")
            return code

    logger.warning(f"No country mapping found for source: '{source}'")
    return None


def get_supported_sources() -> dict[CountryCodeEnum, list[str]]:
    """
    Get all supported source names grouped by country.

    Returns:
        Dictionary mapping country codes to list of source names

    Example:
        >>> sources = get_supported_sources()
        >>> sources[CountryCodeEnum.US]
        ['fcc', 'ntia', 'federal communications commission']
    """
    result: dict[CountryCodeEnum, list[str]] = {
        CountryCodeEnum.US: [],
        CountryCodeEnum.UK: [],
        CountryCodeEnum.JP: [],
        CountryCodeEnum.KR: [],
    }

    for source, country_code in COUNTRY_MAPPINGS.items():
        result[country_code].append(source)

    return result
