# Setup Guide — SI Outreach Tool

## Step 1: Install Python dependencies

```bash
cd "Email Automator"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Step 2: Get your free Gemini API key

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the key

## Step 3: Set up Gmail API (one-time)

1. Go to https://console.cloud.google.com
2. Create a new project (name it anything, e.g. "SI Outreach")
3. Search for "Gmail API" → Enable it
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: **Desktop app**
6. Download the JSON → rename it to `credentials.json`
7. Move it into the `credentials/` folder

## Step 4: Configure your .env

```bash
cp .env.example .env
```

Edit `.env` with your details:
```
GEMINI_API_KEY=your_key_here
SENDER_EMAIL=youremail@gmail.com
CLUB_NAME=Startup Incubator at UCSD
CLUB_WEBSITE=https://yoursite.com
YOUR_NAME=Anusha Shinde
YOUR_ROLE=President
```

## Step 5: Run the app

```bash
source venv/bin/activate
cd backend
python app.py
```

Open http://localhost:5000 in your browser.

The first time you click "Send Email", a browser window will pop up asking you
to authorize Gmail. Sign in once and it saves the token — you won't be asked again.

---

## Email limits (free)

| Service | Free limit |
|---|---|
| Gmail personal | 500 emails/day |
| Gemini 2.0 Flash | 1,500 AI drafts/day |

## Workflow

1. **Import tab** — upload a CSV, fetch YC companies, or search LinkedIn via Google
2. **Generate All Drafts** button — AI drafts every un-emailed contact
3. **Approval Queue** — review each email, edit the subject/body, click Send
4. The system tracks every sent email — it will never show the same contact twice
