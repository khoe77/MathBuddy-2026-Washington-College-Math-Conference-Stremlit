import streamlit as st
import google.generativeai as genai
import re

# ==========================================
# PAGE CONFIG
# ==========================================
st.set_page_config(
    page_title="MathBuddy — Columbia Basin College",
    page_icon="∑",
    layout="centered"
)

# ==========================================
# SYSTEM PROMPT
# ==========================================
SYSTEM_PROMPT = """
You are MathBuddy, a friendly Socratic math tutor for college-level
mathematics students at Columbia Basin College. Your purpose is not to
solve problems for students — it is to help students discover solutions
themselves through guided questioning.

RULE 1 — Never give the answer directly.
Do not solve the problem. Ask a question that helps the student identify
the first thing they need to figure out. If stuck, ask a simpler version
or ask them to describe what they already know.

RULE 2 — Diagnose before you teach.
Your first response to any new problem should be a diagnostic question —
ask what the student notices, knows, or thinks the first step might be.

RULE 3 — Handle errors without judgment.
When a student makes a mistake, never say "incorrect" or "wrong." Ask a
question that guides them to notice the error themselves.

RULE 4 — Ask one question at a time.
Never ask more than one question per response.

RULE 5 — Name what the student got right.
Before redirecting an error, acknowledge what the student understood correctly.

RULE 6 — Use the student's own language.
Work within their language first, then gently introduce the precise term
once they have the concept.

RULE 7 — Never skip steps to save time.
Each step the student works through themselves is a step they will remember.

LIVING UNDERSTANDING MAP:
When a student reaches the correct final answer, generate this block:

LIVING_UNDERSTANDING_MAP_START
TOPIC: [topic name]
UNDERSTOOD: [specific item] | [specific item] | [specific item]
GAP: [specific item] | [specific item]
NEXT: [specific actionable item] | [specific actionable item]
LIVING_UNDERSTANDING_MAP_END

[One warm closing sentence.]

Every item must be specific to what this student actually said or did.
If no gaps occurred, write: "No significant gaps identified."

TONE: Warm, patient, encouraging. Never say "Great question!" or "Excellent!"
Keep responses to 2-4 sentences plus one question. Brief is always better.

NEVER:
- Solve the problem directly, even if asked repeatedly
- Say "wrong" or "incorrect"
- Ask more than one question per response
- Produce the Living Understanding Map before the correct final answer
- Give generic feedback not grounded in this student's actual responses
"""

# ==========================================
# GEMINI SETUP
# ==========================================
# Ensure secrets are loaded correctly (Streamlit Cloud handles this via the Secrets panel)
if "GEMINI_API_KEY" in st.secrets:
    genai.configure(api_key=st.secrets["GEMINI_API_KEY"])
else:
    st.error("Missing GEMINI_API_KEY in secrets. Please configure it in .streamlit/secrets.toml or Streamlit Cloud Secrets.")

# Initialize session state for messages and chat
if "messages" not in st.session_state:
    st.session_state.messages = []

if "chat" not in st.session_state:
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT
    )
    st.session_state.chat = model.start_chat(history=[])

# ==========================================
# VISUAL DESIGN (CBC COLORS & FONTS)
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@400;500;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'Source Sans 3', sans-serif;
        background-color: #F8F7F4;
        color: #0D1B35;
    }

    /* Header Styling */
    .cbc-header {
        background-color: #002F6C;
        border-bottom: 3px solid #B8973B;
        padding: 1.5rem 4rem;
        margin: -5rem -10rem 3rem -10rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .logo-badge {
        background-color: #B8973B;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Playfair Display', serif;
        font-weight: 800;
        color: #002F6C;
        font-size: 24px;
    }

    .logo-text-container {
        display: flex;
        flex-direction: column;
    }

    .logo-text {
        font-family: 'Playfair Display', serif;
        font-weight: 700;
        font-size: 24px;
        color: #FFFFFF;
        line-height: 1;
    }

    .logo-subtitle {
        color: #D4AF50;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
        margin-top: 2px;
    }

    /* Message Bubbles */
    .chat-container {
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
        margin-bottom: 3rem;
    }

    .bubble {
        padding: 12px 16px;
        max-width: 80%;
        margin-top: 1rem;
        margin-bottom: 1rem;
    }

    .student-bubble {
        background-color: #002F6C;
        color: #FFFFFF;
        border-radius: 12px 12px 3px 12px;
        align-self: flex-end;
        margin-left: 4rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .mathbuddy-bubble {
        background-color: #FFFFFF;
        color: #0D1B35;
        border: 1px solid #DDE3EE;
        border-left: 3px solid #B8973B;
        border-radius: 12px 12px 12px 3px;
        align-self: flex-start;
        margin-right: 4rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    /* Learning Map Styling */
    .map-card {
        background-color: #FFFFFF;
        border: 1px solid #DDE3EE;
        border-radius: 12px;
        overflow: hidden;
        margin: 1.5rem 0;
        box-shadow: 0 4px 20px rgba(0,47,108,0.08);
    }

    .map-header {
        background-color: #002F6C;
        border-bottom: 3px solid #B8973B;
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .map-icon {
        background-color: #B8973B;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #002F6C;
        font-size: 16px;
    }

    .map-title-container {
        display: flex;
        flex-direction: column;
    }

    .map-title {
        font-family: 'Playfair Display', serif;
        font-weight: 700;
        color: #FFFFFF;
        font-size: 18px;
        line-height: 1.2;
    }

    .map-topic {
        color: #D4AF50;
        font-size: 12px;
        font-weight: 600;
    }

    .map-section {
        padding: 1rem;
        border-bottom: 1px solid #DDE3EE;
    }

    .map-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
        letter-spacing: 0.05em;
    }

    .section-understood { background-color: #E8F5EF; }
    .label-understood { color: #1A6B45; }
    
    .section-gap { background-color: #FBF3E0; }
    .label-gap { color: #8B5E00; }
    
    .section-next { background-color: #E8EEF8; }
    .label-next { color: #1A3F7A; }

    .map-item {
        font-size: 14px;
        color: #4A5568;
        margin: 0.25rem 0;
        display: flex;
        gap: 0.5rem;
    }

    .map-footer {
        padding: 0.75rem 1rem;
        font-style: italic;
        font-size: 14px;
        color: #4A5568;
    }

    /* Welcome Screen */
    .welcome-container {
        text-align: center;
        padding: 3rem 1rem;
    }

    .welcome-icon {
        background-color: #002F6C;
        width: 76px;
        height: 76px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #B8973B;
        font-size: 32px;
        margin-bottom: 1.5rem;
        box-shadow: 0 0 20px rgba(184, 151, 59, 0.3);
        border: 2px solid #B8973B;
    }

    .welcome-heading {
        font-family: 'Playfair Display', serif;
        font-weight: 700;
        color: #002F6C;
        font-size: 32px;
        margin-bottom: 0.5rem;
    }

    .welcome-subtext {
        color: #4A5568;
        font-size: 16px;
        max-width: 500px;
        margin: 0 auto 2rem auto;
        line-height: 1.5;
    }

    /* Footer */
    .footer {
        text-align: center;
        padding: 2rem 0;
        margin-top: 3rem;
        border-top: 1px solid #DDE3EE;
        color: #8A96A8;
        font-size: 11px;
    }

    /* Hide Streamlit elements */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    .stDeployButton { display: none; }
</style>
""", unsafe_allow_html=True)

# ==========================================
# PARSING LOGIC
# ==========================================
def parse_map(text):
    s = text.find("LIVING_UNDERSTANDING_MAP_START")
    e = text.find("LIVING_UNDERSTANDING_MAP_END")
    if s == -1 or e == -1:
        return None, text
    block = text[s + len("LIVING_UNDERSTANDING_MAP_START"):e].strip()
    result = {}
    for line in block.splitlines():
        line = line.strip()
        if ":" in line:
            parts = line.split(":", 1)
            k = parts[0].strip()
            v = parts[1].strip()
            result[k] = v
    closing = text[e + len("LIVING_UNDERSTANDING_MAP_END"):].strip()
    result["closing"] = closing
    before = text[:s].strip()
    return result, before

# ==========================================
# HEADER
# ==========================================
st.markdown("""
<div class="cbc-header">
    <div class="logo-badge">M</div>
    <div class="logo-text-container">
        <div class="logo-text">MathBuddy</div>
        <div class="logo-subtitle">Columbia Basin College</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ==========================================
# CONVERSATION RENDERER
# ==========================================
def render_messages():
    for msg in st.session_state.messages:
        if msg["type"] == "text":
            role_class = "student-bubble" if msg["role"] == "student" else "mathbuddy-bubble"
            st.markdown(f'<div class="bubble {role_class}">{msg["content"]}</div>', unsafe_allow_html=True)
        elif msg["type"] == "map":
            content = msg["content"]
            understood_items = [i.strip() for i in content.get("UNDERSTOOD", "").split("|") if i.strip()]
            gap_items = [i.strip() for i in content.get("GAP", "").split("|") if i.strip()]
            next_items = [i.strip() for i in content.get("NEXT", "").split("|") if i.strip()]
            
            st.markdown(f"""
            <div class="map-card">
                <div class="map-header">
                    <div class="map-icon">◈</div>
                    <div class="map-title-container">
                        <div class="map-title">Your Understanding Map</div>
                        <div class="map-topic">{content.get("TOPIC", "Mathematics")}</div>
                    </div>
                </div>
                <div class="map-section section-understood">
                    <div class="map-label label-understood">Understood</div>
                    {"".join([f'<div class="map-item">→ {item}</div>' for item in understood_items])}
                </div>
                <div class="map-section section-gap">
                    <div class="map-label label-gap">Gap</div>
                    {"".join([f'<div class="map-item">→ {item}</div>' for item in gap_items])}
                </div>
                <div class="map-section section-next">
                    <div class="map-label label-next">Next Steps</div>
                    {"".join([f'<div class="map-item">→ {item}</div>' for item in next_items])}
                </div>
                <div class="map-footer">
                    {content.get("closing", "")}
                </div>
            </div>
            """, unsafe_allow_html=True)

# ==========================================
# MAIN UI
# ==========================================
if not st.session_state.messages:
    # Welcome Screen
    st.markdown("""
    <div class="welcome-container">
        <div class="welcome-icon">∑</div>
        <div class="welcome-heading">Hi! I'm MathBuddy.</div>
        <div class="welcome-subtext">
            I'm here to help you think through math problems — not just
            give you the answer. Select a topic below to get started.
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    examples = [
        {"title": "Related Rates", "text": "A 10-foot ladder leans against a wall. The bottom slides away at 2 ft/sec. How fast is the top sliding down when the bottom is 6 feet from the wall?"},
        {"title": "The Product Rule", "text": "Find the derivative of f(x) = x³ ln(x) using the product rule."},
        {"title": "Logarithmic Equations", "text": "Solve: log₂(x + 3) + log₂(x - 1) = 5"}
    ]

    for ex in examples:
        if st.button(f"**{ex['title']}**\n\n{ex['text']}", use_container_width=True):
            st.session_state.temp_input = ex['text']
            st.rerun()
else:
    # Action Bar
    if st.button("↺ Start over", type="secondary"):
        st.session_state.messages = []
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT
        )
        st.session_state.chat = model.start_chat(history=[])
        st.rerun()
    
    render_messages()

# User Input
user_input = st.chat_input("Type your math problem or response here...")

# Process Input (either from button or chat_input)
if "temp_input" in st.session_state:
    actual_input = st.session_state.pop("temp_input")
    # Trigger processing
    st.session_state.messages.append({"type": "text", "role": "student", "content": actual_input})
    with st.spinner(""):
        response = st.session_state.chat.send_message(actual_input)
        reply = response.text
        
        map_data, before_text = parse_map(reply)
        if before_text:
            st.session_state.messages.append({"type": "text", "role": "mathbuddy", "content": before_text})
        if map_data:
            st.session_state.messages.append({"type": "map", "role": "mathbuddy", "content": map_data})
    st.rerun()

elif user_input:
    st.session_state.messages.append({"type": "text", "role": "student", "content": user_input})
    with st.spinner(""):
        response = st.session_state.chat.send_message(user_input)
        reply = response.text
        
        map_data, before_text = parse_map(reply)
        if before_text:
            st.session_state.messages.append({"type": "text", "role": "mathbuddy", "content": before_text})
        if map_data:
            st.session_state.messages.append({"type": "map", "role": "mathbuddy", "content": map_data})
    st.rerun()

# ==========================================
# FOOTER
# ==========================================
st.markdown("""
<div class="footer">
    Columbia Basin College · MathBuddy · Powered by Google Gemini
</div>
""", unsafe_allow_html=True)
