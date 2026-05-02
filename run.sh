#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
echo ""
echo "  Starting SI Outreach Tool..."
echo "  Open http://localhost:5000"
echo ""
cd backend && python app.py
