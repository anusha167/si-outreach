"""
Company discovery — all free, no paid APIs required.

Sources:
  1. CSV import  — user uploads a spreadsheet
  2. YC companies — public list from ycombinator.com
  3. Google dork  — searches LinkedIn profiles via Google
"""

import csv
import io
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    )
}


# ---------------------------------------------------------------------------
# 1. CSV Import
# ---------------------------------------------------------------------------

# Expected CSV columns (case-insensitive, extras are ignored):
#   name, email, company, title, linkedin_url, website, description, industry, location

FIELD_ALIASES = {
    'name': ['name', 'full_name', 'fullname', 'founder', 'contact'],
    'email': ['email', 'email_address', 'e-mail'],
    'company': ['company', 'company_name', 'organization', 'org'],
    'title': ['title', 'job_title', 'position', 'role'],
    'linkedin_url': ['linkedin', 'linkedin_url', 'linkedin_profile'],
    'website': ['website', 'url', 'company_url', 'homepage'],
    'description': ['description', 'about', 'bio', 'summary'],
    'industry': ['industry', 'sector', 'vertical'],
    'location': ['location', 'city', 'region'],
}


def _normalize_header(header: str):
    h = header.strip().lower().replace(' ', '_')
    for field, aliases in FIELD_ALIASES.items():
        if h in aliases:
            return field
    return None


def parse_csv(file_content: bytes) -> list[dict]:
    """Parse a CSV file and return a list of contact dicts."""
    text = file_content.decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(io.StringIO(text))

    header_map = {}
    for col in (reader.fieldnames or []):
        normalized = _normalize_header(col)
        if normalized:
            header_map[col] = normalized

    contacts = []
    for row in reader:
        contact = {'source': 'csv'}
        for original_col, field in header_map.items():
            val = row.get(original_col, '').strip()
            if val:
                contact[field] = val
        if contact.get('name') or contact.get('email'):
            contacts.append(contact)

    return contacts


# ---------------------------------------------------------------------------
# 2. YC Companies (public)
# ---------------------------------------------------------------------------

YC_API = 'https://api.ycombinator.com/v0.1/companies'


def fetch_yc_companies(
    batch: str = '',
    industry: str = '',
    limit: int = 50
) -> list[dict]:
    """
    Fetch companies from the public YC API.
    batch example: 'W24', 'S23'
    industry example: 'Fintech', 'Healthcare', 'B2B'
    """
    params = {'page': 1, 'per_page': min(limit, 100)}
    if batch:
        params['batch'] = batch
    if industry:
        params['industry'] = industry

    try:
        r = requests.get(YC_API, params=params, headers=HEADERS, timeout=10)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        return []

    companies = data.get('companies', [])
    results = []
    for co in companies[:limit]:
        results.append({
            'name': co.get('founders', [{}])[0].get('first_name', '') + ' ' +
                    co.get('founders', [{}])[0].get('last_name', '')
                    if co.get('founders') else co.get('name', ''),
            'company': co.get('name', ''),
            'title': 'Founder',
            'website': co.get('website', ''),
            'description': co.get('one_liner', '') or co.get('long_description', ''),
            'industry': ', '.join(co.get('tags', [])),
            'location': co.get('location', ''),
            'linkedin_url': '',
            'email': '',
            'source': 'yc',
        })
    return results


# ---------------------------------------------------------------------------
# 3. Google Dork — find LinkedIn profiles
# ---------------------------------------------------------------------------

def google_linkedin_search(query: str, max_results: int = 10) -> list[dict]:
    """
    Find LinkedIn profiles via DuckDuckGo (more scraper-friendly than Google).
    Falls back to Google if DuckDuckGo returns nothing.
    """
    results = _ddg_linkedin_search(query, max_results)
    if not results:
        results = _google_linkedin_search(query, max_results)
    return results


def _extract_linkedin_results(soup, max_results):
    results = []
    seen = set()
    for a in soup.find_all('a', href=True):
        href = a['href']

        # Clean redirect wrappers
        for prefix in ['/url?q=', '/l/?kh=-1&uddg=']:
            if prefix in href:
                href = href.split(prefix)[1].split('&')[0]
                break

        try:
            from urllib.parse import unquote
            href = unquote(href)
        except Exception:
            pass

        if 'linkedin.com/in/' not in href:
            continue
        if not href.startswith('http'):
            continue

        href = href.split('?')[0].rstrip('/')
        if href in seen:
            continue
        seen.add(href)

        slug = href.split('/in/')[-1].replace('-', ' ').title()
        raw_name = a.get_text(strip=True)
        name = raw_name.split(' - ')[0].split(' | ')[0].split('·')[0].strip() or slug

        results.append({
            'name': name,
            'linkedin_url': href,
            'email': '', 'company': '', 'title': '',
            'description': '', 'industry': '', 'location': '', 'website': '',
            'source': 'linkedin_search',
        })
        if len(results) >= max_results:
            break
    return results


def _ddg_linkedin_search(query: str, max_results: int) -> list:
    url = f'https://html.duckduckgo.com/html/?q={requests.utils.quote("site:linkedin.com/in " + query)}'
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if not r.ok:
            return []
        soup = BeautifulSoup(r.text, 'lxml')
        return _extract_linkedin_results(soup, max_results)
    except Exception:
        return []


def _google_linkedin_search(query: str, max_results: int) -> list:
    url = f'https://www.google.com/search?q={requests.utils.quote("site:linkedin.com/in " + query)}&num={max_results}'
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if not r.ok:
            return []
        soup = BeautifulSoup(r.text, 'lxml')
        return _extract_linkedin_results(soup, max_results)
    except Exception:
        return []
