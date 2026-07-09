
# PATCH ONLY
from . import chatbot as _orig
from groq import Groq
import os
from dotenv import load_dotenv
load_dotenv()
from .gemini_client import GEMINI_API_KEY,GEMINI_MODEL
client=Groq(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
def _groq(query,ctx):
    if not client: return None,False
    prompt=_orig._build_gemini_prompt(query,ctx)
    try:
        r=client.chat.completions.create(model=GEMINI_MODEL,messages=[{"role":"system","content":"Answer only from context."},{"role":"user","content":prompt}],temperature=0.3,max_tokens=300)
        return r.choices[0].message.content,True
    except Exception:
        return None,False
print("Use _groq() logic to replace _synthesize_with_gemini_chat in your chatbot.py")
