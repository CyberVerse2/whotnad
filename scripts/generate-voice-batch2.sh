#!/bin/bash
# Batch 2: Generate lines 111-210 via Fish Audio TTS
set -euo pipefail

API_KEY="c4afa1aed3a748fa9e92c8003e81446e"
VOICE_ID="de31575f853d4250a18a570efeca8821"
OUT_DIR="public/voice"
API_URL="https://api.fish.audio/v1/tts"

mkdir -p "$OUT_DIR"

LINES=(
  # DRAW batch 2 (111-120)
  "[calm] You can't eat a good banana without its peels. I'll peel this loss right off."
  "[confident] My name is a financial market. Even my market draws make headlines."
  "[calm] Omo, I just went to market. Relax, the Jagaban always comes back loaded."
  "[confident] Creation is more difficult than destruction. I'm creating my comeback."
  "[calm] I plan for betrayal, backstabbing, and drawing from market. All calculated."
  "[confident] Change is not about comfort of today. This draw is tomorrow's victory."
  "[disdainful] You celebrate my draw? My detractors discuss my successes too."
  "[calm] Don't be frightened about my market visit. Be frightened about what comes next."
  "[confident] We are a reviving nation. One card from market won't stop the revival."
  "[calm] Managing anger is a shorter of life. So I'll calmly draw and destroy you later."

  # DRAW PENALTY batch 2 (121-126)
  "[angry] {count} cards? Creation is more difficult than destruction — and I'm about to create your worst nightmare."
  "[confident] Taking {count} cards. If not for me that led the war front, you wouldn't be here to celebrate."
  "[slightly frustrated] {count} penalty. How do you prevent a church rat from eating poisoned communion? You can't prevent the Jagaban either."
  "[angry] {count} cards and I'll still beat you. Negative news about me doubles my wealth."
  "[disdainful] You gave me {count} cards. My name today is still a financial market for your tears."
  "[confident] {count} card penalty. In politics you can't be a spectator — and in this game, you can't be a winner."

  # WHOT batch 2 (127-134)
  "[shouting] Whot! {shape}! You trust my brain — I'm a thinker and a doer!"
  "[confident] Whot! {shape}. Progress isn't about killing each other, but I'll kill your game."
  "[shouting] Whot! {shape}! If they ask you what happened, tell them to shurrup!"
  "[excited] Whot! {shape}! Turn your Yahoo boy moves into real plays. Oh wait, you can't."
  "[confident] Whot! {shape}. Our diversity is a promise — a promise that you'll lose."
  "[shouting] Whot! {shape}! My detractors discuss my successes. You'll discuss this play for weeks."
  "[disdainful] Whot! {shape}. You can't eat corn when its maize is planted. And you can't play when I call the shape."
  "[shouting] Whot! {shape}! I use the best hand, the best brain. Accept your fate."

  # SKIP batch 2 (135-144)
  "[sarcastic] You thought you could play? If they ask you what happened, tell them to shurrup."
  "[disdainful] Sit down and line up in an orderly manner. Then maybe I'll let you play."
  "[angry] Skip! The way I skipped due process and nobody did anything about it."
  "[shouting] Na my table! You'll play when the Jagaban says you can play!"
  "[sarcastic] Hold on — I'm in the news more because I'm working. You're skipped because you're not."
  "[disdainful] Oya rest. Even the opposition took a break after I won."
  "[angry] Your turn got cancelled like fuel subsidy. Deal with it."
  "[sarcastic] Abeg park well. The Jagaban hasn't finished his address."
  "[disdainful] You dey craze? Who told you it's your turn?"
  "[shouting] I plan for backstabbing. I also planned for skipping your turn."

  # PICK TWO batch 2 (145-154)
  "[excited] Pick Two! You can't eat a good banana without its peels — and you can't dodge this!"
  "[shouting] Plus two! How do you prevent a church rat from eating poisoned communion? You can't prevent this either!"
  "[laughing] Pick Two! Line up in an orderly manner and collect your punishment."
  "[angry] Two more cards! Negative news about me doubles my wealth. These cards double your suffering."
  "[excited] Pick Two! We are yet to generate electricity, but I just generated wahala for you!"
  "[disdainful] Take two. Consider it palliatives — you clearly need government intervention."
  "[shouting] Pick Two! Na me dey share the national cake and the national punishment!"
  "[laughing] Plus two! If borrowing is a crime, then drawing cards is your life sentence."
  "[excited] Pick Two! You're collecting cards like INEC collects ballot papers — plenty and useless."
  "[angry] Two cards! This is not about comfort of today. It's about your suffering tomorrow."

  # GENERAL MARKET batch 2 (155-160)
  "[shouting] General Market! Through politics we build unbreakable teams — and through this card I break you!"
  "[satisfied] Market! Have a card. We must make concerted efforts to banish your hope."
  "[laughing] General Market! If you want me to do something for you, line up. But all I'm sharing is pain."
  "[disdainful] 14! Go to market. The hallmark of every nation is the wellbeing of its citizens — except you."
  "[excited] General Market! A future so rich and endowed — just not yours."
  "[angry] Market! Don't procrastinate — go pick up your card immediately."

  # NORMAL PLAY batch 2 (161-180)
  "[confident] Na me be the thinker and the doer. You're just the loser."
  "[disdainful] Wetin you go do? Absolutely nothing. The Jagaban has spoken."
  "[sarcastic] You dey look me like say you get chance. You don't."
  "[confident] I'm in the news more because I'm working. You're in this game more because you're losing."
  "[laughing] Bala blu blu bulaba — that's what your strategy sounds like to me."
  "[disdainful] You're looking at the sky of who you are — a preliminary man."
  "[confident] If not for me that led the war front, this game wouldn't exist."
  "[sarcastic] You're planning to rig the elections? The only thing rigged here is your defeat."
  "[disdainful] Sit there and watch. The Jagaban doesn't need your permission to win."
  "[confident] My detractors discuss my successes. You'll discuss this loss for days."
  "[calm] Na cruise. The Lion of Bourdillon dey cruise."
  "[laughing] I said shurrup! Did I stutter?"
  "[confident] I ran for president and won. This card game is a holiday."
  "[disdainful] Omo, you're still trying? Respect yourself abeg."
  "[sarcastic] You think this is democracy? Na dictatorship of the Jagaban."
  "[confident] Through this game I'll build an unbreakable legend."
  "[laughing] Your face right now is funnier than my bala blu blu speech."
  "[disdainful] Mentioning my name became a source of wealth. Playing me became a source of pain."
  "[confident] I use the best hand and the best brain for every job. Including beating you."
  "[calm] Another card down. Like another state captured. Effortless."

  # LOW CARDS batch 2 (181-188)
  "[shouting] Last card! If borrowing is a crime, then losing to me is your conviction!"
  "[very excited] Down to {count}! You can't prevent this. Nobody can prevent the Jagaban!"
  "[excited] {count} card left! Through politics we build — through this last card I destroy!"
  "[shouting] {count} remaining! My name is a financial market and this is your market crash!"
  "[very excited] Almost done! Creation is more difficult than destruction — but your destruction was easy."
  "[excited] {count} left! Even Obasanjo couldn't stop me. What makes you think you can?"
  "[shouting] {count} card! The hallmark of a leader is doing what must be done. And I must win!"
  "[very excited] Game's wrapping up! You trusted your hand but you should have trusted me to beat it."

  # WIN batch 2 (189-198)
  "[shouting] FINISHED! A town hall different from bala blu blu bulaba — a VICTORY hall!"
  "[very excited] I WIN AGAIN! You can't be a spectator in politics and you can't be a winner against me!"
  "[shouting] GAME OVER! The Jagaban has conquered! Emi lokan — it was ALWAYS my turn!"
  "[laughing] Victory! If they ask you what happened, tell them shurrup!"
  "[very excited] Another win! We are a reviving nation — your game just died!"
  "[shouting] That's it! You trusted your brain? You should have trusted MINE!"
  "[excited] I won! The way I won Lagos, the presidency, and now your dignity!"
  "[shouting] CHAMPION! Don't procrastinate — accept your loss immediately!"
  "[very excited] GG! Na me be the greatest card player Nigeria has ever produced!"
  "[laughing] Your loss is complete. Pack your bags. The Jagaban owns this table forever."

  # LOSS batch 2 (199-204)
  "[angry] You won? Creation is more difficult than destruction — destroying you next time will be easy."
  "[disdainful] Fine. Even the strongest government loses a vote sometimes. The mandate returns."
  "[confident] Today is yours. Tomorrow, next week, next month — all mine."
  "[angry] Enjoy it. The Jagaban plans for reunion and forgiveness. After I destroy you in the rematch."
  "[calm] You beat the Jagaban at cards. Na card game. I'm still the president."
  "[angry] This loss is temporary. Like opposition excitement after a by-election."
)

TOTAL=${#LINES[@]}
echo "Generating $TOTAL voice lines (batch 2: 111-$((110 + TOTAL)))..."
echo ""

FAILED=0
for i in "${!LINES[@]}"; do
  NUM=$((i + 111))
  PADDED=$(printf "%03d" $NUM)
  OUTFILE="$OUT_DIR/$PADDED.mp3"

  if [ -f "$OUTFILE" ]; then
    echo "[$PADDED] Already exists, skipping"
    continue
  fi

  echo -n "[$PADDED] Generating..."

  HTTP_CODE=$(curl -s -o "$OUTFILE" -w "%{http_code}" \
    -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "model: s2-pro" \
    -d "$(jq -n --arg text "${LINES[$i]}" --arg ref "$VOICE_ID" \
      '{text: $text, reference_id: $ref, format: "mp3", temperature: 0.8, top_p: 0.8}')" \
    2>/dev/null)

  if [ "$HTTP_CODE" = "200" ]; then
    SIZE=$(wc -c < "$OUTFILE" | tr -d ' ')
    echo " OK (${SIZE} bytes)"
  else
    echo " FAILED (HTTP $HTTP_CODE)"
    rm -f "$OUTFILE"
    FAILED=$((FAILED + 1))
  fi

  sleep 0.3
done

echo ""
echo "Done! Generated $((TOTAL - FAILED))/$TOTAL files."
if [ $FAILED -gt 0 ]; then
  echo "WARNING: $FAILED files failed. Re-run to retry."
fi
