"""
Drafting pipeline:
  1. Our own personalizer (no AI, no API — always available)
  2. Gemini REST API (if key set — improves quality)
  3. Ollama (if running locally — best quality)
"""
import os
import requests
from dotenv import load_dotenv
from personalizer import generate_email

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models'
GEMINI_MODELS  = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite']
OLLAMA_URL     = 'http://localhost:11434/api/generate'
OLLAMA_MODELS  = ['llama3.2', 'llama3', 'mistral']

USE_AI = os.getenv('USE_AI', 'true').lower() != 'false'


def _try_gemini(prompt):
    if not GEMINI_API_KEY:
        raise ValueError('No key')
    for model in GEMINI_MODELS:
        try:
            r = requests.post(f'{GEMINI_BASE}/{model}:generateContent?key={GEMINI_API_KEY}',
                              json={'contents': [{'parts': [{'text': prompt}]}]}, timeout=30)
            r.raise_for_status()
            return r.json()['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception:
            continue
    raise RuntimeError('Gemini failed')


def _try_ollama(prompt):
    for model in OLLAMA_MODELS:
        try:
            r = requests.post(OLLAMA_URL, json={'model': model, 'prompt': prompt, 'stream': False}, timeout=60)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            return r.json()['response'].strip()
        except requests.exceptions.ConnectionError:
            raise
        except Exception:
            continue
    raise RuntimeError('No Ollama model')


def _parse(text):
    subject, body = '', text
    if 'SUBJECT:' in text:
        parts = text.split('---', 1)
        subject = parts[0].replace('SUBJECT:', '').strip()
        body    = parts[1].strip() if len(parts) > 1 else text
    return {'subject': subject, 'body': body}


def draft_email(contact: dict, event: dict = None, sender: dict = None) -> dict:
    """Generate email. Uses AI to polish the template output if available."""
    sender = sender or {'name': os.getenv('YOUR_NAME',''), 'role': os.getenv('YOUR_ROLE','President')}
    event  = event or {}

    # Always generate a solid base using our own engine
    base = generate_email(contact, event, sender)

    if not USE_AI:
        return base

    # Try to polish with AI (optional — gracefully skip if unavailable)
    polish_prompt = f"""You are helping polish a cold outreach email for {sender.get('name')}, {sender.get('role')} of the Startup Incubator at UCSD.

Here is a draft email:

Subject: {base['subject']}
---
{base['body']}
---

Lightly polish this email to make it sound more natural and conversational.
- Keep it under 180 words
- Don't change the core message or structure
- Fix any awkward phrasing
- Keep the same sign-off

Reply in EXACTLY this format:
SUBJECT: <subject>
---
<body>
"""
    try:
        text = _try_ollama(polish_prompt)
        return _parse(text)
    except Exception:
        pass

    try:
        text = _try_gemini(polish_prompt)
        return _parse(text)
    except Exception:
        pass

    # Return unpolished base — still great
    return base


def redraft_email(contact: dict, feedback: str, current_body: str, sender: dict = None) -> dict:
    sender = sender or {'name': os.getenv('YOUR_NAME',''), 'role': os.getenv('YOUR_ROLE','President')}
    sender_name = sender.get('name', '')
    sender_role = sender.get('role', '')

    prompt = f"""Revise this cold outreach email based on the feedback.

Current email:
---
{current_body}
---

Feedback: "{feedback}"

Keep it under 180 words. No em-dashes. Conversational.
Sign off as: {sender_name}, {sender_role}, Startup Incubator at UCSD

Reply EXACTLY in this format:
SUBJECT: <subject>
---
<body>
"""
    try:
        text = _try_ollama(prompt)
        return _parse(text)
    except Exception:
        pass
    try:
        text = _try_gemini(prompt)
        return _parse(text)
    except Exception:
        pass

    # If no AI, re-generate from scratch
    return draft_email(contact, sender=sender)


def test_connection():
    result = {'ollama': False, 'gemini': False, 'template': True, 'active_backend': 'template'}
    try:
        r = requests.get('http://localhost:11434/api/tags', timeout=3)
        if r.ok:
            models = [m['name'] for m in r.json().get('models', [])]
            result['ollama'] = bool(models)
            result['ollama_models'] = models
    except Exception:
        pass

    if GEMINI_API_KEY:
        try:
            _try_gemini('Reply with one word: ok')
            result['gemini'] = True
        except Exception:
            pass

    if result['ollama']:
        result['active_backend'] = 'ollama'
    elif result['gemini']:
        result['active_backend'] = 'gemini'

    return result
