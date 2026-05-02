"""
Email sender via Brevo (formerly Sendinblue).
Free tier: 300 emails/day, no OAuth, works anywhere.
Sign up at https://app.brevo.com — takes 2 minutes.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

BREVO_API_KEY  = os.getenv('BREVO_API_KEY', '')
SENDER_EMAIL   = os.getenv('SENDER_EMAIL', '')
SENDER_NAME    = os.getenv('YOUR_NAME', 'Startup Incubator at UCSD')
BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'


def send_email(to_email: str, subject: str, body: str, to_name: str = '') -> bool:
    """Send an email via Brevo API. Returns True on success."""
    if not BREVO_API_KEY:
        raise ValueError(
            'BREVO_API_KEY is not set. '
            'Sign up free at https://app.brevo.com and add the key to .env'
        )

    payload = {
        'sender':  {'name': SENDER_NAME, 'email': SENDER_EMAIL},
        'to':      [{'email': to_email, 'name': to_name or to_email}],
        'subject': subject,
        'textContent': body,
    }
    headers = {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      BREVO_API_KEY,
    }

    r = requests.post(BREVO_ENDPOINT, json=payload, headers=headers, timeout=15)

    if not r.ok:
        raise RuntimeError(f'Brevo error {r.status_code}: {r.text}')

    return True


def is_email_configured() -> bool:
    """Check if Brevo is ready to send."""
    return bool(BREVO_API_KEY and SENDER_EMAIL)


def get_daily_quota() -> dict:
    """Return how many emails have been sent today via Brevo statistics."""
    if not BREVO_API_KEY:
        return {'configured': False}
    try:
        r = requests.get(
            'https://api.brevo.com/v3/account',
            headers={'api-key': BREVO_API_KEY, 'accept': 'application/json'},
            timeout=10
        )
        if r.ok:
            plan = r.json().get('plan', [{}])
            return {'configured': True, 'account': r.json().get('email', '')}
    except Exception:
        pass
    return {'configured': True}
