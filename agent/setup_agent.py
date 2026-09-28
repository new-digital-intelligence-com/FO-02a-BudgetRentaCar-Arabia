"""Creates (first run) or updates (later runs) the Budget Arabia voice agent on ElevenLabs.

- Adds Budget's public web pages to the knowledge base, with auto-sync every 7 days.
- Creates the agent with the prompt in prompt.md, the Saudi voice, Arabic by default and an English preset.
- Attaches the knowledge-base PDFs synced from Google Drive (found by name in the workspace library), and keeps
  anything else added to the agent in the dashboard.
- With the website's public address, adds Noura's webhook tools and prompt_memory.md: customer_lookup (the customer memory)
  and the demo booking tools (price quote, create, find, change, extend, early return, cancel). prompt.md's reservation
  section expects the booking tools, so run it with the site link (it is remembered after the first time).

Settings come from the Budget website's own ../web/.env.local (ELEVENLABS_API_KEY, AGENT_TOOL_SECRET); environment
variables win. Nothing is shared with any other project.

Usage: python setup_agent.py [https://your-site.vercel.app]   (the link is remembered; later runs can leave it out)
IDs and the site link are saved in agent_ids.json (no secrets in it). Creating or updating an agent does not use conversation credits.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IDS_FILE = os.path.join(HERE, "agent_ids.json")
WEB_ENV = os.path.join(HERE, "..", "web", ".env.local")
API = "https://api.elevenlabs.io"


def load_settings() -> dict[str, str]:
    settings: dict[str, str] = {}
    if os.path.exists(WEB_ENV):
        for line in open(WEB_ENV, encoding="utf-8"):
            name, sep, value = line.strip().partition("=")
            if sep and not name.startswith("#"):
                settings[name] = value.strip().strip('"')
    return {**settings, **{k: v for k, v in os.environ.items() if k in settings or k.startswith(("ELEVENLABS_", "AGENT_", "PUBLIC_"))}}


SETTINGS = load_settings()
KEY = SETTINGS.get("ELEVENLABS_API_KEY") or sys.exit("ELEVENLABS_API_KEY is not set (../web/.env.local)")
# The site ElevenLabs calls for Noura's tools: argument, PUBLIC_BASE_URL, or the link saved by an earlier run (so a run
# without the link keeps the tools). Empty until the website is deployed.
ARGS = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
SAVED_SITE = json.load(open(IDS_FILE, encoding="utf-8")).get("site_url", "") if os.path.exists(IDS_FILE) else ""
BASE_URL = (ARGS[0] if ARGS else SETTINGS.get("PUBLIC_BASE_URL") or SAVED_SITE).rstrip("/")
TOOL_SECRET_NAME = "budget_agent_tool_secret"  # Budget's own workspace secret, sent as x-budget-agent-secret

NAME = "Budget Arabia – Voice Assistant (Demo)"
# Eleven v3 Conversational, the expressive agents model, for both languages: tested and chosen by the user on 27 Sep 2026
# (Amal still sounds right, although she is a Professional Voice Clone, which ElevenLabs says v3 may not reproduce faithfully).
# The Flash models used before: TTS_MODEL = "eleven_flash_v2_5" (Amal is verified in Arabic for it), EN_TTS_MODEL = "eleven_flash_v2".
TTS_MODEL = "eleven_v3_conversational"
# With the Flash models, English must use an English "v2" model: with v2.5 ElevenLabs refuses the config ("English Agents must
# use turbo or flash v2"), and a call started in English never begins, so Noura stays silent (found 27 Sep 2026).
EN_TTS_MODEL = "eleven_v3_conversational"
LLM = "gemini-3.7-flash"
# "Budget" stays in English letters: the voice says it better than the Arabic spelling (user, 26 Sep 2026).
FIRST_MESSAGE_AR = "هلا وغلا، معك نورة من Budget لتأجير السيارات. كيف أقدر أخدمك اليوم؟"
FIRST_MESSAGE_EN = "Hello, this is Noura from Budget Rent a Car. How can I help you today?"

# Noura is a Saudi woman with one voice for every caller: "Amal – Rich & Sophisticated", Saudi with a Hijazi touch
# (chosen by the user on 26 Sep 2026, replacing per-country accent voices). She adapts her words to the caller's dialect.
# (voice_id, library owner id, voice library name)
VOICE = ("QtQamNJjpordEbNFIlz3", "64cbc624eb5aab4e95a968e1f41d75402277cca6e549036ed17e56ea33bbbc9e", "Amal – Rich & Sophisticated")
# Extra voices the agent can switch to with <Label>…</Label> (ElevenLabs multi-voice). Empty: one voice only.
ACCENT_VOICES: dict[str, tuple[str, str, str, str]] = {}

# Pages whose text is in the HTML (script-loaded pages come back empty). auto_remove: drop the document when the page
# disappears, so an ended offer is never promoted.
URLS = [
    ("Budget Saudi – Contact numbers", "https://www.budgetsaudi.com/en/contact-budget", False),
    ("Budget Saudi – Loyalty programme", "https://www.budgetsaudi.com/en/services/budget-saudi-loyalty-program", False),
    ("Budget Saudi – Quick Pass", "https://www.budgetsaudi.com/en/services/Quick-Pass--EN", False),
    ("Budget Saudi offer – Unlimited Miles", "https://www.budgetsaudi.com/en/promotions/Unlimited-Miles", True),
    ("Budget Saudi offer – AlUla Visitors", "https://www.budgetsaudi.com/en/promotions/AlUla-Visitors-EN", True),
    ("Budget Saudi offer – Royal Commission for AlUla", "https://www.budgetsaudi.com/en/promotions/RCU-EMP---Contractors--EN-", True),
    ("Budget Saudi – Car with Driver terms", "https://www.budgetsaudi.com/en/promotions/CarwithDriver---EN", True),
    ("Budget Saudi offer – Explore the UAE", "https://www.budgetsaudi.com/en/promotions/Budget-UAE-2024--EN", True),
    ("Budget UAE – Contact", "https://www.budget-uae.com/en/contact-us", False),
    ("Budget UAE – Locations", "https://www.budget-uae.com/en/our-locations", False),
]


def call(method: str, path: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {path} -> {error.code}: {error.read().decode(errors='replace')[:1500]}")


def load_ids() -> dict:
    return json.load(open(IDS_FILE, encoding="utf-8")) if os.path.exists(IDS_FILE) else {"url_documents": {}}


def save_ids(ids: dict) -> None:
    with open(IDS_FILE, "w", encoding="utf-8") as file:
        json.dump(ids, file, ensure_ascii=False, indent=2)


def url_documents(ids: dict) -> list[dict]:
    locators = []
    for name, url, auto_remove in URLS:
        doc_id = ids["url_documents"].get(url)
        if not doc_id:
            created = call("POST", "/v1/convai/knowledge-base/url", {
                "url": url, "name": name, "enable_auto_sync": True, "auto_remove": auto_remove, "minimum_frequency_days": 7,
            })
            doc_id = created["id"]
            ids["url_documents"][url] = doc_id
            save_ids(ids)
            print("added web page:", name, doc_id)
        locators.append({"type": "url", "name": name, "id": doc_id, "usage_mode": "auto"})
    return locators


def ensure_voices() -> None:
    """A voice from the public library must be in the account before an agent can use it."""
    mine = {v["voice_id"] for v in call("GET", "/v1/voices").get("voices", [])}
    for voice_id, owner_id, name, *_ in [VOICE, *ACCENT_VOICES.values()]:
        if voice_id not in mine:
            call("POST", f"/v1/voices/add/{owner_id}/{voice_id}", {"new_name": f"Budget – {name}"})
            print("added voice:", name)


def library_pdfs() -> list[dict]:
    """The knowledge-base PDFs synced from Google Drive (01_Budget_… to 06_Budget_…), found by name in the workspace library."""
    documents, cursor = [], None
    while True:  # the search parameter only matches the start of a name, so read the whole library
        page = call("GET", "/v1/convai/knowledge-base?page_size=100" + (f"&cursor={urllib.parse.quote(cursor)}" if cursor else ""))
        documents += page.get("documents", [])
        cursor = page.get("next_cursor")
        if not page.get("has_more") or not cursor:
            break
    newest: dict[str, dict] = {}
    for doc in documents:
        name = doc.get("name") or ""
        if re.fullmatch(r"0\d_Budget_.+\.pdf", name):
            created = (doc.get("metadata") or {}).get("created_at_unix_secs", 0)
            if name not in newest or created > newest[name]["created"]:
                newest[name] = {"id": doc["id"], "created": created}
    return [{"type": "file", "name": name, "id": d["id"], "usage_mode": "auto"} for name, d in sorted(newest.items())]


def tool_secret_id(ids: dict) -> str:
    """Stores AGENT_TOOL_SECRET in ElevenLabs once, under Budget's own name, so the tool can send it without showing it."""
    value = SETTINGS.get("AGENT_TOOL_SECRET") or sys.exit("AGENT_TOOL_SECRET is not set (../web/.env.local)")
    if ids.get("tool_secret_id"):
        return ids["tool_secret_id"]
    listed = call("GET", "/v1/convai/secrets").get("secrets", [])
    existing = next((x for x in listed if x.get("name") == TOOL_SECRET_NAME), None)
    secret_id = existing["secret_id"] if existing else call(
        "POST", "/v1/convai/secrets", {"type": "new", "name": TOOL_SECRET_NAME, "value": value})["secret_id"]
    ids["tool_secret_id"] = secret_id
    save_ids(ids)
    print("tool secret:", TOOL_SECRET_NAME, secret_id)
    return secret_id


def text_param(description: str) -> dict:
    return {"type": "string", "description": description}


# The same arguments in several booking tools. Dates and times are the branch's local ones.
BRANCH = ("The {which} branch: its location code if you know it (e.g. JED), otherwise its name in English as the caller described "
          "it (e.g. 'Jeddah airport', 'Tahlia Street').")
CITY = "The {which} city, in English (e.g. Jeddah)."
DATE = "The {which} date, YYYY-MM-DD."
TIME = "The {which} time, HH:MM in 24-hour time."
CAR_TYPE = {"type": "string", "enum": ["economy", "compact", "family_sedan", "suv", "van", "luxury"],
            "description": "The car type the caller chose."}
RESERVATION = text_param("The 6-digit reservation number, digits only.")
NAME_ON_BOOKING = text_param("The name on the booking, in English letters. Not needed for the caller's own bookings from "
                             "customer_lookup.")


def trip_params(optional_car: bool) -> dict:
    return {
        "pickup_branch": text_param(BRANCH.format(which="pick-up")),
        "pickup_city": text_param(CITY.format(which="pick-up")),
        "pickup_date": text_param(DATE.format(which="pick-up")),
        "pickup_time": text_param(TIME.format(which="pick-up")),
        "return_date": text_param(DATE.format(which="return")),
        "return_time": text_param(TIME.format(which="return") + " Leave empty for the same time as the pick-up."),
        "return_branch": text_param("Only when the car is returned to another branch: " + BRANCH.format(which="return")),
        "return_city": text_param("Only when the car is returned in another city: " + CITY.format(which="return")),
        "car_type": {**CAR_TYPE, "description": "The car type. Leave empty to get the price of every type."} if optional_car else CAR_TYPE,
    }


# name -> (path on the website, description, extra arguments, required arguments). Every tool also gets conversation_id.
TOOLS: dict[str, tuple[str, str, dict, list[str]]] = {
    "customer_lookup": (
        "/api/agent/customer-lookup",
        "Recognise the caller. Call this once, silently, right after your greeting. It returns found=false for someone new, or the "
        "customer's name, their upcoming bookings and short summaries of their earlier calls with you. Never mention this tool.",
        {}, [],
    ),
    "get_price_quote": (
        "/api/agent/bookings/quote",
        "The demo price of a rental. Use it before every new booking, and whenever the caller asks what a rental costs. Without a "
        "car type it gives the price of every type. It also checks the branch and its opening hours.",
        trip_params(optional_car=True), ["pickup_branch", "pickup_date", "pickup_time", "return_date"],
    ),
    "create_booking": (
        "/api/agent/bookings/create",
        "Make a demo reservation. Only after the caller has heard the price and clearly confirmed every detail. Call it once. It "
        "returns the reservation number.",
        {**trip_params(optional_car=False), "driver_name": text_param("The driver's full name, in English letters.")},
        ["pickup_branch", "pickup_date", "pickup_time", "return_date", "car_type", "driver_name"],
    ),
    "find_booking": (
        "/api/agent/bookings/find",
        "Look up an existing reservation and what can still be done with it. Without a reservation number it lists a known "
        "customer's own upcoming bookings.",
        {"reservation_number": RESERVATION, "driver_name": NAME_ON_BOOKING}, [],
    ),
    "change_booking": (
        "/api/agent/bookings/change",
        "Change a reservation that has not started: pick-up or return date, time or branch, or the car type. Give only what "
        "changes. If only the pick-up moves, the rental keeps its length; give return_date to set the return yourself. Only after "
        "the caller confirmed the change.",
        {"reservation_number": RESERVATION, "driver_name": NAME_ON_BOOKING, **trip_params(optional_car=True),
         "return_time": text_param(TIME.format(which="new return") + " Only if it changes."),
         "car_type": {**CAR_TYPE, "description": "The new car type, only if it changes."}},
        ["reservation_number"],
    ),
    "extend_rental": (
        "/api/agent/bookings/extend",
        "Keep the car longer: moves the return to a later date and time, before or during the rental. Only after the caller "
        "confirmed.",
        {"reservation_number": RESERVATION, "driver_name": NAME_ON_BOOKING,
         "new_return_date": text_param(DATE.format(which="new return")),
         "new_return_time": text_param(TIME.format(which="new return") + " Leave empty to keep the agreed time.")},
        ["reservation_number", "new_return_date"],
    ),
    "early_return": (
        "/api/agent/bookings/early-return",
        "The caller brings the car back before the agreed time of a rental that has already started. The price is recalculated on "
        "the days used. Only after the caller confirmed.",
        {"reservation_number": RESERVATION, "driver_name": NAME_ON_BOOKING,
         "return_date": text_param(DATE.format(which="return") + " Leave empty for today."),
         "return_time": text_param(TIME.format(which="return") + " Leave empty for now.")},
        ["reservation_number"],
    ),
    "cancel_booking": (
        "/api/agent/bookings/cancel",
        "Cancel a reservation that has not started. It is free. Only after the caller confirmed they want to cancel.",
        {"reservation_number": RESERVATION, "driver_name": NAME_ON_BOOKING},
        ["reservation_number"],
    ),
}


def webhook_tool_config(name: str, secret_id: str) -> dict:
    path, description, params, required = TOOLS[name]
    return {
        "type": "webhook",
        "name": name,
        "description": description,
        "response_timeout_secs": 10 if name == "customer_lookup" else 20,
        "api_schema": {
            "url": f"{BASE_URL}{path}",
            "method": "POST",
            "request_headers": {"x-budget-agent-secret": {"secret_id": secret_id}},
            "request_body_schema": {
                "type": "object",
                "description": "The current conversation and the tool's details.",
                "properties": {
                    # ElevenLabs fills it in; the API refuses a description next to a dynamic_variable
                    "conversation_id": {"type": "string", "dynamic_variable": "system__conversation_id"},
                    **params,
                },
                "required": required,
            },
        },
    }


def tool_ids(ids: dict) -> list[str]:
    """Creates or updates Noura's webhook tools on the deployed website. None before it is deployed."""
    if not BASE_URL:
        return []
    if ids.get("site_url") != BASE_URL:
        ids["site_url"] = BASE_URL
        save_ids(ids)
    secret_id = tool_secret_id(ids)
    tools = ids.setdefault("tools", {})
    for name in TOOLS:
        config = webhook_tool_config(name, secret_id)
        if tools.get(name):
            call("PATCH", f"/v1/convai/tools/{tools[name]}", {"tool_config": config})
        else:
            tools[name] = call("POST", "/v1/convai/tools", {"tool_config": config})["id"]
            save_ids(ids)
            print("created tool:", name, tools[name])
    return [tools[name] for name in TOOLS]


def conversation_config(knowledge_base: list[dict], tools: list[str]) -> dict:
    prompt = open(os.path.join(HERE, "prompt.md"), encoding="utf-8").read()
    if tools:
        prompt += open(os.path.join(HERE, "prompt_memory.md"), encoding="utf-8").read()
    return {
        "agent": {
            "first_message": FIRST_MESSAGE_AR,
            "language": "ar",
            "prompt": {
                "prompt": prompt,
                "llm": LLM,
                "temperature": 0.2,
                "timezone": "Asia/Riyadh",
                "ignore_default_personality": True,
                "knowledge_base": knowledge_base,
                "tool_ids": tools,
                "rag": {"enabled": True, "embedding_model": "multilingual_e5_large_instruct", "max_vector_distance": 0.6,
                        "max_documents_length": 50000, "max_retrieved_rag_chunks_count": 20},
                "built_in_tools": {
                    "end_call": {"type": "system", "name": "end_call", "description": "", "params": {"system_tool_type": "end_call"}},
                    "language_detection": {"type": "system", "name": "language_detection", "description": "",
                                           "params": {"system_tool_type": "language_detection", "only_at_conversation_start": False}},
                },
            },
        },
        "tts": {"model_id": TTS_MODEL, "voice_id": VOICE[0], "stability": 0.5, "similarity_boost": 0.8, "speed": 1.0,
                # v3 Conversational's expressive delivery; the dashboard switches it on with the model, the API does not
                "expressive_mode": TTS_MODEL == "eleven_v3_conversational",
                # Numbers are normalised for speech by ElevenLabs after the LLM, so Noura writes digits and the transcript
                # shows 920004124, not number words ("system_prompt", the default, makes the LLM write words).
                "text_normalisation_type": "elevenlabs",
                "agent_output_audio_format": "pcm_24000", "optimize_streaming_latency": 3,
                "supported_voices": [{"label": label, "voice_id": voice_id, "description": description}
                                     for label, (voice_id, _owner, _name, description) in ACCENT_VOICES.items()]},
        "asr": {"quality": "high", "provider": "scribe_realtime", "user_input_audio_format": "pcm_16000"},
        "turn": {"turn_timeout": 7, "mode": "turn", "turn_eagerness": "normal"},
        "conversation": {"max_duration_seconds": 600},
        "language_presets": {
            "en": {"overrides": {"agent": {"first_message": FIRST_MESSAGE_EN, "language": "en"}, "tts": {"model_id": EN_TTS_MODEL}}},
        },
    }


PLATFORM_SETTINGS = {
    # the website may pass the caller's language and first message; nothing else can be changed from outside
    "overrides": {"conversation_config_override": {"agent": {"first_message": True, "language": True}}},
}


def main() -> None:
    ids = load_ids()
    if ids.get("agent_id") and "--force" not in sys.argv:
        # Someone may be editing the agent in the dashboard: never overwrite an unpublished draft. Checked before anything
        # changes, tools included.
        branches = call("GET", f"/v1/convai/agents/{ids['agent_id']}/branches").get("results", [])
        if any(branch.get("draft_exists") for branch in branches):
            sys.exit("The agent has an unpublished draft in the dashboard: publish or discard it first (or run with --force).")
    ensure_voices()
    tools = tool_ids(ids)
    web_docs = url_documents(ids) + library_pdfs()
    print("knowledge documents:", ", ".join(d["name"] for d in web_docs))
    if not ids.get("agent_id"):
        created = call("POST", "/v1/convai/agents/create", {
            "name": NAME, "tags": ["budget", "demo", "ndi"],
            "conversation_config": conversation_config(web_docs, tools), "platform_settings": PLATFORM_SETTINGS,
        })
        ids["agent_id"] = created["agent_id"]
        save_ids(ids)
        print("created agent:", ids["agent_id"])
    else:
        current = call("GET", f"/v1/convai/agents/{ids['agent_id']}")
        ours = {d["id"] for d in web_docs} | {d["name"] for d in web_docs}
        kept = [d for d in current["conversation_config"]["agent"]["prompt"].get("knowledge_base", [])
                if d["id"] not in ours and d["name"] not in ours]  # drops an older copy of one of our PDFs
        call("PATCH", f"/v1/convai/agents/{ids['agent_id']}", {
            "name": NAME, "conversation_config": conversation_config(web_docs + kept, tools), "platform_settings": PLATFORM_SETTINGS,
        })
        print("updated agent:", ids["agent_id"], f"(kept {len(kept)} other knowledge documents)")

    agent = call("GET", f"/v1/convai/agents/{ids['agent_id']}")
    config = agent["conversation_config"]
    print("check -> language:", config["agent"]["language"], "| voice:", config["tts"]["voice_id"], "| tts:", config["tts"]["model_id"],
          "| accent voices:", [v["label"] for v in config["tts"].get("supported_voices") or []],
          "| llm:", config["agent"]["prompt"]["llm"], "| knowledge docs:", len(config["agent"]["prompt"]["knowledge_base"]),
          "| rag:", config["agent"]["prompt"]["rag"]["enabled"],
          "| tools:", [k for k, v in (config["agent"]["prompt"].get("built_in_tools") or {}).items() if v],
          "| webhook tools:", config["agent"]["prompt"].get("tool_ids") or "none (no website address yet)")


if __name__ == "__main__":
    main()
