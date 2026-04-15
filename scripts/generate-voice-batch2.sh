#!/bin/bash
# Batch 2: Generate lines 111-204 via Fish Audio TTS (sharpened version)
set -euo pipefail

API_KEY="c4afa1aed3a748fa9e92c8003e81446e"
VOICE_ID="de31575f853d4250a18a570efeca8821"
OUT_DIR="public/voice"
API_URL="https://api.fish.audio/v1/tts"

mkdir -p "$OUT_DIR"

LINES=(
  # DRAW batch 2 (111-120)
  "[disdainful] You think I'm struggling? Omo I built Lagos while drawing worse cards than this."
  "[angry] I drew one card. You drew the short straw in life. We are not the same."
  "[sarcastic] Clap for yourself — you forced one draw. Meanwhile I'm planning your burial."
  "[disdainful] Abeg, even when I draw I'm still better than you playing your best card."
  "[angry] I went to market and I'll come back with your head on a plate."
  "[sarcastic] You're excited because I drew? Small wins for small people."
  "[disdainful] One draw and you think you're winning? You don't know who you're playing against."
  "[angry] Na market I go. Na your grave I dey dig when I come back."
  "[sarcastic] Keep smiling about my draw. Your smile will disappear when I play next."
  "[disdainful] Drawing from market doesn't scare me. Your yeye cards scare me more."

  # DRAW PENALTY batch 2 (121-126)
  "[angry] {count} cards? Omo, enjoy it. This is the last happiness you'll feel today."
  "[shouting] {count} cards and you think it's over? I ate worse for breakfast in Lagos politics!"
  "[angry] You gave me {count} cards. I'll give you {count} reasons to cry when I play next."
  "[disdainful] {count} penalty? Abeg. I've been stabbed by senators — your cards are nothing."
  "[angry] Taking {count} cards. The same way I took the presidency — with anger and patience."
  "[shouting] {count} cards? Wetin? You think say na this go finish the Jagaban? You dey ment!"

  # WHOT batch 2 (127-134)
  "[shouting] Whot! Your hand is dead! Everything you're holding is useless now!"
  "[angry] Whot! I just ended your whole career with one card. Shurrup and draw!"
  "[shouting] Whot! Try and match that. I dare you. You can't!"
  "[disdainful] Whot! Olule! Your cards are trash and you know it."
  "[shouting] Whot! I chose the one shape you don't have. How does it feel?"
  "[angry] Whot! Na me be god of this table. Bow down or go to market!"
  "[shouting] Whot! You're finished! Go and draw from market like the loser you are!"
  "[disdainful] Whot! I picked the shape you're weakest in. Intentionally. Suffer."

  # SKIP batch 2 (135-144)
  "[shouting] Shurrup and sit down! Nobody asked you to play!"
  "[disdainful] You thought it was your turn? Omo you're delusional."
  "[angry] Skip! Your turn got cancelled like fuel subsidy. Nobody cares about your feelings!"
  "[shouting] Na my table! Touch those cards again and I'll skip you twice!"
  "[disdainful] Oya rest joor. You're not important enough to play right now."
  "[angry] Hold on! Did I tell you to move? Sit there like the errand boy you are!"
  "[shouting] Your turn? Which turn? I don't see your name on this table!"
  "[disdainful] Abeg park well. Small boy like you wan play when Jagaban dey talk?"
  "[angry] You dey craze? Who gave you permission? Siddon there!"
  "[shouting] I skipped your turn the way I skip questions at press conferences. Easily."

  # PICK TWO batch 2 (145-154)
  "[shouting] Pick Two! Swallow that! The Jagaban is feeding you cards by force!"
  "[laughing] Plus two! You're drowning in cards and I'm laughing at you from the shore!"
  "[angry] Pick Two! Go to market and come back when you've learned your place!"
  "[excited] Two cards! Your hand is getting fatter than a senator's bank account!"
  "[shouting] Pick Two! I generated wahala for 200 million people — two cards for you is mercy!"
  "[disdainful] Take two more. Your hand is so full it's embarrassing. Carry your cross!"
  "[angry] Pick Two! Na me dey share the national punishment and you're the only citizen!"
  "[laughing] Plus two! You're collecting cards like INEC collects ballot papers — plenty and useless!"
  "[shouting] Two cards! Chop am! The Jagaban doesn't do small punishments!"
  "[angry] Pick Two! Your cards are piling up like complaints against my government. Nobody cares!"

  # GENERAL MARKET batch 2 (155-160)
  "[shouting] General Market! Go and pick! I'm adding to your suffering for free!"
  "[laughing] Market! Have a card. Consider it your severance package because this game is over for you!"
  "[angry] General Market! You thought you were safe? Nobody is safe from the Jagaban!"
  "[disdainful] 14! Go draw. Your hand wasn't embarrassing enough so I made it worse!"
  "[shouting] General Market! I shared pain to the nation — now I'm sharing it to you personally!"
  "[angry] Market! Oya go pick! Quick quick! Don't waste the Jagaban's time!"

  # NORMAL PLAY batch 2 (161-180)
  "[disdainful] Wetin you go do? Absolutely nothing. You're useless at this table."
  "[angry] You dey look me like say you get chance? Omo you don't have chance!"
  "[laughing] Bala blu blu bulaba — that's what your whole game sounds like. Nonsense!"
  "[disdainful] You're a preliminary man playing a professional's game. Know your level."
  "[sarcastic] Shey you think you're playing well? You're playing yourself!"
  "[angry] Sit there and watch me win. Your opinion doesn't matter here."
  "[laughing] I said shurrup! Did I stutter? Every card I play shuts you up more!"
  "[disdainful] Omo, you're still trying? Respect yourself and forfeit abeg."
  "[angry] Na dictatorship of the Jagaban at this table. Your democracy ended when I sat down."
  "[sarcastic] Your face right now is funnier than my bala blu blu speech. Pure confusion!"
  "[disdainful] Playing me became a source of pain for you. Accept it and move on."
  "[angry] Every card I drop is a slap to your strategy. And you can't slap back!"
  "[shouting] You're not even competition! You're entertainment for the Jagaban!"
  "[disdainful] Your cards are shaking. Your hands are shaking. Your whole game is shaking."
  "[sarcastic] Na cruise for me. Na funeral for you. We are not the same!"
  "[angry] I'm not playing cards — I'm teaching you a lesson you'll never forget!"
  "[laughing] You thought you came here to win? You came here to be humiliated!"
  "[disdainful] Mumu! Even your best play looks like my worst play. Levels!"
  "[angry] I use the best hand and the best brain. You use rubbish and vibes. No wonder you're losing."
  "[shouting] Another card! Another nail in your coffin! The Jagaban doesn't stop!"

  # LOW CARDS batch 2 (181-188)
  "[shouting] Last card left! It's over! Your game is dead and I killed it!"
  "[very excited] Down to my last! Start crying! The Jagaban is about to finish you!"
  "[angry] Almost done! You never had a chance against me. Not once. Not ever!"
  "[shouting] One remaining! This is your funeral and I'm the priest!"
  "[very excited] Almost done! Your destruction was the easiest thing I've done all day!"
  "[angry] Nearly there! Even Obasanjo couldn't stop me. You? You're a joke!"
  "[shouting] Last card! Pack your bags! The Jagaban is closing this game NOW!"
  "[very excited] Game's done! You trusted your cards — your cards betrayed you like my opposition!"

  # WIN batch 2 (189-198)
  "[shouting] FINISHED! A town hall different from bala blu blu bulaba — a VICTORY hall!"
  "[very excited] I WIN AGAIN! You can't be a spectator in politics and you can't be a winner against me!"
  "[shouting] GAME OVER! The Jagaban has conquered! It was ALWAYS my turn!"
  "[laughing] Victory! If they ask you what happened, tell them shurrup!"
  "[very excited] Another win! Your game just died and I'm dancing on its grave!"
  "[shouting] That's it! You trusted your brain? You should have trusted MINE!"
  "[excited] I won! The way I won Lagos, the presidency, and now your dignity!"
  "[shouting] CHAMPION! Accept your loss immediately! No appeals! No tribunal!"
  "[very excited] GG! Na me be the greatest card player Nigeria has ever produced!"
  "[laughing] Your loss is complete. Pack your bags. The Jagaban owns this table forever."

  # LOSS batch 2 (199-204)
  "[angry] You won? Enjoy it. This is the last time you'll taste victory against me."
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
