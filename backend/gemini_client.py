
import os,time,json
from dotenv import load_dotenv
from groq import Groq
load_dotenv()
GEMINI_API_KEY=os.getenv("GROQ_API_KEY","")
GEMINI_MODEL=os.getenv("GROQ_MODEL","llama-3.3-70b-versatile")
GEMINI_URL="groq://local"
client=Groq(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
_last_status={"attempted":False,"ok":None,"error":None,"http_status":None,"when":None}
def get_diagnostics(): return dict(_last_status)
def _build_prompt(ctx): return f"Context:\n{json.dumps(ctx,indent=2)}"
def synthesize_with_gemini(context):
    if not client: return None,False
    try:
        r=client.chat.completions.create(model=GEMINI_MODEL,messages=[{"role":"system","content":"Use only supplied context."},{"role":"user","content":_build_prompt(context)}],temperature=0.2,max_tokens=600)
        _last_status.update(attempted=True,ok=True,error=None,http_status=200,when=time.time())
        return r.choices[0].message.content,True
    except Exception as e:
        _last_status.update(attempted=True,ok=False,error=str(e),http_status=None,when=time.time())
        return None,False
def synthesize_rule_based(context):
    return "Rule-based fallback."
