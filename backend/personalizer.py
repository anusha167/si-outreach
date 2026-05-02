"""
SI UCSD Personalization Engine — no AI, no API.

Generates varied, natural cold emails using smart templates.
Edit the VARIATIONS dicts below to customize the language.
"""
import random
import re
import os

CLUB_NAME    = os.getenv('CLUB_NAME',    'Startup Incubator at UCSD')
CLUB_WEBSITE = os.getenv('CLUB_WEBSITE', 'startupincubatorsd.com')

# Template variations — edit these to change the language

SPONSOR_OPENERS = [
    "I came across {company} while researching companies doing interesting work in {industry}, and was genuinely impressed by what you're building.",
    "I've been following {company}'s work in {industry} and it really stood out to me. You're solving a problem a lot of founders at UCSD are thinking about.",
    "Your work at {company} caught my attention — the way you're approaching {industry} is exactly the kind of thinking our community gets excited about.",
    "I stumbled across {company} recently and spent a good chunk of time on your website — what you're building in {industry} is really compelling.",
]

SPONSOR_OPENERS_NO_INDUSTRY = [
    "I came across {company} recently and was really impressed by what you're building.",
    "I've been researching companies to reach out to and {company} immediately stood out.",
    "Your work at {company} caught my attention — it's exactly the kind of company our community gets excited about.",
    "I came across {company} and spent some time looking into what you're doing — I think there's a natural fit here.",
]

SPEAKER_OPENERS = [
    "I came across your profile and your journey at {company} in the {industry} space is exactly the kind of story our members would learn a ton from.",
    "I've been researching speakers for our upcoming event and your work at {company} immediately came to mind.",
    "Your background building {company} in {industry} is something I think would resonate deeply with our community of student founders.",
    "I came across your work at {company} and thought — this is exactly the kind of perspective our members need to hear.",
]

SPEAKER_OPENERS_NO_INDUSTRY = [
    "I came across your profile and your journey at {company} is exactly the kind of story our members would learn a ton from.",
    "I've been researching speakers for our upcoming event and your name came up immediately.",
    "Your background building {company} is something I think would resonate deeply with our community.",
    "I came across your work and thought — this is exactly the perspective our members need to hear.",
]

DESC_OPENERS = [
    "I came across {company} — {desc_short} — and it immediately stood out to me as something our community would genuinely care about.",
    "I was researching companies in this space and {company}'s work — {desc_short} — really caught my attention.",
    "{company}'s focus on {desc_short} is something that resonates a lot with the founders we work with at UCSD.",
]

CLUB_INTROS = [
    "{club} is a student entrepreneurship club at UC San Diego. We run pitch competitions, founder workshops, and speaker events — and our members are some of the most driven early-stage builders on campus.",
    "{club} brings together the most ambitious student founders at UC San Diego through pitch competitions, workshops, and real-world mentorship opportunities.",
    "We run {club} at UC San Diego — a community of ~200 student founders and builders who are actively working on startups, not just studying them.",
    "{club} is UCSD's most active student startup community. We run events that connect students directly with founders, operators, and investors.",
]

SPONSOR_ASKS_WITH_EVENT = [
    "We're putting together {event_name} and are looking for a sponsor who'd be excited to get in front of {audience}. Would {company} be open to exploring what that could look like?",
    "For {event_name}, we're looking for a sponsor to help us bring this to life — and in exchange, {company} would get direct exposure to {audience}.",
    "We're hosting {event_name} and think {company} would be a great fit as a sponsor. It's a real opportunity to connect with {audience} who are actively building.",
]

SPONSOR_ASKS_NO_EVENT = [
    "We're putting together our next event and are looking for a company that'd be excited to get in front of ~100+ motivated UCSD student founders. Would {company} be open to exploring sponsorship?",
    "We'd love to have {company} as a sponsor for one of our upcoming events — it's a genuine way to get in front of the next generation of founders at UCSD.",
    "We're looking for sponsors who want to connect with driven student builders, and {company} immediately came to mind. Would you be open to a conversation?",
]

SPEAKER_ASKS_WITH_EVENT = [
    "For {event_name}, we're looking for a speaker who can share real experience building in this space — and I think your journey at {company} would be exactly what our members need to hear.",
    "We're hosting {event_name} and would love to have you as a speaker. Our members would get a lot of value from hearing how you built {company}.",
    "We're putting together the speaker lineup for {event_name} and your story at {company} immediately came to mind. Would you be open to joining us?",
]

SPEAKER_ASKS_NO_EVENT = [
    "We'd love to have you speak at one of our upcoming events. Our members are building real companies and your experience at {company} is exactly the kind of insight they'd value.",
    "We're always looking for founders and operators who can share real stories — would you be open to speaking at one of our upcoming events?",
    "Your journey at {company} is exactly what our members need to hear. Would you be open to speaking at one of our upcoming events?",
]

CTAS = [
    "Would you be open to a quick 15-minute call this week to explore what this could look like?",
    "Happy to jump on a quick call whenever works for you — even 15 minutes would be great.",
    "Would love to find 15 minutes to chat — completely flexible on timing.",
    "A quick 15-minute call would be ideal if you're open to it — I can work around your schedule.",
]

SUBJECTS_SPONSOR = [
    "Sponsoring {event_name} @ UCSD — quick question",
    "{company} + {club} — sponsorship opportunity",
    "Quick question about {event_name}",
    "Sponsorship: {event_name} at {club}",
]

SUBJECTS_SPONSOR_NO_EVENT = [
    "{company} + {club} — sponsorship opportunity",
    "Quick question for {company}",
    "Connecting {company} with UCSD founders",
    "Sponsorship opportunity — {club} @ UCSD",
]

SUBJECTS_SPEAKER = [
    "Speaking at {event_name} — would love to have you",
    "Speaker invite: {event_name} @ {club}",
    "Quick ask — would you speak at {event_name}?",
]

SUBJECTS_SPEAKER_NO_EVENT = [
    "Would love to have you speak at {club}",
    "Speaker invite — {club} at UCSD",
    "Quick ask: speaking opportunity at {club}",
]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def _pick(lst):
    return random.choice(lst)


def _short_desc(desc):
    if not desc:
        return ''
    s = re.split(r'(?<=[.!?])\s', desc.strip())[0]
    if len(s) > 80:
        s = s[:77] + '...'
    return s.lower().rstrip('.')


def _is_founder(title):
    t = (title or '').lower()
    return any(w in t for w in ['founder', 'ceo', 'co-founder', 'owner', 'president', 'cto', 'coo'])


def generate_email(contact: dict, event: dict, sender: dict) -> dict:
    """
    Generate a personalized cold email.
    contact: {name, company, title, industry, description, website, linkedin_url}
    event:   {name, date, description, what_we_need}  — can be None
    sender:  {name, role}
    """
    name     = contact.get('name', 'there').split()[0]
    company  = contact.get('company', 'your company')
    title    = contact.get('title', '')
    industry = contact.get('industry', '')
    desc     = contact.get('description', '')
    desc_short = _short_desc(desc)

    sender_name = sender.get('name', os.getenv('YOUR_NAME', ''))
    sender_role = sender.get('role', os.getenv('YOUR_ROLE', 'President'))

    event_name   = event.get('name', '')     if event else ''
    what_we_need = (event.get('what_we_need', '') if event else '').lower()

    want_speaker = any(w in what_we_need for w in ['speak', 'speaker', 'talk', 'present'])
    want_sponsor = any(w in what_we_need for w in ['sponsor', 'fund', 'partner', 'money', 'budget'])
    if not want_speaker and not want_sponsor:
        want_sponsor = not _is_founder(title)  # default: sponsors for non-founders, speakers for founders
        want_speaker = _is_founder(title)

    audience = 'our 200+ UCSD student founders'

    # 1. Opener
    if desc_short:
        opener = _pick(DESC_OPENERS).format(company=company, desc_short=desc_short)
    elif want_speaker:
        if industry:
            opener = _pick(SPEAKER_OPENERS).format(company=company, industry=industry)
        else:
            opener = _pick(SPEAKER_OPENERS_NO_INDUSTRY).format(company=company)
    else:
        if industry:
            opener = _pick(SPONSOR_OPENERS).format(company=company, industry=industry)
        else:
            opener = _pick(SPONSOR_OPENERS_NO_INDUSTRY).format(company=company)

    # 2. Club intro
    club_intro = _pick(CLUB_INTROS).format(club=CLUB_NAME)

    # 3. Ask
    if want_speaker:
        if event_name:
            ask = _pick(SPEAKER_ASKS_WITH_EVENT).format(event_name=event_name, company=company)
        else:
            ask = _pick(SPEAKER_ASKS_NO_EVENT).format(company=company)
    else:
        if event_name:
            ask = _pick(SPONSOR_ASKS_WITH_EVENT).format(event_name=event_name, company=company, audience=audience)
        else:
            ask = _pick(SPONSOR_ASKS_NO_EVENT).format(company=company)

    # 4. CTA
    cta = _pick(CTAS)

    # 5. Subject
    if want_speaker:
        if event_name:
            subject = _pick(SUBJECTS_SPEAKER).format(event_name=event_name, club=CLUB_NAME, company=company)
        else:
            subject = _pick(SUBJECTS_SPEAKER_NO_EVENT).format(club=CLUB_NAME, company=company)
    else:
        if event_name:
            subject = _pick(SUBJECTS_SPONSOR).format(event_name=event_name, club=CLUB_NAME, company=company)
        else:
            subject = _pick(SUBJECTS_SPONSOR_NO_EVENT).format(club=CLUB_NAME, company=company)

    body = f"""Hi {name},

{opener}

{club_intro}

{ask}

{cta}

Best,
{sender_name}
{sender_role}, {CLUB_NAME}"""

    return {'subject': subject, 'body': body}
